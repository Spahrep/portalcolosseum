import { supabaseClient } from '../js/utils.js';
import { showNotReadyModal, highlightSpeedButtons, highlightFontButtons, initMenuSettings } from './settings-menu.js';

// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

// Supabase client instance (initialized in initGame())
let supabase;

async function initGame() {
  // Initialize Supabase client with localStorage-backed PKCE storage
  if (SUPABASE_URL) {
    supabase = supabaseClient();
  }

  // Fail-closed auth check
  let session = null;
  if (supabase) {
    try {
      // First: check for a PKCE callback (code in URL query params)
      if (window.location.search.includes('code=')) {
        const { data: { session }, error: _error } = await supabase.auth.getSession();

        if (session && session.refresh_token) {
          await fetch('/api/session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });
        }
      }

      // Now check the session
      const { data: { session: storedSession }, error: _error } = await supabase.auth.getSession();
      session = storedSession;

      // === COOKIE-BASED SESSION RESTORATION (fallback) ===
      if (!session && supabase) {
        try {
          const sessionResponse = await fetch('/api/session', {
            method: 'GET',
            credentials: 'include'
          });
          if (sessionResponse.ok) {
            const { session: cookieSession } = await sessionResponse.json();
            if (cookieSession && cookieSession.access_token) {
              await supabase.auth.setSession({
                access_token: cookieSession.access_token,
                refresh_token: cookieSession.refresh_token,
              });
              session = cookieSession;
            }
          }
        } catch (err) {
          console.error('Cookie session restore error:', err);
        }
      }

      if (!session) {
        window.location.href = '/login';
        return;
      }
    } catch (error) {
      console.error('Session check failed:', error);
      window.location.href = '/login';
      return;
    }
  } else {
    window.location.href = '/login';
    return;
  }

  // Fill hud-name from session
  const hudName = document.getElementById('hud-name');
  if (hudName && session && session.user) {
    const meta = session.user.user_metadata || {};
    hudName.textContent = meta.username || meta.full_name || (session.user.email ? session.user.email.split('@')[0] : 'PLAYER');
  }

  // Active run check
  try {
    const res = await fetch('/api/combat/runs/active', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const { run } = await res.json();
      if (run && run.id) {
        window.location.href = '/run.html?id=' + run.id;
        return;
      }
    }
  } catch (e) {
    console.error('Active run check failed (soft):', e);
  }

  // Load persisted settings from the server
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

async function loadServerSettings(tokenForHeader) {
  if (!tokenForHeader) return;
  try {
    const res = await fetch('/api/user/profile', {
      headers: { Authorization: `Bearer ${tokenForHeader}` },
    });
    if (!res.ok) return;
    const { settings } = await res.json();
    if (!settings) return;
    if (settings.battle_text_speed) {
      localStorage.setItem('pc_battle_text_speed', settings.battle_text_speed);
    }
  } catch (e) {
    console.error('Settings fetch failed (soft):', e);
  }
}

async function logout() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  try {
    await fetch('/api/session', { method: 'DELETE', credentials: 'include' });
  } catch (err) {
    console.error('Cookie clear error:', err);
  }
  localStorage.removeItem('supabase.auth.token');
  window.location.href = '/login';
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