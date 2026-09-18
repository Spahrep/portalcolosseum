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

function renderPortals(portals) {
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
        <div class="cost gold"><span>GOLD</span> ${p.unlock_gold_cost || 1000}</div>
      </div>
      <div class="portal-status ${p.is_locked ? 'locked' : 'unlocked'}">
        ${p.is_locked ? '🔒 LOCKED' : '✅ UNLOCKED'}
      </div>
      ${p.is_locked ? `<div class="lock-hint">Complete Portal ${p.id-1} to unlock</div>` : ''}
    `;
    card.addEventListener('click', () => {
      if (!p.is_locked) {
        window.location.href = `/run-equip.html?portal_id=${p.id}`;
      } else {
        showToast(`Complete Portal ${p.id - 1} to unlock`);
      }
    });
    grid.appendChild(card);
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
    const portals = data.portals || [];
    loading.style.display = 'none';
    if (portals.length === 0) {
      errorEl.textContent = 'No portals available';
      errorEl.style.display = 'block';
      return;
    }
    renderPortals(portals);
  } catch (e) {
    console.error('Failed to load portals', e);
    loading.style.display = 'none';
    errorEl.textContent = 'Failed to load portals: ' + e.message;
    errorEl.style.display = 'block';
  }

  // Escape key -> back to game.html
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.location.href = '/game.html';
    }
  });

  // Optional: back button in dock if present
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', () => window.location.href = '/game.html');
}

window.addEventListener('DOMContentLoaded', init);