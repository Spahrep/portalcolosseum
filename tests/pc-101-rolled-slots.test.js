import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST, __setAdminClientForTests } from '../api/combat/[...path].js';

afterEach(() => __setAdminClientForTests(null));

/**
 * Template mapping is the trap: it lists attacks the roll did NOT grant,
 * and it omits slot 0. Combat must ignore it and use weapon_instance slots.
 */
const MAPPED_NOT_GRANTED = 99;
const SLOT0 = 10;
const SLOT1 = 20;
const SLOT2 = 30;

const ATTACKS = {
  [SLOT0]: {
    id: SLOT0, name: 'Attack', is_multi_target: false,
    prepare_time_multiplier: 2, cooldown_time_multiplier: 3, prepare_time_multiplier_range: 1, cooldown_time_multiplier_range: 0,
    description: 'basic swing', base_damage_multiplier: 1, crit_factor: 1, crit_multiplier: 2,
  },
  [SLOT1]: {
    id: SLOT1, name: 'Quick Slash', is_multi_target: false,
    prepare_time_multiplier: 1, cooldown_time_multiplier: 0.5, prepare_time_multiplier_range: 0, cooldown_time_multiplier_range: 1,
    description: 'fast', base_damage_multiplier: 0.7, crit_factor: 1.1, crit_multiplier: 2,
  },
  [SLOT2]: {
    id: SLOT2, name: 'Whirlwind', is_multi_target: true,
    prepare_time_multiplier: 1.8, cooldown_time_multiplier: 2, prepare_time_multiplier_range: 0.4, cooldown_time_multiplier_range: 0.5,
    description: 'spin', base_damage_multiplier: 0.9, crit_factor: 1.2, crit_multiplier: 2.5,
  },
  [MAPPED_NOT_GRANTED]: {
    id: MAPPED_NOT_GRANTED, name: 'Mapped Only', is_multi_target: false,
    prepare_time_multiplier: 2.2, cooldown_time_multiplier: 2.2, prepare_time_multiplier_range: 0, cooldown_time_multiplier_range: 0,
    description: 'should never appear', base_damage_multiplier: 2, crit_factor: 1, crit_multiplier: 2,
  },
};

function slots(partial) {
  return {
    slot_0_attack_id: SLOT0,
    slot_1_attack_id: null,
    slot_2_attack_id: null,
    slot_3_attack_id: null,
    slot_4_attack_id: null,
    ...partial,
  };
}

function weaponRow(id, slotPartial) {
  return {
    id,
    user_id: 'user-1',
    template_id: 7,
    damage: 25,
    speed: 12,
    accuracy: 80,
    grade: 'C',
    crit_chance: 5,
    weapon_template: { name: 'Short Sword', base_damage: 20, damage_range: 5 },
    ...slots(slotPartial),
  };
}

const ONLY_SLOT0 = weaponRow(42, {});
const SLOTS_0_AND_2 = weaponRow(43, { slot_2_attack_id: SLOT2 });

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
    rpc() { return Promise.resolve({ data: null, error: null }); },
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  };
}

function req(method, path, body) {
  return new Request('https://portalcolosseum.com/api/combat' + path, {
    method,
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function attackIdsFrom(list) {
  return (list || []).map(a => a.id);
}

function rowsForIds(ids) {
  return (ids || []).map(id => ATTACKS[Number(id)]).filter(Boolean);
}

/**
 * Mapping still answers with attacks the instance did not roll, and omits slot 0.
 * A correct handler never consults this table for the menu or the commit gate.
 */
function mappingTrap(snap) {
  if (snap.table !== 'weapon_template_attack_mapping') return null;
  if (snap.opts && snap.opts.head) {
    const attackEq = snap.filters.find(f => f[0] === 'eq' && f[1] === 'attack_id');
    const id = attackEq ? Number(attackEq[2]) : null;
    const mapped = id === MAPPED_NOT_GRANTED || id === SLOT1;
    return { count: mapped ? 1 : 0 };
  }
  return {
    data: [MAPPED_NOT_GRANTED, SLOT1].map(id => ({ attack: ATTACKS[id] })),
  };
}

function menuResponder(instances) {
  return (snap) => {
    const trapped = mappingTrap(snap);
    if (trapped) return trapped;
    if (snap.table === 'weapon_instance') return { data: instances };
    if (snap.table === 'attack') {
      const inFilter = snap.filters.find(f => f[0] === 'in' && f[1] === 'id');
      const eq = snap.filters.find(f => f[0] === 'eq' && f[1] === 'id');
      const ids = inFilter ? inFilter[2] : (eq ? [eq[2]] : []);
      return { data: rowsForIds(ids) };
    }
    if (snap.table === 'portal_run') {
      return {
        data: {
          id: 1, user_id: 'user-1', status: 'active', player_hp: 1000,
          hand_l_weapon_id: instances[0]?.id ?? null,
          hand_r_weapon_id: null,
          belt_weapon_id: null,
          portal_template_id: null,
          prize_pool: null,
          battle_state: { queue: [], monsters: [], feed: [], tic: 0 },
        },
      };
    }
    if (snap.table === 'portal_run_dice') return { data: [] };
    if (snap.table === 'game_config') {
      return {
        data: {
          fist_prepare_time: 1, fist_prepare_time_range: 0,
          fist_cooldown_time: 1, fist_cooldown_time_range: 0,
          fist_damage: 4, fist_accuracy: 50, fist_speed: 6, fist_crit_chance: 5,
        },
      };
    }
    return { data: null };
  };
}

function readyBattle() {
  return {
    queue: [{ id: 'r1', label: 'LH', event: 'ready', tics: 0 }],
    player: {
      hp: 1000, max_hp: 1000,
      hands: {
        LH: { state: 'Ready', weaponId: 42, attackId: null },
        RH: { state: 'Ready', weaponId: null, attackId: null },
      },
    },
    monsters: [{ id: 1, current_hp: 20, max_hp: 20, type: 'monster' }],
    feed: [], tic: 0, buffs: [], potions: null,
  };
}

function commitResponder(weapon) {
  return (snap) => {
    const trapped = mappingTrap(snap);
    if (trapped) return trapped;
    if (snap.table === 'attack' && snap.single) {
      const eq = snap.filters.find(f => f[0] === 'eq' && f[1] === 'id');
      return { data: eq ? ATTACKS[Number(eq[2])] || null : null };
    }
    if (snap.table === 'portal_run' && snap.op === 'select') {
      return {
        data: {
          id: 1, user_id: 'user-1', status: 'active', player_hp: 1000,
          hand_l_weapon_id: weapon ? weapon.id : null,
          hand_r_weapon_id: null,
          battle_state: readyBattle(),
        },
      };
    }
    if (snap.table === 'portal_run' && snap.op === 'update') return { data: null };
    if (snap.table === 'weapon_instance') return { data: weapon };
    if (snap.table === 'game_config') {
      return {
        data: {
          fist_speed: 6, fist_prepare_time: 2, fist_prepare_time_range: 0,
          fist_cooldown_time: 3, fist_cooldown_time_range: 0,
          fist_damage: 4, fist_accuracy: 50, fist_crit_chance: 0,
        },
      };
    }
    return { data: null };
  };
}

describe('PC-101 granted weapon slots', () => {
  it('GET /weapons offers only slot 0 when slots 1-4 were not granted', async () => {
    const admin = mockAdmin(menuResponder([ONLY_SLOT0]));
    __setAdminClientForTests(admin);
    const res = await GET(req('GET', '/weapons'));
    assert.equal(res.status, 200, await res.clone().text());
    const { weapons } = await res.json();
    assert.deepEqual(attackIdsFrom(weapons[0].attacks), [SLOT0]);
    assert.equal(admin.calls.some(c => c.table === 'weapon_template_attack_mapping'), false);
  });

  it('GET /weapons offers exactly slot 0 and slot 2, in slot order, with attack metadata', async () => {
    const admin = mockAdmin(menuResponder([SLOTS_0_AND_2]));
    __setAdminClientForTests(admin);
    const res = await GET(req('GET', '/weapons'));
    assert.equal(res.status, 200, await res.clone().text());
    const { weapons } = await res.json();
    const attacks = weapons[0].attacks;
    assert.deepEqual(attackIdsFrom(attacks), [SLOT0, SLOT2]);
    const spin = attacks.find(a => a.id === SLOT2);
    assert.equal(spin.name, 'Whirlwind');
    assert.equal(spin.prepare_time_multiplier, 1.8);
    assert.equal(spin.cooldown_time_multiplier, 2);
    assert.equal(spin.prepare_time_multiplier_range, 0.4);
    assert.equal(spin.cooldown_time_multiplier_range, 0.5);
    assert.equal(spin.base_damage_multiplier, 0.9);
    assert.equal(spin.crit_factor, 1.2);
    assert.equal(spin.crit_multiplier, 2.5);
    assert.equal(spin.is_multi_target, true);
    assert.equal(admin.calls.some(c => c.table === 'weapon_template_attack_mapping'), false);
  });

  it('GET /runs battle weapon menu matches the granted slots, including slot 0 absent from the mapping', async () => {
    const admin = mockAdmin(menuResponder([SLOTS_0_AND_2]));
    __setAdminClientForTests(admin);
    const res = await GET(req('GET', '/runs/1'));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    const hand = body.run.battle_state.weapons.hand_l;
    assert.deepEqual(attackIdsFrom(hand.attacks), [SLOT0, SLOT2]);
    assert.equal(hand.attacks.some(a => a.id === MAPPED_NOT_GRANTED), false);
    assert.equal(hand.attacks.some(a => a.id === SLOT1), false);
  });

  it('POST /commit accepts slot 0 even when that attack is not in the template mapping', async () => {
    const admin = mockAdmin(commitResponder(ONLY_SLOT0));
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/runs/1/commit', { hand: 'LH', attack_id: SLOT0, target_ids: [1] }));
    assert.equal(res.status, 200, await res.clone().text());
  });

  it('POST /commit accepts a granted slot 2 and rejects a mapped attack that was not rolled', async () => {
    const admin = mockAdmin(commitResponder(SLOTS_0_AND_2));
    __setAdminClientForTests(admin);
    const ok = await POST(req('POST', '/runs/1/commit', { hand: 'LH', attack_id: SLOT2, target_ids: [1] }));
    assert.equal(ok.status, 200, await ok.clone().text());

    admin.calls.length = 0;
    const denied = await POST(req('POST', '/runs/1/commit', { hand: 'LH', attack_id: SLOT1, target_ids: [1] }));
    assert.equal(denied.status, 403);
    const payload = await denied.json();
    assert.match(payload.error, /Attack not on equipped weapon/);
    assert.equal(admin.calls.some(c => c.table === 'portal_run' && c.op === 'update'), false);
  });

  it('POST /commit unarmed fist path does not consult weapon slots', async () => {
    const admin = mockAdmin(commitResponder(null));
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/runs/1/commit', { hand: 'LH', attack_id: 1, target_ids: [1] }));
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(admin.calls.some(c => c.table === 'weapon_instance'), false);
    const upd = admin.calls.find(c => c.table === 'portal_run' && c.op === 'update');
    const winding = upd.payload.battle_state.queue.find(r => r.label === 'LH' && r.event === 'winding');
    assert.equal(winding.attackName, 'Fist');
  });
});
