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

// === TOWN LOCATION NAVIGATION (replaces old panorama shift logic) ===
// Arrow keys now cycle between town locations; Enter pans the viewport
// to the selected location and toggles its [ ] / [x] marker.

// Location definitions: position on the panorama in viewport percentages.
// These map to background-position percentages that the panorama
// background should center on when a location is selected.
const LOCATIONS = [
  { name: 'portal',      label: '[ ] Enter The Portal',   x: 50, y: 80 },
  { name: 'store',       label: '[ ] Store',              x: 70, y: 30 },
  { name: 'wizard',      label: '[ ] Wizard Hut',         x: 20, y: 60 },
  { name: 'leaderboard', label: '[ ] Leaderboards',       x: 30, y: 20 }
];

// Track which locations have been visited
const visited = new Set();

// Currently selected location index
let selectedIndex = 0;

/**
 * Pan the town panorama background to center on the selected location.
 * Uses smooth CSS transition on background-position.
 */
function panToLocation(index) {
  const loc = LOCATIONS[index];
  // Background is 150vw wide, so the visible viewport sees a portion.
  // We map the location's x% to a background-position percentage.
  // At 150vw, center of viewport = 50% of 150vw = 75vw from left.
  // To put loc.x% at center: bgPosX = loc.x% + (75% - 50%) = loc.x% + 25%
  const bgPosX = loc.x + 25;
  const bgPosY = loc.y + 0;  // height is 100vh so no horizontal offset needed

  document.body.style.backgroundPosition = `${bgPosX}% ${bgPosY}%`;

  // Update marker selection state
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
 * Toggle the [ ] / [x] state for the currently selected location.
 * If first visit, mark as visited and pan to center.
 */
function enterLocation() {
  const loc = LOCATIONS[selectedIndex];
  const markers = document.querySelectorAll('.location-marker');
  const marker = markers[selectedIndex];

  if (!visited.has(loc.name)) {
    // First visit: mark as visited
    visited.add(loc.name);
    marker.classList.add('visited');
    marker.querySelector('.marker-text').textContent =
      `[x] ${loc.label.replace('[ ] ', '')}`;
  } else {
    // Already visited: toggle [x] / [ ]
    const text = marker.querySelector('.marker-text');
    if (text.textContent.startsWith('[x]')) {
      text.textContent = `[ ] ${loc.label.replace('[ ] ', '')}`;
    } else {
      text.textContent = `[x] ${loc.label.replace('[ ] ', '')}`;
    }
  }

  // Auto-pan to center on the location (slight zoom-in effect)
  panToLocation(selectedIndex);
}

/**
 * Initialize town location markers in the DOM.
 */
function initLocations() {
  const container = document.getElementById('town-locations');
  if (!container) return;

  // Clear any existing markers
  container.innerHTML = '';

  LOCATIONS.forEach((loc, i) => {
    const marker = document.createElement('div');
    marker.className = 'location-marker';
    marker.dataset.location = loc.name;
    marker.style.left = `${loc.x}%`;
    marker.style.top = `${loc.y}%`;
    marker.dataset.index = i;

    const span = document.createElement('span');
    span.className = 'marker-text';
    span.textContent = loc.label;
    marker.appendChild(span);

    container.appendChild(marker);
  });
}

/**
 * Reset the background to center position.
 */
function resetBackground() {
  document.body.style.backgroundPosition = 'center';
  document.querySelectorAll('.location-marker').forEach(m => {
    m.classList.remove('selected', 'visited');
  });
  // Restore initial labels
  document.querySelectorAll('.location-marker .marker-text').forEach((span, i) => {
    span.textContent = LOCATIONS[i].label;
  });
  selectedIndex = 0;
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
  // Enter pans to the selected location and toggles [ ] / [x]
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