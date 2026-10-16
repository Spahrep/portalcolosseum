/**
 * /js/hud-resources.js
 * =====================
 * Bottom-dock wallet HUD (PC-HUD): renders the player's current/max AP and
 * current gold in the fixed status-dock on game/run/run-equip screens.
 *
 * This is a LEAF module — it imports nothing from an app root (no
 * import-back-up per pc-coding-standards). State flows in: the app shell calls
 * refreshHudWallet(token) once on boot, and may re-call it (or renderHudWallet
 * with a fresh payload) whenever the wallet changes — e.g. from the AP-heartbeat
 * onGrant callback, after a run start, or after gold is spent.
 *
 * Data source: GET /api/user/profile?transition=1   (grants accrued daily AP
 * on entry AND returns { settings, ap, max_ap, gold, last_daily_ap }).
 */

let dockEl = null;
let apTextEl = null;
let apFillEl = null;
let goldEl = null;

/** Locate + cache dock element refs. Safe to call repeatedly; no-op if absent. */
function cacheEls() {
  if (dockEl) return true;
  dockEl = document.getElementById('status-dock');
  if (!dockEl) return false;
  apTextEl = document.getElementById('hud-ap');
  apFillEl = document.getElementById('hud-ap-fill');
  goldEl = document.getElementById('hud-gold');
  return true;
}

/** Clamp helper: keep a number within [0, max]. */
function clamp(n, max) {
  if (typeof n !== 'number' || !isFinite(n)) return 0;
  if (typeof max !== 'number' || !isFinite(max) || max <= 0) max = 1;
  return Math.max(0, Math.min(n, max));
}

/**
 * Render the dock from a wallet payload { ap, max_ap, gold }.
 * No-op if the dock or its value elements are not present.
 */
export function renderHudWallet({ ap, max_ap, gold } = {}) {
  if (!cacheEls()) return;

  const cur = typeof ap === 'number' && isFinite(ap) ? ap : 0;
  const max = typeof max_ap === 'number' && isFinite(max_ap) && max_ap > 0 ? max_ap : 500;
  const g = typeof gold === 'number' && isFinite(gold) ? gold : 0;

  if (apTextEl) {
    apTextEl.textContent = `${cur}/${max}`;
    apTextEl.title = `AP: ${cur} of ${max}`;
  }
  if (goldEl) {
    goldEl.textContent = `◉ ${g.toLocaleString()}gc`;
    goldEl.title = `${g.toLocaleString()} gold`;
  }
  if (dockEl) {
    dockEl.title = `AP: ${cur}/${max} · gained daily (cap ${max}) · spent on runs & shop rerolls\u000A` +
      `Gold: ${g.toLocaleString()}gc · earned from runs, spent at shops, entry fees & rerolls`;
  }
  if (apFillEl) {
    const pct = Math.round((clamp(cur, max) / max) * 100);
    apFillEl.style.width = `${pct}%`;
  }
}

/**
 * Fetch the wallet via GET /api/user/profile?transition=1 (also triggers any
 * accrued daily-AP grant) and render it into the dock. Returns the payload,
 * or null on failure (dock left as-is).
 */
export async function refreshHudWallet(token) {
  try {
    const res = await fetch('/api/user/profile?transition=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    renderHudWallet(payload);
    return payload;
  } catch {
    return null; // network/parse failure — don't clobber the dock
  }
}
