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

// === PANORAMA BACKGROUND SHIFT (parallax when arrow keys pressed) ===
// The background image is larger than the viewport — we shift its position
// to simulate looking around a 360° environment.
let bgOffsetX = 0;  // horizontal offset in pixels
let bgOffsetY = 0;  // vertical offset in pixels
const MAX_SHIFT = 200;  // max pixels the background can shift in any direction

/**
 * Shift the panorama background based on arrow key input.
 * Arrow keys shift the background in the intuitive direction:
 * pressing right reveals more of the right side of the panorama.
 * @param {string} direction - 'left', 'right', 'up', 'down'
 */
function shiftBackground(direction) {
  const step = 50;  // pixels per keypress

  switch (direction) {
    case 'left':
      bgOffsetX = Math.max(-MAX_SHIFT, bgOffsetX - step);
      break;
    case 'right':
      bgOffsetX = Math.min(MAX_SHIFT, bgOffsetX + step);
      break;
    case 'up':
      bgOffsetY = Math.max(-MAX_SHIFT, bgOffsetY - step);
      break;
    case 'down':
      bgOffsetY = Math.min(MAX_SHIFT, bgOffsetY + step);
      break;
  }

  // Apply the shift via background-position percentage
  // Shift from center (50%) by a percentage based on max shift
  const shiftXPercent = (bgOffsetX / MAX_SHIFT) * 5;  // ±5% from center
  const shiftYPercent = (bgOffsetY / MAX_SHIFT) * 5;  // ±5% from center
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.backgroundPosition = `${50 + shiftXPercent}% ${50 + shiftYPercent}%`;
  }
}

/**
 * Reset the background to center position.
 */
function resetBackground() {
  bgOffsetX = 0;
  bgOffsetY = 0;
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.backgroundPosition = 'center';
  }
}

/**
 * Initialize the game page.
 * 1. Creates the Supabase client
 * 2. Checks for an active session (redirects to login if none)
 * 3. Initializes the game canvas context for future rendering
 */
async function initGame() {
  // Initialize Supabase client with localStorage-backed PKCE storage
  // This matches login-app.js and signup-app.js — the session must be
  // stored in localStorage so the game page can read it after login redirect
  // (same origin, same storage). The refresh_token is persisted separately
  // via the /api/session Edge Function as an HttpOnly cookie.
  // Security: tokens are short-lived access tokens; the refresh_token
  // (long-lived) goes through HttpOnly cookies, not localStorage.
  if (SUPABASE_URL) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  // Fail-closed auth check: session is persisted via localStorage (PKCE flow)
  // with refresh_token also stored in HttpOnly cookie as a fallback.
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
      }
      // else: PKCE flow with localStorage-backed storage will have the
      // session available directly — no need for cookie fallback here.

      // Now check the session (from localStorage or PKCE callback exchange)
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!session) {
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

  // Initialize the game canvas context (placeholder for future rendering)
  // No placeholder text drawn — the canvas is ready for arena battle rendering
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // Canvas is initially transparent — the town panorama shows through
}

/**
 * Log out the current user.
 * Clears the Supabase session and the HttpOnly session cookie, then
 * redirects back to the login page.
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
  // Clear PKCE session from localStorage (code_verifier, session, etc.)
  localStorage.removeItem('supabase.auth.token');
  window.location.href = '/login';
}

// --- DOM ready: initialize game when page loads ---
document.addEventListener('DOMContentLoaded', () => {
  // Check for OAuth callback (PKCE: code in URL query params)
  if (window.location.search.includes('code=')) {
    // PKCE auto-exchange handled in initGame() via getSession()
  }
  initGame();

  // --- Directional key handling for panorama background shift ---
  // Arrow keys shift the background image to simulate looking around
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        shiftBackground('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        shiftBackground('right');
        break;
      case 'ArrowUp':
        e.preventDefault();
        shiftBackground('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        shiftBackground('down');
        break;
      case 'Home':
        // Reset background position
        e.preventDefault();
        resetBackground();
        break;
    }
  });
});
