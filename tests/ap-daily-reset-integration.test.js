/**
 * /tests/ap-daily-reset-integration.test.js
 * ==========================================
 * P5 integration/regression tests for the AP daily-reset flow, ACROSS the
 * server hooks:
 *   - GET /api/user/profile?transition=1  (grants accrued AP, returns ap+last_daily_ap)
 *   - GET /api/user/profile               (passive: cached, no grant)
 *   - chargeRunEntry                      (grants BEFORE the AP-sufficiency check)
 *
 * Style matches tests/profile-api.test.js and tests/combat-api-correctness.test.js:
 * mock @supabase/supabase-js, no live network, built-in node --test only.
 *
 * The helper's own unit tests live in tests/ap-daily-reset.test.js (P2). This
 * file exercises the real handlers end-to-end through a stateful DB mock.
 */
import { mock, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---- Stateful in-memory DB mock -------------------------------------------
// Mirrors the real tables the handlers touch: game_config (singleton id=1) and
// profiles (id, settings, ap, last_daily_ap, gold).
const db = {
  game_config: { id: 1, daily_ap_gain: 100, max_ap: 500 },
  profiles: new Map(), // id -> { settings, ap, last_daily_ap, gold }
};

function resetDb() {
  db.game_config = { id: 1, daily_ap_gain: 100, max_ap: 500 };
  db.profiles = new Map();
}

// A profile row with the wallet columns present (normal, migrated DB).
function seedProfile(id, { ap = 0, last_daily_ap = null, gold = 0, settings = {} } = {}) {
  db.profiles.set(id, { settings, ap, last_daily_ap, gold });
}

// Chainable supabase query builder over the in-memory db.
function chain(table) {
  const ctx = { op: 'select', cols: null, eqCol: null, eqVal: null, payload: null };
  const api = {
    select(cols) { ctx.cols = cols; return api; },
    update(payload) { ctx.op = 'update'; ctx.payload = payload; return api; },
    eq(col, val) { ctx.eqCol = col; ctx.eqVal = val; return api; },
    maybeSingle() { return finish(); },
    single() { return finish(); },
    then(res, rej) { return finish().then(res, rej); },
  };

  function finish() {
    if (table === 'game_config') {
      return Promise.resolve({ data: { ...db.game_config }, error: null });
    }
    if (table === 'profiles') {
      const row = ctx.eqCol === 'id' ? db.profiles.get(ctx.eqVal) : undefined;
      if (ctx.op === 'update') {
        if (!row) return Promise.resolve({ data: null, error: null });
        Object.assign(row, ctx.payload);
        return Promise.resolve({ data: { ...row }, error: null });
      }
      if (!row) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: { ...row }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
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
        from(t) { return chain(t); },
        rpc() { return { rpc: true }; },
      };
    },
  },
});

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

const { GET } = await import('../api/user/profile.js');
const { chargeRunEntry } = await import('../api/combat/[...path].js');

function profileReq(transition) {
  const qs = transition ? '?transition=1' : '';
  return new Request(`https://portalcolosseum.com/api/user/profile${qs}`, {
    method: 'GET',
    headers: { authorization: 'Bearer tok' },
  });
}

// A template with a known AP entry cost.
const tmpl = { ap_cost: 150, entry_gold_cost: 0 };

// "N days before today (UTC)" as an ISO date — keeps every date-aware test robust
// no matter when it runs, instead of pinning one hardcoded "today".
const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
};
const TODAY = daysAgo(0);

describe('GET /api/user/profile?transition=1 — daily grant', () => {
  beforeEach(resetDb);

  it('grants accrued AP and returns updated ap + last_daily_ap', async () => {
    seedProfile('user-1', { ap: 0, last_daily_ap: daysAgo(3) }); // 3 days ago
    const res = await GET(profileReq(true));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.ap, 300); // 0 + 100*3
    assert.equal(body.last_daily_ap, TODAY); // today (UTC)
  });

  it('caps at max_ap (500) and never exceeds it', async () => {
    seedProfile('user-1', { ap: 480, last_daily_ap: daysAgo(1) }); // 1 day ago
    const res = await GET(profileReq(true));
    const body = await res.json();
    assert.equal(body.ap, 500); // min(480+100, 500)
  });

  it('accrues missed days: 3 days at 0 → 300', async () => {
    seedProfile('user-1', { ap: 0, last_daily_ap: daysAgo(3) });
    const body = await (await GET(profileReq(true))).json();
    assert.equal(body.ap, 300);
  });

  it('accrues missed days: 5 days at 0 → capped 500', async () => {
    seedProfile('user-1', { ap: 0, last_daily_ap: daysAgo(5) }); // 5 days ago
    const body = await (await GET(profileReq(true))).json();
    assert.equal(body.ap, 500); // min(0+100*5, 500)
  });

  it('is idempotent: two ?transition=1 calls same UTC day grant once', async () => {
    seedProfile('user-1', { ap: 0, last_daily_ap: daysAgo(3) });
    const first = await (await GET(profileReq(true))).json();
    assert.equal(first.ap, 300);
    // Second call same day: last_daily_ap is now today → no elapsed days → no grant.
    const second = await (await GET(profileReq(true))).json();
    assert.equal(second.ap, 300);
    assert.equal(second.last_daily_ap, TODAY);
  });

  it('treats NULL last_daily_ap as today — no retroactive grant', async () => {
    seedProfile('user-1', { ap: 10, last_daily_ap: null });
    const body = await (await GET(profileReq(true))).json();
    assert.equal(body.ap, 10); // unchanged
    assert.equal(body.last_daily_ap, null); // no grant fired, still NULL
  });

  it('returns max_ap (AP cap) and current gold for the HUD dock', async () => {
    // last_daily_ap = today (UTC) → no grant fires → ap/gold pass through untouched.
    seedProfile('user-1', { ap: 120, last_daily_ap: TODAY, gold: 3470 });
    const body = await (await GET(profileReq(true))).json();
    assert.equal(body.ap, 120); // no grant (last_daily_ap is today)
    assert.equal(body.max_ap, 500); // game_config.max_ap in mock
    assert.equal(body.gold, 3470); // wallet forwarded to the HUD
  });
});

describe('GET /api/user/profile (passive) — no grant', () => {
  beforeEach(resetDb);

  it('returns cached AP without granting and without advancing last_daily_ap', async () => {
    seedProfile('user-1', { ap: 0, last_daily_ap: daysAgo(3) });
    const res = await GET(profileReq(false));
    assert.equal(res.status, 200);
    const body = await res.json();
    // Passive path returns only settings (no ap/last_daily_ap in body).
    assert.deepEqual(body, { settings: {} });
    // And the DB was NOT touched: still 0 AP, still 3 days stale.
    const row = db.profiles.get('user-1');
    assert.equal(row.ap, 0);
    assert.equal(row.last_daily_ap, daysAgo(3));
  });
});

describe('chargeRunEntry — grant before AP-sufficiency check', () => {
  beforeEach(resetDb);

  it('grants a stale balance up to >= ap_cost, then lets the run start', async () => {
    // 0 AP, last grant 3 days ago → grant fires +300 → 300 >= 150 cost → run starts.
    seedProfile('user-1', { ap: 0, last_daily_ap: daysAgo(3), gold: 0 });
    const out = await chargeRunEntry({ from: (t) => chain(t) }, 'user-1', tmpl);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.charged.ap, 150);
    // Balance after charge: 300 - 150 = 150.
    assert.equal(db.profiles.get('user-1').ap, 150);
  });

  it('blocks a player still below cost after the grant', async () => {
    // 0 AP, last grant 1 day ago → grant fires +100 → 100 < 150 cost → blocked.
    seedProfile('user-1', { ap: 0, last_daily_ap: daysAgo(1), gold: 0 });
    const out = await chargeRunEntry({ from: (t) => chain(t) }, 'user-1', tmpl);
    assert.equal(out.ok, false);
    assert.equal(out.status, 400);
    assert.match(out.error, /Not enough AP or gold/);
  });
});
