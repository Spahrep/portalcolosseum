/**
 * Portal Colosseum - Game Page Application Logic
 * =================================================
 * External ES module extracted from game.html's inline scripts.
 * Required because CSP script-src 'self' esm.sh https://*.supabase.co
 * blocks all inline <script> blocks.
 *
 * This module imports createClient directly from esm.sh (allowed by CSP),
 * reads config from window.ENV (set by /api/env.js), and attaches all
 * event listeners via DOMContentLoaded.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

// Supabase client instance (initialized in initGame())
let supabase;

/**
 * Initialize the game page.
 * 1. Creates the Supabase client
 * 2. Checks for an active session (redirects to login if none)
 * 3. Displays the player's name
 * 4. Draws the placeholder canvas content
 */
async function initGame() {
  // Initialize Supabase client with in-memory storage + PKCE flow
  // Security: tokens never persist to localStorage (XSS prevention)
  if (SUPABASE_URL) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      }
    });
  }

  // --- Event listener bindings (no inline onclick handlers) ---
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Fail-closed auth check: try in-memory session first, then cookie-based fallback
  // Security: We do NOT fall back to localStorage for auth decisions.
  let playerName = 'Guest';

  if (supabase) {
    try {
      // First: check for a PKCE callback (code in URL query params)
      if (window.location.search.includes('code=')) {
        // PKCE auto-exchange happened via detectSessionInUrl — just need to
        // pick up the session and persist the refresh token server-side
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session && session.refresh_token) {
          // Persist the refresh token in an HttpOnly cookie via our Edge Function
          await fetch('/api/session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });
        }
      } else {
        // No callback — try to recover session from the HttpOnly cookie
        const resp = await fetch('/api/session', {
          method: 'GET',
          credentials: 'include'
        });

        if (resp.ok) {
          const { session: cookieSession } = await resp.json();
          if (cookieSession) {
            // Restore the in-memory session from the cookie-obtained tokens
            await supabase.auth.setSession(cookieSession);
          }
        }
      }

      // Now check the session (whether from callback or cookie restore)
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session) {
        // User is authenticated - extract display name from session
        const user = session.user;
        playerName = user.email ||
                    user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    'Gladiator';
        // Security: Do NOT persist session or PII to localStorage (XSS risk)
      } else {
        // No active session - fail closed, redirect to login
        window.location.href = '/login';
        return;
      }
    } catch (error) {
      // Fail closed on any error - redirect to login
      console.error('Session check failed:', error);
      window.location.href = '/login';
      return;
    }
  } else {
    // Supabase not initialized - fail closed, redirect to login
    window.location.href = '/login';
    return;
  }

  // Display the player's name on the status bar
  document.getElementById('player-name').textContent = playerName;

  // Initialize the game canvas with placeholder content
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Fill canvas with dark blue background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw placeholder title text
  ctx.fillStyle = '#fff';
  ctx.font = '30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Arena Battle Will Begin Soon', canvas.width / 2, canvas.height / 2);

  // Draw player name subtitle
  ctx.font = '20px monospace';
  ctx.fillStyle = '#ff6b3b';
  ctx.fillText('Player: ' + playerName, canvas.width / 2, canvas.height / 2 + 50);
}

/**
 * Log out the current user.
 * Clears the Supabase session and the HttpOnly session cookie, then
 * redirects back to the login page. No localStorage is used.
 */
async function logout() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  // Clear the HttpOnly session cookie via the Edge Function
  try {
    await fetch('/api/session', { method: 'DELETE', credentials: 'include' });
  } catch (err) {
    console.error('Cookie clear error:', err);
  }
  // Security: No localStorage to clear — no PII stored client-side
  window.location.href = '/login';
}

// --- DOM ready: initialize game when page loads ---
document.addEventListener('DOMContentLoaded', () => {
  // Check for OAuth callback (PKCE: code in URL query params)
  if (window.location.search.includes('code=')) {
    // PKCE auto-exchange handled in initGame() via getSession()
  }
  initGame();
});
