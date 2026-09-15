/**
 * Portal Colosseum - Run Equip Page Application Logic (PC-42)
 * External ES module for /run-equip.html
 * Uses window.ENV + direct Supabase (matches game-app.js exactly)
 * Real API: GET /api/combat/weapons, /consumables, /portals, POST /api/combat/runs
 * Auth redirect to /login.html on no session
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabase;
let backpack = [];
let loadout = [null, null, null, null, null];
let selectedIndex = null;
let popupEl;
let currentPortal = null;
let weaponsMap = {};
let consumablesMap = {};

function getAuthToken() {
  // For API calls, use supabase session token
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
  return true;
}

async function loadData() {
  // Fetch weapons, consumables, portals (first one)
  const [wRes, cRes, pRes] = await Promise.all([
    apiCall('/weapons'),
    apiCall('/consumables'),
    apiCall('/portals')
  ]);

  const weapons = wRes.weapons || [];
  const consumables = cRes.consumables || [];
  const portals = pRes.portals || [];

  weaponsMap = {};
  weapons.forEach(w => { if (w && w.name) weaponsMap[w.name] = w; });
  consumablesMap = {};
  consumables.forEach(c => {
    const key = c.name || c.template_name || c.consumable_template?.name || c.consumable_template?.template_name;
    if (key) consumablesMap[key] = c;
  });

  currentPortal = portals[0] || null;

  // Default loadout prefill: first 3 weapons + first 2 consumables if owned
  const ownedWeapons = weapons.slice(0, 3);
  const ownedConsumables = consumables.slice(0, 2);
  loadout[0] = ownedWeapons[0] ? ownedWeapons[0].name : null;
  loadout[1] = ownedWeapons[1] ? ownedWeapons[1].name : null;
  loadout[2] = ownedWeapons[2] ? ownedWeapons[2].name : null;
  loadout[3] = ownedConsumables[0] ? (ownedConsumables[0].name || ownedConsumables[0].template_name || ownedConsumables[0].consumable_template?.name) : null;
  loadout[4] = ownedConsumables[1] ? (ownedConsumables[1].name || ownedConsumables[1].template_name || ownedConsumables[1].consumable_template?.name) : null;

  // Backpack = remaining owned items not in loadout
  backpack = [];
  const used = new Set(loadout.filter(Boolean));
  weapons.forEach(w => { if (w && w.name && !used.has(w.name)) backpack.push(w.name); });
  consumables.forEach(c => {
    const nm = c.name || c.template_name || c.consumable_template?.name || c.consumable_template?.template_name;
    if (nm && !used.has(nm)) backpack.push(nm);
  });
}

function isWeapon(name) { return !!weaponsMap[name]; }
function isConsumable(name) { return !!consumablesMap[name]; }

function renderBackpack() {
  const grid = document.getElementById('backpack-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    if (i < backpack.length) {
      slot.textContent = backpack[i];
      slot.dataset.index = i;
      slot.onclick = () => selectBackpackItem(i, slot);
    } else {
      slot.classList.add('empty');
      slot.textContent = (i + 1).toString().padStart(2, '0');
    }
    grid.appendChild(slot);
  }
}

function selectBackpackItem(index, el) {
  document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  selectedIndex = index;
  const itemName = backpack[index];
  showInspectPopup(itemName, el);
  highlightTargets(itemName);
}

function highlightTargets(itemName) {
  const isW = isWeapon(itemName);
  const isC = isConsumable(itemName);
  document.querySelectorAll('.slot-row').forEach(row => {
    const slotNum = parseInt(row.dataset.slot);
    const content = row.querySelector('.slot-content');
    const isWeaponSlot = slotNum <= 2;
    const isConsumableSlot = slotNum >= 3;
    if ((isW && isWeaponSlot) || (isC && isConsumableSlot)) {
      content.style.borderColor = '#66ff99';
      content.style.boxShadow = '0 0 0 1px #66ff99';
    } else {
      content.style.opacity = '0.5';
    }
  });
}

function clearHighlights() {
  document.querySelectorAll('.slot-content').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    el.style.opacity = '';
  });
  document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected', 'valid-target', 'invalid-target'));
}

function showInspectPopup(itemName, targetEl) {
  popupEl.innerHTML = '';
  popupEl.style.display = 'block';
  const rect = targetEl.getBoundingClientRect();
  const contRect = document.querySelector('.container').getBoundingClientRect();
  popupEl.style.left = (rect.left - contRect.left + 30) + 'px';
  popupEl.style.top = (rect.top - contRect.top - 10) + 'px';

  let html = `<div class="name">${itemName}</div>`;
  if (weaponsMap[itemName]) {
    const w = weaponsMap[itemName];
    html += `<div class="type">WEAPON</div>`;
    html += `<div class="stat-line">DMG ${w.damage ?? '??'} · SPD ${w.speed ?? '??'} · ACC ${w.accuracy ?? '??'}</div>`;
    if (w.attacks && w.attacks.length) {
      const rows = w.attacks.map(a => {
        const bits = [];
        if (a.base_damage_multiplier != null) bits.push(`×${a.base_damage_multiplier} dmg`);
        if (a.prepare_time != null) bits.push(`cast ${a.prepare_time}`);
        if (a.cooldown_time != null) bits.push(`cd ${a.cooldown_time}`);
        if (a.is_multi_target) bits.push('multi-target');
        let row = `<div class="attack-row"><strong>${a.name}</strong>`;
        if (bits.length) row += ` <span style="color:#88aaff;">${bits.join(' · ')}</span>`;
        if (a.description) row += `<div style="color:#7a8ca6;margin-top:2px;">${a.description}</div>`;
        return row + '</div>';
      }).join('');
      html += `<div class="attacks">${rows}</div>`;
    }
  } else if (consumablesMap[itemName]) {
    const c = consumablesMap[itemName];
    html += `<div class="type">CONSUMABLE</div>`;
    html += `<div class="stat-line">${c.consumable_template?.description || c.description || c.template_name || 'Effect'}</div>`;
  }
  popupEl.innerHTML = html;

  setTimeout(() => {
    document.addEventListener('click', function handler(ev) {
      if (!popupEl.contains(ev.target) && !targetEl.contains(ev.target)) {
        popupEl.style.display = 'none';
        clearHighlights();
        document.removeEventListener('click', handler);
      }
    }, { once: true });
  }, 10);
}

function assignToSlot(slotIndex) {
  if (selectedIndex === null) return;
  const itemName = backpack[selectedIndex];
  const isW = isWeapon(itemName);
  const isC = isConsumable(itemName);
  const isWeaponSlot = slotIndex <= 2;
  const isConsumableSlot = slotIndex >= 3;

  if ((isW && !isWeaponSlot) || (isC && !isConsumableSlot)) {
    const row = document.querySelector(`[data-slot="${slotIndex}"]`);
    const orig = row.querySelector('.slot-content').innerHTML;
    row.querySelector('.slot-content').innerHTML = `<span class="error-flash">${isW ? 'Weapons go in hand/belt slots' : 'Consumables go in C1/C2'}</span>`;
    setTimeout(() => {
      if (row.querySelector('.slot-content')) row.querySelector('.slot-content').innerHTML = orig;
      clearHighlights();
      selectedIndex = null;
      popupEl.style.display = 'none';
    }, 1200);
    return;
  }

  const displaced = loadout[slotIndex];
  loadout[slotIndex] = itemName;
  backpack.splice(selectedIndex, 1);
  if (displaced) backpack.push(displaced);
  renderAll();
  clearHighlights();
  selectedIndex = null;
  popupEl.style.display = 'none';
}

function unequipSlot(slotIndex) {
  const itemName = loadout[slotIndex];
  if (!itemName) return;
  loadout[slotIndex] = null;
  backpack.push(itemName);
  renderAll();
}

function renderLoadout() {
  const labels = ['LH','RH','BL','C1','C2'];
  for (let i = 0; i < 5; i++) {
    const content = document.getElementById('slot-' + i);
    if (!content) continue;
    const row = content.parentElement;
    row.onclick = null;
    if (loadout[i]) {
      const name = loadout[i];
      let stats = '';
      if (weaponsMap[name]) stats = `DMG ${weaponsMap[name].damage || '??'}`;
      else if (consumablesMap[name]) stats = consumablesMap[name].consumable_template?.description || consumablesMap[name].description || 'Effect';
      content.innerHTML = `<span>${name}</span><span class="stats">${stats}</span>`;
      content.classList.remove('empty');
      row.onclick = () => unequipSlot(i);
    } else {
      content.innerHTML = '— EMPTY —';
      content.classList.add('empty');
    }
    const origClick = row.onclick;
    row.onclick = (e) => {
      if (selectedIndex !== null) {
        assignToSlot(i);
      } else if (origClick) {
        origClick();
      }
    };
  }
}

function renderDiceTray() {
  const tray = document.querySelector('.dice-tray');
  if (!tray || !currentPortal) return;
  const g = currentPortal.green_dice_count || 4;
  const y = currentPortal.yellow_dice_count || 3;
  const r = currentPortal.red_dice_count || 2;
  const total = g + y + r;
  // Face values come from the portal template (API payload), never invented here.
  const facesOf = (color) => (currentPortal && Array.isArray(currentPortal[color + '_faces']) && currentPortal[color + '_faces'].length)
    ? currentPortal[color + '_faces'].join(' · ')
    : null;
  const titleFor = (color) => {
    const faces = facesOf(color);
    return faces ? `Faces: ${faces}` : '';
  };
  let html = '<div><div style="display:flex;gap:3px;margin-bottom:2px;">';
  for (let i = 0; i < g; i++) html += `<div class="die green" title="${titleFor('green')}">G</div>`;
  for (let i = 0; i < y; i++) html += `<div class="die yellow" title="${titleFor('yellow')}">Y</div>`;
  for (let i = 0; i < r; i++) html += `<div class="die red" title="${titleFor('red')}">R</div>`;
  html += `</div><div class="dice-labels"><div>REMAINING (${total})</div><div>USED (0)</div></div></div>`;
  tray.innerHTML = html;
}

function renderAll() {
  renderBackpack();
  renderLoadout();
  renderDiceTray();
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      selectedIndex = null;
      popupEl.style.display = 'none';
      clearHighlights();
      document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected'));
    }
    if (e.key >= '1' && e.key <= '5') {
      const slot = parseInt(e.key) - 1;
      if (selectedIndex !== null) {
        assignToSlot(slot);
      } else {
        if (loadout[slot]) unequipSlot(slot);
      }
    }
    if (e.key === 'Enter') {
      const btn = document.getElementById('enter-btn');
      if (btn) btn.click();
    }
  });
}

async function enterPortal() {
  if (!currentPortal) {
    alert('No portal selected');
    return;
  }
  // Real instance id mapping using maps (support template_name shape)
  const getWeaponId = (name) => name && weaponsMap[name] ? weaponsMap[name].id : null;
  const getConsumableId = (name) => name && consumablesMap[name] ? consumablesMap[name].id : null;
  const payload = {
    portal_template_id: currentPortal.id,
    hand_l_weapon_id: getWeaponId(loadout[0]),
    hand_r_weapon_id: getWeaponId(loadout[1]),
    belt_weapon_id: getWeaponId(loadout[2]),
    consume_a: getConsumableId(loadout[3]),
    consume_b: getConsumableId(loadout[4])
  };
  try {
    const result = await apiCall('/runs', 'POST', payload);
    const runId = result.run?.id || result.id;
    window.location.href = `/run.html?id=${runId}`;
  } catch (e) {
    const bottom = document.getElementById('bottom-bar');
    // Failure UX: keep ENTER button, show error above it
    const existingErr = bottom.querySelector('.message-error');
    if (existingErr) existingErr.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'message-error';
    errDiv.style.color = '#ff6666';
    errDiv.style.marginBottom = '8px';
    errDiv.textContent = `ENTRY FAILED: ${e.message}`;
    bottom.insertBefore(errDiv, bottom.firstChild);
  }
}

function setupEnterButton() {
  const btn = document.getElementById('enter-btn');
  const bottom = document.getElementById('bottom-bar');
  btn.onclick = async () => {
    // clear prior error if any
    const prior = bottom.querySelector('.message-error');
    if (prior) prior.remove();
    bottom.querySelectorAll('.message-locked').forEach(el => el.remove());
    const lockMsg = document.createElement('div');
    lockMsg.className = 'message-locked';
    lockMsg.textContent = 'Loadout locked. Entering portal...';
    bottom.insertBefore(lockMsg, btn);
    await enterPortal();
  };
}

async function init() {
  popupEl = document.getElementById('info-popup');
  // createClient FIRST matching game-app.js exactly (auth order fix)
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
  if (!await checkAuth()) return;
  try {
    await loadData();
  } catch (e) {
    console.error('Data load failed', e);
    // fallback to empty
  }
  renderAll();
  setupKeyboard();
  setupEnterButton();
  if (popupEl) popupEl.style.display = 'none';
  // Update run info if portal known
  const runInfo = document.querySelector('.run-info h1');
  if (runInfo && currentPortal) runInfo.textContent = `${currentPortal.name} · RUN 1`;
}

init();
