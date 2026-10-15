/**
 * /api/lib/ap-daily.js
 * ====================
 * Lazy daily-AP grant (PC-DEC-073). No cron: the grant fires only when
 * accessor code calls ensureDailyAp() at a screen/state transition where AP
 * matters (run start via chargeRunEntry, or GET /api/user/profile?transition=1).
 *
 * Semantics (user-locked, do not change):
 *   - Every player accrues daily_ap_gain (100) AP per FULL elapsed day,
 *     capped at max_ap (500). Missed days accumulate (3 days missed = +300).
 *   - new_ap = min(ap + daily_ap_gain * days_elapsed, max_ap)
 *   - days_elapsed = whole days between last_daily_ap and today (UTC).
 *     last_daily_ap = NULL is treated as today (a brand-new-ish player's
 *     first grant accrues from their real current balance — no retroactive gift).
 *   - last_daily_ap records the last day a grant actually FIRED, not the last
 *     read/spend. A same-day call never advances it.
 *   - Idempotent: two calls the same UTC day → one grant.
 *   - Never decreases AP. Never exceeds max_ap. Never fires more than once/day.
 */

/**
 * Apply the accrual grant for a player, idempotently.
 *
 * @param {object} admin  Supabase admin client (service role) — created the same
 *                        way as getAdminClient() in api/user/profile.js.
 * @param {string} userId Supabase auth user id (profiles.id PK).
 * @returns {Promise<{ap: number, last_daily_ap: string|null}>}
 *          The (possibly updated) balance + last-granted date.
 */
export async function ensureDailyAp(admin, userId) {
  // Read the config singleton (id=1). Columns could still be NULL on a fresh
  // DB or a legacy row that predates the decision — fall back safely.
  const { data: cfg, error: cfgErr } = await admin
    .from('game_config')
    .select('daily_ap_gain, max_ap')
    .eq('id', 1)
    .maybeSingle();

  if (cfgErr) throw cfgErr;

  const gain = cfg && typeof cfg.daily_ap_gain === 'number' ? cfg.daily_ap_gain : 100;
  const cap = cfg && typeof cfg.max_ap === 'number' ? cfg.max_ap : 500;
  if (gain <= 0 || cap < 0) throw new Error('Invalid daily AP config');

  // Current balance + last-granted date.
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('ap, last_daily_ap')
    .eq('id', userId)
    .maybeSingle();

  if (profErr) {
    // Profile read failed (e.g. unmigrated DB missing wallet columns, or a
    // transient error). The daily grant is a bonus — never block the caller
    // (run entry, profile fetch) on it. Return a safe no-op.
    return { ap: 0, last_daily_ap: null };
  }
  if (!prof) return { ap: 0, last_daily_ap: null };

  const today = utcDateString(); // 'YYYY-MM-DD'

  // last_daily_ap NULL → treat as today: no elapsed days, no immediate grant.
  const last = prof.last_daily_ap; // string 'YYYY-MM-DD' | null
  const daysElapsed = last ? wholeDaysBetween(last, today) : 0;

  const currentAp = typeof prof.ap === 'number' ? prof.ap : 0;
  const newAp = Math.min(currentAp + gain * daysElapsed, cap);

  if (daysElapsed <= 0 || newAp <= currentAp) {
    // Same day (idempotent) or already at/near cap — nothing to grant.
    return { ap: currentAp, last_daily_ap: last };
  }

  // Grant fired: advance last_daily_ap to today AND write the new balance.
  const { error: updErr } = await admin
    .from('profiles')
    .update({ ap: newAp, last_daily_ap: today })
    .eq('id', userId);

  if (updErr) throw updErr;

  return { ap: newAp, last_daily_ap: today };
}

/** Today's UTC date as 'YYYY-MM-DD'. */
export function utcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Whole-number days from start to end, both as 'YYYY-MM-DD' (end >= start). */
function wholeDaysBetween(start, end) {
  const ms = Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z');
  return Math.floor(ms / 86400000);
}
