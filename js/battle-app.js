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
let dwMenuState = null;   // { prefHand } — DW menu hand switch
let dwOnPickTarget = null; // DW target-pick callback (set while targeting)
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

function renderMonsters(monsters, targetMode, targetIdx) {
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
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  monsters.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'monster-card' + (targetMode ? ' targetable' : '');
    if (targetMode && i === targetIdx) card.classList.add('selected');
    card.style.cssText = 'background:rgba(0,0,0,0.4);border:2px solid #4a90d9;padding:8px 10px;margin-bottom:6px;';
    if (targetMode) {
      card.onclick = () => { if (dwOnPickTarget) dwOnPickTarget(i); };
    }
    const sprite = document.createElement('div');
    sprite.style.cssText = 'width:64px;height:48px;background:#112233;border:1px solid #335577;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#66ccff;';
    sprite.textContent = m.name ? m.name.substring(0,3).toUpperCase() : 'MON';
    const name = document.createElement('div');
    name.style.cssText = 'color:#ffcc66;font-size:11px;text-align:center;';
    name.textContent = m.name || 'Monster';
    if (targetMode) name.textContent = letters[i] + ' - ' + (m.name || 'Monster');
    const hp = document.createElement('div');
    hp.style.cssText = 'margin-top:4px;text-align:center;';
    const hpWord = m.hp_word || m.hpWord || 'Healthy';
    hp.innerHTML = `<span style="color:#66ff99;font-size:10px;">HP: ${hpWord}</span>`;
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
 * Action choices = what the player can actually do right now, per design
 * (attack name + damage only — pure choices). One button per READY hand per
 * attack; a winding hand shows its remaining cast tics (live queue countdown).
 */
/**
 * PC-56 DW per-hand command menu: single COMMAND panel, hand-line, flat rows
 * (attacks + C1/C2/BL), attack → target → confirm, item-confirm prompts, and
 * '>' timing markers on the queue rail (approved mockup 04-dw-battle).
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

  // Per-hand turn menu: LH if Ready, else RH. Both ready same tick = resolve
  // one hand, then the next; a chip in the hand-line switches when both Ready.
  const readyHands = ['LH', 'RH'].filter(h => {
    const w = weapons[h === 'LH' ? 'hand_l' : 'hand_r'];
    return hands[h] && hands[h].state === 'Ready' && w && w.id;
  });
  const pref = (dwMenuState && dwMenuState.prefHand) || 'LH';
  let hand = readyHands.includes(pref) ? pref : (readyHands[0] || null);
  if (!hand) {
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

  const w = weapons[hand === 'LH' ? 'hand_l' : 'hand_r'];
  const handLineText = hand === 'LH' ? 'L.HAND' : 'R.HAND';
  const otherReady = readyHands.find(h => h !== hand) || null;

  const menu = document.createElement('div');
  menu.className = 'command-menu';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'COMMAND';
  menu.appendChild(title);

  const handLine = document.createElement('div');
  handLine.className = 'hand-line';
  handLine.innerHTML = `<span class="hand-label">${handLineText}</span> — <span class="weapon-name">${escHtml(w.name || 'Unknown')}</span>`;
  if (otherReady) {
    const chip = document.createElement('span');
    chip.className = 'hand-switch';
    chip.textContent = `[${otherReady === 'LH' ? 'L.HAND' : 'R.HAND'}]`;
    chip.title = `switch to ${otherReady}`;
    chip.onclick = () => {
      dwMenuState = dwMenuState || {};
      dwMenuState.prefHand = otherReady;
      renderActionMenu(bs);
    };
    handLine.appendChild(chip);
  }
  menu.appendChild(handLine);

  // flat rows: attacks (no numbered rows) + C1/C2/BL
  const rows = [];
  (w.attacks || []).forEach(a => rows.push({ kind: 'attack', label: a.name, attack: a }));
  rows.push({ kind: 'c1', label: 'C1', slot: 'A' });
  rows.push({ kind: 'c2', label: 'C2', slot: 'B' });
  rows.push({ kind: 'bl', label: 'BL' });

  let activeIdx = 0;
  let targetMode = false;
  let targetIdx = 0;
  let itemConfirm = null; // { onOk }

  function showInfo(text) {
    const fi = document.getElementById('footer-info');
    if (fi) fi.innerHTML = text || 'Select a command to see details';
  }

  function attackInfo(a) {
    const base = w.base_damage != null ? w.base_damage : (w.damage || 0);
    const range = w.damage_range != null ? w.damage_range : 0;
    const multi = a.is_multi_target ? ' <span style="color:#ffaa66">[MULTI]</span>' : '';
    const desc = a.description ? ` — ${escHtml(a.description)}` : '';
    const pVar = a.prepare_time_range || 0;
    const cVar = a.cooldown_time_range || 0;
    const pText = pVar > 0 ? `${a.prepare_time}-${a.prepare_time + pVar}` : `${a.prepare_time}`;
    const cText = cVar > 0 ? `${a.cooldown_time}-${a.cooldown_time + cVar}` : `${a.cooldown_time}`;
    return `<strong>${escHtml(a.name)}</strong> DMG ${base}±${range} | Windup: ${pText}t | CD: ${cText}t${multi}${desc}`;
  }

  function setMarkers(attack) {
    queueMarkers = new Map(computeTimingMarkers(queue, attack).map(m => [m.id, m.marker]));
    renderQueue(lastBs);
  }
  function clearMarkers() {
    queueMarkers = null;
    renderQueue(lastBs);
  }

  function clearRowHighlight() {
    menu.querySelectorAll('.command-row').forEach(el => el.classList.remove('active'));
  }
  function paintRows() {
    menu.querySelectorAll('.command-row').forEach((el, idx) => {
      el.classList.toggle('active', idx === activeIdx);
    });
  }

  function renderRows() {
    menu.querySelectorAll('.command-row').forEach(el => el.remove());
    menu.querySelectorAll('.item-confirm').forEach(el => el.remove());
    rows.forEach((row, idx) => {
      const el = document.createElement('div');
      el.className = 'command-row';
      if (row.kind === 'attack') {
        el.textContent = row.label;
        el.onmouseenter = () => { if (!targetMode && !itemConfirm) { showInfo(attackInfo(row.attack)); setMarkers(row.attack); } };
        el.onmouseleave = () => { if (!targetMode && !itemConfirm) { showInfo(''); clearMarkers(); } };
        el.onclick = () => {
          if (busy || targetMode || itemConfirm) return;
          activeIdx = idx; paintRows();
          enterTargetMode(row);
        };
      } else if (row.kind === 'bl') {
        const beltName = belt && belt.id ? belt.name : 'none';
        el.innerHTML = `BL: <span style="color:${belt && belt.id ? '#a8c8ea' : '#556677'}">${escHtml(beltName)}</span>`;
        el.onmouseenter = () => { if (!targetMode && !itemConfirm) showInfo(belt && belt.id ? `Belt: ${escHtml(belt.name)}` : 'No belt weapon equipped'); };
        el.onmouseleave = () => { if (!targetMode && !itemConfirm) showInfo(''); };
        el.onclick = () => {
          if (busy || targetMode || itemConfirm) return;
          if (!belt || !belt.id) { showInfo('No belt weapon equipped'); return; }
          activeIdx = idx; paintRows();
          showItemConfirm(`Swap ${handLineText} with belt weapon <strong>${escHtml(belt.name)}</strong>?`, () => doSwap(currentRunId, hand));
        };
      } else {
        const key = row.slot === 'A' ? 'potion_a' : 'potion_b';
        const p = potions[key] || potions[row.slot] || null;
        const used = p && p.used;
        const label = p && !used ? p.template_name : (p && used ? `${p.template_name} (USED)` : 'empty');
        el.innerHTML = `${row.label}: <span style="color:${p && !used ? '#a8c8ea' : '#556677'}">${escHtml(label)}</span>`;
        el.onmouseenter = () => { if (!targetMode && !itemConfirm) showInfo(p && !used ? `${row.label}: ${escHtml(p.template_name)} · ${escHtml(p.effect_label || '')}` : `${row.label}: ${used ? 'already used' : 'empty'}`); };
        el.onmouseleave = () => { if (!targetMode && !itemConfirm) showInfo(''); };
        el.onclick = () => {
          if (busy || targetMode || itemConfirm) return;
          if (!p || used) { showInfo(p && used ? 'This potion was already used' : 'No potion in this slot'); return; }
          activeIdx = idx; paintRows();
          showItemConfirm(`Use <strong>${escHtml(p.template_name)}</strong> (${escHtml(p.effect_label || '')})?`, () => usePotion(currentRunId, row.slot));
        };
      }
      menu.appendChild(el);
    });
    paintRows();
  }

  function enterTargetMode(row) {
    if (monsters.length === 0) {
      // nothing to target — commit with auto-target (CLI parity)
      doAttack(currentRunId, hand, row.attack.id, []);
      return;
    }
    if (row.attack && row.attack.is_multi_target) {
      // multi-target attacks hit ALL live monsters — no pick needed (CLI parity: target_ids [])
      targetMode = true;
      dwOnPickTarget = null;
      renderMonsters(monsters, false);
      showTargetBar(row, true);
      showInfo('Multi-target attack — hits all monsters. Enter to confirm, Esc to cancel');
      return;
    }
    targetMode = true;
    targetIdx = 0;
    dwOnPickTarget = (i) => {
      targetIdx = i;
      renderMonsters(monsters, true, targetIdx);
      updateTargetBar(row);
    };
    renderMonsters(monsters, true, targetIdx);
    showTargetBar(row);
    showInfo('Pick a target — click a monster or use ←/→, Enter to confirm, Esc to cancel');
  }

  function showTargetBar(row, all) {
    let bar = document.getElementById('target-confirm-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'target-confirm-bar';
      document.body.appendChild(bar);
    }
    const target = all ? null : (monsters[targetIdx] || null);
    const targetText = all ? 'ALL MONSTERS' : (target ? target.name : 'auto');
    bar.innerHTML = `ATTACK <strong>${escHtml(row.attack.name)}</strong> → <strong class="tgt">${escHtml(targetText)}</strong>
      <button id="target-confirm-btn">CONFIRM</button>
      <button id="target-cancel-btn">CANCEL</button>`;
    bar.querySelector('#target-confirm-btn').onclick = () => {
      if (all) { doAttack(currentRunId, hand, row.attack.id, []); return; }
      const t = monsters[targetIdx];
      doAttack(currentRunId, hand, row.attack.id, t && t.id != null ? [t.id] : []);
    };
    bar.querySelector('#target-cancel-btn').onclick = () => exitTargetMode(true);
  }

  function updateTargetBar(row) {
    const bar = document.getElementById('target-confirm-bar');
    if (!bar) return;
    const target = monsters[targetIdx] || null;
    const span = bar.querySelector('.tgt');
    if (span) span.textContent = target ? target.name : 'auto';
  }

  function exitTargetMode(cancel) {
    targetMode = false;
    dwOnPickTarget = null;
    const bar = document.getElementById('target-confirm-bar');
    if (bar) bar.remove();
    renderMonsters(monsters, false);
    if (cancel) { showInfo(''); clearMarkers(); }
  }

  function showItemConfirm(msg, onOk) {
    itemConfirm = { onOk };
    const box = document.createElement('div');
    box.className = 'item-confirm';
    box.innerHTML = `<div class="confirm-msg">${msg}</div>
      <div class="confirm-btns"><button>CONFIRM</button><button>CANCEL</button></div>`;
    box.querySelectorAll('button')[0].onclick = () => {
      const ok = itemConfirm && itemConfirm.onOk;
      itemConfirm = null;
      box.remove();
      if (ok) ok();
    };
    box.querySelectorAll('button')[1].onclick = () => {
      itemConfirm = null;
      box.remove();
    };
    menu.appendChild(box);
  }

  renderRows();
  wrap.appendChild(menu);

  // keyboard: arrows move the active row, Enter activates, Escape backs out
  document.onkeydown = (e) => {
    if (busy) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (targetMode) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        targetIdx = (targetIdx + dir + monsters.length) % monsters.length;
        if (dwOnPickTarget) dwOnPickTarget(targetIdx);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const btn = document.getElementById('target-confirm-btn');
        if (btn) btn.click();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        exitTargetMode(true);
        e.preventDefault();
      }
      return;
    }
    if (itemConfirm) {
      if (e.key === 'Enter') {
        const btns = menu.querySelectorAll('.item-confirm .confirm-btns button');
        if (btns[0]) btns[0].click();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        const btns = menu.querySelectorAll('.item-confirm .confirm-btns button');
        if (btns[1]) btns[1].click();
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      activeIdx = (activeIdx + 1) % rows.length;
      paintRows();
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      activeIdx = (activeIdx - 1 + rows.length) % rows.length;
      paintRows();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const row = rows[activeIdx];
      if (row) {
        if (row.kind === 'attack') enterTargetMode(row);
        else if (row.kind === 'bl') {
          if (!belt || !belt.id) { showInfo('No belt weapon equipped'); return; }
          showItemConfirm(`Swap ${handLineText} with belt weapon <strong>${escHtml(belt.name)}</strong>?`, () => doSwap(currentRunId, hand));
        } else {
          const key = row.slot === 'A' ? 'potion_a' : 'potion_b';
          const p = potions[key] || potions[row.slot] || null;
          if (!p || p.used) { showInfo(p && p.used ? 'This potion was already used' : 'No potion in this slot'); return; }
          showItemConfirm(`Use <strong>${escHtml(p.template_name)}</strong> (${escHtml(p.effect_label || '')})?`, () => usePotion(currentRunId, row.slot));
        }
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      showInfo(''); clearMarkers();
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