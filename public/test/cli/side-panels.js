/**
 * Side-panel renderer and player-stats select mode.
 * Owns the six panel DOM nodes, selectMode/selectIndex, and menuAttack
 * (the queue-marker object). The input loop talks through isSelectMode /
 * enterSelectMode / exitSelectMode / nudgeSelect / showItemDetailForCurrent.
 * Blur/focus of the command input is a callback — this module does not hold
 * the input element. menuAttack is written only via setMenuAttack so the
 * reference-equality marker check stays intact.
 * Contract: initSidePanels({ apiCall, blurInput, focusInput }) plus the
 * functions exported below. Does not import cli-app.js.
 */
import { computeTimingMarkers } from '../../js/combat/tic-queue.js';
import { QUEUE_ACTION_LABELS, monsterQueueLabel } from './queue-labels.js';

// Side panel elements (retro 3-col layout)
const playerStatsContent = document.getElementById('player-stats-content');
const monsterRosterContent = document.getElementById('monster-roster-content');
const runLootContent = document.getElementById('run-loot-content');
const actionQueueContent = document.getElementById('action-queue-content');
const diceLeftContent = document.getElementById('dice-left-content');
const diceRolledContent = document.getElementById('dice-rolled-content');

let apiCall = null;
let blurInput = () => {};
let focusInput = () => {};

export function initSidePanels(deps) {
  apiCall = deps.apiCall;
  blurInput = deps.blurInput;
  focusInput = deps.focusInput;
}

let selectMode = false; // UX select mode for player stats slots
let selectIndex = 0; // 0=LH,1=RH,2=BL,3=C1,4=C2
// PC-56: DW menu selection state — active attack shows '>' markers on the queue panel
let menuAttack = null; // {attack, queue} while a menu attack pick is pending

export function setMenuAttack(value) {
  menuAttack = value;
}

export function isSelectMode() {
  return selectMode;
}

export function nudgeSelect(dir) {
  selectIndex = (selectIndex + dir + 5) % 5;
  updateSelectHighlight();
}

export function blankActionQueue() {
  if (actionQueueContent) actionQueueContent.innerHTML = '<div class="dim">—</div>';
}

export function updateSidePanelsFromRun(run) {
  if (!run) return;
  const bs = run.battle_state || {};
  const weapons = bs.weapons || {};
  const mons = bs.monsters || [];
  const d = bs.dice || {};
  const queue = bs.queue || [];

  // LEFT: Player stats (HP + hands + placeholders for BL/C1/C2)
  if (playerStatsContent) {
    let html = `<div class="stat-line" data-slot="hp">HP: ${run.player_hp ?? '—'}</div>`;
    const lh = weapons.hand_l;
    html += `<div class="stat-line selectable" data-slot="lh">LH: ${lh ? `#${lh.id} ${lh.name}` : '—'}</div>`;
    const rh = weapons.hand_r;
    html += `<div class="stat-line selectable" data-slot="rh">RH: ${rh ? `#${rh.id} ${rh.name}` : '—'}</div>`;
    const bl = weapons.belt;
    html += `<div class="stat-line selectable" data-slot="bl">BL: ${bl ? `#${bl.id} ${bl.name}` : '—'}</div>`;
    const pots = bs.potions || {};
    const potA = pots.potion_a || pots.A || null;
    const potB = pots.potion_b || pots.B || null;
    const fmtPot = (p) => p
      ? `${p.template_name || 'Potion'}${p.used ? ' (used)' : ''}`
      : '—';
    html += `<div class="stat-line selectable" data-slot="c1">C1: ${fmtPot(potA)}</div>`;
    html += `<div class="stat-line selectable" data-slot="c2">C2: ${fmtPot(potB)}</div>`;
    html += `<div id="player-detail" class="player-detail" style="display:none;"></div>`;
    playerStatsContent.innerHTML = html;
    // attach click handlers for selectable rows (TASK2)
    const detailEl = playerStatsContent.querySelector('#player-detail');
    playerStatsContent.querySelectorAll('.stat-line.selectable').forEach((el, idx) => {
      el.addEventListener('click', () => {
        if (selectMode) {
          selectIndex = idx;
          updateSelectHighlight();
        }
        showItemDetailForSlot(el.dataset.slot, detailEl, weapons);
      });
    });
  }

  // LEFT: Monster roster
  if (monsterRosterContent) {
    if (mons.length === 0) {
      monsterRosterContent.innerHTML = '<div class="dim">No monsters</div>';
    } else {
      let html = '';
      mons.forEach(m => {
        const letter = (m.label && /[A-Z]$/.test(m.label)) ? m.label.slice(-1) : '';
        const deadMark = m.dead ? ' (dead)' : '';
        html += `<div class="monster">${m.name}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Healthy'}${deadMark}</div>`;
      });
      monsterRosterContent.innerHTML = html;
    }
  }

  // LEFT: Run Loot (prize_pool from run state)
  if (runLootContent) {
    const pp = run.prize_pool;
    if (pp && (pp.lp_earned > 0 || pp.gold > 0 || (pp.weapon_ids && pp.weapon_ids.length > 0))) {
      let html = '<div>LP earned: ' + (pp.lp_earned || 0) + '</div>';
      html += '<div>Gold: ' + (pp.gold || 0) + '</div>';
      html += '<div>Weapons: ' + (pp.weapon_ids?.length || 0) + '</div>';
      runLootContent.innerHTML = html;
    } else {
      runLootContent.innerHTML = '<div class="dim">— (no loot data)</div>';
    }
  }

  // RIGHT: Action/tic queue
  if (actionQueueContent) {
    const inFight = bs.tic > 0 || (bs.feed && bs.feed.length > 0);
    if (!inFight || queue.length === 0) {
      // Blank until the first fight starts (Spahrep 2026-09-13)
      actionQueueContent.innerHTML = '<div class="dim">—</div>';
    } else {
      let html = '';
      queue.slice(0, 8).forEach(q => {
        const tics = q.tics ?? 0;
        const monLabel = monsterQueueLabel(q, bs.monsters);
        let label, ev;
        if (monLabel) {
          label = monLabel;
          ev = '';
        } else {
          label = q.label || '?';
          ev = QUEUE_ACTION_LABELS[q.event] || (q.event ? q.event[0].toUpperCase() + q.event.slice(1) : '?');
        }
        // PC-56: prediction bar — show | at the start and end of the bar range (no pin mode per design ref)
        let marker = '';
        if (menuAttack && menuAttack.queue === queue) {
          const info = computeTimingMarkers(menuAttack.queue, menuAttack.attack, menuAttack.weaponSpeed);
          if (info && info.kind === 'bar') {
            if (info.firstId === q.id) marker = ' |<';
            else if (info.lastId === q.id) marker = ' |>';
            else marker = ' |';
          }
        }
        html += `<div>${tics} - ${label}${ev ? ': ' + ev : ''}${marker}</div>`;
      });
      actionQueueContent.innerHTML = html;
    }
  }

  // RIGHT: Dice Left (from battle_state.dice.remaining)
  if (diceLeftContent) {
    const fmt = (o) => `G${o?.green ?? 0} Y${o?.yellow ?? 0} R${o?.red ?? 0}`;
    const rem = d.remaining ? fmt(d.remaining) : 'G0 Y0 R0';
    diceLeftContent.innerHTML = `<div class="stat-line">${rem}</div>`;
    if (d.used) {
      diceLeftContent.innerHTML += `<div class="dim">used: ${fmt(d.used)}</div>`;
    }
  }

  // RIGHT: Dice rolled results (current + any feed info)
  if (diceRolledContent) {
    let html = '';
    if (d.current) {
      html += `<div>current: ${d.current.color} face=${d.current.face} val=${d.current.rolled_value}</div>`;
    } else {
      html += `<div class="dim">no die drawn yet</div>`;
    }
    if (bs.feed && bs.feed.length) {
      html += `<div class="amber">feed: ${bs.feed.slice(-2).join(' | ')}</div>`;
    }
    diceRolledContent.innerHTML = html || '<div class="dim">—</div>';
  }
}

// TASK2 UX select mode helpers (small functions, plain JS, yellow border aesthetic)
export function enterSelectMode() {
  selectMode = true;
  selectIndex = 0;
  blurInput();
  updateSelectHighlight();
}

export function exitSelectMode() {
  selectMode = false;
  if (playerStatsContent) {
    playerStatsContent.querySelectorAll('.stat-line.selectable').forEach(el => el.classList.remove('highlight'));
    const d = playerStatsContent.querySelector('#player-detail');
    if (d) d.style.display = 'none';
  }
  focusInput();
}

function updateSelectHighlight() {
  if (!playerStatsContent || !selectMode) return;
  const rows = playerStatsContent.querySelectorAll('.stat-line.selectable');
  rows.forEach((el, i) => {
    if (i === selectIndex) el.classList.add('highlight');
    else el.classList.remove('highlight');
  });
}

export async function showItemDetailForCurrent() {
  if (!playerStatsContent) return;
  const rows = playerStatsContent.querySelectorAll('.stat-line.selectable');
  const row = rows[selectIndex];
  if (!row) return;
  const detailEl = playerStatsContent.querySelector('#player-detail');
  if (detailEl) {
    await showItemDetailForSlot(row.dataset.slot, detailEl, null);
  }
}

async function showItemDetailForSlot(slot, detailEl, preloadedWeapons) {
  if (!detailEl) return;
  detailEl.style.display = 'block';
  if (slot === 'hp' || !['lh','rh','bl','c1','c2'].includes(slot)) {
    detailEl.innerHTML = 'No item';
    return;
  }
  if (slot === 'c1' || slot === 'c2') {
    detailEl.innerHTML = 'No item';
    return;
  }
  // parse id from the row text e.g. "LH: #12 Sword"
  const rowText = document.querySelector(`.stat-line.selectable[data-slot="${slot}"]`)?.textContent || '';
  const m = rowText.match(/#(\d+)/);
  if (!m) {
    detailEl.innerHTML = 'No item';
    return;
  }
  const id = parseInt(m[1], 10);
  try {
    let wData = preloadedWeapons ? {weapons: Object.values(preloadedWeapons || {})} : null; // rough, but use fetch
    if (!wData || !wData.weapons) {
      wData = await apiCall('GET', '/weapons');
    }
    const weapons = wData.weapons || [];
    const w = weapons.find(ww => ww.id === id);
    if (!w) {
      detailEl.innerHTML = `#${id} not found`;
      return;
    }
    let html = `<div><strong>${w.name}</strong></div>`;
    const delta = w.damage_delta != null ? ` (+${w.damage_delta})` : '';
    html += `<div>Damage: ${w.damage}${delta}</div>`;
    if (w.attacks && w.attacks.length) {
      w.attacks.forEach(a => {
        const pVar = a.prepare_time_range || 0;
        const cVar = a.cooldown_time_range || 0;
        const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
        const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
        html += `<div>#${a.id} ${a.name} (${pPart}/${cPart})</div>`;
      });
    }
    detailEl.innerHTML = html;
  } catch (e) {
    detailEl.innerHTML = 'Error loading detail';
  }
}
