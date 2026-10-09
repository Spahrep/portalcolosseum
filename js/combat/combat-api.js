// js/combat/combat-api.js
// Shared getAuthToken / apiCall / checkAuth for the battle screens.
// Uses the supabaseClient() singleton so the PKCE session is the same
// instance the apps hold — do not create a second client here.
// checkAuth returns the session (falsy + redirect when missing), not a boolean.
// apiCall error text is the richer form: response body, or `HTTP ${status}` if empty.

import { supabaseClient } from '../utils.js';

export function getAuthToken() {
  const supabase = supabaseClient();
  if (!supabase) return Promise.resolve(null);
  return supabase.auth.getSession().then(async ({ data }) => {
    const session = data?.session;
    if (!session) return null;
    // Supabase getSession() does NOT auto-refresh an expired access token.
    // An idle player's token expires ~1h; without this, every battle API
    // call sends a stale token and the server 401s — the battle appears
    // "totally broken" (can't load, can't commit, can't end run). Refresh
    // when the token is expired or within 30s of expiry.
    const exp = session.expires_at ? session.expires_at * 1000 : null;
    if (exp != null && exp - Date.now() < 30_000) {
      const { data: { session: fresh } } = await supabase.auth.refreshSession();
      return fresh?.access_token || session.access_token;
    }
    return session.access_token;
  });
}

export async function apiCall(path, method = 'GET', body = null) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/combat${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkAuth() {
  const supabase = supabaseClient();
  if (!supabase) {
    window.location.href = '/login.html';
    return false;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return false;
  }
  return session;
}
