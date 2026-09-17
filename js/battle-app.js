/**
 * Portal Colosseum - Battle Screen Live Combat Wiring (PC-47 pass 2)
 * Wires ATTACK (via /commit), ITEM (/use-potion), battle advance (/battle/end).
 * Matches CLI payloads exactly: {hand, attack_id, target_ids:[]}, {slot}.
 * hp_word ONLY for all HP display; busy-state gating on all actions.
 * Re-renders from action responses + GET restore.
 * No console errors; errors in message box.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';
import { computeTimingMarkers } from './combat/tic-queue.js';

const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabase;
let currentRunId = null;
let lastBs = null; // last loaded battle_state (safeState) — source for attack/potion lookups
let busy = false;
let pendingAttack = null; // {hand, attackId} for commit via re-click or Enter
let queueMarkers = null;   // Map<rowId, '>'> — PC-56 timing markers for the selected attack
let shouldAnimateDice = false;
// PC-51: monsters stay hidden while the dice roll ceremony plays, then
// fade in one at a time. Set in the battle render when a roll will run;
// revealMonsters() clears it when the roll completes.
let monstersPendingReveal = false;
const MONSTER_FADE_STAGGER = 450; // ms between monster reveals
const MONSTER_FADE_MS = 650;      // per-monster fade duration

// Tuning constants for dice-selection roulette (client theater only).
// Sweep: uniform left→right walk, stops on random same-color box (incl phantom).
// Landed box IS selection (no morph). Roll: real faces from payload, weighty decel.
const DICE_ANIM = {
  COUNTDOWN_WHIR: 12,   // Spahrep's countdown: steps = 12*(n-1) + r, r in 1..n solved so the countdown ends on a drawn-color box
  SWEEP_FAST: 35,       // ms per die at full whir (sweep start)
  SWEEP_TAIL: 16,       // final sweep steps that decelerate into the landing
  SWEEP_SLOW: 240,      // ms on the very last step (weighty arrival, no instant stop)
  LAND_PAUSE: 350,      // beat on the landed box before the roll starts
  ROLL_TICKS: 16,       // tumbles before settle (longer, weightier roll)
  ROLL_INITIAL: 80,     // ms start for the roll (quick transitions)
  ROLL_DECEL: 1.16,     // per-tick decel factor
  ROLL_MIN: 400         // final dwell cap (~4.4s total roll)
};

// PC-52r/PC-63: monster condition words color by severity everywhere they render.
const BAND_CLASS = {
  healthy: 'st-green', injured: 'st-amber', battered: 'st-orange', critical: 'st-red'
};
function bandClass(m) {
  const word = String(m.hp_word || m.hpWord || 'Healthy').toLowerCase();
  return BAND_CLASS[word] || 'st-green';
}

function getAuthToken() {
  return supabase?.auth?.getSession?.().then(({ data }) => data?.session?.access_token);
}

async function apiCall(path, method = 'GET', body = null) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/combat${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
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

function showMessage(text, isError = false) {
  const box = document.getElementById('message-box');
  if (!box) return;
  const line = document.createElement('div');
  line.className = isError ? 'msg-error' : 'msg-line';
  line.textContent = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function showErrorState(title, detail, showReturn = true) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  const err = document.createElement('div');
  err.className = 'msg-error';
  err.innerHTML = `<strong>${title}</strong><br>${detail || ''}`;
  if (showReturn) {
    const link = document.createElement('a');
    link.href = '/game.html';
    link.textContent = 'Return to Town';
    link.style.cssText = 'display:block;margin-top:8px;color:#66ccff;';
    err.appendChild(link);
  }
  box.appendChild(err);
}

function setBusy(state) {
  busy = state;
  // Dynamic hand buttons + ITEM all live inside #action-menu; gate the whole row.
  document.querySelectorAll('#action-menu button').forEach(btn => {
    btn.disabled = state;
    btn.style.opacity = state ? '0.5' : '1';
  });
}

function renderDice(dice) {
  const tray = document.getElementById('dice-tray');
  const labels = document.getElementById('dice-labels');
  if (!tray || !labels || !dice) return;
  tray.innerHTML = '';
  const rem = dice.remaining || { green: 0, yellow: 0, red: 0 };
  const used = dice.used || { green: 0, yellow: 0, red: 0 };
  const current = dice.current;

  const remRow = document.createElement('div');
  remRow.style.cssText = 'display:flex;gap:3px;margin-bottom:4px;';
  for (let i = 0; i < (rem.green || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die green';
    d.textContent = 'G';
    remRow.appendChild(d);
  }
  for (let i = 0; i < (rem.yellow || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die yellow';
    d.textContent = 'Y';
    remRow.appendChild(d);
  }
  for (let i = 0; i < (rem.red || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die red';
    d.textContent = 'R';
    remRow.appendChild(d);
  }
  tray.appendChild(remRow);

  labels.innerHTML = `
    <div>REMAINING (${(rem.green||0)+(rem.yellow||0)+(rem.red||0)})</div>
    <div>USED (${(used.green||0)+(used.yellow||0)+(used.red||0)})</div>
  `;

  const curEl = document.getElementById('current-die');
  if (curEl) {
    if (current && current.color && current.face != null) {
      if (shouldAnimateDice) {
        shouldAnimateDice = false;
        curEl.style.display = 'none';
        // Stage 1 (selection): sweep row = remaining pool + the drawn die as an
        // extra box, so the roulette can land ON it. It shows the color letter
        // like every other box — never the face, or the result is spoiled early.
        const drawnEl = document.createElement('div');
        drawnEl.className = `die ${current.color}`;
        drawnEl.textContent = current.color.substring(0, 1).toUpperCase();
        // Phantom inserted at END of its color block (G→Y→R natural order preserved).
        // This keeps same-color boxes contiguous; out-of-order would be a tell.
        // Sweep will pick uniformly among same-color boxes (incl. phantom) and
        // walk to it; landing box IS the drawn die (no morph ever).
        let insertAt;
        if (current.color === 'green') insertAt = rem.green || 0;
        else if (current.color === 'yellow') insertAt = (rem.green || 0) + (rem.yellow || 0);
        else insertAt = (rem.green || 0) + (rem.yellow || 0) + (rem.red || 0);
        remRow.insertBefore(drawnEl, remRow.children[insertAt] || null);
        // Labels match visible pool during sweep: REMAINING counts the
        // phantom (+1, die still "in play"); USED must NOT count it yet
        // (server already moved it to used) — so show usedTotal - 1.
        // The cleanup render below restores true post-draw counts.
        const remTotal = (rem.green || 0) + (rem.yellow || 0) + (rem.red || 0);
        const usedTotal = (used.green || 0) + (used.yellow || 0) + (used.red || 0);
        labels.innerHTML = `
          <div>REMAINING (${remTotal + 1})</div>
          <div>USED (${usedTotal - 1})</div>
        `;
        const diceEls = Array.from(remRow.children); // >= 1 (drawn die appended)
        // Stage 2 (roll) plays out IN the box the sweep landed on — the
        // current-die slot stays hidden until the reveal, so the chosen
        // die is never shown sitting at the row's right edge mid-roll.
        // After it lands, re-render the tray so the phantom drawn-die box
        // and its highlight are cleared — final state = true post-draw.
        const selectAndRoll = (landedBox) => {
          rollDiceAnimation(landedBox, current, dice.faces, () => {
            updateCurrentDie(curEl, current); // persistent slot lights up
            revealMonsters(); // roll done → monsters fade in one at a time
            setTimeout(() => renderDice(dice), 350);
          });
        };
        if (diceEls.length === 1) {
          // Only the drawn die in the tray: brief highlight, then roll.
          diceEls[0].classList.add('highlight');
          setTimeout(() => selectAndRoll(diceEls[0]), DICE_ANIM.LAND_PAUSE);
        } else {
          // Spahrep's spec: the landed box IS the drawn die — no morph,
          // ever. Land on a random box OF THE DRAWN COLOR (existing
          // same-color boxes + the phantom), then walk from 0 to it.
          const candidates = [];
          diceEls.forEach((el, i) => {
            if (el.classList.contains(current.color)) candidates.push(i);
          });
          // Phantom guarantees >= 1 same-color box; fall back defensively.
          const targetIndex = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : Math.floor(Math.random() * diceEls.length);
          performSweepAnimation(diceEls, targetIndex, selectAndRoll);
        }
      } else {
        updateCurrentDie(curEl, current);
      }
    } else {
      curEl.style.display = 'none';
    }
  }
}

function updateCurrentDie(curEl, current) {
  curEl.innerHTML = `
    <div class="die ${current.color}" style="width:32px;height:32px;font-size:14px;">${current.face}</div>
    <div style="font-size:9px;color:#88aaff;margin-top:2px;">${current.rolled_value != null ? current.rolled_value : ''}</div>
  `;
  curEl.style.display = 'flex';
}

function performSweepAnimation(diceEls, targetIndex, onLand) {
  const total = diceEls.length;
  // Spahrep's countdown: start at the first die, hop to the next, reduce
  // the count, stop on zero. Count = 12*(n-1) + r (r in 1..n) — the whir
  // term is pure theater (12-ish laps of the loop at high speed, same
  // every run, no info about the draw), and r is SOLVED BACKWARDS so the
  // countdown lands exactly on the target box. The caller picked the
  // target uniformly from the drawn color's boxes, so the landing IS the
  // selection — no morph, ever.
  const whir = DICE_ANIM.COUNTDOWN_WHIR * (total - 1);
  const r = ((targetIndex + DICE_ANIM.COUNTDOWN_WHIR) % total) || total; // (r + whir) % total === targetIndex, r in 1..n
  let count = whir + r; // steps remaining
  let idx = 0;

  function step() {
    diceEls.forEach(el => el.classList.remove('highlight'));
    diceEls[idx % total].classList.add('highlight');
    if (count === 0) {
      // countdown hit zero: this box IS the drawn die
      setTimeout(() => onLand(diceEls[idx % total]), DICE_ANIM.LAND_PAUSE);
      return;
    }
    idx++;
    count--;
    setTimeout(step, stepDelay(count));
  }

  function stepDelay(count) {
    // Pacing only — the countdown math above is untouched. Full-speed whir
    // for most of the spin, then the final SWEEP_TAIL steps interpolate
    // down to SWEEP_SLOW, so the highlight decelerates into the landing
    // instead of stopping dead.
    if (count > DICE_ANIM.SWEEP_TAIL) return DICE_ANIM.SWEEP_FAST;
    const t = (count - 1) / Math.max(1, DICE_ANIM.SWEEP_TAIL - 1);
    return DICE_ANIM.SWEEP_SLOW - (DICE_ANIM.SWEEP_SLOW - DICE_ANIM.SWEEP_FAST) * t;
  }

  step();
}

// Roll tumbles real faces[color] from payload (defensive [face] if missing).
// No invented values. Settles with pop; #current-die lights only after.
function rollDiceAnimation(box, current, faces, onDone) {
  // The box keeps its color and highlight — it is already the draw's die.
  const pool = (faces && faces[current.color] && faces[current.color].length > 0)
    ? faces[current.color]
    : [current.face]; // defensive: unknown pool → die just settles

  let tick = 0;
  let interval = DICE_ANIM.ROLL_INITIAL;
  function step() {
    if (tick >= DICE_ANIM.ROLL_TICKS) {
      box.textContent = current.face;
      box.classList.remove('rolled');
      void box.offsetWidth; // force reflow so the pop animation restarts
      box.classList.add('rolled');
      onDone();
      return;
    }
    box.textContent = pool[Math.floor(Math.random() * pool.length)];
    tick++;
    interval = Math.min(DICE_ANIM.ROLL_MIN, Math.floor(interval * DICE_ANIM.ROLL_DECEL));
    setTimeout(step, interval);
  }
  step();
}

function renderMonsters(monsters) {
  const container = document.getElementById('monsters');
  if (!container) return;
  container.innerHTML = '';
  if (!monsters || monsters.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#556677;font-size:11px;padding:12px;';
    empty.textContent = 'No monsters present.';
    if (monstersPendingReveal) hideForReveal(empty);
    container.appendChild(empty);
    return;
  }
  monsters.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'monster-card';
    card.style.cssText = 'background:rgba(0,0,0,0.4);border:2px solid #4a90d9;padding:8px 10px;margin-bottom:6px;';
    const sprite = document.createElement('div');
    sprite.style.cssText = 'width:64px;height:48px;background:#112233;border:1px solid #335577;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#66ccff;';
    sprite.textContent = m.name ? m.name.substring(0,3).toUpperCase() : 'MON';
    const name = document.createElement('div');
    name.style.cssText = 'color:#ffcc66;font-size:11px;text-align:center;';
    name.textContent = m.name || 'Monster';
    const hp = document.createElement('div');
    hp.style.cssText = 'margin-top:4px;text-align:center;';
    const hpWord = m.hp_word || m.hpWord || 'Healthy';
    hp.innerHTML = `<span class="${bandClass(m)}" style="font-size:10px;">HP: ${hpWord}</span>`;
    card.appendChild(sprite);
    card.appendChild(name);
    card.appendChild(hp);
    if (monstersPendingReveal) hideForReveal(card);
    container.appendChild(card);
  });
}
// While the roll plays, monster cards render invisible (laid out, opacity 0)
// and materialize one at a time once the roll completes.
function hideForReveal(el) {
  el.style.transition = `opacity ${MONSTER_FADE_MS}ms ease`;
  el.style.opacity = '0';
}

function revealMonsters() {
  if (!monstersPendingReveal) return;
  monstersPendingReveal = false;
  const container = document.getElementById('monsters');
  if (!container) return;
  Array.from(container.children).forEach((card, i) => {
    setTimeout(() => { card.style.opacity = '1'; }, i * MONSTER_FADE_STAGGER);
  });
}

function renderFeed(feed) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  if (!feed || feed.length === 0) {
    const line = document.createElement('div');
    line.className = 'msg-line';
    line.textContent = 'Battle begins...';
    box.appendChild(line);
    return;
  }
  feed.forEach(lineText => {
    const line = document.createElement('div');
    line.className = 'msg-line';
    line.textContent = lineText;
    box.appendChild(line);
  });
  box.scrollTop = box.scrollHeight;
}

function renderPlayerHP(runOrState) {
  const el = document.getElementById('player-hp');
  if (!el) return;
  // API exposes player_hp (numeric) only — no player hp_word. Design shows numbers.
  const hpVal = (runOrState && typeof runOrState.player_hp === 'number') ? runOrState.player_hp : null;
  const hpColor = hpVal === null ? '#66ff99' : (hpVal > 300 ? '#66ff99' : (hpVal > 100 ? '#ffcc66' : '#ff6666'));
  el.innerHTML = `HP: <span style="color:${hpColor};">${hpVal === null ? '—' : hpVal}</span>`;
}

function renderLoadout(bs) {
  const wl = bs.weapons || {};
  const lh = document.getElementById('loadout-lh');
  const rh = document.getElementById('loadout-rh');
  if (lh) lh.textContent = (wl.hand_l && wl.hand_l.name) || '—';
  if (rh) rh.textContent = (wl.hand_r && wl.hand_r.name) || '—';
}

/**
 * TIME MENU (next-up events column), per the design mockups: one row per
 * queued event, `Label EventName | tics-until-change`, next event on top.
 * Rows are countdowns to a state change: an attack landing, a hand freeing
 * ("Ready"), a monster striking, a potion taking effect.
 */
function renderQueue(bs) {
  const el = document.getElementById('queue');
  if (!el) return;
  el.innerHTML = '';
  const queue = bs.queue || [];
  if (queue.length === 0) return;
  const monsters = bs.monsters || [];
  const sorted = [...queue].sort((a, b) => (a.tics ?? 0) - (b.tics ?? 0));
  for (const row of sorted) {
    const div = document.createElement('div');
    div.className = 'queue-row';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = `${queueLabel(row)} ${queueEventName(row, monsters, bs)}`;
    const ticSpan = document.createElement('span');
    ticSpan.className = 'tic';
    ticSpan.textContent = String(row.tics != null ? row.tics : 0);
    div.appendChild(nameSpan);
    div.appendChild(ticSpan);
    // PC-56: '>' timing markers on the right rail, mirroring the DW mockup —
    // one marker per affected row, keyed by row id, cleared on selection change.
    if (queueMarkers && queueMarkers.has(row.id)) {
      const markerSpan = document.createElement('span');
      markerSpan.className = 'queue-marker';
      markerSpan.textContent = queueMarkers.get(row.id);
      div.appendChild(markerSpan);
    }
    el.appendChild(div);
  }
}

function queueLabel(row) {
  if (row.label === 'LH' || row.label === 'RH') return row.label;
  // Monsters show as single-letter arena markers (A/B/C), like the mockups.
  return String(row.label || '?').replace(/^Monster\s*/i, '');
}

function queueEventName(row, monsters, bs) {
  // A hand freeing is a state change — the queue counts down to "Ready".
  if (row.event === 'cooldown' || row.event === 'recovery') return 'Ready';
  if (row.event === 'drinking') {
    const p = (bs.potions || {})[row.potionSlot];
    return (p && p.template_name) ? p.template_name : 'Potion';
  }
  if (row.attackName) return row.attackName;
  // Monster attack rows carry no name — use the monster's primary attack.
  const mon = monsters.find(m => m.label === row.label);
  if (mon && Array.isArray(mon.attacks) && mon.attacks.length && mon.attacks[0].name) {
    return mon.attacks[0].name;
  }
  return 'Attack';
}

function showAdvanceUI(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  // No more actions to pick — clear the action row.
  const actionWrap = document.getElementById('action-choices');
  if (actionWrap) actionWrap.innerHTML = '';
  const adv = document.createElement('div');
  adv.className = 'msg-line';
  const monstersDead = state.monsters_dead ?? (Array.isArray(state.monsters) && state.monsters.length > 0 && state.monsters.every(m => m.dead));
  adv.innerHTML = `<strong>Battle complete.</strong> ${monstersDead ? 'Monsters defeated.' : ''}`;
  const contBtn = document.createElement('button');
  contBtn.textContent = 'Continue to next battle';
  contBtn.className = 'action-btn';
  contBtn.style.marginTop = '8px';
  contBtn.onclick = async () => {
    setBusy(true);
    try {
      const res = await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'continue' });
      showMessage('Advancing to next battle...');
      shouldAnimateDice = true; // post-continue battle-start transition
      await loadBattle(runId);
    } catch (e) {
      showMessage(e.message, true);
    }
    setBusy(false);
  };
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop run';
  stopBtn.className = 'action-btn';
  stopBtn.style.marginTop = '8px';
  stopBtn.onclick = async () => {
    setBusy(true);
    try {
      await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' });
      showErrorState('Run stopped', 'You abandoned the run.', true);
    } catch (e) {
      showMessage(e.message, true);
    }
    setBusy(false);
  };
  adv.appendChild(contBtn);
  adv.appendChild(stopBtn);
  box.appendChild(adv);
}

async function doAttack(runId, hand, attackId, targetIds) {
  if (busy) return;
  setBusy(true);
  try {
    // Real mapped attack for the clicked hand (server validates the mapping).
    // CLI parity: ALWAYS target_ids: [] — engine auto-targets.
    const payload = { hand, attack_id: attackId, target_ids: targetIds || [] };
    const data = await apiCall(`/runs/${runId}/commit`, 'POST', payload);
    const w = (lastBs && lastBs.weapons && lastBs.weapons[hand === 'LH' ? 'hand_l' : 'hand_r']) || {};
    const attack = (w.attacks || []).find(a => a.id === attackId) || {};
    showMessage(`Attack committed (${hand} ${attack.name || '#' + attackId})`);
    pendingAttack = null;
    // Commit response is a minimal engine snapshot — re-render from the well-shaped GET.
    if (data.state && data.state.battle_over) {
      showAdvanceUI(runId, data.state);
    } else {
      await loadBattle(runId);
    }
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('Hand not ready')) {
      showMessage('Hand not ready — waiting engine advance');
    } else {
      showMessage(msg, true);
    }
  }
  setBusy(false);
}

async function doSwap(runId, hand) {
  if (busy) return;
  setBusy(true);
  try {
    const data = await apiCall(`/runs/${runId}/swap`, 'POST', { hand });
    showMessage(`Belt swap (${hand}) — cooldown ${data.delay != null ? data.delay : ''} tics`);
    pendingAttack = null;
    if (data.state && data.state.battle_over) {
      showAdvanceUI(runId, data.state);
    } else {
      await loadBattle(runId);
    }
  } catch (e) {
    showMessage(String(e.message || e), true);
  }
  setBusy(false);
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * PC-63 DW cascading command menu — three-window modal cascade per the locked
 * spec (docs/battle-status-ui.md Cascading Window Spec; shared/CommandSelection.png):
 *   1. COMMAND window (blue hand tab; attack rows + potions + Equip row)
 *   2. TARGET window (lettered monsters w/ HP word, or L.HAND/R.HAND, or ALL MONSTERS)
 *   3. CONFIRM window ("Confirm <attack>: <letter> <name>" + Yes/No)
 * Esc backs one window at every level; the root window never closes (PC-DEC-022).
 * Menu rows derive from the real per-weapon attacks via the weapon template
 * mapping — never a hardcoded list. Payloads/CLI parity unchanged
 * ({hand, attack_id, target_ids}). Both-hands order is the engine's call
 * (PC-DEC-028/030, initiative on PC-64): the UI opens the first ready hand,
 * LH → RH — no hand-switch chip, no override. Keyboard: Up/Down move the
 * green hand cursor, Enter selects, Esc backs out. Mouse: hover moves the
 * cursor, click selects (active/top window only — one modal stack).
 */
function renderActionMenu(bs) {
  const wrap = document.getElementById('action-choices');
  if (!wrap) return;
  wrap.innerHTML = '';
  pendingAttack = null;
  wrap.style.display = 'block';

  const hands = (bs.player && bs.player.hands) || {};
  const weapons = bs.weapons || {};
  const queue = bs.queue || [];
  const monsters = (bs.monsters || []).filter(m => !m.dead);
  const potions = bs.potions || {};
  const belt = weapons.belt || null;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // PC-52r: an empty hand is a Ready hand — it always has legal actions
  // (potion, Fist unarmed attack), so the queue never waits on an impossible action.
  const readyHands = ['LH', 'RH'].filter(h => {
    const w = weapons[h === 'LH' ? 'hand_l' : 'hand_r'];
    return hands[h] && hands[h].state === 'Ready' && (!w || w.id);
  }).sort((a, b) => {
    // PC-DEC-028: both ready → faster base attack (lower weapon speed) opens first; tie → LH.
    // Missing speed (empty hand / anomalous data) sorts last — never a surprise first-mover.
    const sa = weapons[a === 'LH' ? 'hand_l' : 'hand_r']?.speed ?? Number.MAX_SAFE_INTEGER;
    const sb = weapons[b === 'LH' ? 'hand_l' : 'hand_r']?.speed ?? Number.MAX_SAFE_INTEGER;
    return sa !== sb ? sa - sb : (a === 'LH' ? -1 : 1);
  });
  if (!readyHands.length) {
    // no ready hand — show winding status
    const status = document.createElement('div');
    status.className = 'action-status';
    status.textContent = ['LH', 'RH'].map(h => {
      const w = weapons[h === 'LH' ? 'hand_l' : 'hand_r'];
      if (!w || !w.id) return null;
      const windingRow = queue.find(q => q.event === 'winding' && q.label === h);
      return `${h} — winding${windingRow && windingRow.tics != null ? ' ' + windingRow.tics + ' tics' : ''}`;
    }).filter(Boolean).join('  ·  ') || 'No hand ready';
    wrap.appendChild(status);
    return;
  }

  const hand = readyHands[0];
  const w = weapons[hand === 'LH' ? 'hand_l' : 'hand_r'];
  const handLineText = hand === 'LH' ? 'L.HAND' : 'R.HAND';
  // PC-52r: display stats for the empty-hand Fist (fixed; matches the backend Fist profile)
  const FIST_WEAPON = { base_damage: 5, damage_range: 0 };

  function potionFor(slot) {
    return potions[slot === 'A' ? 'potion_a' : 'potion_b'] || potions[slot] || null;
  }

  function showInfo(text) {
    const fi = document.getElementById('footer-info');
    if (fi) fi.innerHTML = text || 'Select a command to see details';
  }

  function attackInfo(a, weapon) {
    const src = weapon || w || {};
    const base = src.base_damage != null ? src.base_damage : (src.damage || 0);
    const range = src.damage_range != null ? src.damage_range : 0;
    const multi = a.is_multi_target ? ' <span style="color:#ffaa66">[MULTI]</span>' : '';
    const desc = a.description ? ` — ${escHtml(a.description)}` : '';
    const pVar = a.prepare_time_range || 0;
    const cVar = a.cooldown_time_range || 0;
    const pText = pVar > 0 ? `${a.prepare_time}-${a.prepare_time + pVar}` : `${a.prepare_time}`;
    const cText = cVar > 0 ? `${a.cooldown_time}-${a.cooldown_time + cVar}` : `${a.cooldown_time}`;
    return `<strong>${escHtml(a.name)}</strong> DMG ${base}±${range} | Windup: ${pText}t | CD: ${cText}t${multi}${desc}`;
  }

  function setMarkers(attack) {
    queueMarkers = new Map(computeTimingMarkers(queue, attack, (w && w.speed) || 0).map(m => [m.id, m.marker]));
    renderQueue(lastBs);
  }
  function clearMarkers() {
    queueMarkers = null;
    renderQueue(lastBs);
  }

  // ---- cascade stack: levels { kind: action|target|confirm, rows, activeIdx } ----
  const stack = [];

  function yesNoRows(onYes) {
    return [
      { html: 'Yes', action: onYes },
      { html: 'No', action: () => back() }
    ];
  }

  function back() {
    if (stack.length > 1) {
      stack.pop();
      renderStack();
    } else {
      // root window cannot close (PC-DEC-022) — clear the readout only
      clearMarkers();
      showInfo('');
    }
  }

  function pickTarget(a) {
    if (!monsters.length) {
      // nothing to target — commit with auto-target (CLI parity)
      doAttack(currentRunId, hand, a.id, []);
      return;
    }
    const weapon = (w && w.id) ? w : FIST_WEAPON;
    if (a.is_multi_target) {
      // multi-target hits ALL live monsters — a single row, no pick (CLI parity: ids)
      stack.push({ kind: 'target', attack: a, weapon, rows: [{ html: 'ALL MONSTERS' }] });
    } else {
      stack.push({
        kind: 'target',
        attack: a,
        weapon,
        rows: monsters.map((m, i) => ({
          html: `<span class="dw-letter">${LETTERS[i]}</span>: ${escHtml(m.name)} - <span class="${bandClass(m)}">${escHtml(m.hp_word || m.hpWord || 'Healthy')}</span>`,
          monster: m,
          letter: LETTERS[i]
        }))
      });
    }
    renderStack();
  }

  function pickPotion(slot, p) {
    stack.push({
      kind: 'target',
      potion: p,
      slot,
      info: `${slot}: ${escHtml(p.template_name)} · ${escHtml(p.effect_label || '')}`,
      rows: [{ label: 'L.HAND', html: 'L.HAND' }, { label: 'R.HAND', html: 'R.HAND' }]
    });
    renderStack();
  }

  function pickEquip() {
    stack.push({
      kind: 'confirm',
      text: `Swap ${handLineText} with <span class="dw-weapon">${escHtml(belt.name)}</span>?`,
      rows: yesNoRows(() => doSwap(currentRunId, hand))
    });
    renderStack();
  }

  function selectTop() {
    const lvl = stack[stack.length - 1];
    const row = lvl.rows[lvl.activeIdx];
    if (!row || row.disabled) return;
    if (lvl.kind === 'action') {
      if (row.enter) row.enter();
      return;
    }
    if (lvl.kind === 'target') {
      if (lvl.potion) {
        stack.push({
          kind: 'confirm',
          text: `Use <strong>${escHtml(lvl.potion.template_name)}</strong> (${escHtml(lvl.potion.effect_label || '')}) on ${row.label}?`,
          rows: yesNoRows(() => usePotion(currentRunId, lvl.slot))
        });
      } else {
        const live = monsters.filter(m => (m.current_hp ?? 1) > 0).map(m => m.id);
        const ids = row.monster ? [row.monster.id] : live;
        const label = row.monster ? `${row.letter} ${row.monster.name}` : 'ALL MONSTERS';
        stack.push({
          kind: 'confirm',
          text: `Confirm ${escHtml(lvl.attack.name)}: ${escHtml(label)}`,
          rows: yesNoRows(() => doAttack(currentRunId, hand, lvl.attack.id, ids))
        });
      }
      renderStack();
      return;
    }
    if (lvl.kind === 'confirm') {
      if (row.action) row.action();
    }
  }

  function renderStack() {
    wrap.querySelectorAll('.dw-root').forEach(el => el.remove());
    const root = document.createElement('div');
    root.className = 'dw-root';
    wrap.appendChild(root);
    const topIdx = stack.length - 1;
    stack.forEach((lvl, i) => {
      if (lvl.activeIdx == null) lvl.activeIdx = 0; // every window opens with row 0 selected
      const win = document.createElement('div');
      win.className = 'dw-window' + (i === topIdx ? ' top' : '');
      win.style.left = (i * 140) + 'px';
      win.style.top = (i * 62) + 'px';
      win.style.zIndex = String(10 + i);
      if (i === 0 && lvl.tab) {
        const tab = document.createElement('div');
        tab.className = 'dw-tab';
        tab.textContent = lvl.tab;
        win.appendChild(tab);
      }
      if (lvl.text) {
        const t = document.createElement('div');
        t.className = 'dw-text';
        t.innerHTML = lvl.text;
        win.appendChild(t);
      }
      lvl.rows.forEach((row, ri) => {
        if (row.blank) {
          const g = document.createElement('div');
          g.className = 'dw-gap';
          win.appendChild(g);
          return;
        }
        const el = document.createElement('div');
        el.className = 'dw-row'
          + (row.disabled ? ' disabled' : '')
          + (ri === lvl.activeIdx ? ' active' : '');
        el.innerHTML = row.html;
        if (i === topIdx && !row.disabled) {
          el.onclick = () => { lvl.activeIdx = ri; renderStack(); selectTop(); };
          el.onmouseenter = () => { if (lvl.activeIdx !== ri) { lvl.activeIdx = ri; renderStack(); } };
        }
        win.appendChild(el);
      });
      root.appendChild(win);
    });
    paintReadout();
  }

  // Footer info + '>' timing markers track the TOP window's selection.
  function paintReadout() {
    const top = stack[stack.length - 1];
    if (!top) { showInfo(''); clearMarkers(); return; }
    if (top.kind === 'action') {
      const row = top.rows[top.activeIdx];
      showInfo(row.info || '');
      if (row.attack) setMarkers(row.attack); else clearMarkers();
      return;
    }
    if (top.kind === 'target') {
      if (top.attack) { showInfo(attackInfo(top.attack, top.weapon)); return; } // markers persist from the action pick
      if (top.info) { showInfo(top.info); return; }
    }
    // confirm level: readout stays as the pending action until it executes
  }

  // ---- root command window rows (real per-weapon attacks via template mapping) ----
  const rootRows = [];
  if (w && w.id) {
    (w.attacks || []).forEach(a => {
      rootRows.push({
        html: escHtml(a.name),
        info: attackInfo(a),
        attack: a,
        enter() { pickTarget(a); }
      });
    });
  } else {
    // PC-52r: empty hand → Fist unarmed attack (fixed stats, no grade/variance; not a weapon).
    // attack_id 1 matches the CLI path; the backend applies the Fist profile when the hand is empty.
    const fist = {
      id: 1,
      name: 'Fist (unarmed)',
      prepare_time: 6, cooldown_time: 6,
      prepare_time_range: 0, cooldown_time_range: 0,
      is_multi_target: false,
      description: ''
    };
    const fistWeapon = { base_damage: 5, damage_range: 0 };
    rootRows.push({
      html: 'Fist (unarmed)',
      info: attackInfo(fist, fistWeapon),
      attack: fist,
      enter() { pickTarget(fist); }
    });
  }
  rootRows.push({ blank: true });
  ['A', 'B'].forEach(slot => {
    const p = potionFor(slot);
    const used = p && p.used;
    if (!p) {
      rootRows.push({ html: `${slot}: <span class="dw-dim">empty</span>`, info: `${slot}: no potion in this slot`, disabled: true });
      return;
    }
    if (used) {
      rootRows.push({ html: `${escHtml(p.template_name)} <span class="dw-dim">(USED)</span>`, info: `${slot}: already used`, disabled: true });
      return;
    }
    rootRows.push({
      html: escHtml(p.template_name),
      info: `${slot}: ${escHtml(p.template_name)} · ${escHtml(p.effect_label || '')}`,
      enter() { pickPotion(slot, p); }
    });
  });
  rootRows.push({ blank: true });
  rootRows.push({
    html: `Equip: <span class="${belt && belt.id ? 'dw-weapon' : 'dw-dim'}">${escHtml(belt && belt.id ? belt.name : 'none')}</span>`,
    info: belt && belt.id ? `Belt: ${escHtml(belt.name)}` : 'No belt weapon equipped',
    disabled: !belt || !belt.id,
    enter() { if (belt && belt.id) pickEquip(); }
  });
  stack.push({ kind: 'action', tab: handLineText, rows: rootRows, activeIdx: 0 });

  renderStack();

  // keyboard: Up/Down move the cursor (skips blank/disabled rows), Enter selects,
  // Esc backs one window (root: no-op). Only the top window responds.
  document.onkeydown = (e) => {
    if (busy) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const selectable = [];
      top.rows.forEach((r, i) => { if (!r.blank && !r.disabled) selectable.push(i); });
      if (!selectable.length) return;
      const cur = selectable.indexOf(top.activeIdx);
      const dir = (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 1;
      top.activeIdx = selectable[(cur + dir + selectable.length) % selectable.length];
      renderStack();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      selectTop();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      back();
      e.preventDefault();
    }
  };
}




async function usePotion(runId, slot) {
  if (busy) return;
  setBusy(true);
  try {
    const payload = { slot };
    await apiCall(`/runs/${runId}/use-potion`, 'POST', payload);
    showMessage(`Potion ${slot} used`);
    await loadBattle(runId);
  } catch (e) {
    showMessage(e.message, true);
  }
  setBusy(false);
}

async function loadBattle(runId) {
  currentRunId = runId;
  const box = document.getElementById('message-box');
  try {
    const data = await apiCall(`/runs/${runId}`);
    const run = data.run || data;
    if (!run || !run.id) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
      return;
    }
    if (run.status === 'completed' || run.status === 'inactive' || run.status === 'dead' || run.status === 'abandoned') {
      showErrorState('Run ' + run.status, 'This run is no longer active.', true);
      return;
    }

    const runTitle = document.getElementById('run-title');
    if (runTitle) runTitle.textContent = `PORTAL · RUN ${run.id}`;
    const battleLabel = document.getElementById('battle-label');
    if (battleLabel) {
      const cb = run.current_battle || 1;
      const tb = run.total_battles || 1;
      const bsTic = (run.battle_state && run.battle_state.tic != null) ? run.battle_state.tic : 0;
      battleLabel.textContent = `BATTLE ${cb} OF ${tb} — TIC ${bsTic}`;
    }

    renderPlayerHP(run);
    const bs = run.battle_state || {};
    lastBs = bs;
    queueMarkers = null; // PC-56: fresh battle state — no selection, no markers
    // Capture BEFORE renderDice — the animation path clears the flag.
    monstersPendingReveal = shouldAnimateDice;
    renderDice(bs.dice || {});
    renderMonsters(bs.monsters || []);
    renderFeed(bs.feed || []);
    renderLoadout(bs);
    renderActionMenu(bs);
    renderQueue(bs);


    // battle-over detection on reload: safeState has no battle_over flag —
    // all monsters dead means the battle is winnable/over.
    const monsterList = bs.monsters || [];
    const allMonstersDead = monsterList.length > 0 && monsterList.every(m => m.dead);
    if (allMonstersDead) {
      showAdvanceUI(runId, bs);
    }

  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('not found') || msg.includes('404')) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
    } else if (msg.includes('inactive') || msg.includes('completed')) {
      showErrorState('Run inactive', 'This run is no longer active.', true);
    } else {
      showErrorState('Load failed', msg, true);
    }
  }
}

function setupEndRunButton(runId) {
  const btn = document.getElementById('end-run-btn');
  if (!btn) return;
  btn.onclick = () => {
    // exact dialog per spec
    const dialog = document.createElement('div');
    dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
    dialog.innerHTML = `
      <div style="background:#112233;border:3px solid #4a90d9;padding:20px;max-width:420px;color:#e0e0ff;font-family:'Pixeloid Mono',monospace;font-size:12px;">
        <div style="margin-bottom:12px;">you will lose all loot from this run and nothing will be refunded. Type 'End Run' to confirm.</div>
        <input id="end-run-input" type="text" style="width:100%;background:#000;border:2px solid #335577;color:#e0e0ff;padding:6px;margin-bottom:12px;" placeholder="type here">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="end-run-cancel" class="action-btn">Cancel</button>
          <button id="end-run-confirm" class="action-btn" disabled>Confirm End Run</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const input = dialog.querySelector('#end-run-input');
    const confirmBtn = dialog.querySelector('#end-run-confirm');
    const cancelBtn = dialog.querySelector('#end-run-cancel');
    const checkInput = () => {
      const val = (input.value || '').trim().toLowerCase();
      confirmBtn.disabled = val !== 'end run';
    };
    input.oninput = checkInput;
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
    };
    cancelBtn.onclick = () => dialog.remove();
    confirmBtn.onclick = async () => {
      dialog.remove();
      try {
        await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' });
        localStorage.removeItem('currentRunId');
        window.location.href = '/game.html';
      } catch (e) {
        // surface error without crash
        alert('End Run failed: ' + (e.message || e));
      }
    };
    input.focus();
  };
}

async function init() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showErrorState('Configuration error', 'Missing Supabase ENV.');
    return;
  }
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
  if (!(await checkAuth())) return;

  // PC-52: fill hud-name from session (front-end only, placeholder dock)
  const { data: { session } } = await supabase.auth.getSession();
  const hudName = document.getElementById('hud-name');
  if (hudName && session && session.user) {
    const meta = session.user.user_metadata || {};
    hudName.textContent = meta.username || meta.full_name || (session.user.email ? session.user.email.split('@')[0] : 'PLAYER');
  }

  const params = new URLSearchParams(window.location.search);
  const runId = params.get('id');
  if (!runId) {
    showErrorState('Missing run ID', 'Add ?id=NNN to the URL.', true);
    return;
  }

  shouldAnimateDice = true; // run start transition
  await loadBattle(runId);
  setupEndRunButton(runId);
}

init();