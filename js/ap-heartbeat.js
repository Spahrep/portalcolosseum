/**
 * AP Heartbeat — lightweight UTC date-rollover backstop for daily AP grant.
 * Fires a single ?transition=1 profile fetch on midnight rollover while the app is open.
 * NOT tied to combat engine tick(). Wired from app-shell bootstrap only.
 * Follows repo module style: small, no import-back-up to app roots, pure fetch.
 */

let lastSeenDate = null;
let intervalId = null;

/**
 * Start the UTC rollover heartbeat.
 * @param {string} token - auth token for the profile fetch
 * @param {Function} [onGrant] - optional callback after a successful transition fetch (e.g. refresh HUD)
 */
export function startApHeartbeat(token, onGrant) {
  if (intervalId) return; // idempotent

  const check = async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastSeenDate && lastSeenDate !== today) {
      // UTC date rolled over — trigger the grant via transition fetch
      try {
        const res = await fetch(`/api/user/profile?transition=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && typeof onGrant === 'function') {
          const data = await res.json();
          onGrant(data);
        }
      } catch (e) {
        // soft fail; next tick will retry
        console.warn('AP heartbeat transition fetch failed (soft):', e);
      }
    }
    lastSeenDate = today;
  };

  // Seed on start
  lastSeenDate = new Date().toISOString().slice(0, 10);

  // Light 1s interval (cheap check, only the date string compare)
  intervalId = setInterval(check, 1000);
}

/** Stop the heartbeat (for tests / logout if needed). */
export function stopApHeartbeat() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  lastSeenDate = null;
}
