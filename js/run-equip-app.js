/**
 * Portal Colosseum - Run Equip Page Application Logic (PC-42)
 * External ES module for /run-equip.html
 * Uses window.ENV + direct Supabase (matches game-app.js exactly)
 * Real API: GET /api/combat/weapons, /consumables, /portals, POST /api/combat/runs
 * Auth redirect to /login.html on no session
 */

import { apiCall, checkAuth } from './combat/combat-api.js';
import { fillHudName, redirectIfActiveRun } from './session.js';

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
          if (a.prepare_time_multiplier != null) bits.push(`cast ${Math.round((w.speed ?? 0) * (a.prepare_time_multiplier ?? 1))}`);
          if (a.cooldown_time_multiplier != null) bits.push(`cooldown ${Math.round((w.speed ?? 0) * (a.cooldown_time_multiplier ?? 1))}`);
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
      const typeTag = c.type_label || (c.effect_type ? c.effect_type.toUpperCase() : 'CONSUMABLE');
      html += `<div class="type">${typeTag}</div>`;
      html += `<div class="stat-line">${c.effect_label}</div>`;
      const info = [];
      if (c.drink_speed != null) info.push(`Speed: ${c.drink_speed}`);
      if (c.duration_ticks != null) info.push(`Duration: ${c.duration_ticks} tics`);
      if (c.crit_chance != null) info.push(`Crit: ${c.crit_chance}%`);
      if (info.length) html += `<div class="info-line">${info.join(' · ')}</div>`;
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
  const cellLeft = rect.left - contRect.left;
  const cellRight = rect.right - contRect.left;

  // Try right side: a full gap clear of the item's right edge
  let left = cellRight + GAP;
  if (left < minLeft) left = minLeft;

  // Whether we fell back to vertical placement below the cell
  let useVertical = false;

  // Overflowing the container's right edge: flip to the item's left side,
  // again a full gap clear of the item's left edge.
  if (left + popupW > contRect.width - 8) {
    const flipped = cellLeft - popupW - GAP - borderL;
    if (flipped >= minLeft) {
      // Left-side fit works — use it
      left = flipped;
    } else {
      // Neither side fits without overlapping the cell (the clamp to minLeft
      // would slide the popup right over the item). Place below the cell
      // instead, with the popup's left edge at the cell's left edge or the
      // loadout boundary, whichever is rightmost.
      useVertical = true;
      left = Math.max(minLeft, cellLeft);
      if (left + popupW > contRect.width - 8) {
        left = contRect.width - popupW - 8;
      }
      if (left < minLeft) left = minLeft;
    }
  }

  // Vertical position
  let top;
  if (useVertical) {
    // Below the cell, a small gap from its bottom edge
    top = rect.bottom - contRect.top + 4;
  } else {
    top = rect.top - contRect.top - 6;
  }

  // Clamp within vertical bounds
  if (top < 8) top = 8;
  if (top + popupH > contRect.height - 8) {
    // Not enough room below: flip upward, a full gap clear of the item, instead
    // of dropping the popup over the bottom bar/ENTER button.
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
        if (c) stats = c.effect_label || 'Effect';
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
      const overlay = document.getElementById('admin-overlay');
      if (overlay && !overlay.hidden) {
        overlay.hidden = true;
        return;
      }
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

// PC-110: admin-only generate + delete on the loadout screen.
// The button and panel are created only after POST /dev/grant returns dev_mode.
const SLOT_INDEX = { LH: 0, RH: 1, BL: 2, C1: 3, C2: 4 };
const WEAPON_SLOTS = ['LH', 'RH', 'BL', 'backpack'];
const CONSUMABLE_SLOTS = ['C1', 'C2', 'backpack'];
let adminBusy = false;
let pendingDelete = null;
let adminTemplates = { weapons: [], consumables: [] };

function apiErrorText(e) {
  let message = e && e.message ? e.message : 'request failed';
  try {
    const parsed = JSON.parse(message);
    if (parsed && parsed.error) message = parsed.error;
  } catch (_) { /* not JSON */ }
  return message;
}

function setAdminStatus(text, isError) {
  const el = document.getElementById('admin-status');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('error', !!isError);
}

function firstEmptySlot(kind) {
  if (kind === 'weapon') {
    if (!loadout[0]) return 'LH';
    if (!loadout[1]) return 'RH';
    if (!loadout[2]) return 'BL';
    return 'backpack';
  }
  if (!loadout[3]) return 'C1';
  if (!loadout[4]) return 'C2';
  return 'backpack';
}

function placeNewItem(item, slot) {
  const target = slot || firstEmptySlot(item.kind);
  const idx = SLOT_INDEX[target];
  const kindOk = item.kind === 'weapon' ? (idx != null && idx <= 2) : (idx != null && idx >= 3);
  if (target === 'backpack' || !kindOk) {
    backpack.push(item);
    return target === 'backpack' ? 'backpack' : firstEmptySlot(item.kind);
  }
  const displaced = loadout[idx];
  loadout[idx] = item;
  if (displaced) backpack.push(displaced);
  return target;
}

function ownedKey(item) { return `${item.kind}:${item.id}`; }

async function syncOwned(place) {
  const prev = new Set([
    ...loadout.filter(Boolean).map(ownedKey),
    ...backpack.map(ownedKey)
  ]);
  const [wRes, cRes] = await Promise.all([
    apiCall('/weapons'),
    apiCall('/consumables')
  ]);
  const weapons = wRes.weapons || [];
  const consumables = cRes.consumables || [];
  weaponsById = {};
  weapons.forEach(w => { if (w && w.id) weaponsById[w.id] = w; });
  consumablesById = {};
  consumables.forEach(c => { if (c && c.id) consumablesById[c.id] = c; });
  const weaponItems = weapons.filter(w => w && w.id).map(w => ({ kind: 'weapon', id: w.id, name: w.name, grade: w.grade || null }));
  const consumableItems = consumables.filter(c => c && c.id).map(c => ({ kind: 'consumable', id: c.id, name: c.template_name, grade: c.grade || null }));
  const all = [...weaponItems, ...consumableItems];
  const byKey = {};
  all.forEach(item => { byKey[ownedKey(item)] = item; });
  const owned = new Set(Object.keys(byKey));
  for (let i = 0; i < 5; i++) {
    if (loadout[i] && !owned.has(ownedKey(loadout[i]))) loadout[i] = null;
    else if (loadout[i]) loadout[i] = byKey[ownedKey(loadout[i])];
  }
  backpack = backpack.filter(item => owned.has(ownedKey(item))).map(item => byKey[ownedKey(item)]);
  const newcomers = all.filter(item => !prev.has(ownedKey(item)));
  let placed = null;
  newcomers.forEach((item, idx) => {
    if (place && idx === 0 && place.kind === item.kind) placed = placeNewItem(item, place.slot);
    else backpack.push(item);
  });
  renderAll();
  const overlay = document.getElementById('admin-overlay');
  if (overlay && !overlay.hidden) {
    renderAdminTemplates();
    renderAdminDeleteList();
  }
  return placed;
}

function fillSlotSelect(select, options, selected) {
  select.innerHTML = '';
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === selected) o.selected = true;
    select.appendChild(o);
  });
}

function renderTemplateRows(container, templates, kind) {
  container.innerHTML = '';
  const list = Array.isArray(templates) ? templates : [];
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = 'No templates';
    container.appendChild(empty);
    return;
  }
  const options = kind === 'weapon' ? WEAPON_SLOTS : CONSUMABLE_SLOTS;
  list.forEach(tpl => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    const nameBtn = document.createElement('button');
    nameBtn.type = 'button';
    nameBtn.className = 'admin-name';
    nameBtn.textContent = tpl.name || ('#' + tpl.id);
    const select = document.createElement('select');
    select.className = 'admin-slot';
    fillSlotSelect(select, options, firstEmptySlot(kind));
    const gen = document.createElement('button');
    gen.type = 'button';
    gen.className = 'admin-gen';
    gen.textContent = 'GENERATE';
    const go = () => generateFromTemplate(kind, tpl, select.value);
    nameBtn.onclick = go;
    gen.onclick = go;
    row.appendChild(nameBtn);
    row.appendChild(select);
    row.appendChild(gen);
    container.appendChild(row);
  });
}

function renderAdminTemplates() {
  const data = adminTemplates || { weapons: [], consumables: [] };
  const wBox = document.getElementById('admin-weapons');
  const cBox = document.getElementById('admin-consumables');
  if (wBox) renderTemplateRows(wBox, data.weapons, 'weapon');
  if (cBox) renderTemplateRows(cBox, data.consumables, 'consumable');
}

function inventoryForDelete() {
  const labels = ['LH', 'RH', 'BL', 'C1', 'C2'];
  const rows = [];
  loadout.forEach((item, i) => { if (item) rows.push({ item, where: labels[i] }); });
  backpack.forEach(item => { rows.push({ item, where: 'backpack' }); });
  return rows;
}

function renderAdminDeleteList() {
  const box = document.getElementById('admin-delete-list');
  const delBtn = document.getElementById('admin-delete-btn');
  if (!box) return;
  const selectedKey = pendingDelete ? ownedKey(pendingDelete.item) + '@' + pendingDelete.where : null;
  box.innerHTML = '';
  const rows = inventoryForDelete();
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = 'Inventory empty';
    box.appendChild(empty);
    pendingDelete = null;
    if (delBtn) delBtn.disabled = true;
    const confirm = document.getElementById('admin-confirm');
    if (confirm) confirm.hidden = true;
    return;
  }
  let stillSelected = false;
  rows.forEach(row => {
    const el = document.createElement('div');
    el.className = 'admin-del-row';
    const key = ownedKey(row.item) + '@' + row.where;
    if (key === selectedKey) {
      el.classList.add('selected');
      stillSelected = true;
      pendingDelete = row;
    }
    el.textContent = `${row.where}  ${row.item.name}  #${row.item.id}`;
    el.onclick = () => {
      pendingDelete = row;
      const confirm = document.getElementById('admin-confirm');
      if (confirm) confirm.hidden = true;
      renderAdminDeleteList();
    };
    box.appendChild(el);
  });
  if (!stillSelected) pendingDelete = null;
  if (delBtn) delBtn.disabled = !pendingDelete || adminBusy;
}

async function generateFromTemplate(kind, tpl, slot) {
  if (adminBusy || !tpl || !tpl.id) return;
  adminBusy = true;
  setAdminStatus('Rolling...');
  try {
    const path = kind === 'weapon' ? '/dev/give-weapon-self' : '/dev/give-consumable';
    const res = await apiCall(path, 'POST', { template_id: tpl.id });
    const placed = await syncOwned({ kind, slot: slot || firstEmptySlot(kind) });
    const name = (res && res.template_name) || tpl.name || 'item';
    setAdminStatus(`Granted ${name} → ${placed || slot || 'backpack'}`);
  } catch (e) {
    setAdminStatus(apiErrorText(e), true);
  } finally {
    adminBusy = false;
    renderAdminDeleteList();
  }
}

function askDelete() {
  if (!pendingDelete || adminBusy) return;
  const confirm = document.getElementById('admin-confirm');
  const label = document.getElementById('admin-confirm-label');
  if (!confirm || !label) return;
  label.textContent = `Delete ${pendingDelete.item.name} (${pendingDelete.where})?`;
  confirm.hidden = false;
}

async function confirmDelete() {
  if (!pendingDelete || adminBusy) return;
  const target = pendingDelete;
  adminBusy = true;
  setAdminStatus('Deleting...');
  try {
    await apiCall('/dev/del-item', 'POST', { kind: target.item.kind, instance_id: target.item.id });
    pendingDelete = null;
    const confirm = document.getElementById('admin-confirm');
    if (confirm) confirm.hidden = true;
    await syncOwned(null);
    setAdminStatus(`Deleted ${target.item.name}`);
  } catch (e) {
    setAdminStatus(apiErrorText(e), true);
  } finally {
    adminBusy = false;
    renderAdminDeleteList();
  }
}

async function openAdminPanel() {
  const overlay = document.getElementById('admin-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  setAdminStatus('Loading templates...');
  try {
    adminTemplates = await apiCall('/dev/templates');
    setAdminStatus('');
    renderAdminTemplates();
    renderAdminDeleteList();
  } catch (e) {
    setAdminStatus(apiErrorText(e), true);
  }
}

function buildAdminOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'admin-overlay';
  overlay.className = 'admin-overlay';
  overlay.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'admin-panel';
  panel.addEventListener('click', (ev) => ev.stopPropagation());

  const head = document.createElement('div');
  head.className = 'admin-head';
  const title = document.createElement('div');
  title.className = 'panel-title';
  title.textContent = 'ADMIN';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cancel-btn';
  close.style.marginLeft = '0';
  close.textContent = 'CLOSE';
  close.onclick = () => { overlay.hidden = true; };
  head.appendChild(title);
  head.appendChild(close);

  const status = document.createElement('div');
  status.id = 'admin-status';
  status.className = 'admin-status';

  const wTitle = document.createElement('div');
  wTitle.className = 'admin-section-title';
  wTitle.textContent = 'GENERATE WEAPON';
  const wBox = document.createElement('div');
  wBox.id = 'admin-weapons';

  const cTitle = document.createElement('div');
  cTitle.className = 'admin-section-title';
  cTitle.textContent = 'GENERATE CONSUMABLE';
  const cBox = document.createElement('div');
  cBox.id = 'admin-consumables';

  const dTitle = document.createElement('div');
  dTitle.className = 'admin-section-title';
  dTitle.textContent = 'DELETE INVENTORY';
  const dBox = document.createElement('div');
  dBox.id = 'admin-delete-list';
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.id = 'admin-delete-btn';
  delBtn.className = 'admin-del';
  delBtn.textContent = 'DELETE SELECTED';
  delBtn.disabled = true;
  delBtn.onclick = askDelete;

  const confirm = document.createElement('div');
  confirm.id = 'admin-confirm';
  confirm.className = 'admin-confirm';
  confirm.hidden = true;
  const label = document.createElement('span');
  label.id = 'admin-confirm-label';
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'admin-yes';
  yes.textContent = 'YES';
  yes.onclick = confirmDelete;
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'admin-no';
  no.textContent = 'NO';
  no.onclick = () => { confirm.hidden = true; };
  confirm.appendChild(label);
  confirm.appendChild(yes);
  confirm.appendChild(no);

  panel.appendChild(head);
  panel.appendChild(status);
  panel.appendChild(wTitle);
  panel.appendChild(wBox);
  panel.appendChild(cTitle);
  panel.appendChild(cBox);
  panel.appendChild(dTitle);
  panel.appendChild(dBox);
  panel.appendChild(delBtn);
  panel.appendChild(confirm);
  overlay.appendChild(panel);
  overlay.addEventListener('click', () => { overlay.hidden = true; });
  document.body.appendChild(overlay);
}

async function setupAdminPanel() {
  if (document.getElementById('admin-btn')) return;
  let dev;
  try {
    dev = await apiCall('/dev/grant', 'POST', {});
  } catch (_) {
    return;
  }
  if (!dev || dev.dev_mode !== true) return;
  const bottom = document.getElementById('bottom-bar');
  if (!bottom) return;
  const btn = document.createElement('button');
  btn.id = 'admin-btn';
  btn.className = 'admin-btn';
  btn.type = 'button';
  btn.textContent = 'ADMIN';
  const note = bottom.querySelector('.note');
  if (note) bottom.insertBefore(btn, note);
  else bottom.appendChild(btn);
  buildAdminOverlay();
  btn.onclick = () => { openAdminPanel(); };
}

async function init() {
  popupEl = document.getElementById('info-popup');
  // checkAuth creates the shared PKCE client (supabaseClient) before getSession.
  const session = await checkAuth();
  if (!session) return;

  // PC-52: fill hud-name from session (front-end only, placeholder dock)
  fillHudName(session);

  // PC-50r: active-run bounce on load (equip screen only for brand-new runs)
  if (await redirectIfActiveRun(session.access_token)) return;
  try {
    await loadData();
  } catch (e) {
    console.error('Data load failed', e);
    // fallback to empty
  }
  // Admin button is injected only after /dev/grant confirms is_admin.
  // Non-admins: no button, no panel, no /dev/templates fetch.
  try { await setupAdminPanel(); } catch (e) {
    console.error('Admin panel setup failed', e);
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
