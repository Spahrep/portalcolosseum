/**
 * /api/combat/shop.js — Weapon shop leaf module (PC-DEC-074/076).
 * Imported by api/combat/[...path].js, mirroring ./dev/[...path].js.
 *
 * Routes:
 *   GET  /shop                 — lazy daily refresh + return stock/prices/gold/ap/reroll_cost
 *   POST /shop/buy   {slot}    — deduct gold, grant an owned instance
 *   POST /shop/sell  {instance_id} — grant gold (sell formula), delete the instance
 *   POST /shop/reroll          — deduct gold, re-roll stock, increment reroll counter
 *   POST /shop/ap-reset        — deduct AP, reset reroll counter to 0
 *
 * Pricing (PC-DEC-076 + continuous premium curve): buy  = round(tmpl.base_price * priceFactor(qm) * 1.40) for weapons;
 *                                       buy  = round(tmpl.base_price * priceFactor(qm) * 1.40 * cfg.consumable_price_multiplier) for consumables (default 0.22).
 *                                       sell = round(tmpl.base_price * priceFactor(qm) * 0.42) for weapons only.
 * priceFactor(qm) is a single continuous monotonic curve across ALL qm — no flat par floor, no tier step.
 * E/D/C rise gently off ~0.78, curve steepens hard through B/A/S (B ~1.5x, A ~2.3x, S ~3.1x a C at entry),
 * reaching ~4.8x at the S cap. Slope carries the premium, so every tier is on the curve
 * (Spahrep 2026-10-26: "they are all on a curve"; supersedes PC-DEC-076's flat low tiers + no-tier-jump).
 *
 * Stock is per-player, rolled lazily on shop open when the UTC date changes.
 * Same lazy pattern as api/lib/ap-daily.js (no cron — fires on screen switch).
 *
 * Tier gating: shop weapons are gated to templates mapped in portal_loot_mapping
 * for portals <= the player's best unlocked portal (Spahrep 2026-10-21).
 */

// --- config reads ---
const DEFAULT_CFG = {
  reroll_base_price: 50,
  reroll_price_multiplier: 2.0,
  ap_reset_cost: 10,
  sell_recovery_rate: 0.42,
  shop_refresh_hour: 0,
  consumable_price_multiplier: 0.22,
};

async function getConfig(admin) {
  try {
    const { data } = await admin.from('game_config')
      .select('reroll_base_price, reroll_price_multiplier, ap_reset_cost, sell_recovery_rate, shop_refresh_hour, consumable_price_multiplier')
      .eq('id', 1).maybeSingle();
    if (data) return { ...DEFAULT_CFG, ...data };
  } catch (e) { /* fall through */ }
  return DEFAULT_CFG;
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

// Box-Muller normal_int — mirrors public.normal_int(base, range) in SQL so shop
// rolls match generate_weapon's distribution exactly.
function normalInt(base, range) {
  const b = Number(base) || 1;
  const r = Number(range) || 0;
  if (r === 0) return b;
  const mean = b;
  const stddev = r / 3.0;
  const low = mean - r;
  const high = mean + r;
  let u1 = Math.random();
  while (u1 === 0) u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const res = mean + stddev * z0;
  return Math.round(Math.min(high, Math.max(low, res)));
}

// compute quality_multiplier + tier from rolled stats (matches generate_weapon PC-DEC-076)
function qualityFor(tmpl, damage, speed, accuracy, crit) {
  const powerScore = damage * (100.0 / speed) * (accuracy / 100.0) * (1.0 + (crit / 100.0));
  const basePower = tmpl.base_damage * (100.0 / tmpl.base_speed) * (tmpl.base_accuracy / 100.0) * 1.05;
  const qm = Math.pow(Math.max(powerScore / basePower, 0.25), 0.78);
  const tier = qm >= 1.11 ? 'S' : qm >= 1.075 ? 'A' : qm >= 1.04 ? 'B' : qm >= 0.985 ? 'C' : qm >= 0.94 ? 'D' : 'E';
  return { quality_multiplier: Math.round(qm * 10000) / 10000, tier };
}

// Continuous price curve over the whole qm range (supersedes PC-DEC-076).
// Mirrors public.price_factor(qm) in the price_factor RPC — keep BOTH byte-identical.
// "They are all on a curve" (Spahrep 2026-10-26): no flat par for low tiers and no
// tier step — E/D/C rise gently, then the curve steepens hard through B/A/S so the
// premium the label carries comes from slope, not a jump. Strictly monotonic in qm.
const PF_ANCH = [  // (qm, factor)
  [0.80, 0.78],
  [0.90, 0.90],
  [0.94, 0.95],
  [0.985, 1.00],
  [1.00, 1.03],
  [1.04, 1.55],
  [1.055, 1.90],
  [1.075, 2.30],
  [1.09, 2.60],
  [1.11, 3.30],
  [1.15, 3.90],
  [1.23, 5.20],
  [1.30, 5.80],
];
function priceFactor(qm) {
  const q = Math.max(qm, PF_ANCH[0][0]);
  for (let i = 0; i < PF_ANCH.length - 1; i++) {
    const [x0, y0] = PF_ANCH[i];
    const [x1, y1] = PF_ANCH[i + 1];
    if (q <= x1) return y0 + (q - x0) / (x1 - x0) * (y1 - y0);
  }
  return PF_ANCH[PF_ANCH.length - 1][1];
}
function buyPriceOf(basePrice, qm) {
  return Math.round(basePrice * priceFactor(qm) * 1.40);
}
function sellPriceOf(basePrice, qm, rate) {
  return Math.round(basePrice * priceFactor(qm) * rate);
}

// roll one weapon stock item from a template (does NOT persist)
function rollWeaponStock(tmpl) {
  const damage = Math.max(1, normalInt(tmpl.base_damage, tmpl.damage_range));
  const speed = Math.max(1, normalInt(tmpl.base_speed, tmpl.speed_range));
  const accuracy = Math.max(0, normalInt(tmpl.base_accuracy, tmpl.accuracy_range));
  const crit = (Number(tmpl.crit_range) || 0) <= 0
    ? Math.max(0, Number(tmpl.crit_base) || 5)
    : Math.max(0, (Number(tmpl.crit_base) || 5)
        + Math.floor(Math.random() * (tmpl.crit_range * 2 + 1)) - tmpl.crit_range);
  const { quality_multiplier, tier } = qualityFor(tmpl, damage, speed, accuracy, crit);
  const basePrice = Number(tmpl.base_price) || 45;
  return {
    kind: 'weapon',
    template_id: tmpl.id,
    damage, speed, accuracy, crit_chance: crit,
    quality_multiplier, tier, base_price: basePrice,
  };
}

// roll one consumable stock item (floor/window model) — does NOT persist
function rollConsumableStock(tmpl) {
  const floor = Math.max(1, Number(tmpl.floor_base) + Math.floor(Math.random() * ((Number(tmpl.floor_delta) || 0) + 1)));
  const window = Math.max(1, Number(tmpl.window_base) + Math.floor(Math.random() * ((Number(tmpl.window_delta) || 0) + 1)));
  const speed = Math.max(1, Number(tmpl.speed_base) + Math.floor(Math.random() * ((Number(tmpl.speed_delta) || 0) + 1)));
  const crit = (Number(tmpl.crit_range) || 0) <= 0
    ? Math.max(0, Number(tmpl.crit_base) || 0)
    : Math.max(0, (Number(tmpl.crit_base) || 0)
        + Math.floor(Math.random() * (tmpl.crit_range * 2 + 1)) - tmpl.crit_range);
  // consumable tier from EV/sigma vs template (matches generate_consumable_instance)
  const expEV = Number(tmpl.floor_base) + (Number(tmpl.floor_delta) / 2) + ((Number(tmpl.window_base) + Number(tmpl.window_delta)) / 2) / 2;
  const sigma = Math.max((Number(tmpl.window_base) + Number(tmpl.window_delta)) / 2, 1);
  const z = ((floor + window / 2) - expEV) / sigma;
  const grade = z >= 3 ? 'S' : z >= 2 ? 'A' : z >= 1 ? 'B' : z >= 0 ? 'C' : z >= -1 ? 'D' : z >= -2 ? 'E' : 'F';
  const basePrice = 45; // notional weapon-relative base; actual consumable discount applied in decorateStock via cfg.consumable_price_multiplier
  const qm = Math.pow(Math.max((floor + window / 2) / Math.max(expEV, 1), 0.25), 0.78);
  return {
    kind: 'consumable',
    template_id: tmpl.id,
    rolled_floor: floor,
    rolled_window: window,
    rolled_speed: speed,
    crit_chance: crit,
    tier: grade,
    quality_multiplier: Math.round(qm * 10000) / 10000,
    base_price: basePrice,
    _expEV: expEV,
  };
}

// Determine the player's best unlocked portal (mirrors /portals PC-75 logic):
// Portal 1 always unlocked; N>1 requires a completed run on portal N-1.
// (Gold-unlock purchase not yet implemented, so today that means Portal 1 only —
// but the chain logic is future-proof for when gold unlocks ship.)
async function bestUnlockedPortal(admin, userId) {
  try {
    const { data: completedRuns } = await admin.from('portal_run')
      .select('portal_template_id')
      .eq('user_id', userId)
      .eq('status', 'completed');
    const completedIds = new Set((completedRuns || []).map(r => r.portal_template_id));
    // highest portal id whose predecessor is completed (or id 1)
    let best = 1;
    for (let id = 2; id <= 20; id++) {
      if (completedIds.has(id - 1)) best = id;
      else break;
    }
    return best;
  } catch (e) {
    return 1;
  }
}

// roll a full 4-slot stock: 2 weapons + 2 potions.
// Weapons are gated to templates mapped to portals <= maxPortalId (tier gating).
async function rollStock(admin, maxPortalId = 1) {
  const [wRes, cRes, lootRes] = await Promise.all([
    admin.from('weapon_template').select('id,name,base_damage,damage_range,base_speed,speed_range,base_accuracy,accuracy_range,crit_base,crit_range,base_price').order('id'),
    admin.from('consumable_template').select('id,name,floor_base,floor_delta,window_base,window_delta,speed_base,speed_delta,crit_base,crit_range').order('id'),
    admin.from('portal_loot_mapping').select('weapon_template_id').lte('portal_template_id', maxPortalId),
  ]);
  if (wRes.error) throw wRes.error;
  if (cRes.error) throw cRes.error;
  if (lootRes.error) throw lootRes.error;
  const allWeapons = wRes.data || [];
  const consumables = cRes.data || [];
  // tier gate: only weapons mapped to portals <= maxPortalId are shop-eligible
  const gatedIds = new Set((lootRes.data || []).map(r => r.weapon_template_id));
  const weapons = allWeapons.filter(w => gatedIds.has(w.id));
  const stock = [];
  // 2 weapons (slots 1-2)
  for (let slot = 1; slot <= 2; slot++) {
    const t = weapons.length ? weapons[Math.floor(Math.random() * weapons.length)] : null;
    if (!t) continue;
    stock.push({ slot, ...rollWeaponStock(t), name: t.name });
  }
  // 2 potions (slots 3-4)
  for (let slot = 3; slot <= 4; slot++) {
    const t = consumables.length ? consumables[Math.floor(Math.random() * consumables.length)] : null;
    if (!t) continue;
    stock.push({ slot, ...rollConsumableStock(t), name: t.name });
  }
  return stock;
}

// persist a rolled stock for the player for today
async function persistStock(admin, userId, stock) {
  const today = utcToday();
  const rows = stock.map(s => ({
    user_id: userId,
    slot: s.slot,
    kind: s.kind,
    template_id: s.template_id,
    name: s.name ?? null,
    stock_date: today,
    damage: s.damage ?? null,
    speed: s.speed ?? null,
    accuracy: s.accuracy ?? null,
    crit_chance: s.crit_chance ?? null,
    quality_multiplier: s.quality_multiplier ?? null,
    tier: s.tier ?? null,
    rolled_floor: s.rolled_floor ?? null,
    rolled_window: s.rolled_window ?? null,
    rolled_speed: s.rolled_speed ?? null,
  }));
  await admin.from('shop_stock').delete().eq('user_id', userId).eq('stock_date', today);
  if (rows.length) await admin.from('shop_stock').insert(rows);
  await admin.from('profiles')
    .update({ shop_stock_date: today, shop_reroll_count: 0 })
    .eq('id', userId);
  return stock;
}

// load today's persisted stock (or null)
async function loadStock(admin, userId, today) {
  const { data } = await admin.from('shop_stock')
    .select('*').eq('user_id', userId).eq('stock_date', today).order('slot');
  if (!data || !data.length) return null;
  return data;
}

// ensure the player has fresh stock for today (lazy daily refresh)
async function ensureStock(admin, userId) {
  const today = utcToday();
  const { data: prof } = await admin.from('profiles').select('shop_stock_date').eq('id', userId).maybeSingle();
  if (prof && prof.shop_stock_date === today) {
    const existing = await loadStock(admin, userId, today);
    if (existing) return { stock: existing, fresh: false };
  }
  const maxPortal = await bestUnlockedPortal(admin, userId);
  const stock = await rollStock(admin, maxPortal);
  await persistStock(admin, userId, stock);
  return { stock, fresh: true };
}

async function getGoldAp(admin, userId) {
  const { data } = await admin.from('profiles').select('gold, ap').eq('id', userId).maybeSingle();
  return { gold: Number(data?.gold) || 0, ap: Number(data?.ap) || 0 };
}

async function countWeapons(admin, userId) {
  const { count } = await admin.from('weapon_instance').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return count || 0;
}

// decorate persisted stock rows into the API contract shape
function decorateStock(rows, cfg) {
  return rows.map(r => {
    const qm = Number(r.quality_multiplier) || 1;
    let buy = buyPriceOf(Number(r.base_price) || 45, qm);
    if (r.kind === 'consumable') {
      const mult = Number(cfg?.consumable_price_multiplier) || 0.22;
      buy = Math.round(buy * mult);
    }
    const name = r.name || r.weapon_template?.name || 'Unknown';
    if (r.kind === 'weapon') {
      return {
        slot: r.slot, kind: 'weapon', template_id: r.template_id, name,
        tier: r.tier, quality_multiplier: Number(r.quality_multiplier), buy_price: buy,
        damage: r.damage, speed: r.speed, accuracy: r.accuracy, crit_chance: r.crit_chance,
      };
    }
    return {
      slot: r.slot, kind: 'consumable', template_id: r.template_id, name,
      tier: r.tier, quality_multiplier: Number(r.quality_multiplier), buy_price: buy,
      rolled_floor: r.rolled_floor, rolled_window: r.rolled_window,
    };
  });
}

// --- route handlers ---
export async function handleShop({ request, path, method, admin, user, json }) {
  const userId = user.id;
  const cfg = await getConfig(admin);
  async function body() { return request.json().catch(() => ({})); }

  // GET /shop
  if (path === '/shop' && method === 'GET') {
    let stockRows;
    try {
      const { stock } = await ensureStock(admin, userId);
      stockRows = stock;
    } catch (e) {
      console.error('shop ensureStock error', e);
      return json({ error: 'Internal server error' }, 500);
    }
    const { gold, ap } = await getGoldAp(admin, userId);
    const profile = (await admin.from('profiles').select('shop_reroll_count').eq('id', userId).maybeSingle()).data;
    const rerollCount = Number(profile?.shop_reroll_count) || 0;
    const rerollCost = Math.round(cfg.reroll_base_price * Math.pow(cfg.reroll_price_multiplier, rerollCount));
    const weaponCount = await countWeapons(admin, userId);
    return json({
      stock: decorateStock(stockRows, cfg),
      reroll_cost: rerollCost,
      ap_reset_cost: cfg.ap_reset_cost,
      gold,
      ap,
      can_sell_last_weapon: weaponCount > 1,
    });
  }

  // GET /shop/inventory — caller's owned weapons with sell prices (for the sell flow)
  if (path === '/shop/inventory' && method === 'GET') {
    const { data: instances, error } = await admin.from('weapon_instance')
      .select('id, template_id, quality_multiplier, tier, damage, speed, accuracy, weapon_template:template_id (name, base_price)')
      .eq('user_id', userId).order('id');
    if (error) return json({ error: 'Internal server error' }, 500);
    const weaponCount = await countWeapons(admin, userId);
    const { gold } = await getGoldAp(admin, userId);
    const items = (instances || []).map(inst => {
      const basePrice = Number(inst.weapon_template?.base_price) || 45;
      const qm = Number(inst.quality_multiplier) || 1;
      return {
        instance_id: inst.id,
        name: inst.weapon_template?.name || 'Unknown',
        tier: inst.tier || 'C',
        quality_multiplier: Number(inst.quality_multiplier) || 1,
        damage: inst.damage, speed: inst.speed, accuracy: inst.accuracy,
        sell_price: sellPriceOf(basePrice, qm, cfg.sell_recovery_rate),
      };
    });
    return json({ items, can_sell_last_weapon: weaponCount > 1, gold });
  }

  // POST /shop/buy {slot}
  if (path === '/shop/buy' && method === 'POST') {
    const b = await body();
    const slot = parseInt(b.slot, 10);
    if (isNaN(slot) || slot < 1 || slot > 4) return json({ error: 'invalid_slot' }, 400);
    const { stock } = await ensureStock(admin, userId);
    const item = (stock || []).find(r => r.slot === slot);
    if (!item) return json({ error: 'slot_not_in_stock' }, 400);
    const { gold } = await getGoldAp(admin, userId);
    const qm = Number(item.quality_multiplier) || 1;
    const buyPrice = buyPriceOf(Number(item.base_price) || 45, qm);
    if (gold < buyPrice) return json({ error: 'insufficient_gold', need: buyPrice, have: gold }, 400);
    // grant instance
    try {
      let instanceId = null;
      if (item.kind === 'weapon') {
        const rpcRes = await admin.rpc('generate_weapon', { p_template_id: item.template_id, p_user_id: userId });
        if (rpcRes.error) throw rpcRes.error;
        if (!rpcRes.data || !rpcRes.data.id) throw new Error('generate_weapon returned no id');
        instanceId = rpcRes.data.id;
      } else {
        const rpcRes = await admin.rpc('generate_consumable_instance', { p_template_id: item.template_id, p_user_id: userId });
        if (rpcRes.error) throw rpcRes.error;
        const cid = rpcRes.data && (rpcRes.data.id ?? rpcRes.data);
        if (!cid) throw new Error('generate_consumable_instance returned no id');
        instanceId = cid;
      }
      // charge gold and remove the sold slot from today's stock so it leaves the store
      await admin.from('profiles').update({ gold: gold - buyPrice }).eq('id', userId);
      await admin.from('shop_stock').delete().eq('user_id', userId).eq('stock_date', utcToday()).eq('slot', slot);
      return json({ ok: true, instance_id: instanceId, new_gold: gold - buyPrice });
    } catch (e) {
      console.error('shop buy error', e);
      return json({ error: 'Internal server error' }, 500);
    }
  }

  // POST /shop/sell {instance_id} — atomic single-RPC sell (fast: 1 DB round-trip)
  if (path === '/shop/sell' && method === 'POST') {
    const b = await body();
    const instanceId = parseInt(b.instance_id, 10);
    if (isNaN(instanceId) || instanceId <= 0) return json({ error: 'invalid_instance_id' }, 400);
    // one RPC does ownership + no-sell-last + active-run checks, clears run FK refs,
    // deletes, and pays gold inside a single transaction.
    let rpc;
    try {
      const rpcRes = await admin.rpc('sell_weapon', {
        p_user_id: userId,
        p_instance_id: instanceId,
        p_recovery_rate: cfg.sell_recovery_rate,
      });
      if (rpcRes.error) throw rpcRes.error;
      rpc = rpcRes.data;
    } catch (e) {
      console.error('shop sell RPC error', e);
      return json({ error: 'Internal server error' }, 500);
    }
    if (!rpc || rpc.error) return json({ error: rpc?.error || 'sell_failed' }, 400);
    return json(rpc);
  }

  // POST /shop/reroll
  if (path === '/shop/reroll' && method === 'POST') {
    const { gold } = await getGoldAp(admin, userId);
    const profRes = await admin.from('profiles').select('shop_reroll_count').eq('id', userId).maybeSingle();
    const rerollCount = Number(profRes.data?.shop_reroll_count) || 0;
    const rerollCost = Math.round(cfg.reroll_base_price * Math.pow(cfg.reroll_price_multiplier, rerollCount));
    if (gold < rerollCost) return json({ error: 'insufficient_gold', need: rerollCost, have: gold }, 400);
    const maxPortal = await bestUnlockedPortal(admin, userId);
    const fresh = await rollStock(admin, maxPortal);
    await persistStock(admin, userId, fresh);
    await admin.from('profiles').update({ gold: gold - rerollCost }).eq('id', userId);
    const nextCount = rerollCount + 1;
    await admin.from('profiles').update({ shop_reroll_count: nextCount }).eq('id', userId);
    const nextCost = Math.round(cfg.reroll_base_price * Math.pow(cfg.reroll_price_multiplier, nextCount));
    return json({ ok: true, stock: decorateStock(fresh, cfg), reroll_cost: nextCost, new_gold: gold - rerollCost });
  }

  // POST /shop/ap-reset
  if (path === '/shop/ap-reset' && method === 'POST') {
    const { ap } = await getGoldAp(admin, userId);
    if (ap < cfg.ap_reset_cost) return json({ error: 'insufficient_ap', need: cfg.ap_reset_cost, have: ap }, 400);
    await admin.from('profiles').update({ ap: ap - cfg.ap_reset_cost, shop_reroll_count: 0 }).eq('id', userId);
    const rerollCost = Math.round(cfg.reroll_base_price * Math.pow(cfg.reroll_price_multiplier, 0));
    return json({ ok: true, shop_reroll_count: 0, reroll_cost: rerollCost, new_ap: ap - cfg.ap_reset_cost });
  }

  return null;
}