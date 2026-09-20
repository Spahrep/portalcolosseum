/**
 * Portal Colosseum - Portal Selection Screen (PC-75)
 * External ES module for /portal-select.html
 * Same auth pattern as game-app.js / run-equip-app.js
 * Fetches GET /api/combat/portals (now includes ap_cost, unlock_gold_cost, player_has_completed_previous, is_locked)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabase;
let portals = [];
let selectedIndex = -1;

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase env');
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}

async function getAuthToken() {
  return supabase?.auth?.getSession?.().then(({data}) => data?.session?.access_token);
}

async function apiCall(path, method = 'GET', body = null) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/combat${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function checkAuth() {
  if (!supabase) {
    window.location.href = '/login.html';
    return false;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return false;
  }
  return session;
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#330000;color:#ffaaaa;border:2px solid #ff6666;padding:8px 16px;font-size:12px;z-index:9999;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function updateHighlight() {
  const cards = document.querySelectorAll('.portal-card');
  cards.forEach((card, i) => {
    card.classList.toggle('menu-focused', i === selectedIndex);
  });
  // Scroll the highlighted card into view if off-screen
  const target = cards[selectedIndex];
  if (target) {
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function activatePortal() {
  const p = portals[selectedIndex];
  if (!p) return;
  if (!p.is_locked) {
    window.location.href = `/run-equip.html?portal_id=${p.id}`;
  } else {
    const cost = p.unlock_gold_cost || 1000;
    showToast(`Complete Portal ${p.id - 1} first, then pay ${cost} gold to unlock`);
  }
}

function handleArrowKey(dx, dy) {
  if (portals.length === 0) return;
  const cards = document.querySelectorAll('.portal-card');
  const cols = getColumns(cards);
  const curRow = Math.floor(selectedIndex / cols);
  const curCol = selectedIndex % cols;

  let newRow = curRow + dy;
  let newCol = curCol + dx;

  if (newCol < 0) {
    newCol = cols - 1;
    newRow -= 1;
  } else if (newCol >= cols) {
    newCol = 0;
    newRow += 1;
  }

  newRow = Math.max(0, Math.min(newRow, Math.ceil(cards.length / cols) - 1));
  const newIndex = newRow * cols + newCol;
  if (newIndex >= 0 && newIndex < cards.length) {
    selectedIndex = newIndex;
    updateHighlight();
  }
}

function getColumns(cards) {
  if (cards.length < 2) return 1;
  // Detect how many cards fit per row by finding cards on the same vertical level
  const rect0 = cards[0].getBoundingClientRect();
  let cols = 1;
  for (let i = 1; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (r.top - rect0.top < 5 && r.top - rect0.top > -5) {
      cols++;
    } else {
      break;
    }
  }
  return cols;
}

function renderPortals(data) {
  portals = data;
  const grid = document.getElementById('portal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  portals.forEach(p => {
    const card = document.createElement('div');
    card.className = `portal-card ${p.is_locked ? 'locked' : 'unlocked'}`;
    card.innerHTML = `
      <div class="portal-header">
        <span class="portal-num">P${String(p.id).padStart(2,'0')}</span>
        <span class="portal-name">${p.name}</span>
      </div>
      <div class="portal-costs">
        <div class="cost ap"><span>AP</span> ${p.ap_cost || 0}</div>
        ${p.is_locked ? `<div class="cost gold"><span>UNLOCK</span> ${p.unlock_gold_cost || 1000} GOLD</div>` : ''}
      </div>
      <div class="portal-status ${p.is_locked ? 'locked' : 'unlocked'}">
        ${p.is_locked ? '🔒 LOCKED' : '✅ UNLOCKED'}
      </div>
      ${p.is_locked ? `<div class="lock-hint">Complete Portal ${p.id-1} first, then pay ${p.unlock_gold_cost || 1000} gold to unlock</div>` : ''}
    `;
    card.addEventListener('click', () => {
      // On click, sync selection to this card then activate
      const idx = Array.from(grid.children).indexOf(card);
      selectedIndex = idx;
      updateHighlight();
      if (!p.is_locked) {
        window.location.href = `/run-equip.html?portal_id=${p.id}`;
      } else {
        showToast(`Complete Portal ${p.id - 1} first, then pay ${p.unlock_gold_cost || 1000} gold to unlock`);
      }
    });
    grid.appendChild(card);
  });

  // Auto-highlight the highest unlocked portal
  let bestIdx = -1;
  for (let i = portals.length - 1; i >= 0; i--) {
    if (!portals[i].is_locked) {
      bestIdx = i;
      break;
    }
  }
  // Fallback to first portal if none unlocked
  if (bestIdx === -1) bestIdx = 0;
  selectedIndex = bestIdx;
  updateHighlight();
}

function setupKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.location.href = '/game.html';
      return;
    }

    // Arrow navigation — only react when portal cards exist
    if (portals.length === 0) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        handleArrowKey(e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowDown' ? 1 : 0);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        handleArrowKey(e.key === 'ArrowLeft' ? -1 : 0, e.key === 'ArrowUp' ? -1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        activatePortal();
        break;
    }
  });
}

async function init() {
  supabase = initSupabase();
  const session = await checkAuth();
  if (!session) return;

  const loading = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const grid = document.getElementById('portal-grid');

  try {
    loading.style.display = 'block';
    const data = await apiCall('/portals');
    const portalData = data.portals || [];
    loading.style.display = 'none';
    if (portalData.length === 0) {
      errorEl.textContent = 'No portals available';
      errorEl.style.display = 'block';
      return;
    }
    renderPortals(portalData);
    setupKeyboardNav();
  } catch (e) {
    console.error('Failed to load portals', e);
    loading.style.display = 'none';
    errorEl.textContent = 'Failed to load portals: ' + e.message;
    errorEl.style.display = 'block';
  }

  // Back button in dock
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', () => window.location.href = '/game.html');
}

window.addEventListener('DOMContentLoaded', init);