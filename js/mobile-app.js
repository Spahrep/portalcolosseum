import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';
import { setSpeed, setFontSize, getSpeedKey, getFontSizeKey, onSpeedChange, onFontSizeChange } from './settings-controller.js';

// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

// Supabase client instance (initialized in initGame())
let supabase;

async function initGame() {
  // Initialize Supabase client with localStorage-backed PKCE storage
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
    window.location.href = '/portal-select';
  });
  document.getElementById('btn-store')?.addEventListener('click', showNotReadyModal);
  document.getElementById('btn-wizard')?.addEventListener('click', showNotReadyModal);
  document.getElementById('btn-leaderboard')?.addEventListener('click', showNotReadyModal);
  document.getElementById('btn-menu')?.addEventListener('click', showMenuSettings);
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    document.getElementById('logout-confirm-dialog').hidden = false;
  });

  // Logout confirm Yes
  document.getElementById('logout-confirm-yes')?.addEventListener('click', () => {
    hideMenuSettings();
    setTimeout(() => logout(), 100);
  });
  // Logout confirm No
  document.getElementById('logout-confirm-no')?.addEventListener('click', () => {
    document.getElementById('logout-confirm-dialog').hidden = true;
  });
  // Backdrop dismiss for not-ready modal
  document.getElementById('not-ready-modal')?.addEventListener('click', hideNotReadyModal);
  document.getElementById('not-ready-close')?.addEventListener('click', hideNotReadyModal);
  // Backdrop dismiss for menu-settings-modal
  const menuModal = document.getElementById('menu-settings-modal');
  const menuFrame = menuModal?.querySelector('.menu-settings-frame');
  if (menuModal && menuFrame) {
    menuModal.addEventListener('click', (e) => {
      if (!menuFrame.contains(e.target) && e.target !== document.getElementById('menu-settings-close')) {
        hideMenuSettings();
      }
    });
  }
  menuModal?.querySelector('#menu-settings-close')?.addEventListener('click', hideMenuSettings);
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
function showNotReadyModal() {
  const modal = document.getElementById('not-ready-modal');
  if (modal) modal.hidden = false;
}
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

function highlightSpeedButtons() {
  const current = getSpeedKey();
  document.querySelectorAll('.speed-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.speed.toLowerCase() === current ||
      (btn.dataset.speed === 'STANDARD' && current === 'normal'));
  });
}

function highlightFontButtons() {
  const current = getFontSizeKey();
  document.querySelectorAll('.font-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === current);
  });
}

function setBattleTextSpeed(key) {
  setSpeed(key);
  highlightSpeedButtons();
  syncSettings({ battle_text_speed: key.toLowerCase() });
}

function setQueueFontSize(key) {
  setFontSize(key);
  highlightFontButtons();
}

async function syncSettings(partial) {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch('/api/user/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ settings: partial }),
    });
  } catch (e) {
    console.error('Settings sync failed (soft):', e);
  }
}

function initMenuSettings() {
  const closeBtn = document.getElementById('menu-settings-close');
  if (closeBtn) closeBtn.addEventListener('click', hideMenuSettings);

  const modal = document.getElementById('menu-settings-modal');
  const frame = modal?.querySelector('.menu-settings-frame');
  if (modal && frame) {
    modal.addEventListener('click', (e) => {
      if (!frame.contains(e.target) && e.target !== closeBtn) {
        hideMenuSettings();
      }
    });
  }

  document.querySelectorAll('.speed-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setBattleTextSpeed(btn.dataset.speed);
    });
  });

  document.querySelectorAll('.font-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setQueueFontSize(btn.dataset.font);
    });
  });

  onSpeedChange(() => highlightSpeedButtons());
  onFontSizeChange(() => highlightFontButtons());

  const logoutBtn = document.getElementById('menu-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const confirm = document.getElementById('logout-confirm-dialog');
      if (confirm) confirm.hidden = false;
    });
  }

  const confirmYes = document.getElementById('logout-confirm-yes');
  if (confirmYes) {
    confirmYes.addEventListener('click', () => {
      hideMenuSettings();
      setTimeout(() => logout(), 100);
    });
  }

  const confirmNo = document.getElementById('logout-confirm-no');
  if (confirmNo) {
    confirmNo.addEventListener('click', () => {
      const confirm = document.getElementById('logout-confirm-dialog');
      if (confirm) confirm.hidden = true;
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initGame();
  initMenuSettings();
});