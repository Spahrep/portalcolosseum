import { supabaseClient } from '../js/utils.js';
import {
  ensureSession,
  fillHudName,
  redirectIfActiveRun,
  loadServerSettings,
  logout as sessionLogout,
} from './session.js';
import { showNotReadyModal, highlightSpeedButtons, highlightFontButtons, initMenuSettings } from './settings-menu.js';

// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

// Supabase client instance (initialized in initGame())
let supabase;

async function initGame() {
  // Assign the shared PKCE singleton before the first await. initMenuSettings
  // wires logout during DOMContentLoaded while this function is in flight.
  if (SUPABASE_URL) {
    supabase = supabaseClient();
  }

  const session = await ensureSession({ redirectTo: '/login' });
  if (!session) return;

  // Fill hud-name from session
  fillHudName(session);

  // Active run check — fetch failure is soft
  if (await redirectIfActiveRun(session.access_token)) return;

  // Load persisted settings from the server (not awaited)
  loadServerSettings(session.access_token);

  // Button wiring
  document.getElementById('btn-portal')?.addEventListener('click', () => {
    window.location.href = '/portal-select.html';
  });
  document.getElementById('btn-store')?.addEventListener('click', showNotReadyModal);
  document.getElementById('btn-wizard')?.addEventListener('click', showNotReadyModal);
  document.getElementById('btn-leaderboard')?.addEventListener('click', showNotReadyModal);
  document.getElementById('btn-menu')?.addEventListener('click', showMenuSettings);
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    document.getElementById('logout-confirm-dialog').hidden = false;
  });

  // Not-ready modal only. Menu close, backdrop, and logout-confirm yes/no
  // are wired once in initMenuSettings — binding them here too fired logout twice.
  document.getElementById('not-ready-modal')?.addEventListener('click', hideNotReadyModal);
  document.getElementById('not-ready-close')?.addEventListener('click', hideNotReadyModal);
}

function logout() {
  return sessionLogout(supabase);
}

// === NOT-READY MODAL (mobile simplified - no location marker clearing) ===
function hideNotReadyModal() {
  const modal = document.getElementById('not-ready-modal');
  if (modal) modal.hidden = true;
}

// === MENU / SETTINGS (mobile simplified - no keyboard nav) ===
function showMenuSettings() {
  const modal = document.getElementById('menu-settings-modal');
  if (modal) {
    const confirm = document.getElementById('logout-confirm-dialog');
    if (confirm) confirm.hidden = true;
    modal.hidden = false;
    highlightSpeedButtons();
    highlightFontButtons();
  }
}

function hideMenuSettings() {
  const modal = document.getElementById('menu-settings-modal');
  if (modal) modal.hidden = true;
}

document.addEventListener('DOMContentLoaded', () => {
  initGame();
  initMenuSettings({
    getSupabase: () => supabase,
    hideMenuSettings,
    logout,
  });
});