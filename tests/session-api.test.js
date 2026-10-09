import { mock, describe, it } from 'node:test';
import assert from 'node:assert/strict';

mock.module('@supabase/supabase-js', {
  exports: {
    createClient() {
      return {
        auth: {
          refreshSession: async () => ({ data: null, error: { message: 'expired' } }),
        },
      };
    },
  },
});

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

const { GET } = await import('../api/session.js');

function get(cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  return new Request('https://portalcolosseum.com/api/session', { headers });
}

describe('GET /api/session 401', () => {
  it('401s when the refresh cookie is missing', async () => {
    const res = await GET(get());
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'No session cookie' });
  });

  it('401s and clears the cookie when refresh fails', async () => {
    const res = await GET(get('supabase_refresh_token=stale-token'));
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Session expired or invalid' });
    assert.match(res.headers.get('set-cookie'), /supabase_refresh_token=;/);
    assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  });
});
