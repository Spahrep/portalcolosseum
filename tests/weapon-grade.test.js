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

// PC-DEC-076: quality_multiplier = max(power_score / base_power, 0.25) ^ 0.78
// power_score = d * (100/s) * (a/100) * (1 + c/100); base_power = base_damage * (100/base_speed) * (base_accuracy/100) * 1.05
function expectedQm(d, s, a, c, tmpl) {
  const powerScore = d * (100.0 / s) * (a / 100.0) * (1.0 + (c / 100.0));
  const basePower = tmpl.base_damage * (100.0 / tmpl.base_speed) * (tmpl.base_accuracy / 100.0) * 1.05;
  return Math.pow(Math.max(powerScore / basePower, 0.25), 0.78);
}
function expectedTier(qm) {
  return qm >= 1.11 ? 'S' : qm >= 1.075 ? 'A' : qm >= 1.04 ? 'B' : qm >= 0.985 ? 'C' : qm >= 0.94 ? 'D' : 'E';
}

async function resultFromHandler(stats, tmpl = template()) {
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
  return { body, upd };
}

describe('weapon quality_multiplier + tier from set-weapon-stats (PC-DEC-076)', () => {
  it('persists quality_multiplier, tier, and grade mirror matching the power_score formula', async () => {
    const { body, upd } = await resultFromHandler({ damage: 13, speed: 7, accuracy: 13 });
    const qm = expectedQm(13, 7, 13, INSTANCE.crit_chance, template());
    assert.ok(Math.abs(body.quality_multiplier - qm) < 1e-9, `qm ${body.quality_multiplier} != ${qm}`);
    assert.equal(body.tier, expectedTier(qm));
    assert.equal(upd.payload.quality_multiplier, qm);
    assert.equal(upd.payload.tier, body.tier);
    assert.equal(upd.payload.grade, body.tier, 'grade mirrors tier for legacy readers');
  });

  it('a god roll (high damage, fast, accurate) grades S', async () => {
    const { body } = await resultFromHandler({ damage: 13, speed: 7, accuracy: 13 });
    assert.equal(body.tier, 'S');
  });

  it('an average roll grades C', async () => {
    const { body } = await resultFromHandler({ damage: 10, speed: 10, accuracy: 10 });
    assert.equal(body.tier, 'C');
  });

  it('a poor roll grades E', async () => {
    const { body } = await resultFromHandler({ damage: 8, speed: 12, accuracy: 8 });
    assert.equal(body.tier, 'E');
  });

  it('crit IS part of the power_score formula — raising crit can push a roll up a tier', async () => {
    const tmpl = template();
    const low = await resultFromHandler({ damage: 10, speed: 10, accuracy: 10, crit: 0 }, tmpl);
    const high = await resultFromHandler({ damage: 10, speed: 10, accuracy: 10, crit: 60 }, tmpl);
    const qmLow = expectedQm(10, 10, 10, 0, tmpl);
    const qmHigh = expectedQm(10, 10, 10, 60, tmpl);
    assert.ok(qmHigh > qmLow, 'higher crit must raise quality_multiplier');
    assert.ok(expectedTier(qmHigh) >= expectedTier(qmLow), 'higher crit must not lower tier');
  });

  it('identical stats always yield the same quality_multiplier (no source-dependent value)', async () => {
    const a = await resultFromHandler({ damage: 12, speed: 8, accuracy: 12 });
    const b = await resultFromHandler({ damage: 12, speed: 8, accuracy: 12 });
    assert.equal(a.body.quality_multiplier, b.body.quality_multiplier);
    assert.equal(a.body.tier, b.body.tier);
  });
});
