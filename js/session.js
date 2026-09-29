/**
 * Portal Colosseum - Session bootstrap (PC-92)
 * ============================================
 * One copy of the PKCE + HttpOnly-cookie sequence that town and mobile
 * used to duplicate, plus the helpers those screens share with equip,
 * battle, and the auth pages.
 *
 * Uses the supabaseClient() singleton from utils.js. Do not create a
 * second client here — every screen must see the same PKCE session.
 *
 * Fail-closed vs soft-fail is intentional. Do not "tighten" a soft-fail:
 *   - ensureSession: any thrown error, or no session, redirects (fail-closed).
 *   - cookie GET restore: log and continue; the outer !session check still redirects.
 *   - active-run bounce and settings fetch: log and continue. A redirect loop is worse.
 *   - persistRefreshCookie itself does not catch. Callers that must keep going
 *     (login, admin) wrap it. Callers that must fail closed (ensureSession) do not.
 */

import { supabaseClient } from './utils.js';

/**
 * POST /api/session — persist the refresh token in an HttpOnly cookie.
 * Returns the fetch Response when a token was posted, otherwise undefined.
 * Does not catch: a thrown fetch fails closed inside ensureSession, and
 * login/admin/signup keep their own catch or response.ok check at the call site.
 * @param {object|null|undefined} session
 * @returns {Promise<Response|undefined>}
 */
export async function persistRefreshCookie(session) {
  if (session && session.refresh_token) {
    return await fetch('/api/session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
  }
}

/**
 * Full PKCE + cookie-restore + fail-closed sequence.
 * Returns the session, or redirects and returns null.
 *
 * Guard order matches game-app.js / mobile-app.js exactly:
 *   1. Client only if SUPABASE_URL is set (supabaseClient() may still return null).
 *   2. if (supabase) — otherwise redirect.
 *   3. code= in the query → getSession, then POST the refresh cookie.
 *      That first getSession is only for the cookie. It does not become the
 *      returned session (the original shadowed the outer binding).
 *   4. Second getSession — localStorage / PKCE exchange result.
 *   5. If still empty, GET /api/session and setSession (inner try; log, don't redirect).
 *   6. Still no session, or anything thrown: redirect to redirectTo.
 *
 * @param {{ redirectTo?: string }} [opts]
 * @returns {Promise<object|null>}
 */
export async function ensureSession({ redirectTo = '/login' } = {}) {
  // Same gate as game-app / mobile-app: don't construct the client (and don't
  // log utils' missing-config error) unless SUPABASE_URL is set.
  const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
  let supabase = null;
  if (SUPABASE_URL) {
    supabase = supabaseClient();
  }

  let session = null;
  if (supabase) {
    try {
      // PKCE callback: detectSessionInUrl already exchanged the code.
      // Persist the refresh token, then fall through to the normal read.
      if (window.location.search.includes('code=')) {
        const { data: { session: callbackSession }, error: _error } = await supabase.auth.getSession();
        await persistRefreshCookie(callbackSession);
      }

      const { data: { session: storedSession }, error: _error } = await supabase.auth.getSession();
      session = storedSession;

      // Cookie fallback. The cookie survives localStorage clears and is
      // XSS-safe (HttpOnly). GET exchanges the refresh_token for a fresh session.
      // Inner catch is soft — the !session check below still fail-closes.
      if (!session && supabase) {
        try {
          const sessionResponse = await fetch('/api/session', {
            method: 'GET',
            credentials: 'include'
          });
          if (sessionResponse.ok) {
            const { session: cookieSession } = await sessionResponse.json();
            if (cookieSession && cookieSession.access_token) {
              await supabase.auth.setSession({
                access_token: cookieSession.access_token,
                refresh_token: cookieSession.refresh_token,
              });
              session = cookieSession;
            }
          }
        } catch (err) {
          console.error('Cookie session restore error:', err);
        }
      }

      if (!session) {
        window.location.href = redirectTo;
        return null;
      }
    } catch (error) {
      console.error('Session check failed:', error);
      window.location.href = redirectTo;
      return null;
    }
  } else {
    window.location.href = redirectTo;
    return null;
  }

  return session;
}

/**
 * Fill #hud-name from session user_metadata. No-op if the node or user is missing.
 * username, then full_name, then the email local-part, else PLAYER.
 */
export function fillHudName(session) {
  const hudName = document.getElementById('hud-name');
  if (hudName && session && session.user) {
    const meta = session.user.user_metadata || {};
    hudName.textContent = meta.username || meta.full_name || (session.user.email ? session.user.email.split('@')[0] : 'PLAYER');
  }
}

/**
 * Bounce to /run.html?id= when the player already has an active run.
 * Fetch failure is soft (console + continue) — a redirect loop is worse.
 * @param {string} token access token (may be missing; header is still sent, as before)
 * @returns {Promise<boolean>} true if a redirect was started (caller should return)
 */
export async function redirectIfActiveRun(token) {
  try {
    const res = await fetch('/api/combat/runs/active', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { run } = await res.json();
      if (run && run.id) {
        window.location.href = '/run.html?id=' + run.id;
        return true;
      }
    }
  } catch (e) {
    console.error('Active run check failed (soft):', e);
  }
  return false;
}

/**
 * Fetch settings from the server and merge into localStorage.
 * Server values win. Fails silently on network/auth errors; localStorage survives.
 * @param {string} tokenForHeader
 */
export async function loadServerSettings(tokenForHeader) {
  if (!tokenForHeader) return;
  try {
    const res = await fetch('/api/user/profile', {
      headers: { Authorization: `Bearer ${tokenForHeader}` },
    });
    if (!res.ok) return;
    const { settings } = await res.json();
    if (!settings) return;
    if (settings.battle_text_speed) {
      localStorage.setItem('pc_battle_text_speed', settings.battle_text_speed);
    }
  } catch (e) {
    console.error('Settings fetch failed (soft):', e);
  }
}

/**
 * Log out: signOut (soft), DELETE the HttpOnly cookie (soft), clear the
 * PKCE localStorage key, redirect to /login.
 * @param {object|null|undefined} supabase the shared client the page holds
 */
export async function logout(supabase) {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  try {
    await fetch('/api/session', { method: 'DELETE', credentials: 'include' });
  } catch (err) {
    console.error('Cookie clear error:', err);
  }
  localStorage.removeItem('supabase.auth.token');
  window.location.href = '/login';
}
