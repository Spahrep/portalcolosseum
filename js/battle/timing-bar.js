/**
 * Queue timing-bar fill. Design: width% = (1 - remaining / initial) × 100.
 * Blue while charging (winding / drinking). Cyan at reduction (cooldown / recovery).
 * Ready, approach, and impact rows have no bar.
 * Monster winding is a charging row (PC-102) and gets the same fill.
 */

const CHARGING = new Set(['winding', 'drinking']);
const REDUCTION = new Set(['cooldown', 'recovery']);

export function rowShowsTimingBar(row) {
  if (!row || !row.event) return false;
  if (row.event === 'ready' || row.event === 'approach' || row.event === 'impact') return false;
  if (row.event === 'attack') return false; // legacy monster attack: name + tic only
  return CHARGING.has(row.event) || REDUCTION.has(row.event);
}

/** 'blue' while charging, 'cyan' at reduction. */
export function timingBarColor(row) {
  if (row && REDUCTION.has(row.event)) return 'cyan';
  return 'blue';
}

/**
 * Initial tics for the fill denominator.
 * Prefer an explicit initialTics on the row. Otherwise derive from action data
 * (castTicks while winding, cooldownTicks / postTicks while reducing).
 * `remembered` is the first tics value seen for this row id when the row
 * itself does not carry the original length.
 */
export function initialTicsFor(row, remembered) {
  if (!row) return 0;
  const explicit = Number(row.initialTics ?? row.initial_tics);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (row.event === 'winding') {
    const cast = Number(row.castTicks);
    if (Number.isFinite(cast) && cast > 0) return cast;
  }
  if (row.event === 'cooldown' || row.event === 'recovery') {
    const cd = Number(row.cooldownTicks ?? row.postTicks);
    if (Number.isFinite(cd) && cd > 0) return cd;
  }
  if (row.event === 'drinking') {
    const pre = Number(row.preTicks ?? row.postTicks);
    if (Number.isFinite(pre) && pre > 0) return pre;
  }
  const seen = Number(remembered);
  if (Number.isFinite(seen) && seen > 0) return seen;
  const tics = Number(row.tics);
  return Number.isFinite(tics) && tics > 0 ? tics : 0;
}

/** 0..1 fill. 0 at insert (full tics left), 1 when remaining hits 0. */
export function timingFillRatio(row, remembered) {
  const initial = initialTicsFor(row, remembered);
  const remaining = Math.max(0, Number(row && row.tics) || 0);
  if (!initial) return remaining <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, 1 - remaining / initial));
}

export function timingFillPercent(row, remembered) {
  return Math.round(timingFillRatio(row, remembered) * 100);
}
