/**
 * Portal Colosseum - Shared Utilities
 * ===================================
 * Common boilerplate extracted from all *-app.js files to eliminate duplication.
 * Provides Supabase client init.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

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
