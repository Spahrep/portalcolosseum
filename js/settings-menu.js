/**
 * Shared town menu / settings wiring (PC-88).
 * Moved from game-app.js and mobile-app.js. The seven functions are identical;
 * page-specific hideMenuSettings / logout / supabase are injected because the
 * game page also clears location markers and both close over a page-local client.
 *
 * Listeners attach once. mobile-app used to bind #menu-settings-close, the menu
 * backdrop, and #logout-confirm-yes/no in initGame AND here, so confirm-yes
 * started logout twice.
 */
import {
  setSpeed, setFontSize, setUxSpeed, setScreenshakeOn,
  getSpeedKey, getFontSizeKey, getUxSpeed, getScreenshakeOn,
  onSpeedChange, onFontSizeChange, onUxSpeedChange, onScreenshakeChange,
} from './settings-controller.js';

const settingsHooks = {
  getSupabase: () => null,
  hideMenuSettings() {},
  logout() {},
};

let menuWired = false;

export function showNotReadyModal() {
  const modal = document.getElementById('not-ready-modal');
  if (modal) modal.hidden = false;
}

export function highlightSpeedButtons() {
  const current = getSpeedKey();
  // Font / effect-speed / shake buttons share .speed-opt for styling but have
  // no data-speed. Only the text-speed row is highlighted here.
  document.querySelectorAll('.speed-opt[data-speed]').forEach(btn => {
    const key = btn.dataset.speed.toLowerCase();
    btn.classList.toggle('active', key === current ||
      (btn.dataset.speed === 'STANDARD' && current === 'normal'));
  });
}

export function highlightFontButtons() {
  const current = getFontSizeKey();
  document.querySelectorAll('.font-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === current);
  });
}

export function highlightUxButtons() {
  const current = getUxSpeed();
  document.querySelectorAll('.ux-opt').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.ux) === current);
  });
}

export function highlightShakeButtons() {
  const on = getScreenshakeOn();
  document.querySelectorAll('.shake-opt').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.shake === 'on') === on);
  });
}

export function setBattleTextSpeed(key) {
  setSpeed(key);
  highlightSpeedButtons();
  syncSettings({ battle_text_speed: key.toLowerCase() });
}

export function setQueueFontSize(key) {
  setFontSize(key);
  highlightFontButtons();
}

export function setUxSpeedSetting(value) {
  setUxSpeed(value);
  highlightUxButtons();
  syncSettings({ ux_speed: getUxSpeed() });
}

export function setScreenshakeSetting(on) {
  setScreenshakeOn(on);
  highlightShakeButtons();
  syncSettings({ screenshake_on: getScreenshakeOn() });
}

/**
 * Sync a partial settings object to the server.
 * Merges the provided keys into the user's profile settings via PATCH /api/user/profile.
 * Fails silently — localStorage is the local authoritative cache.
 */
export async function syncSettings(partial) {
  const supabase = settingsHooks.getSupabase();
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

/**
 * Wire menu close, backdrop, speed/font buttons, and logout confirm.
 * Safe to call once per page. A second call refreshes hooks but does not
 * add another listener (the mobile double-logout bug).
 * @param {{ getSupabase?: function, hideMenuSettings?: function, logout?: function }} [hooks]
 */
export function initMenuSettings(hooks = {}) {
  if (hooks.getSupabase) settingsHooks.getSupabase = hooks.getSupabase;
  if (hooks.hideMenuSettings) settingsHooks.hideMenuSettings = hooks.hideMenuSettings;
  if (hooks.logout) settingsHooks.logout = hooks.logout;
  if (menuWired) return;
  menuWired = true;

  const hideMenuSettings = settingsHooks.hideMenuSettings;
  const logout = settingsHooks.logout;

  const closeBtn = document.getElementById('menu-settings-close');
  if (closeBtn) closeBtn.addEventListener('click', hideMenuSettings);

  // Click backdrop to dismiss (same pattern as not-ready-modal)
  const modal = document.getElementById('menu-settings-modal');
  const frame = modal?.querySelector('.menu-settings-frame');
  if (modal && frame) {
    modal.addEventListener('click', (e) => {
      // Close only if clicking the backdrop, not the frame or its children
      if (!frame.contains(e.target) && e.target !== closeBtn) {
        hideMenuSettings();
      }
    });
  }

  // Text-speed buttons only. Other .speed-opt rows (font, effect speed, shake)
  // have their own data attributes and must not call setBattleTextSpeed.
  document.querySelectorAll('.speed-opt[data-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      setBattleTextSpeed(btn.dataset.speed);
    });
  });

  // Font size option buttons
  document.querySelectorAll('.font-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setQueueFontSize(btn.dataset.font);
    });
  });

  document.querySelectorAll('.ux-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setUxSpeedSetting(btn.dataset.ux);
    });
  });

  document.querySelectorAll('.shake-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setScreenshakeSetting(btn.dataset.shake === 'on');
    });
  });

  // Subscribe to external changes (e.g. from battle tab or other tab) to keep highlights in sync
  onSpeedChange(() => highlightSpeedButtons());
  onFontSizeChange(() => highlightFontButtons());
  onUxSpeedChange(() => highlightUxButtons());
  onScreenshakeChange(() => highlightShakeButtons());

  // Logout button — shows the confirmation dialog
  const logoutBtn = document.getElementById('menu-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const confirm = document.getElementById('logout-confirm-dialog');
      if (confirm) confirm.hidden = false;
    });
  }

  // Logout confirmation Yes — performs actual logout (reuses existing logout())
  const confirmYes = document.getElementById('logout-confirm-yes');
  if (confirmYes) {
    confirmYes.addEventListener('click', () => {
      hideMenuSettings();
      // Give the modal time to hide before redirecting
      setTimeout(() => logout(), 100);
    });
  }

  // Logout confirmation No — dismisses the dialog
  const confirmNo = document.getElementById('logout-confirm-no');
  if (confirmNo) {
    confirmNo.addEventListener('click', () => {
      const confirm = document.getElementById('logout-confirm-dialog');
      if (confirm) confirm.hidden = true;
    });
  }
}
