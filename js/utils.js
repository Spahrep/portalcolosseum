/**
 * Portal Colosseum - Shared Utilities
 * ===================================
 * Common boilerplate extracted from all *-app.js files to eliminate duplication.
 * Provides Supabase client init, auth helpers, error display, fetch wrapper, and HTML escaping.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';
import { escapeHtml } from './pure-utils.js';

// === SUPABASE CONFIGURATION ===
// Config is loaded from /api/env.js (served by Vercel serverless function)
const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabaseInstance = null;

/**
 * Returns a singleton Supabase client configured for PKCE flow with localStorage storage.
 * Matches the init pattern used across login, signup, reset, game, admin apps.
 */
export function supabaseClient() {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[utils] Missing Supabase config in window.ENV');
      return null;
    }
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        storage: {
          getItem: (key) => localStorage.getItem(key),
          setItem: (key, value) => localStorage.setItem(key, value),
          removeItem: (key) => localStorage.removeItem(key)
        }
      }
    });
  }
  return supabaseInstance;
}

/**
 * Auth guard: redirects to /login if no active session.
 * Used by protected pages (game, admin).
 */
export async function authGuard() {
  const supabase = supabaseClient();
  if (!supabase) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/login';
      return false;
    }
    return true;
  } catch (e) {
    console.error('[utils] authGuard error', e);
    window.location.href = '/login';
    return false;
  }
}

/**
 * Returns the current user from Supabase session or null.
 */
export async function currentUser() {
  const supabase = supabaseClient();
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  } catch (e) {
    return null;
  }
}

/**
 * Display error message in a standard error element (id="error-message" or similar).
 * Keeps identical behavior to per-file implementations.
 */
export function showError(message, elementId = 'error-message') {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
    el.className = 'error';
  } else {
    console.error('[utils] showError: no element', elementId, message);
  }
}

/**
 * Wrapper around fetch that adds credentials and JSON handling for API calls.
 * Used for /api/* endpoints.
 */
export async function apiFetch(url, options = {}) {
  const opts = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  };
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${url} failed: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}
