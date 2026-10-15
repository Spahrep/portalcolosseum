import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// --- Mocked Supabase admin client -------------------------------------------
// Drives ensureDailyAp(admin, userId). `state` holds the profiles row and the
// game_config singleton; updates are applied and recorded so assertions can
// verify exact write payloads (incl. that last_daily_ap is untouched on no-op).
const state = {
  config: { id: 1, daily_ap_gain: 100, max_ap: 500 },
  profile: { ap: 10, last_daily_ap: null },
  updateLog: [],
};

function chain() {
  let table = null;
  let payload = null;
  const api = {
    from(t) { table = t; return api; },
    select() { return api; },
    update(p) { payload = p; return api; },
    eq() { return api; },
    maybeSingle() {
      if (table === 'game_config') return Promise.resolve({ data: state.config, error: null });
      if (table === 'profiles') return Promise.resolve({ data: { ...state.profile }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    then(res, rej) {
      // Executes the whole chain: reads are served for .select, the .update
      // payload is applied to state + logged.
      if (payload !== null) {
        state.profile = { ...state.profile, ...payload };
        state.updateLog.push({ table, ...payload });
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      }
      return this.maybeSingle().then(res, rej);
    },
  };
  return api;
}

const admin = {
  from: (t) => { const c = chain(); return c.from(t); },
};

const mod = await import('../api/lib/ap-daily.js');
const { ensureDailyAp } = mod;

function reset(ap, last) {
  state.profile = { ap, last_daily_ap: last };
  state.updateLog = [];
  // Config unchanged across tests (gain 100 / cap 500).
}

// --- Tests -------------------------------------------------------------------

describe('ensureDailyAp (lazy daily grant)', () => {
  it('same-day call is a no-op: AP and last_daily_ap unchanged, no write', async () => {
    reset(10, mod.utcDateString());
    const out = await ensureDailyAp(admin, 'u1');
    assert.equal(out.ap, 10);
    assert.equal(out.last_daily_ap, mod.utcDateString());
    assert.equal(state.updateLog.length, 0, 'no UPDATE should fire same-day');
  });

  it('3 missed days from 0 AP -> 300', async () => {
    // last_daily_ap 3 days ago
    const d = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    reset(0, d);
    const out = await ensureDailyAp(admin, 'u1');
    assert.equal(out.ap, 300);
    assert.equal(state.updateLog.at(-1).ap, 300);
    assert.equal(state.updateLog.at(-1).last_daily_ap, mod.utcDateString());
  });

  it('5 missed days from 0 AP -> capped at 500', async () => {
    const d = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    reset(0, d);
    const out = await ensureDailyAp(admin, 'u1');
    assert.equal(out.ap, 500);
    assert.equal(state.updateLog.at(-1).ap, 500);
  });

  it('450 at day change -> 500 (only needs +50)', async () => {
    const d = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);
    reset(450, d);
    const out = await ensureDailyAp(admin, 'u1');
    assert.equal(out.ap, 500);
    assert.equal(state.updateLog.at(-1).ap, 500);
  });

  it('480 at cap -> +20 -> 500, never exceeds', async () => {
    const d = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);
    reset(480, d);
    const out = await ensureDailyAp(admin, 'u1');
    assert.equal(out.ap, 500);
  });

  it('NULL last_daily_ap treated as today -> no retroactive gift', async () => {
    reset(250, null);
    const out = await ensureDailyAp(admin, 'u1');
    assert.equal(out.ap, 250, 'no grant should fire when last_daily_ap is NULL');
    assert.equal(state.updateLog.length, 0, 'no write on NULL-first-access');
  });

  it('never returns AP lower than input', async () => {
    reset(480, new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10));
    const out = await ensureDailyAp(admin, 'u1');
    assert.ok(out.ap >= 480, 'AP must not decrease');
  });
});
