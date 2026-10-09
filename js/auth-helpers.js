/**
 * Shared auth-page helpers.
 * One copy of the snippets login, signup, reset, admin, and the landing
 * page had each pasted (and then let drift).
 *
 * showMessage writes #auth-message (4000ms hide on success, optional
 * XSS-safe link). battle-app.js showMessage is a different widget
 * (#message-box) and must not call this.
 *
 * signInWithProvider always navigates data.url. Admin used to drop the
 * URL on the floor; that was the bug. Pass showMessage only on pages that
 * already surface OAuth errors — admin stays silent except for the navigate.
 */

const AUTH_MESSAGE_HIDE_MS = 4000;

/**
 * @param {string} text
 * @param {string} [type] 'success' or 'error'
 * @param {{ text: string, href: string }|null} [link]
 */
export function showMessage(text, type = 'success', link = null) {
  const msgEl = document.getElementById('auth-message');
  if (!msgEl) return;
  msgEl.textContent = '';
  if (link) {
    msgEl.appendChild(document.createTextNode(text));
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.text;
    msgEl.appendChild(a);
  } else {
    msgEl.textContent = text;
  }
  msgEl.className = `auth-message ${type}`;
  msgEl.style.display = 'block';
  if (type === 'success') {
    setTimeout(() => {
      msgEl.style.display = 'none';
    }, AUTH_MESSAGE_HIDE_MS);
  }
}

/**
 * PKCE OAuth. Navigates to data.url when the provider returns one.
 * Message strings default to the login page. Signup passes its own
 * unavailable / exception copy so the visible text does not change.
 * Omit showMessage (admin) to keep a silent error UI.
 *
 * @param {object|null|undefined} supabase
 * @param {string} provider
 * @param {{
 *   redirectTo: string,
 *   showMessage?: function,
 *   unavailableMessage?: string,
 *   failLabel?: string,
 *   exceptionLabel?: string,
 * }} [options]
 */
export async function signInWithProvider(supabase, provider, {
  redirectTo,
  showMessage: report,
  unavailableMessage = 'Authentication service not available. Please refresh the page.',
  failLabel = 'login failed',
  exceptionLabel = 'login error',
} = {}) {
  const notify = typeof report === 'function' ? report : () => {};
  if (!supabase) {
    console.error('Supabase not initialized');
    return notify(unavailableMessage, 'error');
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: redirectTo,
      }
    });

    if (error) {
      console.error(`${provider} OAuth error:`, error);
      return notify(`${provider} ${failLabel}: ${error.message}`, 'error');
    }
    // PKCE: signInWithOAuth returns a URL. Without this navigation the
    // page sits there. Admin used to skip it.
    if (data && data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error(`${provider} OAuth exception:`, err);
    notify(`${provider} ${exceptionLabel}: ${err.message}`, 'error');
  }
}

/**
 * Password policy: at least 8 characters. No character-class rules.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePassword(password) {
  const errors = [];
  if (password.length < 8) {
    errors.push(`Password must be at least 8 characters (currently ${password.length}).`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * invite-verify Edge Function URL from window.ENV.SUPABASE_URL.
 * The project ref is not hardcoded: this file is a static asset.
 * Returns null if /api/env.js never loaded.
 */
export function getInviteVerifyUrl() {
  const baseUrl = (window.ENV && window.ENV.SUPABASE_URL) || '';
  if (!baseUrl) {
    console.error('[auth-helpers] Missing window.ENV.SUPABASE_URL — is /api/env.js loaded?');
    return null;
  }
  return `${baseUrl.replace(/\/+$/, '')}/functions/v1/invite-verify`;
}

/**
 * POST { key } to invite-verify. On valid, stores invite_key in
 * sessionStorage so signup can read it after the landing redirect.
 * @param {string} key
 * @returns {Promise<object>} parsed JSON body
 */
export async function verifyInviteKey(key) {
  const url = getInviteVerifyUrl();
  if (!url) {
    throw new Error('Missing invite verify URL');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key }),
  });
  const result = await response.json();
  if (result.valid) {
    sessionStorage.setItem('invite_key', key);
  }
  return result;
}
