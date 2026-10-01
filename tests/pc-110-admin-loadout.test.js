import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST, __setAdminClientForTests } from '../api/combat/[...path].js';

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
      if (single) {
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : (result.data ?? null);
        return Promise.resolve({ data, error: result.error || null });
      }
      return Promise.resolve({ data: result.data ?? null, error: result.error || null });
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

function req(method, path, body) {
  const init = {
    method,
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request('https://portalcolosseum.com/api/combat' + path, init);
}

function adminProfile(isAdmin) {
  return (snap) => {
    if (snap.table === 'profiles') return { data: { is_admin: isAdmin } };
    return null;
  };
}

const POTION = {
  id: 4,
  name: 'Health Potion',
  effect_type: 'heal',
  floor_base: 10,
  floor_delta: 0,
  window_base: 4,
  window_delta: 0,
  speed_base: 3,
  speed_delta: 0,
  crit_base: 5,
  crit_range: 0,
};

const SWORD = {
  id: 3,
  name: 'Short Sword',
  slot_0_attack_id: 1,
  base_damage: 12,
  damage_range: 0,
  base_speed: 6,
  speed_range: 0,
  base_accuracy: 70,
  accuracy_range: 0,
};

describe('GET /dev/templates includes consumables', () => {
  it('returns consumables with id, name, effect_type for an admin', async () => {
    const admin = mockAdmin((snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      if (snap.table === 'weapon_template') return { data: [{ id: 1, name: 'Sword' }] };
      if (snap.table === 'monster_template') return { data: [{ id: 2, name: 'Wolf' }] };
      if (snap.table === 'consumable_template') return { data: [{ id: 4, name: 'Health Potion', effect_type: 'heal' }] };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await GET(req('GET', '/dev/templates'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.consumables, [{ id: 4, name: 'Health Potion', effect_type: 'heal' }]);
    assert.equal(body.weapons.length, 1);
    assert.equal(body.monsters.length, 1);
    const q = admin.calls.find(c => c.table === 'consumable_template');
    assert.equal(q.cols, 'id, name, effect_type');
  });

  it('403s a non-admin and does not query templates', async () => {
    const admin = mockAdmin(adminProfile(false));
    __setAdminClientForTests(admin);
    const res = await GET(req('GET', '/dev/templates'));
    assert.equal(res.status, 403);
    assert.equal(admin.calls.some(c => c.table === 'consumable_template'), false);
  });
});

describe('POST /dev/give-consumable', () => {
  function responder({ rpcError, userId, missing } = {}) {
    let n = 0;
    return (snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      if (snap.table === 'consumable_template') {
        return missing ? { data: null } : { data: POTION };
      }
      if (snap.table === 'rpc:generate_consumable_instance') {
        if (rpcError) return { error: { message: 'Not authenticated' } };
        n += 1;
        return { data: 100 + n };
      }
      if (snap.table === 'consumable_instance' && snap.op === 'select') {
        const id = snap.filters.find(f => f[1] === 'id')[2];
        return { data: { id, rolled_floor: 10, rolled_window: 4, rolled_speed: 3, grade: 'C', user_id: userId || 'user-1' } };
      }
      if (snap.table === 'consumable_instance' && snap.op === 'insert') {
        return { data: { id: 88, ...snap.payload } };
      }
      return { data: null };
    };
  }

  it('grants to the caller via the RPC and returns rolled fields', async () => {
    const admin = mockAdmin(responder());
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-consumable', { template_id: 4, count: 2 }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.template_name, 'Health Potion');
    assert.equal(body.granted.length, 2);
    assert.deepEqual(body.granted[0], {
      instance_id: 101, rolled_floor: 10, rolled_window: 4, rolled_speed: 3, grade: 'C',
    });
    const rpcs = admin.calls.filter(c => c.table === 'rpc:generate_consumable_instance');
    assert.equal(rpcs.length, 2);
    assert.deepEqual(rpcs[0].payload, { p_template_id: 4 });
    assert.equal(admin.calls.some(c => c.op === 'insert'), false);
  });

  it('defaults count to 1 and clamps to 25', async () => {
    const admin = mockAdmin(responder());
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-consumable', { template_id: 4, count: 40 }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.granted.length, 25);
    assert.equal(admin.calls.filter(c => c.op === 'rpc').length, 25);
  });

  it('reassigns the instance when the RPC stamped a different user', async () => {
    const admin = mockAdmin(responder({ userId: 'other-user' }));
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-consumable', { template_id: 4 }));
    assert.equal(res.status, 200);
    const upd = admin.calls.find(c => c.table === 'consumable_instance' && c.op === 'update');
    assert.deepEqual(upd.payload, { user_id: 'user-1' });
    assert.ok(upd.filters.some(f => f[0] === 'eq' && f[1] === 'id' && f[2] === 101));
  });

  it('falls back to a caller-owned insert when the RPC cannot authenticate', async () => {
    const admin = mockAdmin(responder({ rpcError: true }));
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-consumable', { template_id: 4 }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.template_name, 'Health Potion');
    assert.equal(body.granted.length, 1);
    assert.equal(body.granted[0].instance_id, 88);
    const ins = admin.calls.find(c => c.table === 'consumable_instance' && c.op === 'insert');
    assert.equal(ins.payload.user_id, 'user-1');
    assert.equal(ins.payload.template_id, 4);
    assert.equal(ins.payload.rolled_floor, 10);
    assert.ok(admin.calls.some(c => c.op === 'rpc'));
  });

  it('404s a missing template and does not call the RPC', async () => {
    const admin = mockAdmin(responder({ missing: true }));
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-consumable', { template_id: 99 }));
    assert.equal(res.status, 404);
    assert.equal(admin.calls.some(c => c.op === 'rpc'), false);
  });

  it('400s an invalid template_id', async () => {
    const admin = mockAdmin(responder());
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-consumable', { template_id: 0 }));
    assert.equal(res.status, 400);
  });
});

describe('POST /dev/give-weapon-self', () => {
  it('rolls via generate_weapon RPC for the caller, not a looked-up username', async () => {
    const admin = mockAdmin((snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      if (snap.table === 'weapon_template') return { data: SWORD };
      if (snap.op === 'rpc' && snap.table === 'rpc:generate_weapon') {
        return { data: { id: 55, damage: 12, speed: 6, accuracy: 70, grade: 'C' } };
      }
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-weapon-self', { template_id: 3 }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.template_id, 3);
    assert.equal(body.template_name, 'Short Sword');
    assert.equal(body.granted.length, 1);
    assert.deepEqual(body.granted[0], { instance_id: 55, damage: 12, speed: 6, accuracy: 70, grade: 'C' });
    const rpc = admin.calls.find(c => c.op === 'rpc');
    assert.equal(rpc.table, 'rpc:generate_weapon');
    assert.deepEqual(rpc.payload, { p_template_id: 3, p_user_id: 'user-1' });
    assert.equal(admin.calls.some(c => c.op === 'insert'), false);
    assert.equal(admin.calls.filter(c => c.table === 'profiles').length, 1);
  });

  it('500s when generate_weapon returns no id', async () => {
    const admin = mockAdmin((snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      if (snap.table === 'weapon_template') return { data: SWORD };
      if (snap.op === 'rpc') return { data: { damage: 12, grade: 'C' } };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-weapon-self', { template_id: 3 }));
    assert.equal(res.status, 500);
  });

  it('404s a missing weapon template', async () => {
    const admin = mockAdmin((snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/give-weapon-self', { template_id: 9 }));
    assert.equal(res.status, 404);
    assert.equal(admin.calls.some(c => c.op === 'insert'), false);
    assert.equal(admin.calls.some(c => c.op === 'rpc'), false);
  });
});

describe('POST /dev/del-item', () => {
  it('deletes an owned weapon and clears hand/belt pointers first', async () => {
    const admin = mockAdmin((snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      if (snap.table === 'weapon_instance' && snap.op === 'select') return { data: { id: 9 } };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/del-item', { kind: 'weapon', instance_id: 9 }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { deleted: true, kind: 'weapon', instance_id: 9 });
    const clears = admin.calls.filter(c => c.table === 'portal_run' && c.op === 'update');
    assert.deepEqual(clears.map(c => c.payload), [
      { hand_l_weapon_id: null },
      { hand_r_weapon_id: null },
      { belt_weapon_id: null },
    ]);
    clears.forEach(c => {
      assert.ok(c.filters.some(f => f[1] === 'user_id' && f[2] === 'user-1'));
    });
    const del = admin.calls.find(c => c.table === 'weapon_instance' && c.op === 'delete');
    assert.ok(del);
    assert.ok(del.filters.some(f => f[1] === 'id' && f[2] === 9));
    assert.ok(del.filters.some(f => f[1] === 'user_id' && f[2] === 'user-1'));
    assert.ok(admin.calls.indexOf(clears[0]) < admin.calls.indexOf(del));
  });

  it('deletes an owned consumable and clears consume_a/b pointers', async () => {
    const admin = mockAdmin((snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      if (snap.table === 'consumable_instance' && snap.op === 'select') return { data: { id: 4 } };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/del-item', { kind: 'consumable', instance_id: 4 }));
    assert.equal(res.status, 200);
    const clears = admin.calls.filter(c => c.table === 'portal_run' && c.op === 'update');
    assert.deepEqual(clears.map(c => c.payload), [
      { consume_a_id: null },
      { consume_b_id: null },
    ]);
    assert.ok(admin.calls.some(c => c.table === 'consumable_instance' && c.op === 'delete'));
    assert.equal(admin.calls.some(c => c.table === 'weapon_instance' && c.op === 'delete'), false);
  });

  it('404s an instance the caller does not own and does not delete', async () => {
    const admin = mockAdmin((snap) => {
      if (snap.table === 'profiles') return { data: { is_admin: true } };
      return { data: null };
    });
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/del-item', { kind: 'weapon', instance_id: 9 }));
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error, /not found in your inventory/);
    assert.equal(admin.calls.some(c => c.op === 'delete'), false);
    assert.equal(admin.calls.some(c => c.op === 'update'), false);
  });

  it('400s an invalid kind', async () => {
    const admin = mockAdmin(adminProfile(true));
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/del-item', { kind: 'monster', instance_id: 1 }));
    assert.equal(res.status, 400);
  });

  it('403s a non-admin before any delete', async () => {
    const admin = mockAdmin(adminProfile(false));
    __setAdminClientForTests(admin);
    const res = await POST(req('POST', '/dev/del-item', { kind: 'weapon', instance_id: 9 }));
    assert.equal(res.status, 403);
    assert.equal(admin.calls.some(c => c.op === 'delete'), false);
  });
});
