// js/combat/combat-api.js
// Shared getAuthToken / apiCall / checkAuth for the battle screens.
// Uses the supabaseClient() singleton so the PKCE session is the same
// instance the apps hold — do not create a second client here.
// checkAuth returns the session (falsy + redirect when missing), not a boolean.
// apiCall error text is the richer form: response body, or `HTTP ${status}` if empty.

import { supabaseClient } from '../utils.js';

export function getAuthToken() {
  const supabase = supabaseClient();
  return supabase?.auth?.getSession?.().then(({ data }) => data?.session?.access_token);
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
