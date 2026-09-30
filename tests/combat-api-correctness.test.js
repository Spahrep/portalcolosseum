import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  POST,
  __setAdminClientForTests,
  rollMultiplier,
  monstersForLoot,
  entryCosts,
} from '../api/combat/[...path].js';

afterEach(() => __setAdminClientForTests(null));

function mockAdmin(responder) {
  const calls = [];
  function chain(table) {
    const ctx = { table, op: null, payload: null, filters: [], cols: null, opts: null };
    const api = {
      select(cols, opts) {
        ctx.cols = cols;
        ctx.opts = opts;
        if (ctx.op !== 'insert' && ctx.op !== 'update') ctx.op = 'select';
        return api;
      },
      insert(payload) { ctx.op = 'insert'; ctx.payload = payload; return api; },
      update(payload) { ctx.op = 'update'; ctx.payload = payload; return api; },
      delete() { ctx.op = 'delete'; return api; },
      eq(k, v) { ctx.filters.push(['eq', k, v]); return api; },
      in(k, v) { ctx.filters.push(['in', k, v]); return api; },
      is(k, v) { ctx.filters.push(['is', k, v]); return api; },
      order() { return api; },
      limit() { return api; },
      single() { return finish(true); },
      maybeSingle() { return finish(true); },
      then(res, rej) { return finish(false).then(res, rej); },
    };
    function finish(single) {
      const snap = {
        table: ctx.table,
        op: ctx.op,
        payload: ctx.payload,
        cols: ctx.cols,
        opts: ctx.opts,
        filters: ctx.filters.map(f => [...f]),
        single,
      };
      calls.push(snap);
      const result = responder(snap) || { data: null };
      if (ctx.opts && ctx.opts.head) {
        return Promise.resolve({ data: null, count: result.count ?? 0, error: result.error || null });
      }
      if (single) {
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : (result.data ?? null);
        return Promise.resolve({ data, error: result.error || null });
      }
      return Promise.resolve({ data: result.data ?? null, error: result.error || null, count: result.count });
    }
    return api;
  }
  return {
    calls,
    from(table) { return chain(table); },
    rpc(name, args) {
      const snap = { table: 'rpc:' + name, op: 'rpc', payload: args, filters: [], cols: null, single: false };
      calls.push(snap);
      const result = responder(snap) || { data: null };
      return Promise.resolve({ data: result.data ?? null, error: result.error || null });
    },
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  };
}

function post(path, body) {
  return new Request('https://portalcolosseum.com/api/combat' + path, {
    method: 'POST',
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

function readyBattle(extra = {}) {
  return {
    queue: [{ id: 'r1', label: 'LH', event: 'ready', tics: 0 }],
    player: {
      hp: 1000,
      max_hp: 1000,
      hands: {
        LH: { state: 'Ready', weaponId: null, attackId: null },
        RH: { state: 'Ready', weaponId: null, attackId: null },
      },
    },
    monsters: [{ id: 1, current_hp: 20, max_hp: 20, type: 'monster' }],
    feed: [],
    tic: 0,
    buffs: [],
    potions: null,
    ...extra,
  };
}

describe('rollMultiplier (base ± range, range 0 = base, not clamped to 1)', () => {
  it('range 0 or falsy returns base exactly, including sub-1 multipliers', () => {
    assert.equal(rollMultiplier(1.5, 0), 1.5);
    assert.equal(rollMultiplier(0.7, 0), 0.7);
    assert.equal(rollMultiplier(1.5, null), 1.5);
    assert.equal(rollMultiplier(1.5, undefined), 1.5);
  });

  it('uniform even spread stays inside [base-range, base+range] with EV at base', () => {
    assert.equal(rollMultiplier(1.5, 0.2, () => 0), 1.3);
    assert.equal(rollMultiplier(1.5, 0.2, () => 1), 1.7);
    assert.equal(rollMultiplier(1.5, 0.2, () => 0.5), 1.5);
    assert.equal(rollMultiplier(0.1, 1, () => 0), 0); // clamp >= 0, not >= 1
  });
});

describe('monstersForLoot reads persisted.monsters, not participants, and keeps the dead', () => {
  it('includes killed monsters (current_hp <= 0 and .dead) and ignores the snapshot path', () => {
    const persisted = {
      participants: { monsters: [{ template_id: 99, dead: false }] },
      monsters: [
        { id: 'm1', template_id: 7, current_hp: 0, dead: true },
        { id: 'm2', template_id: 8, current_hp: 0 },
      ],
    };
    const ids = monstersForLoot(persisted).map(m => m.template_id);
    assert.deepEqual(ids, [7, 8]);
  });
});

describe('entryCosts', () => {
  it('reads ap_cost and entry_gold_cost, with gold_cost as alias', () => {
    assert.deepEqual(entryCosts({ ap_cost: 2, entry_gold_cost: 5 }), { ap: 2, gold: 5 });
    assert.deepEqual(entryCosts({ ap_cost: 1, gold_cost: 4 }), { ap: 1, gold: 4 });
    assert.deepEqual(entryCosts({}), { ap: 0, gold: 0 });
  });
});

describe('POST /runs deducts ap_cost and entry gold', () => {
  function runResponder({ wallet, template, walletError }) {
    return (snap) => {
      if (snap.table === 'portal_run' && snap.opts && snap.opts.head) return { count: 0 };
      if (snap.table === 'weapon_instance') return { data: [{ id: 9, user_id: 'user-1' }] };
      if (snap.table === 'portal_template') return { data: template };
      if (snap.table === 'profiles' && snap.op === 'select') {
        if (walletError) return { error: walletError, data: null };
        return { data: wallet };
      }
      if (snap.table === 'profiles' && snap.op === 'update') return { data: null };
      if (snap.table === 'game_config') return { data: { starting_hp: 1000 } };
      if (snap.table === 'portal_run' && snap.op === 'insert') return { data: { id: 55, user_id: 'user-1' } };
      if (snap.table === 'portal_run_dice') return { data: [] };
      return { data: null };
    };
  }

  const body = { portal_template_id: 1, hand_l_weapon_id: 9 };

  it('deducts AP and gold before inserting the run', async () => {
    const admin = mockAdmin(runResponder({
      wallet: { gold: 100, ap: 10 },
      template: { fights: 5, green_dice_count: 0, yellow_dice_count: 0, red_dice_count: 0, ap_cost: 2, entry_gold_cost: 5 },
    }));
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs', body));
    assert.equal(res.status, 200);
    const deducted = admin.calls.find(c => c.table === 'profiles' && c.op === 'update');
    assert.deepEqual(deducted.payload, { gold: 95, ap: 8 });
    assert.ok(admin.calls.some(c => c.table === 'portal_run' && c.op === 'insert'));
    const deductIdx = admin.calls.indexOf(deducted);
    const insertIdx = admin.calls.findIndex(c => c.table === 'portal_run' && c.op === 'insert');
    assert.ok(deductIdx < insertIdx, 'charge must land before the run insert');
  });

  it('rejects when the player cannot afford the entry cost and does not insert', async () => {
    const admin = mockAdmin(runResponder({
      wallet: { gold: 100, ap: 1 },
      template: { fights: 5, green_dice_count: 0, yellow_dice_count: 0, red_dice_count: 0, ap_cost: 2, entry_gold_cost: 5 },
    }));
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs', body));
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.match(payload.error, /Not enough AP or gold/);
    assert.equal(admin.calls.some(c => c.table === 'portal_run' && c.op === 'insert'), false);
  });

  it('still creates the run if wallet columns are missing', async () => {
    const admin = mockAdmin(runResponder({
      walletError: { message: 'column gold does not exist' },
      template: { fights: 5, green_dice_count: 0, yellow_dice_count: 0, red_dice_count: 0, ap_cost: 2, entry_gold_cost: 5 },
    }));
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs', body));
    assert.equal(res.status, 200);
    assert.equal(admin.calls.some(c => c.table === 'profiles' && c.op === 'update'), false);
    assert.ok(admin.calls.some(c => c.table === 'portal_run' && c.op === 'insert'));
  });
});

describe('POST /commit unarmed fist_speed and multiplier range', () => {
  function commitResponder(run, { attack, config, weapon }) {
    return (snap) => {
      if (snap.table === 'attack') return { data: attack };
      if (snap.table === 'portal_run' && snap.op === 'select') return { data: run };
      if (snap.table === 'portal_run' && snap.op === 'update') return { data: null };
      if (snap.table === 'game_config') return { data: config };
      if (snap.table === 'weapon_instance') {
        return {
          data: {
            template_id: 3,
            slot_0_attack_id: 1,
            slot_1_attack_id: null,
            slot_2_attack_id: null,
            slot_3_attack_id: null,
            slot_4_attack_id: null,
            ...(weapon || {}),
          },
        };
      }
      return { data: null };
    };
  }

  it('adds fist_speed to unarmed cast and cooldown', async () => {
    const run = {
      id: 1, user_id: 'user-1', status: 'active', player_hp: 1000,
      hand_l_weapon_id: null, hand_r_weapon_id: null,
      battle_state: readyBattle(),
    };
    const admin = mockAdmin(commitResponder(run, {
      attack: { prepare_time: 1, cooldown_time: 1, prepare_time_range: 0, cooldown_time_range: 0, is_multi_target: false, base_damage_multiplier: 1, name: 'Fist', crit_factor: 1, crit_multiplier: 2 },
      config: { fist_speed: 6, fist_prepare_time: 2, fist_prepare_time_range: 0, fist_cooldown_time: 3, fist_cooldown_time_range: 0, fist_damage: 4, fist_accuracy: 50, fist_crit_chance: 0 },
    }));
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs/1/commit', { hand: 'LH', attack_id: 1, target_ids: [1] }));
    assert.equal(res.status, 200, await res.clone().text());
    const upd = admin.calls.find(c => c.table === 'portal_run' && c.op === 'update');
    const winding = upd.payload.battle_state.queue.find(r => r.label === 'LH' && r.event === 'winding');
    assert.equal(winding.tics, 6 + 2);
    assert.equal(winding.cooldownTicks, 6 + 3);
  });

  it('rolls base_damage_multiplier ± range before multiplying weapon damage', async () => {
    const run = {
      id: 1, user_id: 'user-1', status: 'active', player_hp: 1000,
      hand_l_weapon_id: 42, hand_r_weapon_id: null,
      battle_state: readyBattle(),
    };
    const attack = {
      prepare_time: 1, prepare_time_range: 0, cooldown_time: 1, cooldown_time_range: 0,
      is_multi_target: false, base_damage_multiplier: 1.5, base_damage_multiplier_range: 0,
      name: 'Heavy Chop', crit_factor: 1, crit_multiplier: 2,
    };
    const weapon = { damage: 38, accuracy: 80, speed: 0, crit_chance: 0 };
    const admin = mockAdmin(commitResponder(run, { attack, weapon }));
    __setAdminClientForTests(admin);
    const select = () => admin.calls.find(c => c.table === 'attack');
    let res = await POST(post('/runs/1/commit', { hand: 'LH', attack_id: 1, target_ids: [1] }));
    assert.equal(res.status, 200, await res.clone().text());
    assert.match(select().cols, /base_damage_multiplier_range/);
    let upd = admin.calls.filter(c => c.table === 'portal_run' && c.op === 'update').pop();
    let winding = upd.payload.battle_state.queue.find(r => r.event === 'winding');
    assert.equal(winding.damage, 57); // 38 × 1.5, range 0

    attack.base_damage_multiplier_range = 0.2;
    const orig = Math.random;
    try {
      Math.random = () => 0;
      admin.calls.length = 0;
      res = await POST(post('/runs/1/commit', { hand: 'LH', attack_id: 1, target_ids: [1] }));
      assert.equal(res.status, 200, await res.clone().text());
      upd = admin.calls.filter(c => c.table === 'portal_run' && c.op === 'update').pop();
      winding = upd.payload.battle_state.queue.find(r => r.event === 'winding');
      assert.equal(winding.damage, Math.round(38 * 1.3));
    } finally {
      Math.random = orig;
    }
  });

  it('scales armed cast and cooldown by the attack timing multipliers, ignoring flat ticks', async () => {
    const run = {
      id: 1, user_id: 'user-1', status: 'active', player_hp: 1000,
      hand_l_weapon_id: 42, hand_r_weapon_id: null,
      battle_state: readyBattle(),
    };
    const attack = {
      prepare_time: 99, prepare_time_range: 9,
      cooldown_time: 99, cooldown_time_range: 9,
      prepare_time_multiplier: 1.5, prepare_time_multiplier_range: 0,
      cooldown_time_multiplier: 2, cooldown_time_multiplier_range: 0,
      is_multi_target: false, base_damage_multiplier: 1, base_damage_multiplier_range: 0,
      name: 'Heavy Chop', crit_factor: 1, crit_multiplier: 2,
    };
    const weapon = { damage: 10, accuracy: 80, speed: 20, crit_chance: 0 };
    const admin = mockAdmin(commitResponder(run, { attack, weapon }));
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs/1/commit', { hand: 'LH', attack_id: 1, target_ids: [1] }));
    assert.equal(res.status, 200, await res.clone().text());
    const select = admin.calls.find(c => c.table === 'attack');
    assert.match(select.cols, /prepare_time_multiplier/);
    assert.match(select.cols, /prepare_time_multiplier_range/);
    assert.match(select.cols, /cooldown_time_multiplier/);
    assert.match(select.cols, /cooldown_time_multiplier_range/);
    const upd = admin.calls.find(c => c.table === 'portal_run' && c.op === 'update');
    const winding = upd.payload.battle_state.queue.find(r => r.event === 'winding');
    assert.equal(winding.tics, 20 * 1.5);
    assert.equal(winding.cooldownTicks, 20 * 2);
    assert.notEqual(winding.tics, 20 + 99);

    attack.prepare_time_multiplier_range = 0.2;
    attack.cooldown_time_multiplier_range = 0.4;
    const orig = Math.random;
    try {
      Math.random = () => 0;
      admin.calls.length = 0;
      const ranged = await POST(post('/runs/1/commit', { hand: 'LH', attack_id: 1, target_ids: [1] }));
      assert.equal(ranged.status, 200, await ranged.clone().text());
      const upd2 = admin.calls.filter(c => c.table === 'portal_run' && c.op === 'update').pop();
      const winding2 = upd2.payload.battle_state.queue.find(r => r.event === 'winding');
      assert.equal(winding2.tics, 20 * rollMultiplier(1.5, 0.2, () => 0));
      assert.equal(winding2.cooldownTicks, 20 * rollMultiplier(2, 0.4, () => 0));
      assert.ok(winding2.tics >= 20 * (1.5 - 0.2) - 1e-9 && winding2.tics <= 20 * (1.5 + 0.2) + 1e-9);
      assert.ok(winding2.cooldownTicks >= 0);
    } finally {
      Math.random = orig;
    }
  });
});

describe('POST /tick writes consume_*_used when a drinking row lands', () => {
  it('persists consume_a_used after the drink resolves on tick', async () => {
    const run = {
      id: 1, user_id: 'user-1', status: 'active', player_hp: 500,
      battle_state: {
        queue: [{ id: 'd1', label: 'LH', event: 'drinking', tics: 0, potionSlot: 'A', postTicks: 1 }],
        player: {
          hp: 500, max_hp: 1000,
          hands: {
            LH: { state: 'drinking', weaponId: null, attackId: null },
            RH: { state: 'Approach', weaponId: null, attackId: null },
          },
        },
        monsters: [{ id: 1, current_hp: 40, max_hp: 40, type: 'monster' }],
        feed: [], tic: 3, buffs: [],
        potions: {
          A: { used: false, effect_type: 'heal', rolled_floor: 10, template_name: 'Health Potion', crit_chance: 0 },
          B: null,
        },
      },
    };
    const admin = mockAdmin((snap) => {
      if (snap.table === 'portal_run' && snap.op === 'select') return { data: run };
      if (snap.table === 'portal_run' && snap.op === 'update') return { data: null };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs/1/tick', {}));
    assert.equal(res.status, 200, await res.clone().text());
    const upd = admin.calls.find(c => c.table === 'portal_run' && c.op === 'update');
    assert.equal(upd.payload.consume_a_used, true);
    assert.equal(upd.payload.consume_b_used, false);
    assert.equal(upd.payload.battle_state.potions.A.used, true);
  });
});

describe('battle/end loot reads persisted.monsters and continue saves prize_pool', () => {
  it('loots killed monsters from state.monsters and persists prize_pool on continue', async () => {
    const run = {
      id: 1,
      user_id: 'user-1',
      status: 'active',
      player_hp: 800,
      current_battle: 1,
      total_battles: 5,
      portal_template_id: 1,
      hand_l_weapon_id: null,
      hand_r_weapon_id: null,
      consume_a_id: null,
      consume_b_id: null,
      prize_pool: { weapon_ids: [], gold: 3, lp_earned: 1 },
      battle_state: {
        queue: [{ id: 'q1', label: 'LH', event: 'ready', tics: 0 }],
        player: {
          hp: 800, max_hp: 1000,
          hands: { LH: { state: 'Ready' }, RH: { state: 'Ready' } },
        },
        monsters: [
          { id: 'm1', template_id: 7, current_hp: 0, max_hp: 40, dead: true },
          { id: 'm2', template_id: 8, current_hp: 0, max_hp: 30 },
        ],
        participants: { monsters: [] },
        feed: [], tic: 5, buffs: [], potions: null,
      },
    };
    const admin = mockAdmin((snap) => {
      if (snap.table === 'portal_run' && snap.op === 'select') return { data: run };
      if (snap.table === 'portal_run' && snap.op === 'update') return { data: null };
      if (snap.table === 'portal_monster_mapping') {
        return { data: [
          { monster_template_id: 7, point_cost: 4, weight: 1 },
          { monster_template_id: 8, point_cost: 6, weight: 1 },
        ] };
      }
      if (snap.table === 'monster_template') {
        return { data: [
          { id: 7, min_gold: 5, max_gold: 5, loot_value: 4 },
          { id: 8, min_gold: 5, max_gold: 5, loot_value: 6 },
        ] };
      }
      if (snap.table === 'portal_loot_mapping' || snap.table === 'monster_loot_mapping') return { data: [] };
      if (snap.table === 'portal_template') return { data: { green_faces: [], yellow_faces: [], red_faces: [], stop_share_tiers: [] } };
      if (snap.table === 'portal_run_dice') return { data: [] };
      if (snap.table === 'game_config') return { data: { starting_hp: 1000, fist_speed: 6 } };
      if (snap.op === 'rpc') return { data: null };
      return { data: [] };
    });
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs/1/battle/end', { choice: 'continue' }));
    assert.equal(res.status, 200, await res.clone().text());
    const lootQuery = admin.calls.find(c => c.table === 'monster_template' && c.filters.some(f => f[0] === 'in'));
    assert.ok(lootQuery, 'loot must query monster_template for the fight monsters');
    const ids = lootQuery.filters.find(f => f[0] === 'in')[2];
    assert.deepEqual([...ids].sort(), [7, 8]);
    const upd = admin.calls.find(c => c.table === 'portal_run' && c.op === 'update');
    assert.ok(upd.payload.prize_pool, 'continue update must persist prize_pool');
    assert.equal(upd.payload.prize_pool.gold, 13); // 3 carried + 5+5 dropped
    const bodyJson = await res.json();
    assert.equal(bodyJson.prize_pool.gold, 13);
  });
});

describe('POST /use-potion honors the open menu hand', () => {
  it('queues the drink on RH when the menu says RH, even if LH is also ready', async () => {
    const run = {
      id: 1, user_id: 'user-1', status: 'active', player_hp: 800,
      consume_a_used: false, consume_a_id: 9, consume_b_used: false, consume_b_id: null,
      hand_l_weapon_id: null, hand_r_weapon_id: null,
      battle_state: readyBattle({
        potions: {
          A: { used: false, effect_type: 'heal', rolled_floor: 10, rolled_window: 0, rolled_speed: 2, template_name: 'Health Potion', crit_chance: 0 },
          B: null,
        },
        monsters: [{ id: 1, label: 'A', name: 'Wolf', current_hp: 20, max_hp: 20, speed: 5, damage: 1, accuracy: 50 }],
      }),
    };
    const admin = mockAdmin((snap) => {
      if (snap.table === 'portal_run' && snap.op === 'select') return { data: run };
      if (snap.table === 'portal_run' && snap.op === 'update') return { data: null };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(post('/runs/1/use-potion', { slot: 'A', hand: 'RH' }));
    assert.equal(res.status, 200, await res.clone().text());
    const upd = admin.calls.find(c => c.table === 'portal_run' && c.op === 'update');
    const drinking = upd.payload.battle_state.queue.find(r => r.event === 'drinking');
    assert.equal(drinking.label, 'RH');
    assert.equal(upd.payload.battle_state.player.hands.RH.state, 'drinking');
    assert.equal(upd.payload.battle_state.player.hands.LH.state, 'Ready');
  });
});
