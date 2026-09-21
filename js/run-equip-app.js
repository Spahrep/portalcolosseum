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
// Backpack and loadout hold ITEM objects: { kind: 'weapon'|'consumable', id, name }.
// Identity is the instance id, never the name — two Wristblades are two distinct
// instances and must stay distinct (a name-keyed map collapsed them into one id,
// so a second same-named weapon silently vanished and the run payload repeated
// the same instance id, which the API rejects as 'Duplicate weapon id').
let backpack = [];
let loadout = [null, null, null, null, null];
let selectedIndex = null;
let popupEl;
let hoverTimer = null;
let currentPortal = null;
let weaponsById = {};
let consumablesById = {};

// F/E excluded = no color badge (plain text — junk tier)
const GRADE_COLORS = {
  D: '#9d9d9d',  // gray  — below average
  C: '#ffffff',  // white — average/baseline
  B: '#1eff00',  // green — uncommon
  A: '#0070dd',  // blue  — rare
  S: '#a335ee',  // purple — top tier
  // orange reserved for future beyond-S content
};

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
  return session;
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

  weaponsById = {};
  weapons.forEach(w => { if (w && w.id) weaponsById[w.id] = w; });
  consumablesById = {};
  consumables.forEach(c => { if (c && c.id) consumablesById[c.id] = c; });

  // PC-75: support ?portal_id=N query param; default to Portal 1 if absent (backward compat)
  const urlParams = new URLSearchParams(window.location.search);
  const portalIdParam = urlParams.get('portal_id');
  const portalId = portalIdParam ? parseInt(portalIdParam, 10) : null;
  if (portalId && portals.length > 0) {
    currentPortal = portals.find(p => p.id === portalId) || portals[0];
  } else {
    currentPortal = portals[0] || null;
  }

  // One item per owned instance. Names repeat freely across instances.
  const weaponItems = weapons.filter(w => w && w.id).map(w => ({ kind: 'weapon', id: w.id, name: w.name, grade: w.grade || null }));
  const consumableItems = consumables.filter(c => c && c.id).map(c => ({ kind: 'consumable', id: c.id, name: c.template_name, grade: c.grade || null }));

  // Default loadout prefill: first 3 weapon instances + first 2 consumables if owned
  loadout[0] = weaponItems[0] || null;
  loadout[1] = weaponItems[1] || null;
  loadout[2] = weaponItems[2] || null;
  loadout[3] = consumableItems[0] || null;
  loadout[4] = consumableItems[1] || null;

  // Backpack = remaining owned instances not in loadout (dedupe by instance id,
  // not name; composite kind:id key in case a weapon and consumable share an id)
  backpack = [];
  const usedKeys = new Set(loadout.filter(Boolean).map(item => `${item.kind}:${item.id}`));
  weaponItems.forEach(item => { if (!usedKeys.has(`${item.kind}:${item.id}`)) backpack.push(item); });
  consumableItems.forEach(item => { if (!usedKeys.has(`${item.kind}:${item.id}`)) backpack.push(item); });
}

function isWeapon(item) { return !!item && item.kind === 'weapon'; }
function isConsumable(item) { return !!item && item.kind === 'consumable'; }

function renderBackpack() {
  const grid = document.getElementById('backpack-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    if (i < backpack.length) {
      const item = backpack[i];
      slot.innerHTML = '';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;
      if (item.grade && GRADE_COLORS[item.grade]) {
        nameSpan.style.color = GRADE_COLORS[item.grade];
      }
      slot.appendChild(nameSpan);
      if (item.grade) {
        const badge = document.createElement('span');
        badge.textContent = item.grade;
        if (GRADE_COLORS[item.grade]) {
          badge.style.cssText = `background:${GRADE_COLORS[item.grade]};color:#000;font-size:9px;padding:0 3px;margin-left:4px;border-radius:2px;`;
        } else {
          badge.style.cssText = `color:#666;font-size:9px;margin-left:4px;`;
        }
        slot.appendChild(badge);
      }
      slot.dataset.index = i;
      slot.onclick = () => selectBackpackItem(i, slot);
      slot.onmouseenter = () => onHoverItem(backpack[i], slot);
      slot.onmouseleave = onHoverLeave;
    } else {
      slot.classList.add('empty');
      slot.textContent = (i + 1).toString().padStart(2, '0');
    }
    grid.appendChild(slot);
  }
}

function selectBackpackItem(index, el) {
  // Clicking the already-selected item again deselects it
  if (selectedIndex === index) {
    selectedIndex = null;
    hidePopup();
    clearHighlights();
    return;
  }
  document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  selectedIndex = index;
  const item = backpack[index];
  showInspectPopup(item, el);
  highlightTargets(item);
}

function highlightTargets(item) {
  const isW = isWeapon(item);
  const isC = isConsumable(item);
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

function buildPopupHtml(item) {
  let nameHtml = item.name;
  if (item.grade) {
    if (GRADE_COLORS[item.grade]) {
      nameHtml = `<span style='color:${GRADE_COLORS[item.grade]}'>${item.name}</span> <span style='color:${GRADE_COLORS[item.grade]};font-size:11px;'>(${item.grade})</span>`;
    } else {
      nameHtml = `${item.name} <span style='color:#666;font-size:11px;'>(${item.grade})</span>`;
    }
  }
  let html = `<div class="name">${nameHtml}</div>`;
  if (item.kind === 'weapon') {
    const w = weaponsById[item.id];
    if (w) {
      html += `<div class="type">WEAPON</div>`;
      html += `<div class="stat-line">Damage: ${w.damage ?? '??'} · Speed: ${w.speed ?? '??'} · Accuracy: ${w.accuracy ?? '??'} · Crit: ${w.crit_chance ?? 5}%</div>`;
      if (w.attacks && w.attacks.length) {
        const rows = w.attacks.map(a => {
          const bits = [];
          if (a.base_damage_multiplier != null) bits.push(`×${a.base_damage_multiplier} damage`);
          if (a.prepare_time != null) bits.push(`cast ${a.prepare_time}`);
          if (a.cooldown_time != null) bits.push(`cooldown ${a.cooldown_time}`);
          if (a.is_multi_target) bits.push('multi-target');
          bits.push(`Crit ${Math.round((w.crit_chance ?? 5) * (a.crit_factor ?? 1))}% ×${a.crit_multiplier ?? 2}`);
          let row = `<div class="attack-row"><strong>${a.name}</strong>`;
          if (bits.length) row += ` <span style="color:#88aaff;">${bits.join(' · ')}</span>`;
          if (a.description) row += `<div style="color:#7a8ca6;margin-top:2px;">${a.description}</div>`;
          return row + '</div>';
        }).join('');
        html += `<div class="attacks">${rows}</div>`;
      }
    }
  } else if (item.kind === 'consumable') {
    const c = consumablesById[item.id];
    if (c) {
      html += `<div class="type">CONSUMABLE</div>`;
      html += `<div class="stat-line">${c.description || c.effect_label || c.template_name || 'Effect'}</div>`;
    }
  }
  return html;
}

function positionPopup(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const contRect = document.querySelector('.container').getBoundingClientRect();
  const loadoutRight = document.querySelector('.loadout-panel').getBoundingClientRect().right - contRect.left;
  const minLeft = loadoutRight + 6;
  const popupW = popupEl.offsetWidth;
  const popupH = popupEl.offsetHeight;
  const GAP = 12;
  // style.left/top are relative to the container's padding box (inset by its
  // border), so offset the gaps by the border widths to keep the VISUAL gap
  // at GAP on every side.
  const contStyle = getComputedStyle(document.querySelector('.container'));
  const borderL = parseFloat(contStyle.borderLeftWidth) || 0;
  const borderT = parseFloat(contStyle.borderTopWidth) || 0;
  // Beside the item, a full gap clear of its right edge — never ON the item.
  // A popup over the button it describes eats the click meant for that button
  // (the old rect.left + 30 anchored to the item's LEFT edge, so the popup
  // overlapped ~75% of it). pointer-events:none on .info-popup is the
  // click-through backstop for any residual overlap.
  let left = rect.right - contRect.left + GAP;
  if (left < minLeft) left = minLeft;
  // Overflowing the container's right edge: flip to the item's left side,
  // again a full gap clear of the item's left edge.
  if (left + popupW > contRect.width - 8) {
    const flipped = rect.left - contRect.left - popupW - GAP - borderL;
    // Flip to the item's left side, a full gap clear of its left edge. If even
    // that doesn't fit (very narrow viewport), clamp to the backpack area's
    // left edge — never slide the popup back right over the hovered item.
    left = flipped >= minLeft ? flipped : minLeft;
  }
  let top = rect.top - contRect.top - 6;
  if (top < 8) top = 8;
  if (top + popupH > contRect.height - 8) {
    // Not enough room below (bottom row): flip upward, a full gap clear of the
    // item, instead of dropping the popup over the bottom bar/ENTER button.
    const above = rect.top - contRect.top - popupH - GAP - borderT;
    top = above >= 8 ? above : Math.max(8, contRect.height - popupH - 8);
  }
  popupEl.style.left = left + 'px';
  popupEl.style.top = top + 'px';
}

function showInfoFor(item, targetEl) {
  popupEl.innerHTML = buildPopupHtml(item);
  // Measure AFTER showing: offsetWidth/offsetHeight are 0 while display:none,
  // which broke overflow detection, the flip, and the vertical clamps.
  popupEl.style.display = 'block';
  positionPopup(targetEl);
}

function hidePopup() {
  if (popupEl) popupEl.style.display = 'none';
}

function onHoverItem(item, el) {
  clearTimeout(hoverTimer);
  if (!item) {
    // Empty slot (spare backpack cell, empty loadout row): clear any stale
    // popup rather than dereferencing a null item. While an item is selected
    // the pinned popup stays put.
    if (selectedIndex === null) hidePopup();
    return;
  }
  showInfoFor(item, el);
}

function onHoverLeave() {
  clearTimeout(hoverTimer);
  // Short grace so moving between adjacent slots doesn't blink the popup.
  hoverTimer = setTimeout(() => {
    if (selectedIndex !== null && backpack[selectedIndex]) {
      // Pinned selection: revert to the selected item's info.
      const selEl = document.querySelector('.inv-slot.selected');
      if (selEl) showInfoFor(backpack[selectedIndex], selEl);
      else hidePopup();
    } else {
      hidePopup();
    }
  }, 150);
}

function showInspectPopup(item, targetEl) {
  showInfoFor(item, targetEl);
}

// Persistent dismissal for the pinned (click-selected) popup. Backpack and
// loadout clicks manage themselves (select/deselect, assign/unequip); anything
// else — background, bottom bar, dice panel — clears the selection.
function setupDismiss() {
  document.addEventListener('click', (ev) => {
    if (selectedIndex === null) return;
    if (ev.target.closest('.inv-slot') || ev.target.closest('.slot-row')) return;
    selectedIndex = null;
    clearHighlights();
    hidePopup();
  });
}

function assignToSlot(slotIndex) {
  if (selectedIndex === null) return;
  const item = backpack[selectedIndex];
  const isW = isWeapon(item);
  const isC = isConsumable(item);
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
  loadout[slotIndex] = item;
  backpack.splice(selectedIndex, 1);
  if (displaced) backpack.push(displaced);
  renderAll();
  clearHighlights();
  selectedIndex = null;
  popupEl.style.display = 'none';
}

function unequipSlot(slotIndex) {
  const item = loadout[slotIndex];
  if (!item) return;
  loadout[slotIndex] = null;
  backpack.push(item);
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
      const item = loadout[i];
      let stats = '';
      if (item.kind === 'weapon') {
        const w = weaponsById[item.id];
        if (w) stats = `Damage: ${w.damage ?? '??'}`;
      } else if (item.kind === 'consumable') {
        const c = consumablesById[item.id];
        if (c) stats = c.description || c.effect_label || c.template_name || 'Effect';
      }
      let nameHtml = item.name;
      if (item.grade) {
        if (GRADE_COLORS[item.grade]) {
          nameHtml = `<span style='color:${GRADE_COLORS[item.grade]}'>${item.name}</span> <span style='color:${GRADE_COLORS[item.grade]};font-size:11px;'>(${item.grade})</span>`;
        } else {
          nameHtml = `${item.name} <span style='color:#666;font-size:11px;'>(${item.grade})</span>`;
        }
      }
      content.innerHTML = `<span>${nameHtml}</span><span class="stats">${stats}</span>`;
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
    // Hover an equipped slot to inspect its item (clicking a slot unequips —
    // hover is the only way to read its full info). Suppressed while an item
    // is selected so the equip-flow popup stays put.
    row.onmouseenter = () => {
      if (selectedIndex === null) {
        if (loadout[i]) onHoverItem(loadout[i], content);
        else hidePopup();
      }
    };
    row.onmouseleave = onHoverLeave;
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
  // Die-box markers (presentation only): color letters swapped for glyphs —
  // green ?? / yellow ?! / red !! (matches battle-app.js renderDice).
  const MARK = { green: '??', yellow: '?!', red: '!!' };
  for (let i = 0; i < g; i++) html += `<div class="die green" title="${titleFor('green')}">${MARK.green}</div>`;
  for (let i = 0; i < y; i++) html += `<div class="die yellow" title="${titleFor('yellow')}">${MARK.yellow}</div>`;
  for (let i = 0; i < r; i++) html += `<div class="die red" title="${titleFor('red')}">${MARK.red}</div>`;
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
  // Each loadout slot carries its own instance id — two same-named weapons send
  // two distinct ids, which the API accepts (it only rejects one id twice).
  const payload = {
    portal_template_id: currentPortal.id,
    hand_l_weapon_id: isWeapon(loadout[0]) ? loadout[0].id : null,
    hand_r_weapon_id: isWeapon(loadout[1]) ? loadout[1].id : null,
    belt_weapon_id: isWeapon(loadout[2]) ? loadout[2].id : null,
    consume_a: isConsumable(loadout[3]) ? loadout[3].id : null,
    consume_b: isConsumable(loadout[4]) ? loadout[4].id : null
  };
  try {
    const result = await apiCall('/runs', 'POST', payload);
    const runId = result.run?.id || result.id;
    // PC-72: fresh-entry marker — run.html plays the die ceremony only for a
    // genuine first entry (a NEW run just created here). Every other load of
    // that URL (returning after exiting part way, reload, reopened tab, direct
    // link) is a resume and restores instantly instead. sessionStorage (not
    // localStorage): a closed tab must not replay the ceremony.
    sessionStorage.setItem(`pc_fresh_entry_${runId}`, '1');
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
    // apiCall throws the raw response body; unwrap {"error":"..."} for display
    let message = e.message;
    try {
      const parsed = JSON.parse(e.message);
      if (parsed && parsed.error) message = parsed.error;
    } catch (parseErr) { /* not JSON — show as-is */ }
    errDiv.textContent = `ENTRY FAILED: ${message}`;
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
    // double-submit lock
    const originalDisabled = btn.disabled;
    btn.disabled = true;
    try {
      await enterPortal();
    } finally {
      btn.disabled = originalDisabled;
    }
  };
}

function setupCancelButton() {
  const btn = document.getElementById('cancel-btn');
  if (btn) {
    btn.onclick = () => { window.location.href = '/game.html'; };
  }
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
  const session = await checkAuth();
  if (!session) return;

  // PC-52: fill hud-name from session (front-end only, placeholder dock)
  const hudName = document.getElementById('hud-name');
  if (hudName && session && session.user) {
    const meta = session.user.user_metadata || {};
    hudName.textContent = meta.username || meta.full_name || (session.user.email ? session.user.email.split('@')[0] : 'PLAYER');
  }

  // PC-50r: active-run bounce on load (equip screen only for brand-new runs)
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
  try {
    await loadData();
  } catch (e) {
    console.error('Data load failed', e);
    // fallback to empty
  }
  renderAll();
  setupKeyboard();
  setupDismiss();
  setupEnterButton();
  setupCancelButton();
  if (popupEl) popupEl.style.display = 'none';
  // Update run info if portal known
  const runInfo = document.querySelector('.run-info h1');
  if (runInfo && currentPortal) runInfo.textContent = `${currentPortal.name} · RUN 1`;
}

init();
