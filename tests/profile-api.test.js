import { mock, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const saved = { settings: { speed: 1, font: 'sm' } };
const updates = [];

function chain() {
  const ctx = { op: 'select', payload: null };
  const api = {
    select() {
      if (ctx.op !== 'update') ctx.op = 'select';
      return api;
    },
    update(payload) {
      ctx.op = 'update';
      ctx.payload = payload;
      updates.push(payload);
      return api;
    },
    eq() { return api; },
    single() { return finish(); },
    maybeSingle() { return finish(); },
    then(res, rej) { return finish().then(res, rej); },
  };
  function finish() {
    if (ctx.op === 'select') {
      return Promise.resolve({ data: { settings: { ...saved.settings } }, error: null });
    }
    return Promise.resolve({ data: { settings: ctx.payload.settings }, error: null });
  }
  return api;
}

mock.module('@supabase/supabase-js', {
  exports: {
    createClient() {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
        },
        from() { return chain(); },
        rpc() { return { rpc: true }; },
      };
    },
  },
});

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

const { GET, PATCH } = await import('../api/user/profile.js');

function req(method, body) {
  const init = {
    method,
    headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request('https://portalcolosseum.com/api/user/profile', init);
}

describe('GET /api/user/profile', () => {
  it('returns the authenticated profile settings', async () => {
    const res = await GET(req('GET'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { settings: { speed: 1, font: 'sm' } });
  });
});

describe('PATCH /api/user/profile', () => {
  it('merges the body onto the stored settings and returns the write', async () => {
    updates.length = 0;
    const res = await PATCH(req('PATCH', { settings: { font: 'lg', shake: true } }));
    assert.equal(res.status, 200, await res.clone().text());
    assert.deepEqual(await res.json(), {
      settings: { speed: 1, font: 'lg', shake: true },
    });
    const merged = updates.find(u => u.settings && u.settings.shake === true);
    assert.deepEqual(merged.settings, { speed: 1, font: 'lg', shake: true });
  });
});
