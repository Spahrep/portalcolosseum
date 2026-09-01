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
 *
 * Town Navigation:
 *   Arrow keys cycle selection between town locations (Portal, Store, Wizard,
 *   Leaderboards). The selected marker shows [x] via CSS ::before.
 *   Enter triggers the selected location's action (pan to building + Enter The Portal).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

// Supabase client instance (initialized in initGame())
let supabase;

// === TOWN LOCATION NAVIGATION ===
// Arrow keys cycle through town locations; Enter triggers the location action.
// The [ ] / [x] checkbox is rendered via CSS ::before on .location-marker.selected.

// Location definitions: position on the panorama in image percentages.
// x = % across the 300vw panorama image (0-100)
// y = % down from top of the image (0-100) — all at same height for alignment
// data-x/data-y in game.html match these values
const LOCATIONS = [
  { name: 'portal',      label: 'Enter The Portal', x: 50,  y: 80 },
  { name: 'store',       label: 'Store',            x: 40,  y: 65 },
  { name: 'wizard',      label: 'Wizard Hut',       x: 68,  y: 65 },
  { name: 'leaderboard', label: 'Leaderboards',     x: 88,  y: 65 }
];

// Track which locations have been visited (Enter pressed on them)
const visited = new Set();

// Currently selected location index
let selectedIndex = 0;

/**
 * Pan the town panorama to center on the selected location.
 * The panorama image is 300vw wide (2448px / 816px @ 100vh).
 * Viewport is 100vw wide. To center loc.x% (position in the 300vw image)
 * on the viewport center (50vw):
 *   - Building position in image: loc.x * 3vw
 *   - We want this at viewport center: 50vw
 *   - Container translateX = 50 - (loc.x * 3)
 */
function panToLocation(index) {
  const loc = LOCATIONS[index];
  const tx = 50 - (loc.x * 3);  // in vw units (range: 50 to -250)

  const container = document.getElementById('game-container');
  container.style.transform = `translate(${tx}vw, 0)`;

  // Update marker selection state (CSS ::before shows [x] when selected)
  document.querySelectorAll('.location-marker').forEach((marker, i) => {
    marker.classList.toggle('selected', i === index);
  });
}

/**
 * Cycle selection to the next/previous location based on arrow key.
 * @param {string} direction - 'left', 'right', 'up', 'down'
 */
function navigateLocations(direction) {
  if (direction === 'left' || direction === 'up') {
    selectedIndex = (selectedIndex - 1 + LOCATIONS.length) % LOCATIONS.length;
  } else if (direction === 'right' || direction === 'down') {
    selectedIndex = (selectedIndex + 1) % LOCATIONS.length;
  }
  panToLocation(selectedIndex);
}

/**
 * Trigger the selected location's action.
 * Pans to the building and marks as visited.
 * On 'Enter The Portal' this would start the actual game/battle.
 */
function enterLocation() {
  const loc = LOCATIONS[selectedIndex];
  visited.add(loc.name);
  // Mark as visited (CSS shows [x] and blue visited color)
  const markers = document.querySelectorAll('.location-marker');
  markers[selectedIndex].classList.add('visited');

  // Pan to center on the selected location
  panToLocation(selectedIndex);

  // Trigger location-specific action
  if (loc.name === 'portal') {
    // Enter The Portal — start the game
    console.log('Entering the portal...');
  }
}

/**
 * Initialize town location markers.
 * Markers are defined in HTML inside .pano, so we just set their positions
 * based on data-x/data-y attributes (percentages of the 300vw panorama image).
 */
function initLocations() {
  const markers = document.querySelectorAll('.location-marker');
  markers.forEach((marker, i) => {
    const x = parseFloat(marker.dataset.x);
    const y = parseFloat(marker.dataset.y);
    // Markers are inside .pano (300vw wide), so left:% is x% of 300vw
    // bottom: (100 - y)% since data-y is from top, bottom is inverse
    marker.style.left = `${x}%`;
    marker.style.bottom = `${100 - y}%`;
    marker.style.transform = 'translate(-50%, 20px)';
    marker.dataset.index = i;
  });
}

/**
 * Reset the panorama to center position and clear selections.
 */
function resetBackground() {
  const container = document.getElementById('game-container');
  container.style.transform = 'translate(0, 0)';
  document.querySelectorAll('.location-marker').forEach(m => {
    m.classList.remove('selected', 'visited');
  });
  selectedIndex = 0;
  panToLocation(0);
}

/**
 * Initialize the game page.
 * 1. Creates the Supabase client
 * 2. Checks for an active session (redirects to login if none)
 * 3. Initializes the game canvas context and town location navigation
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
  /* Canvas is initially transparent — the town panorama shows through */

  // Initialize town location markers and pan to first location
  initLocations();
  panToLocation(0);

  // Event listener bindings (no inline onclick handlers)
  document.getElementById('logout-btn')?.addEventListener('click', logout);
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

  // --- Town location navigation via arrow keys + Enter ---
  // Arrow keys cycle through town locations (portal, store, wizard, leaderboard)
  // The selected marker shows [x] via CSS ::before
  // Enter triggers the location action (pan + enter)
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigateLocations('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateLocations('right');
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateLocations('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateLocations('down');
        break;
      case 'Enter':
        e.preventDefault();
        enterLocation();
        break;
      case 'Home':
        // Reset background position to center
        e.preventDefault();
        resetBackground();
        break;
    }
  });
});