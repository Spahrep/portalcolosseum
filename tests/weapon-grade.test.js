import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST, __setAdminClientForTests } from '../api/combat/[...path].js';

afterEach(() => __setAdminClientForTests(null));

function mockAdmin(responder) {
  const calls = [];
  function chain(table) {
    const ctx = { table, op: null, payload: null, filters: [] };
    const api = {
      select() {
        if (ctx.op !== 'insert' && ctx.op !== 'update') ctx.op = 'select';
        return api;
      },
      insert(payload) { ctx.op = 'insert'; ctx.payload = payload; return api; },
      update(payload) { ctx.op = 'update'; ctx.payload = payload; return api; },
      eq(k, v) { ctx.filters.push(['eq', k, v]); return api; },
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
      return Promise.resolve({ data: result.data ?? null, error: result.error || null });
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

function post(body) {
  return new Request('https://portalcolosseum.com/api/combat/dev/set-weapon-stats', {
    method: 'POST',
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const INSTANCE = { id: 9, template_id: 3, damage: 10, speed: 10, accuracy: 10, crit_chance: 4 };

function template(over = {}) {
  return {
    id: 3,
    name: 'Sword',
    base_damage: 10,
    damage_range: 1,
    base_speed: 10,
    speed_range: 1,
    base_accuracy: 10,
    accuracy_range: 1,
    ...over,
  };
}

async function gradeFromHandler(stats, tmpl = template()) {
  const admin = mockAdmin((snap) => {
    if (snap.table === 'profiles') return { data: { is_admin: true } };
    if (snap.table === 'weapon_instance' && snap.op === 'select') return { data: INSTANCE };
    if (snap.table === 'weapon_template') return { data: tmpl };
    if (snap.table === 'weapon_instance' && snap.op === 'update') return { data: null };
    return { data: null };
  });
  __setAdminClientForTests(admin);
  const res = await POST(post({ instance_id: INSTANCE.id, ...stats }));
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  const upd = admin.calls.find(c => c.table === 'weapon_instance' && c.op === 'update');
  assert.equal(upd.payload.grade, body.grade, 'persisted grade is the handler grade');
  return body.grade;
}

describe('weapon grade from set-weapon-stats', () => {
  it('z >= 3 grades S', async () => {
    assert.equal(await gradeFromHandler({ damage: 13, speed: 7, accuracy: 13 }), 'S');
    assert.equal(await gradeFromHandler(
      { damage: 41, speed: 9, accuracy: 41 },
      template({ base_speed: 40, damage_range: 10, speed_range: 10, accuracy_range: 10 })
    ), 'S');
  });

  it('z = 2 and z = 2.5 grade A', async () => {
    assert.equal(await gradeFromHandler({ damage: 12, speed: 8, accuracy: 12 }), 'A');
    assert.equal(await gradeFromHandler(
      { damage: 15, speed: 5, accuracy: 15 },
      template({ damage_range: 2, speed_range: 2, accuracy_range: 2 })
    ), 'A');
  });

  it('z = 0 and z = 0.9 grade C', async () => {
    assert.equal(await gradeFromHandler({ damage: 10, speed: 10, accuracy: 10 }), 'C');
    assert.equal(await gradeFromHandler(
      { damage: 19, speed: 1, accuracy: 19 },
      template({ damage_range: 10, speed_range: 10, accuracy_range: 10 })
    ), 'C');
  });

  it('z = -1 and z = -0.5 grade D', async () => {
    assert.equal(await gradeFromHandler({ damage: 9, speed: 11, accuracy: 9 }), 'D');
    assert.equal(await gradeFromHandler(
      { damage: 9, speed: 11, accuracy: 9 },
      template({ damage_range: 2, speed_range: 2, accuracy_range: 2 })
    ), 'D');
  });

  it('z = -2 grades E; z < -2 grades F', async () => {
    assert.equal(await gradeFromHandler({ damage: 8, speed: 12, accuracy: 8 }), 'E');
    assert.equal(await gradeFromHandler(
      { damage: 11, speed: 32, accuracy: 11 },
      template({ base_damage: 32, base_speed: 11, base_accuracy: 32, damage_range: 10, speed_range: 10, accuracy_range: 10 })
    ), 'F');
    assert.equal(await gradeFromHandler(
      { damage: 10, speed: 40, accuracy: 10 },
      template({ base_damage: 40, base_speed: 10, base_accuracy: 40, damage_range: 10, speed_range: 10, accuracy_range: 10 })
    ), 'F');
  });

  it('a zero range contributes z=0; uniform ±range extremes are B and D', async () => {
    assert.equal(await gradeFromHandler(
      { damage: 25, speed: 18, accuracy: 88 },
      template({ base_damage: 25, damage_range: 0, base_speed: 18, speed_range: 2, base_accuracy: 88, accuracy_range: 4 })
    ), 'C');
    assert.equal(await gradeFromHandler(
      { damage: 30, speed: 16, accuracy: 92 },
      template({ base_damage: 25, damage_range: 5, base_speed: 18, speed_range: 2, base_accuracy: 88, accuracy_range: 4 })
    ), 'B');
    assert.equal(await gradeFromHandler(
      { damage: 20, speed: 20, accuracy: 84 },
      template({ base_damage: 25, damage_range: 5, base_speed: 18, speed_range: 2, base_accuracy: 88, accuracy_range: 4 })
    ), 'D');
  });

  it('setting crit does not change the grade the stats already earned', async () => {
    const tmpl = template();
    const without = await gradeFromHandler({ damage: 13, speed: 7, accuracy: 13 }, tmpl);
    const withCrit = await gradeFromHandler({ damage: 13, speed: 7, accuracy: 13, crit: 40 }, tmpl);
    assert.equal(without, 'S');
    assert.equal(withCrit, without);
  });
});
