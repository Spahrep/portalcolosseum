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
 *
 * Rolls come only from generate_weapon / generate_consumable_instance.
 * Stock calls them with p_persist false and stores that roll. Buy calls them
 * again with p_spec set to the stored roll, so the granted row is the card.
 */

// --- config reads ---
const DEFAULT_CFG = {
  reroll_base_price: 10,
  reroll_price_multiplier: 2.0,
  ap_reset_cost: 10,
  sell_recovery_rate: 0.42,
  shop_refresh_hour: 0,
  consumable_price_multiplier: 0.22,
};

async function getConfig(admin) {
  try {
    const { data } = await admin.from('game_config')
      .select('reroll_base_price, reroll_price_multiplier, ap_reset_cost, sell_recovery_rate, shop_refresh_hour')
      .eq('id', 1).maybeSingle();
    if (data) return { ...DEFAULT_CFG, ...data };
  } catch (e) { /* fall through */ }
  return DEFAULT_CFG;
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
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
// Attack id from a generate_weapon slot object. Does not roll or recompute stats.
function attackId(row) {
  if (row && row.id != null && row.id !== '') return Number(row.id);
  return null;
}

// Map a generate_weapon roll (p_persist false) onto a shop_stock row.
async function rollWeaponFromGenerator(admin, tmpl) {
  const res = await admin.rpc('generate_weapon', {
    p_template_id: tmpl.id,
    p_user_id: null,
    p_spec: null,
    p_persist: false,
  });
  if (!res || res.error) throw res?.error || new Error('generate_weapon failed');
  const roll = res.data;
  if (!roll || roll.damage == null || roll.tier == null) {
    throw new Error('generate_weapon returned no roll');
  }
  return {
    kind: 'weapon',
    template_id: tmpl.id,
    name: tmpl.name,
    damage: roll.damage,
    speed: roll.speed,
    accuracy: roll.accuracy,
    crit_chance: roll.crit_chance,
    quality_multiplier: roll.quality_multiplier,
    tier: roll.tier,
    base_price: Number(tmpl.base_price) || 45,
    slot_0_attack_id: roll.slot_0_attack_id ?? attackId(roll.slot_0_attack),
    slot_1_attack_id: roll.slot_1_attack_id ?? attackId(roll.slot_1_attack),
    slot_2_attack_id: roll.slot_2_attack_id ?? attackId(roll.slot_2_attack),
    slot_3_attack_id: roll.slot_3_attack_id ?? attackId(roll.slot_3_attack),
    slot_4_attack_id: roll.slot_4_attack_id ?? attackId(roll.slot_4_attack),
  };
}

function weaponSpecFromStock(item) {
  return {
    damage: item.damage,
    speed: item.speed,
    accuracy: item.accuracy,
    crit_chance: item.crit_chance,
    quality_multiplier: item.quality_multiplier,
    tier: item.tier,
    slot_0_attack_id: item.slot_0_attack_id ?? null,
    slot_1_attack_id: item.slot_1_attack_id ?? null,
    slot_2_attack_id: item.slot_2_attack_id ?? null,
    slot_3_attack_id: item.slot_3_attack_id ?? null,
    slot_4_attack_id: item.slot_4_attack_id ?? null,
  };
}

// Map a generate_consumable_instance roll (p_persist false) onto a shop_stock row.
async function rollConsumableFromGenerator(admin, tmpl) {
  const res = await admin.rpc('generate_consumable_instance', {
    p_template_id: tmpl.id,
    p_user_id: null,
    p_spec: null,
    p_persist: false,
  });
  if (!res || res.error) throw res?.error || new Error('generate_consumable_instance failed');
  const roll = res.data;
  if (!roll || roll.rolled_floor == null || (roll.tier == null && roll.grade == null)) {
    throw new Error('generate_consumable_instance returned no roll');
  }
  return {
    kind: 'consumable',
    template_id: tmpl.id,
    name: tmpl.name,
    rolled_floor: roll.rolled_floor,
    rolled_window: roll.rolled_window,
    rolled_speed: roll.rolled_speed,
    crit_chance: roll.crit_chance,
    tier: roll.tier || roll.grade,
    quality_multiplier: roll.quality_multiplier,
    // Notional weapon-relative base. The consumable discount is applied in decorateStock.
    base_price: 45,
  };
}

function consumableSpecFromStock(item) {
  return {
    rolled_floor: item.rolled_floor,
    rolled_window: item.rolled_window,
    rolled_speed: item.rolled_speed,
    crit_chance: item.crit_chance,
    grade: item.tier,
    tier: item.tier,
    quality_multiplier: item.quality_multiplier,
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
    const item = await rollWeaponFromGenerator(admin, t);
    stock.push({ slot, ...item });
  }
  // 2 potions (slots 3-4)
  for (let slot = 3; slot <= 4; slot++) {
    const t = consumables.length ? consumables[Math.floor(Math.random() * consumables.length)] : null;
    if (!t) continue;
    const item = await rollConsumableFromGenerator(admin, t);
    stock.push({ slot, ...item });
  }
  return stock;
}

// persist a rolled stock for the player for today
async function persistStock(admin, userId, stock) {
  const today = utcToday();
  const rows = [];
  for (const s of stock) {
    rows.push({
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
      slot_0_attack_id: s.slot_0_attack_id ?? null,
      slot_1_attack_id: s.slot_1_attack_id ?? null,
      slot_2_attack_id: s.slot_2_attack_id ?? null,
      slot_3_attack_id: s.slot_3_attack_id ?? null,
      slot_4_attack_id: s.slot_4_attack_id ?? null,
    });
  }
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

// decorate persisted stock rows into the API contract shape.
// Async: for weapons, the persisted slot attack ids are hydrated into a full
// attacks array so the card can show every attack the buyer will receive.
async function decorateStock(rows, cfg, admin) {
  const weaponIds = new Set();
  for (const r of rows) {
    if (r.kind === 'weapon') {
      for (const key of ['slot_0_attack_id', 'slot_1_attack_id', 'slot_2_attack_id', 'slot_3_attack_id', 'slot_4_attack_id']) {
        if (r[key]) weaponIds.add(Number(r[key]));
      }
    }
  }
  const attackById = {};
  if (weaponIds.size && admin) {
    const { data: attackRows } = await admin.from('attack')
      .select('id,name,description,base_damage_multiplier,base_damage_multiplier_range,crit_multiplier,prepare_time_multiplier,cooldown_time_multiplier,is_multi_target')
      .in('id', [...weaponIds]);
    (attackRows || []).forEach(a => { attackById[Number(a.id)] = a; });
  }
  return Promise.all(rows.map(async r => {
    const qm = Number(r.quality_multiplier) || 1;
    let buy = buyPriceOf(Number(r.base_price) || 45, qm);
    if (r.kind === 'consumable') {
      const mult = Number(cfg?.consumable_price_multiplier) || 0.22;
      buy = Math.round(buy * mult);
    }
    const name = r.name || r.weapon_template?.name || 'Unknown';
    if (r.kind === 'weapon') {
      const attacks = [];
      for (let i = 0; i <= 4; i++) {
        const idKey = `slot_${i}_attack_id`;
        const aid = Number(r[idKey]);
        if (aid && attackById[aid]) attacks.push(attackById[aid]);
      }
      return {
        slot: r.slot, kind: 'weapon', template_id: r.template_id, name,
        tier: r.tier, quality_multiplier: Number(r.quality_multiplier), buy_price: buy,
        damage: r.damage, speed: r.speed, accuracy: r.accuracy, crit_chance: r.crit_chance,
        attack_count: attacks.length,
        attacks,
      };
    }
    return {
      slot: r.slot, kind: 'consumable', template_id: r.template_id, name,
      tier: r.tier, quality_multiplier: Number(r.quality_multiplier), buy_price: buy,
      rolled_floor: r.rolled_floor, rolled_window: r.rolled_window,
    };
  }));
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
      stock: await decorateStock(stockRows, cfg, admin),
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
        // Buyer-fraud fix: grant EXACTLY the shown roll — the RPC re-rolls stats
        // independently, so overwrite the fresh instance with the stock-displayed
        // damage/speed/accuracy/crit/qm/tier (what the GET /shop card showed).
        const upd = await admin.from('weapon_instance')
          .update({
            damage: item.damage,
            speed: item.speed,
            accuracy: item.accuracy,
            crit_chance: item.crit_chance,
            quality_multiplier: item.quality_multiplier,
            tier: item.tier,
            grade: item.tier,
            // grant EXACTLY the stock-displayed slot attacks (display is a promise)
            slot_0_attack_id: item.slot_0_attack_id ?? null,
            slot_1_attack_id: item.slot_1_attack_id ?? null,
            slot_2_attack_id: item.slot_2_attack_id ?? null,
            slot_3_attack_id: item.slot_3_attack_id ?? null,
            slot_4_attack_id: item.slot_4_attack_id ?? null,
          })
          .eq('id', instanceId);
        if (upd.error) throw upd.error;
      } else {
        const rpcRes = await admin.rpc('generate_consumable_instance', { p_template_id: item.template_id, p_user_id: userId });
        if (rpcRes.error) throw rpcRes.error;
        const cid = rpcRes.data && (rpcRes.data.id ?? rpcRes.data);
        if (!cid) throw new Error('generate_consumable_instance returned no id');
        instanceId = cid;
        // grant EXACTLY the shown roll for consumables too (same re-roll mismatch)
        const upd = await admin.from('consumable_instance')
          .update({
            rolled_floor: item.rolled_floor,
            rolled_window: item.rolled_window,
            rolled_speed: item.rolled_speed,
            crit_chance: item.crit_chance,
            grade: item.tier,
          })
          .eq('id', instanceId);
        if (upd.error) throw upd.error;
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
    return json({ ok: true, stock: await decorateStock(fresh, cfg, admin), reroll_cost: nextCost, new_gold: gold - rerollCost });
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