/**
 * Portal Colosseum - Game Page Application Logic
 * =================================================
 * External ES module extracted from game.html's inline scripts.
 * Required because CSP script-src 'self' esm.sh https://*.supabase.co
 * blocks all inline <script> blocks.
 *
 * This module uses shared supabaseClient() from utils.js (PKCE + localStorage),
 * reads config from window.ENV (set by /api/env.js), and attaches all
 * event listeners via DOMContentLoaded.
 *
 * Town Navigation:
 *   Arrow keys cycle selection between town locations (Menu, Store, Portal,
 *   Wizard, Leaderboards). The selected marker shows [x] via CSS ::before.
 *   Enter triggers the selected location's action (pan to building + Enter The Portal).
 */

import { supabaseClient } from '../js/utils.js';
import {
  ensureSession,
  fillHudName,
  redirectIfActiveRun,
  loadServerSettings,
  logout as sessionLogout,
} from './session.js';
import {
  showNotReadyModal, highlightSpeedButtons, highlightFontButtons,
  highlightUxButtons, highlightShakeButtons, initMenuSettings,
} from './settings-menu.js';

// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

// Supabase client instance (initialized in initGame())
let supabase;

// === TOWN LOCATION NAVIGATION ===
// Arrow keys cycle through town locations; Enter triggers the location action.
// The [ ] / [x] checkbox is rendered via CSS ::before on .location-marker.selected.

// Location definitions: position on the panorama in image percentages.
// Order determines the arrow-key navigation cycle: Menu → Store → Portal → Wizard → Leaderboard
// x = % across the 300vh panorama image (0-100)
// y = % down from top of the image — all at same height for alignment
// data-x/data-y in game.html match these values
const LOCATIONS = [
  // The campfire at the far left of the panorama is the Menu section (PC menu)
  { name: 'menu',        label: 'Menu',            x: 6,   y: 80 },
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
  // may differ from 300vw on non-3:1 screens.
  // Clamp so the 100vw viewport NEVER shows black body background on either side.
  const ratio = window.innerHeight / window.innerWidth;  // vh/vw at 100x scale
  const panoWidthVw = Math.max(300 * ratio, 100);
  const buildingPosInVw = (loc.x / 100) * panoWidthVw;  // position in vw
  const maxPanLeft = panoWidthVw - 100;                 // >= 0 by construction
  const tx = Math.min(Math.max(50 - buildingPosInVw, -maxPanLeft), 0);

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
    // Enter The Portal — redirect to portal selection (PC-75)
    window.location.href = '/portal-select.html';
  } else if (loc.name === 'menu') {
    // Menu / Settings panel — replaces the drunk-jester placeholder
    showMenuSettings();
  } else {
    // Store, Wizard Hut and Leaderboards are not built yet —
    // show the default "not yet ready" placeholder (DrunkJester image).
    showNotReadyModal();
  }
}

// === NOT-READY MODAL ===
// Default placeholder for unbuilt town locations (store, wizard, leaderboard).
// Shows the DrunkJester image in a bordered frame with overlay text.
// This is the project default image for "feature not yet ready" placeholders.

function isNotReadyModalOpen() {
  const modal = document.getElementById('not-ready-modal');
  return modal ? !modal.hidden : false;
}

function hideNotReadyModal() {
  const modal = document.getElementById('not-ready-modal');
  if (modal) modal.hidden = true;
  // Clear selection state so marker does not retain blue/[x] after close
  document.querySelectorAll('.location-marker').forEach(m => m.classList.remove('selected', 'visited'));
}

// === MENU / SETTINGS MODAL ===
// Replaces the drunk-jester placeholder for the Menu (campfire) location.
// Player-adjustable settings: battle text speed, effect speed, screen shake, log out.
/** Index into menuFocusItems() (every .speed-opt, then Log Out). */
let menuFocusIndex = 0;

function menuFocusItems() {
  const items = Array.from(document.querySelectorAll('#menu-settings-modal .speed-opt'));
  const logoutBtn = document.getElementById('menu-logout-btn');
  if (logoutBtn) items.push(logoutBtn);
  return items;
}

function isMenuSettingsOpen() {
  const modal = document.getElementById('menu-settings-modal');
  return modal ? !modal.hidden : false;
}

function showMenuSettings() {
  const modal = document.getElementById('menu-settings-modal');
  if (modal) {
    // Reset confirmation dialog in case it was left open
    const confirm = document.getElementById('logout-confirm-dialog');
    if (confirm) confirm.hidden = true;
    modal.hidden = false;
    // Highlight the currently active speed & font buttons
    highlightSpeedButtons();
    highlightFontButtons();
    highlightUxButtons();
    highlightShakeButtons();
    // Reset keyboard focus index to the first speed button
    menuFocusIndex = 0;
    updateMenuFocus();
  }
}

function hideMenuSettings() {
  const modal = document.getElementById('menu-settings-modal');
  if (modal) modal.hidden = true;
  // Clear selection state so marker does not retain blue/[x] after close
  document.querySelectorAll('.location-marker').forEach(m => m.classList.remove('selected', 'visited'));
}

/** Apply visual focus to the currently focused menu item index */
function updateMenuFocus() {
  const items = menuFocusItems();
  if (menuFocusIndex > items.length - 1) menuFocusIndex = Math.max(0, items.length - 1);
  items.forEach((el, i) => el.classList.toggle('menu-focused', i === menuFocusIndex));
}

/** Activate (click) whatever item is currently focused */
function activateMenuFocus() {
  const items = menuFocusItems();
  const el = items[menuFocusIndex];
  if (el) el.click();
}

/** Handle arrow key navigation within the settings modal. Returns true if handled. */
function handleMenuKeydown(e) {
  const confirm = document.getElementById('logout-confirm-dialog');
  const confirmOpen = confirm && !confirm.hidden;

  if (confirmOpen) {
    // In logout confirmation: Enter = Yes (confirm), Escape/Esc = No
    if (e.key === 'Enter') {
      document.getElementById('logout-confirm-yes')?.click();
      return true;
    }
    if (e.key === 'Escape') {
      document.getElementById('logout-confirm-no')?.click();
      return true;
    }
    return false;
  }

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      if (menuFocusIndex > 0) menuFocusIndex--;
      updateMenuFocus();
      return true;
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      {
        const last = Math.max(0, menuFocusItems().length - 1);
        if (menuFocusIndex >= last) menuFocusIndex = 0;
        else menuFocusIndex++;
      }
      updateMenuFocus();
      return true;
    case 'Enter':
      e.preventDefault();
      activateMenuFocus();
      return true;
    case 'Escape':
      hideMenuSettings();
      return true;
  }
  return false;
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
 * Session bootstrap (PKCE, cookie restore, fail-closed /login) is ensureSession.
 * This function keeps the shared client for logout, then only town wiring.
 */
async function initGame() {
  // Assign the shared PKCE singleton before the first await. initMenuSettings
  // wires logout during DOMContentLoaded while this function is in flight;
  // logout() reads `supabase` at click time, and the client must already exist.
  if (SUPABASE_URL) {
    supabase = supabaseClient();
  }

  const session = await ensureSession({ redirectTo: '/login' });
  if (!session) return;

  // PC-52: fill hud-name from session (front-end only, placeholder dock)
  fillHudName(session);

  // PC-50r: auto-resume into active run (never show town to a player with an active run)
  // Fetch failure is soft (console + continue to town) — a redirect loop is worse.
  if (await redirectIfActiveRun(session.access_token)) return;

  // Load persisted settings from the server into localStorage
  // This runs asynchronously — the game doesn't block on it.
  // If it fails, localStorage already has the user's last-known values.
  loadServerSettings(session.access_token);

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

  // Click anywhere on the "not ready" modal dismisses it
  document.getElementById('not-ready-modal')?.addEventListener('click', hideNotReadyModal);
  // Explicit close (×) button
  document.getElementById('not-ready-close')?.addEventListener('click', hideNotReadyModal);
}

/**
 * Log out the current user.
 * Clears the Supabase session and the HttpOnly session cookie, then
 * redirects back to the login page. Body lives in session.js; this
 * wrapper closes over the page's shared client.
 */
function logout() {
  return sessionLogout(supabase);
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
  // Menu/settings modal (in-town settings: text speed, log out).
  // Wired once here — not also inside initGame.
  initMenuSettings({
    getSupabase: () => supabase,
    hideMenuSettings,
    logout,
  });

  // Re-pan on resize to account for aspect ratio changes
  window.addEventListener('resize', () => {
    panToLocation(selectedIndex);
  });

  // --- Town location navigation via arrow keys + mouse scroll ---
  // Arrow keys cycle through town locations (menu, store, portal, wizard, leaderboard)
  // Mouse wheel: scroll up = next location, scroll down = previous location
  // The selected marker shows [x] via CSS ::before
  // Enter triggers the location action (pan + enter)
  document.addEventListener('keydown', (e) => {
    // While the "not ready" modal is open, only Escape is handled —
    // arrows/Enter must not navigate or re-trigger behind the modal.
    if (isNotReadyModalOpen() && e.key !== 'Escape') return;
    // When the settings modal is open, route keys through the modal handler first.
    // Arrow keys, Enter, and Escape are handled; other keys pass through.
    if (isMenuSettingsOpen()) {
      if (handleMenuKeydown(e)) return;
    }
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
      case 'Escape':
        // Dismiss the "not ready" modal if open
        hideNotReadyModal();
        // Dismiss the menu/settings modal if open
        hideMenuSettings();
        break;
    }
  });

  // Mouse scroll navigation: scroll up moves to next location,
  // scroll down moves to previous location
  document.addEventListener('wheel', (e) => {
    // Don't navigate behind an open "not ready" modal
    if (isNotReadyModalOpen()) return;
    // Same guard for the menu/settings modal
    if (isMenuSettingsOpen()) return;
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