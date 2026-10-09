import { supabaseClient } from '../js/utils.js';
import {
  bootstrapTownSession,
  logout,
} from './session.js';
import {
  showNotReadyModal, showMenuSettings, initMenuSettings,
} from './settings-menu.js';

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

  const session = await bootstrapTownSession({ redirectTo: '/login' });
  if (!session) return;

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

// === NOT-READY MODAL (mobile simplified - no location marker clearing) ===
function hideNotReadyModal() {
  const modal = document.getElementById('not-ready-modal');
  if (modal) modal.hidden = true;
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
    logout: () => logout(supabase),
  });
});