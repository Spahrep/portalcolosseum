import { mock, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const box = {
  client: null,
};

mock.module('../js/utils.js', {
  exports: {
    supabaseClient() {
      return box.client;
    },
  },
});

const { apiCall, checkAuth } = await import('../js/combat/combat-api.js');

function jsonResponse(status, text) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

describe('combat-api apiCall / checkAuth', () => {
  it('throws HTTP status text when the error body is empty', async () => {
    box.client = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      },
    };
    const seen = {};
    globalThis.fetch = async (url, opts) => {
      seen.url = url;
      seen.auth = opts.headers.Authorization;
      return jsonResponse(502, '');
    };
    await assert.rejects(() => apiCall('/runs/1'), { message: 'HTTP 502' });
    assert.equal(seen.url, '/api/combat/runs/1');
    assert.equal(seen.auth, 'Bearer tok');
  });

  it('throws the response body when it is non-empty', async () => {
    box.client = { auth: { getSession: async () => ({ data: { session: null } }) } };
    globalThis.fetch = async () => jsonResponse(400, 'bad hand');
    await assert.rejects(() => apiCall('/commit', 'POST', { hand: 'LH' }), { message: 'bad hand' });
  });

  it('redirects to login when the session is missing', async () => {
    globalThis.window = { location: { href: '/run.html' } };
    box.client = { auth: { getSession: async () => ({ data: { session: null } }) } };
    const result = await checkAuth();
    assert.equal(result, false);
    assert.equal(globalThis.window.location.href, '/login.html');
  });

  it('redirects to login when there is no supabase client', async () => {
    globalThis.window = { location: { href: '/run.html' } };
    box.client = null;
    const result = await checkAuth();
    assert.equal(result, false);
    assert.equal(globalThis.window.location.href, '/login.html');
  });
});
