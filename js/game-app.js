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
// Order determines the arrow-key navigation cycle: Store → Portal → Wizard → Leaderboard
// x = % across the 300vh panorama image (0-100)
// y = % down from top of the image — all at same height for alignment
// data-x/data-y in game.html match these values
const LOCATIONS = [
  { name: 'store',       label: 'Store',            x: 20,  y: 80 },
  { name: 'portal',      label: 'Enter The Portal', x: 50,  y: 80 },
  { name: 'wizard',      label: 'Wizard Hut',       x: 68,  y: 80 },
  { name: 'leaderboard', label: 'Leaderboards',     x: 88,  y: 80 }
];

// Track which locations have been visited (Enter pressed on them)
const visited = new Set();

// Currently selected location index
let selectedIndex = 0;

/**
 * Pan the town panorama to center on the selected location.
 * The panorama image (.pano) is 300vh wide (3x viewport height) to preserve
 * the 3:1 aspect ratio of town_pano.jpg regardless of screen aspect ratio.
 * Viewport is 100vw wide. To center loc.x% (position in the image) on the
 * viewport center (50vw):
 *   - Building position in image: loc.x% * 300vh
 *   - We want this at viewport center: 50vw
 *   - Container translateX in vw = 50 - (loc.x * 3 * vh/vw)
 *   where vh/vw = window.innerHeight/window.innerWidth * 100... actually
 *   300vh in vw = 300 * (innerHeight/innerWidth)
 *   So tx = 50 - loc.x * 3 * innerHeight/innerWidth
 */
function panToLocation(index) {
  const loc = LOCATIONS[index];
  // Calculate pan offset: account for the fact that image width (300vh)
  // may differ from 300vw on non-3:1 screens
  const ratio = window.innerHeight / window.innerWidth;  // vh/vw at 100x scale
  const imageWidthInVw = 300 * ratio;  // 300vh expressed in vw units
  const buildingPosInVw = (loc.x / 100) * imageWidthInVw;  // position in vw
  const tx = 50 - buildingPosInVw;  // center on viewport midpoint (50vw)

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
    // Enter The Portal — redirect to the GUI battle test
    window.location.href = '/test/gui1';
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
  let session = null;
  if (supabase) {
    try {
      // First: check for a PKCE callback (code in URL query params)
      if (window.location.search.includes('code=')) {
        // PKCE auto-exchange happened via detectSessionInUrl — just need to
        // pick up the session and persist the refresh token server-side
        const { data: { session }, error: _error } = await supabase.auth.getSession();

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
      const { data: { session: storedSession }, error: _error } = await supabase.auth.getSession();
      session = storedSession;

      // === COOKIE-BASED SESSION RESTORATION (fallback) ===
      // If localStorage session check failed, try restoring from the HttpOnly
      // cookie via GET /api/session — the cookie survives localStorage clears
      // and is XSS-safe (HttpOnly = JS can't read it).
      // The GET endpoint exchanges the refresh_token for a fresh session.
      if (!session && supabase) {
        try {
          const sessionResponse = await fetch('/api/session', {
            method: 'GET',
            credentials: 'include'
          });
          if (sessionResponse.ok) {
            const { session: cookieSession } = await sessionResponse.json();
            if (cookieSession && cookieSession.access_token) {
              // Hydrate the Supabase client with the cookie-restored session
              await supabase.auth.setSession({
                access_token: cookieSession.access_token,
                refresh_token: cookieSession.refresh_token,
              });
              session = cookieSession;
            }
          }
        } catch (err) {
          // Cookie-based restoration is a fallback — don't fail hard
          console.error('Cookie session restore error:', err);
        }
      }

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

// === ONBOARDING TUTORIAL (PC-11) ===
// Lightweight 4-step dismissible overlay for first-run players.
// Uses plain DOM, localStorage persistence, styled to match css/style.css.
const ONBOARDING_KEY = 'pc_onboarding_seen';
const ONBOARDING_STEPS = [
  {
    title: 'Action Points (AP)',
    body: 'AP gates your play. You spend AP to start Portal runs. Manage it wisely between runs.'
  },
  {
    title: 'Starting a Run',
    body: 'Navigate to the Portal marker (arrow keys or scroll) and press Enter. A run is 5 fights. Prize grows with each victory.'
  },
  {
    title: 'Continue vs Stop',
    body: 'After each fight you can CONTINUE (risk it for bigger reward) or STOP and bank your current loot.'
  },
  {
    title: 'Loot & Grades',
    body: 'Higher-grade dice improve your loot tier. Better rolls = rarer rewards at the end of a successful run.'
  }
];

function showOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY) === 'true') return;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(16,31,46,0.92);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:"Pixeloid Mono","Courier New",monospace;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1a1a2e;border:2px solid #ff6b3b;border-radius:8px;max-width:520px;width:90%;padding:28px 32px;color:#fff;box-shadow:0 0 40px rgba(255,107,59,0.3);';

  let stepIndex = 0;

  function renderStep() {
    const step = ONBOARDING_STEPS[stepIndex];
    modal.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="color:#ff6b3b;font-size:13px;letter-spacing:2px;margin-bottom:6px;">TUTORIAL • STEP ${stepIndex + 1}/${ONBOARDING_STEPS.length}</div>
        <h2 style="margin:0 0 14px;font-size:22px;color:#fff;">${step.title}</h2>
        <p style="line-height:1.55;margin:0;font-size:15px;color:#ddd;">${step.body}</p>
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
        ${stepIndex > 0 ? '<button id="ob-back" class="enter-button" style="padding:10px 22px;font-size:14px;">Back</button>' : ''}
        <button id="ob-next" class="enter-button" style="padding:10px 22px;font-size:14px;">${stepIndex === ONBOARDING_STEPS.length - 1 ? 'Got it!' : 'Next'}</button>
        <button id="ob-skip" class="enter-button" style="padding:10px 22px;font-size:14px;background:#333;border-color:#555;">Skip</button>
      </div>
    `;

    // Attach handlers after innerHTML
    setTimeout(() => {
      const nextBtn = modal.querySelector('#ob-next');
      const backBtn = modal.querySelector('#ob-back');
      const skipBtn = modal.querySelector('#ob-skip');

      if (nextBtn) nextBtn.onclick = () => {
        if (stepIndex === ONBOARDING_STEPS.length - 1) {
          finishOnboarding(overlay);
        } else {
          stepIndex++;
          renderStep();
        }
      };
      if (backBtn) backBtn.onclick = () => { stepIndex--; renderStep(); };
      if (skipBtn) skipBtn.onclick = () => finishOnboarding(overlay);
    }, 0);
  }

  function finishOnboarding(ov) {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    ov.remove();
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  renderStep();
}

// --- DOM ready: initialize game when page loads ---
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  // First-run tutorial overlay (localStorage-persisted, dismissible)
  showOnboarding();

  // Re-pan on resize to account for aspect ratio changes
  window.addEventListener('resize', () => {
    panToLocation(selectedIndex);
  });

  // --- Town location navigation via arrow keys + mouse scroll ---
  // Arrow keys cycle through town locations (store, portal, wizard, leaderboard)
  // Mouse wheel: scroll up = next location, scroll down = previous location
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

  // Mouse scroll navigation: scroll up moves to next location,
  // scroll down moves to previous location
  document.addEventListener('wheel', (e) => {
    // Only handle vertical scroll, ignore horizontal
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      navigateLocations('right');  // next location
    } else {
      navigateLocations('left');   // previous location
    }
  }, { passive: false });
});