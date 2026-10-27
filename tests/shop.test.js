import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST, __setAdminClientForTests } from '../api/combat/[...path].js';

afterEach(() => __setAdminClientForTests(null));

// Mock admin client — mirrors the pattern in weapon-grade.test.js. The shop
// routes go through the real catch-all dispatch (GET/POST /shop*).
function mockAdmin(responder) {
  const calls = [];
  function chain(table) {
    const ctx = { table, op: null, payload: null, filters: [] };
    const api = {
      select() {
        if (ctx.op !== 'insert' && ctx.op !== 'update' && ctx.op !== 'delete') ctx.op = 'select';
        return api;
      },
      insert(payload) { ctx.op = 'insert'; ctx.payload = payload; return api; },
      update(payload) { ctx.op = 'update'; ctx.payload = payload; return api; },
      delete() { ctx.op = 'delete'; return api; },
      eq(k, v) { ctx.filters.push(['eq', k, v]); return api; },
      lte(k, v) { ctx.filters.push(['lte', k, v]); return api; },
      in(k, v) { ctx.filters.push(['in', k, v]); return api; },
      or(f) { ctx.filters.push(['or', f]); return api; },
      order() { return api; },
      limit() { return api; },
      single() { return finish(true); },
      maybeSingle() { return finish(true); },
      then(res, rej) { return finish(false).then(res, rej); },
    };
    function finish(single) {
          const snap = { table: ctx.table, op: ctx.op, payload: ctx.payload, filters: ctx.filters.map(f => [...f]), single };
          calls.push(snap);
          const result = responder(snap) || { data: null };
          if (single) {
            const data = Array.isArray(result.data) ? (result.data[0] ?? null) : (result.data ?? null);
            return Promise.resolve({ data, error: result.error || null });
          }
          return Promise.resolve({ data: result.data ?? null, error: result.error || null, count: result.count ?? null });
        }
    return api;
  }
  return {
    calls,
    from(table) { return chain(table); },
    rpc(name, args) {
      const snap = { table: 'rpc:' + name, op: 'rpc', payload: args, filters: [], single: false };
      calls.push(snap);
      const result = responder(snap) || { data: null };
      return Promise.resolve({ data: result.data ?? null, error: result.error || null });
    },
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  };
}

function req(path, method = 'GET', body = null) {
  return new Request(`https://portalcolosseum.com/api/combat${path}`, {
    method,
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Default responder: config row, empty shop_stock (forces a fresh roll), a
// profile with gold/ap, weapon templates, consumable templates, and RPC results.
// shop_stock is modeled statefully (insert persists, select replays, delete removes)
// so ensureStock reads back exactly what it rolled — mirroring the real DB.
function defaultResponder(over = {}) {
  const stockCache = [];
  const today = new Date().toISOString().slice(0, 10);
  return (snap) => {
    if (snap.table === 'game_config') return { data: { id: 1, reroll_base_price: 10, reroll_price_multiplier: 2, ap_reset_cost: 10, sell_recovery_rate: 0.42, shop_refresh_hour: 0 } };
    if (snap.table === 'profiles' && snap.op === 'select') {
      return { data: { id: 'user-1', gold: 1000, ap: 50, shop_stock_date: today, shop_reroll_count: 0 } };
    }
    if (snap.table === 'profiles' && snap.op === 'update') return { data: null };
    if (snap.table === 'shop_stock' && snap.op === 'select') return { data: [...stockCache] };
    if (snap.table === 'shop_stock' && snap.op === 'delete') {
      // delete().eq(user_id).eq(stock_date) — clear all cached rows
      stockCache.length = 0;
      return { data: null };
    }
    if (snap.table === 'shop_stock' && snap.op === 'insert') {
      const rows = Array.isArray(snap.payload) ? snap.payload : [snap.payload];
      stockCache.push(...rows.map(r => ({ ...r })));
      return { data: null };
    }
    if (snap.table === 'weapon_template') return { data: [
      { id: 3, name: 'Greatsword', base_damage: 55, damage_range: 8, base_speed: 35, speed_range: 4, base_accuracy: 82, accuracy_range: 6, crit_base: 5, crit_range: 0, base_price: 45 },
    ] };
    if (snap.table === 'portal_loot_mapping') return { data: [{ weapon_template_id: 3 }] };
    if (snap.table === 'portal_run') return { data: [] };
    if (snap.table === 'consumable_template') return { data: [
      { id: 1, name: 'Potion', floor_base: 10, floor_delta: 2, window_base: 4, window_delta: 2, speed_base: 5, speed_delta: 1, crit_base: 0, crit_range: 0 },
    ] };
    if (snap.table === 'weapon_instance' && snap.op === 'select') return { data: [] };
    if (snap.table === 'weapon_instance' && snap.op === 'delete') return { data: null };
    if (snap.table === 'rpc:generate_weapon') {
      // Single-generator contract: full pre-rolled spec on a p_persist=false call
      // (stock time). Return a complete, stable roll so buy-grant matches what shown.
      if (snap.payload && snap.payload.p_persist === false) {
        return { data: {
          template_id: snap.payload.p_template_id,
          damage: 51, speed: 31, accuracy: 81, crit_chance: 5,
          quality_multiplier: 1.05, tier: 'B',
          slot_0_attack_id: 101, slot_1_attack_id: 102, slot_2_attack_id: null,
          slot_3_attack_id: null, slot_4_attack_id: null,
          slot_0_attack: { id: 101 }, slot_1_attack: { id: 102 },
        } };
      }
      // persist path (buy): just an id
      return { data: { id: 99, damage: 51, speed: 31, accuracy: 81, tier: 'B' } };
    }
    if (snap.table === 'rpc:generate_consumable_instance') {
      if (snap.payload && snap.payload.p_persist === false) {
        return { data: {
          template_id: snap.payload.p_template_id,
          rolled_floor: 11, rolled_window: 5, rolled_speed: 5, crit_chance: 0,
          grade: 'C', tier: 'C', quality_multiplier: 0.9,
        } };
      }
      return { data: { id: 88 } };
    }
    if (snap.table === 'rpc:sell_weapon') return { data: { ok: true, gold_gained: 18, new_gold: 1018 } };
    return { data: null };
  };
}

describe('weapon shop backend (PC-DEC-074/076)', () => {
  it('tier gating: only weapons mapped to portals <= best unlocked portal are stocked', async () => {
    // Player has completed portal 1 -> best unlocked = 2. portal_loot_mapping
    // returns weapons for portals 1 and 2 (ids 3,4). weapon 5 (Warhammer) is
    // NOT mapped -> must never be stocked regardless of roll RNG.
    const admin = mockAdmin((snap) => {
      const base = defaultResponder()(snap);
      if (snap.table === 'portal_run') return { data: [{ portal_template_id: 1 }] };
      if (snap.table === 'portal_loot_mapping') return { data: [{ weapon_template_id: 3 }, { weapon_template_id: 4 }] };
      if (snap.table === 'weapon_template') return { data: [
        { id: 3, name: 'Greatsword', base_damage: 55, damage_range: 8, base_speed: 35, speed_range: 4, base_accuracy: 82, accuracy_range: 6, crit_base: 5, crit_range: 0, base_price: 45 },
        { id: 4, name: 'Battle Axe', base_damage: 50, damage_range: 7, base_speed: 38, speed_range: 4, base_accuracy: 80, accuracy_range: 6, crit_base: 5, crit_range: 0, base_price: 45 },
        { id: 5, name: 'Warhammer', base_damage: 42, damage_range: 6, base_speed: 33, speed_range: 3, base_accuracy: 83, accuracy_range: 5, crit_base: 5, crit_range: 0, base_price: 45 },
      ] };
      return base;
    });
    __setAdminClientForTests(admin);
    const res = await GET(req('/shop'));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    const gated = new Set([3, 4]);
    const stocked = body.stock.filter(i => i.kind === 'weapon');
    assert.equal(stocked.length, 2, '2 weapons stocked');
    for (const w of stocked) {
      assert.ok(gated.has(w.template_id), `stocked weapon id ${w.template_id} must be in gated set {3,4}`);
    }
    // the portal_loot_mapping query used lte(portal_template_id, bestUnlocked=2)
    const lootCall = admin.calls.find(c => c.table === 'portal_loot_mapping');
    assert.ok(lootCall, 'portal_loot_mapping queried');
    assert.ok(lootCall.filters.some(f => f[0] === 'lte' && f[1] === 'portal_template_id' && f[2] === 2), 'gated to portals <= 2');
  });

  it('tier gating: a weapon NOT in any portal loot mapping is never stocked', async () => {
    const admin = mockAdmin((snap) => {
      const base = defaultResponder()(snap);
      if (snap.table === 'portal_loot_mapping') return { data: [{ weapon_template_id: 3 }] };
      if (snap.table === 'weapon_template') return { data: [
        { id: 3, name: 'Greatsword', base_damage: 55, damage_range: 8, base_speed: 35, speed_range: 4, base_accuracy: 82, accuracy_range: 6, crit_base: 5, crit_range: 0, base_price: 45 },
        { id: 5, name: 'Warhammer', base_damage: 42, damage_range: 6, base_speed: 33, speed_range: 3, base_accuracy: 83, accuracy_range: 5, crit_base: 5, crit_range: 0, base_price: 45 },
      ] };
      return base;
    });
    __setAdminClientForTests(admin);
    const res = await GET(req('/shop'));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    const names = new Set(body.stock.filter(i => i.kind === 'weapon').map(i => i.name));
    assert.ok(names.has('Greatsword'), 'mapped weapon available');
    assert.ok(!names.has('Warhammer'), 'unmapped weapon excluded');
  });

  it('GET /shop returns stock, reroll_cost, gold, ap, can_sell_last_weapon', async () => {
    const admin = mockAdmin(defaultResponder());
    __setAdminClientForTests(admin);
    const res = await GET(req('/shop'));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.ok(Array.isArray(body.stock), 'stock is an array');
    const weapons = body.stock.filter(i => i.kind === 'weapon');
    const potions = body.stock.filter(i => i.kind === 'consumable');
    assert.equal(weapons.length, 2, 'exactly 2 weapons in stock');
    assert.equal(potions.length, 2, 'exactly 2 potions in stock');
    assert.equal(body.stock.length, 4, '4 total stock slots');
    assert.equal(typeof body.reroll_cost, 'number');
    assert.equal(body.reroll_cost, 10, 'base reroll cost at count 0');
    assert.equal(body.gold, 1000);
    assert.equal(body.ap, 50);
    assert.equal(typeof body.can_sell_last_weapon, 'boolean');
    // every stock item has a buy_price and tier
    for (const item of body.stock) {
      assert.ok(item.buy_price > 0, 'buy_price > 0');
      assert.ok(item.tier, 'tier present');
      assert.ok(item.name, 'name present');
    }
  });

  it('POST /shop/buy grants an instance and deducts gold', async () => {
    const admin = mockAdmin(defaultResponder());
    __setAdminClientForTests(admin);
    // GET first to establish stock, then buy slot 1
    const getRes = await GET(req('/shop'));
    const getBody = await getRes.json();
    const shownSlot = getBody.stock.find(r => r.slot === 1);
    const res = await POST(req('/shop/buy', 'POST', { slot: 1 }));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.instance_id, 'instance granted');
    assert.ok(body.new_gold < 1000, 'gold deducted');
    // generate_weapon RPC was called
    const rpc = admin.calls.find(c => c.table === 'rpc:generate_weapon');
    assert.ok(rpc, 'generate_weapon RPC called');
    // PC-XXX: buyer gets EXACTLY the stock-shown roll — the fresh instance is overwritten
    // with the displayed stats, not the generate_weapon re-roll. Assert the update payload
    // mirrors slot 1's stock item.
    const upd = admin.calls.find(c => c.table === 'weapon_instance' && c.op === 'update');
    assert.ok(upd, 'weapon_instance update performed (grant-what-shown)');
    const updPayload = upd.payload;
    // the overwrite must mirror exactly what the stock showed for the bought slot
    // (the slot 1 item captured from the initial GET /shop above)
    assert.equal(updPayload.damage, shownSlot.damage);
    assert.equal(updPayload.speed, shownSlot.speed);
    assert.equal(updPayload.accuracy, shownSlot.accuracy);
    assert.equal(updPayload.quality_multiplier, shownSlot.quality_multiplier);
    assert.equal(updPayload.tier, shownSlot.tier);
    assert.equal(updPayload.grade, shownSlot.tier);
    // the sold slot is removed from today's shop_stock so it leaves the store
    const del = admin.calls.find(c => c.table === 'shop_stock' && c.op === 'delete' && c.filters.some(f => f[0] === 'eq' && f[1] === 'slot' && f[2] === 1));
    assert.ok(del, 'sold slot 1 deleted from shop_stock');
  });

  it('POST /shop/buy rejects insufficient gold', async () => {
    const admin = mockAdmin((snap) => {
      const base = defaultResponder()(snap);
      if (snap.table === 'profiles' && snap.op === 'select') return { data: { id: 'user-1', gold: 1, ap: 50, shop_stock_date: null, shop_reroll_count: 0 } };
      return base;
    });
    __setAdminClientForTests(admin);
    await GET(req('/shop'));
    const res = await POST(req('/shop/buy', 'POST', { slot: 1 }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'insufficient_gold');
    assert.ok(body.need > 0, 'error carries the gold needed');
    assert.equal(body.have, 1, 'error carries the gold held');
  });

  it('POST /shop/sell rejects selling the last weapon (no_sell_last_weapon)', async () => {
    const admin = mockAdmin((snap) => {
      const base = defaultResponder()(snap);
      if (snap.table === 'rpc:sell_weapon') return { data: { error: 'no_sell_last_weapon' } };
      return base;
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('/shop/sell', 'POST', { instance_id: 5 }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'no_sell_last_weapon');
  });

  it('POST /shop/reroll re-rolls stock and raises reroll cost', async () => {
    const admin = mockAdmin(defaultResponder());
    __setAdminClientForTests(admin);
    await GET(req('/shop'));
    const res = await POST(req('/shop/reroll', 'POST'));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.stock));
    assert.equal(body.reroll_cost, 20, 'cost doubles after one reroll (10 * 2^1)');
    assert.ok(body.new_gold < 1000, 'gold deducted for reroll');
  });

  it('GET /shop/inventory returns owned weapons with sell prices', async () => {
      const admin = mockAdmin((snap) => {
        const base = defaultResponder()(snap);
        if (snap.table === 'weapon_instance' && snap.op === 'select') {
          return { data: [
            { id: 5, template_id: 3, quality_multiplier: 1.0, tier: 'C', damage: 50, speed: 30, accuracy: 80, weapon_template: { name: 'Greatsword', base_price: 45 } },
            { id: 6, template_id: 3, quality_multiplier: 1.2, tier: 'S', damage: 60, speed: 28, accuracy: 85, weapon_template: { name: 'Greatsword', base_price: 45 } },
          ] , count: 2 };
        }
        return base;
      });
      __setAdminClientForTests(admin);
      const res = await GET(req('/shop/inventory'));
      assert.equal(res.status, 200, await res.clone().text());
      const body = await res.json();
      assert.equal(body.items.length, 2);
      assert.equal(body.can_sell_last_weapon, true);
      // sell price = round(45 * priceFactor(qm) * 0.42). Continuous monotonic curve
      // (PC-PL-2026-10-26): qm 1.0 -> 1.03x, qm 1.2 (interp 1.15/1.23) -> 4.7125x.
      assert.equal(body.items[0].sell_price, Math.round(45 * 1.03 * 0.42));   // 19
      // qm 1.2 is a mid-S roll; the S band sits ~3-5x a C so a jackpot-quality
      // weapon sells far above the old flat-rate 23g.
      assert.equal(body.items[1].sell_price, 89);
      assert.ok(body.items[0].instance_id, 'has instance_id for sell');
      assert.equal(body.gold, 1000, 'includes current gold for the sell header');
    });

  it('POST /shop/sell calls the sell_weapon RPC and returns its result', async () => {
      const admin = mockAdmin(defaultResponder());
      __setAdminClientForTests(admin);
      const res = await POST(req('/shop/sell', 'POST', { instance_id: 5 }));
      assert.equal(res.status, 200, await res.clone().text());
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.gold_gained, 18);
      assert.equal(body.new_gold, 1018);
      // a single sell_weapon RPC was called (not a multi-query chain)
      const rpc = admin.calls.filter(c => c.table === 'rpc:sell_weapon');
      assert.equal(rpc.length, 1, 'sell_weapon RPC called exactly once');
      assert.equal(rpc[0].payload.p_user_id, 'user-1');
      assert.equal(rpc[0].payload.p_instance_id, 5);
    });

    it('POST /shop/sell returns the RPC error (e.g. not_owned on duplicate/replay)', async () => {
      const admin = mockAdmin((snap) => {
        const base = defaultResponder()(snap);
        if (snap.table === 'rpc:sell_weapon') return { data: { error: 'not_owned' } };
        return base;
      });
      __setAdminClientForTests(admin);
      // a replay where the row is already gone
      const res = await POST(req('/shop/sell', 'POST', { instance_id: 5 }));
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'not_owned');
    });

    it('POST /shop/sell surfaces weapon_in_active_run from the RPC', async () => {
      const admin = mockAdmin((snap) => {
        const base = defaultResponder()(snap);
        if (snap.table === 'rpc:sell_weapon') return { data: { error: 'weapon_in_active_run' } };
        return base;
      });
      __setAdminClientForTests(admin);
      const res = await POST(req('/shop/sell', 'POST', { instance_id: 5 }));
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'weapon_in_active_run');
    });

    it('POST /shop/ap-reset resets reroll cost and spends AP', async () => {
    const admin = mockAdmin(defaultResponder());
    __setAdminClientForTests(admin);
    const res = await POST(req('/shop/ap-reset', 'POST'));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.shop_reroll_count, 0);
    assert.equal(body.reroll_cost, 10, 'cost back to base');
    assert.equal(body.new_ap, 40, 'AP deducted by ap_reset_cost (10)');
  });

  it('POST /shop/ap-reset rejects insufficient AP', async () => {
    const admin = mockAdmin((snap) => {
      const base = defaultResponder()(snap);
      if (snap.table === 'profiles' && snap.op === 'select') return { data: { id: 'user-1', gold: 1000, ap: 3, shop_stock_date: null, shop_reroll_count: 0 } };
      return base;
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('/shop/ap-reset', 'POST'));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'insufficient_ap');
  });
});
