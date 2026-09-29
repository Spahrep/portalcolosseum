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
import { potionPrePostTicks } from './combat/potion-contract.js';
import { parseHitLine } from './combat/hit-feedback.js';
import { getSpeedPreset, getSpeedKey, getFontSizePreset, getFontSizeKey, onSpeedChange, onFontSizeChange, setSpeed } from './settings-controller.js';
import './battle-debug.js'; // debugLog(tag, msg) — toggled via game_config.debug in Supabase
import {
  renderQueue, diffQueueForAnimation, clearQueueDom, markQueueRowExiting,
  buildQueueRow, updateQueueRowInPlace, sortQueueRows,
  setQueueBarInfo, getQueueBarInfo, clearQueueBarInfo, isQueueRowExiting,
  queueRowKey, isMonsterQueueRow, forgetQueueRowExiting,
  QUEUE_EXIT_MS, QUEUE_REMOVE_GAP_MS, QUEUE_GAP_MS,
  QUEUE_WIPE_MS, QUEUE_FLASH_MS, QUEUE_ENTER_MS
} from './battle/queue-render.js';

import {
  clearTyping, typeFeedLines, renderFeed, populateFeedInstantly,
  appendFeedLine, typeFeedLinesAsync, awaitNarration,
  bindFeedRender, getRenderedFeedLines, setRenderedFeedLines, addRenderedFeedLines,
  isTypingInProgress, setFeedPinned
} from './battle/feed-render.js';
import {
  renderDice, updateCurrentDie, performSweepAnimation,
  rollDiceAnimation, bindDiceRender
} from './battle/dice-render.js';

// PC-78: feed and dice own their state. Hooks stay here (busy gate, hit
// feedback, ceremony) so the new modules do not import battle-app.js.
bindFeedRender({
  setBusy,
  handleHitLine,
  setSuppressHitFeedback: (v) => { suppressHitFeedback = v; },
});
bindDiceRender({
  appendFeedLine,
  revealMonsters,
  finishBattleIntro,
  getShouldAnimateDice: () => shouldAnimateDice,
  setShouldAnimateDice: (v) => { shouldAnimateDice = v; },
});


/**
 * BattleClock — orchestrates post-commit animation sequencing.
 * Phase flow:
 *   IDLE → SCHEDULED (wait for feed narration) → ANIMATING →
 *     → resolve (flash+shrink on old DOM) → push-down preview
 *     → renderQueue(bs) → entry enter animations → IDLE
 *
 * Busy is held for the entire duration (setBusy filters releases during clock activity),
 * preventing race conditions from rapid commits.
 *
 * Singleton — one instance per module, created at the bottom of this class block.
 */
class BattleClock {
  constructor() {
    this.state = 'IDLE'; // IDLE | SCHEDULED | ANIMATING
    this._diff = null;
    this._newBs = null;
    this._onComplete = null;
    this._timer = null;
  }

  abort() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.state = 'IDLE';
    this._onComplete = null;
  }

  /** Begin the post-commit transition. Called from loadBattle after highlighting. */
  start(diff, newBs, onComplete) {
    this.abort();
    const commits = (diff && diff.readyCommits) || [];
    if (diff.resolved.length === 0 && diff.added.length === 0 && commits.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    this._diff = diff;
    this._newBs = newBs;
    this._onComplete = onComplete;
    this.state = 'SCHEDULED';
  }

  /** Call this when feed narration completes (from renderFeed's onComplete). */
  onNarrateDone() {
    if (this.state !== 'SCHEDULED') return;
    this.state = 'ANIMATING';
    this._runResolve();
  }

  /** Phase 1: removals slide out + group-lift, including a fired head.
   * The head stayed pinned through narration; this runs after that. */
  async _runResolve() {
    const { _diff: diff } = this;
    const queueEl = document.getElementById('queue');

    if (!queueEl || diff.resolved.length === 0) {
      await this._runInsert();
      return;
    }

    const top = queueEl.querySelector('.queue-row:not(.queue-row-exit)');
    const headId = diff.resolved[0];
    const headIsTop = top && String(top.dataset.rowId) === String(headId);
    if (headIsTop) {
      await runQueueRemoval([headId]);
      const rest = diff.resolved.slice(1, 2);
      if (rest.length) await runQueueRemoval(rest);
    } else {
      await runQueueRemoval(diff.resolved.slice(0, 1));
    }
    await this._runInsert();
  }

  /** Phase 2: attack row plays the ceremony first; the ready placeholder
   * then slides out. Never suppressed just because a removal happened
   * in the same tick. */
  async _runInsert() {
    await this._renderNew();
  }

  /** Phase 3: ceremony (event-gated), then ready slide-out, then entry settle. */
  async _renderNew() {
    const { _diff: diff, _newBs: newBs } = this;
    const preset = getSpeedPreset();
    const commits = diff.readyCommits || [];

    const addedRows = diff.addedRows
      || (newBs.queue || []).filter(r => (diff.added || []).some(a => a.id === r.id));
    const ceremonyEntries = [...addedRows, ...commits.map(c => c.attack)];

    // Attack lands in its slot first. Skip the closing reconcile when a ready
    // placeholder still has to slide out — renderQueue would wipe it.
    if (ceremonyEntries.length > 0) {
      await playInsertCeremony(ceremonyEntries, preset, newBs, { reconcile: commits.length === 0 });
    }

    for (const c of commits) {
      if (animationsSkipped(preset)) {
        const el = findQueueRowByIdentity(c.ready);
        if (el) el.remove();
      } else {
        await runQueueRemoval([c.ready.id]);
      }
    }

    if (commits.length > 0 || ceremonyEntries.length === 0) {
      renderQueue(newBs);
    }

    const qp = document.querySelector('.queue-panel');
    if (qp && ceremonyEntries.length > 0 && !animationsSkipped(preset)) {
      qp.classList.add('queue-arrived');
      await waitForEvent(qp, 'animationend', 400);
      qp.classList.remove('queue-arrived');
    }

    this._finish();
  }

  /** All done — release busy gate, call onComplete, return to IDLE. */
  _finish() {
    this.state = 'IDLE';
    setBusy(false); // Release the gate (setBusy respects clock state)
    if (this._onComplete) {
      const cb = this._onComplete;
      this._onComplete = null;
      cb();
    }
  }
}

const battleClock = new BattleClock();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Event-driven wait for animation/transition completion.
 * Uses animationend or transitionend per caller.
 * Reduced-motion media query short-circuits to immediate resolve (no wait).
 * Timeout fallback preserves behavior when events never fire (reduced-motion
 * environments, etc.). Matches the monster-death pattern.
 */
function waitForEvent(el, eventName, timeoutMs = QUEUE_EXIT_MS + 50) {
  return new Promise(resolve => {
    if (!el) {
      resolve();
      return;
    }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      resolve();
      return;
    }
    const handler = () => {
      el.removeEventListener(eventName, handler);
      resolve();
    };
    el.addEventListener(eventName, handler, { once: true });
    // fallback for reduced-motion or when event never fires
    setTimeout(() => {
      el.removeEventListener(eventName, handler);
      resolve();
    }, timeoutMs);
  });
}

/**
 * Genuine-removal choreography (shared by BattleClock._runResolve and tickLoop):
 *   1) the resolved row(s) slide fully out over QUEUE_EXIT_MS (stays in flow),
 *   2) QUEUE_REMOVE_GAP_MS pause,
 *   3) the remaining rows FLIP up together as one unit over QUEUE_EXIT_MS.
 * Callers must pass exactly one id (slice(0,1)) per removal per the shipped spec.
 * The container is left with the remaining rows at their final positions; the
 * subsequent renderQueue() reconciles in place (stable-key pass) so this lift is
 * never clobbered mid-animation.
 */
async function runQueueRemoval(resolvedIds) {
  const queueEl = document.getElementById('queue');
  if (!queueEl || resolvedIds.length === 0) return;
  // strict barrier: fire all exit visuals in parallel, await completion via events
  const exitRows = [];
  resolvedIds.forEach(id => {
    markQueueRowExiting(id);
    const row = queueEl.querySelector(`[data-row-id="${id}"]`);
    if (row) exitRows.push(row);
  });
  await Promise.all(exitRows.map(r => waitForEvent(r, 'animationend')));
  await sleep(QUEUE_REMOVE_GAP_MS); // 2) pause (gap is non-visual timing)
  await groupLiftRemaining();       // 3) glide the rest up together
}

/** FLIP group-lift: release the exited rows' space, then animate every
 * remaining queue row up as one unit (no per-row stagger, no jump). */
async function groupLiftRemaining() {
  const queueEl = document.getElementById('queue');
  if (!queueEl) return;
  const exited = Array.from(queueEl.children).filter(c => isQueueRowExiting(c.dataset.rowId));
  const siblings = Array.from(queueEl.children).filter(c =>
    c.classList.contains('queue-row') && !isQueueRowExiting(c.dataset.rowId)
  );
  if (siblings.length === 0) {
    // nothing to glide — just drop the exited rows and clear the cache
    exited.forEach(c => c.remove());
    exited.forEach(c => forgetQueueRowExiting(c.dataset.rowId));
    return;
  }
  // Capture rows at their pushed-down positions BEFORE releasing the exited
  // row's space, so the FLIP can pin them there and then glide to natural.
  const before = siblings.map(r => r.getBoundingClientRect().top);
  exited.forEach(c => c.remove());
  exited.forEach(c => forgetQueueRowExiting(c.dataset.rowId));
  const after = siblings.map(r => r.getBoundingClientRect().top);
  // FLIP: lock siblings at pre-removal offsets, force reflow, then clear the
  // transform — the transition glides them up together.
  siblings.forEach((r, i) => {
    r.style.transition = 'none';
    r.style.transform = `translateY(${before[i] - after[i]}px)`;
  });
  void queueEl.offsetHeight; // reflow to commit the locked transform
  siblings.forEach(r => {
    r.style.transition = `transform ${QUEUE_EXIT_MS}ms ease-in`;
    r.style.transform = '';
  });
  // strict barrier inside step: await all transitionend events in parallel
  await Promise.all(siblings.map(r => waitForEvent(r, 'transitionend')));
  siblings.forEach(r => { r.style.transition = ''; r.style.transform = ''; });
}

const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabase;
let currentRunId = null;
let lastBs = null; // last loaded battle_state (safeState) — source for attack/potion lookups
let busy = false;
let masterClockDepth = 0; // >0 while tickLoop / commit ceremony owns the clock; blocks setBusy(false)
let pendingAttack = null; // {hand, attackId} for commit via re-click or Enter
let playerName = 'Player';
let shouldAnimateDice = false;
// PC-51: monsters stay hidden while the dice roll ceremony plays, then
// fade in one at a time. Set in the battle render when a roll will run;
// revealMonsters() clears it when the roll completes.
let monstersPendingReveal = false;
const MONSTER_FADE_STAGGER = 1000; // ms pause between monster reveals (one at a time, with a beat)
const MONSTER_FADE_MS = 1400;      // per-monster fade duration

// Ceremony-intro: the battle-start dice ceremony also gates the command window and the
// timing track — both stay hidden while the die rolls. Once the last monster has faded
// in, the timing track fills (First → last); the command window appears only after the
// track is full (the fill's onDone removes intro-pending).
let battleIntroPending = false;
let introTimer = null; // PC-64: countdown interval for the battle-intro replay

function enterMasterClock() { masterClockDepth++; }
function leaveMasterClock() { masterClockDepth = Math.max(0, masterClockDepth - 1); }

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Instant preset and reduced-motion both skip queue motion (rows land directly). */
function animationsSkipped(preset) {
  const p = preset || getSpeedPreset();
  return prefersReducedMotion() || !p || p.charMs === 0;
}

function findQueueRowByIdentity(row) {
  if (!row) return null;
  const queueEl = document.getElementById('queue');
  if (!queueEl) return null;
  if (row.id != null) {
    const byId = queueEl.querySelector(`[data-row-id="${row.id}"]`);
    if (byId) return byId;
  }
  const key = queueRowKey(row);
  return Array.from(queueEl.querySelectorAll('.queue-row')).find(el => el.dataset.stableKey === key) || null;
}

/** Hand-ready commit: same stable key, event flips ready → a committed action. */
function findReadyCommits(oldQueue, newQueue) {
  const commits = [];
  for (const oldRow of oldQueue || []) {
    if (oldRow.label !== 'LH' && oldRow.label !== 'RH') continue;
    if (oldRow.event !== 'ready') continue;
    const next = (newQueue || []).find(r => r.label === oldRow.label);
    if (next && next.event !== 'ready') commits.push({ ready: oldRow, attack: next });
  }
  return commits;
}

function pinProcessedHead(head) {
  const row = findQueueRowByIdentity(head);
  if (!row) return;
  row.classList.add('queue-row-current');
  row.classList.remove('queue-row-exit');
}

/**
 * Fired-head exit: slide the processed row out, then glide the rows below up.
 * Call only after narration + visuals. A `ready` pause is not a fired head.
 * A same-key successor (monster attack→cooldown, hand phase) stays the same
 * key in data — reseat that successor so renderQueue does not treat the
 * glide as a key-breaking rebuild.
 */
async function animateFiredHeadExit(head, newQueue, bs) {
  if (!head || head.event === 'ready') return;
  const key = queueRowKey(head);
  const successor = (newQueue || []).find(r => queueRowKey(r) === key);
  if (animationsSkipped(getSpeedPreset())) {
    if (!successor) {
      const el = findQueueRowByIdentity(head);
      if (el) el.remove();
    }
    return;
  }
  const row = findQueueRowByIdentity(head);
  if (!row) return;
  const id = row.dataset.rowId || head.id;
  await runQueueRemoval([id]);
  if (successor) reseatSameKeySuccessor(successor, newQueue, bs);
}

/** Put a same-key successor back in the DOM at its engine slot, without an
 * enter slide. The fired row already slid out; this is not a new key. */
function reseatSameKeySuccessor(successor, engineQueue, bs) {
  const queueEl = document.getElementById('queue');
  if (!queueEl || !successor) return;
  const key = queueRowKey(successor);
  const existing = Array.from(queueEl.querySelectorAll('.queue-row')).find(el => el.dataset.stableKey === key);
  if (existing) return;
  const rowEl = buildQueueRow(successor, (bs && bs.monsters) || [], bs || {}, true);
  const domRows = Array.from(queueEl.children).filter(c =>
    c.classList.contains('queue-row') && !c.classList.contains('queue-row-exit')
  );
  const idx = insertIndexFor(successor, domRows, engineQueue);
  const ref = domRows[idx] || null;
  if (ref) queueEl.insertBefore(rowEl, ref);
  else queueEl.appendChild(rowEl);
}

function measuredRowHeight(queueEl) {
  const sample = queueEl.querySelector('.queue-row:not(.queue-row-exit)');
  if (!sample) return 24;
  const h = sample.getBoundingClientRect().height;
  return h > 0 ? Math.round(h) : 24;
}

function domRowIsPlayer(el) {
  return (el.dataset.stableKey || '').startsWith('h:');
}

// Visual slot for a new row. Prefer the engine array index (order was fixed at
// insert) so existing DOM rows are not re-sorted. A departing placeholder still
// in the DOM (ready row waiting to slide out) is not an ordering anchor.
// The comparator is only the fallback when there is no engine queue to follow.
function insertIndexFor(entry, domRows, engineQueue) {
  if (engineQueue && entry && entry.id != null) {
    const engineIdx = engineQueue.findIndex(r => r.id === entry.id);
    if (engineIdx !== -1) {
      const before = new Set(engineQueue.slice(0, engineIdx).map(r => r.id));
      if (before.size === 0) return 0;
      let passed = 0;
      let lastBeforeIdx = -1;
      for (let i = 0; i < domRows.length; i++) {
        if (before.has(domRows[i].dataset.rowId)) {
          passed++;
          lastBeforeIdx = i;
        }
      }
      // All anchors are on screen: land just after the last one so a departing
      // ready placeholder does not shift the slot. If an anchor is missing,
      // fall back to the count of anchors already present.
      if (passed >= before.size && lastBeforeIdx !== -1) return lastBeforeIdx + 1;
      return passed;
    }
  }
  const newTics = entry.tics ?? 0;
  const newPlayer = entry.label === 'LH' || entry.label === 'RH';
  for (let i = 0; i < domRows.length; i++) {
    const curTics = Number(domRows[i].dataset.tics ?? 0);
    if (newTics < curTics) return i;
    if (newTics === curTics && newPlayer && !domRowIsPlayer(domRows[i])) return i;
  }
  return domRows.length;
}

async function openInsertGap(entry, queueEl, engineQueue) {
  const domRows = Array.from(queueEl.children).filter(c =>
    c.classList.contains('queue-row') && !isQueueRowExiting(c.dataset.rowId) && !c.classList.contains('queue-row-exit')
  );
  const gap = document.createElement('div');
  gap.className = 'queue-insert-gap';
  gap.style.setProperty('--insert-gap', `${measuredRowHeight(queueEl)}px`);
  const refChild = domRows[insertIndexFor(entry, domRows, engineQueue)] || null;
  if (refChild) queueEl.insertBefore(gap, refChild);
  else queueEl.appendChild(gap);
  void gap.offsetHeight;
  gap.classList.add('open');
  await waitForEvent(gap, 'transitionend', QUEUE_GAP_MS + 80);
  return gap;
}

/** Distinct marker filling the open slot: wipe left→right, then one flash. */
async function playInsertMarker(gap) {
  const marker = document.createElement('div');
  marker.className = 'queue-insert-bar';
  gap.appendChild(marker);
  void marker.offsetWidth;
  marker.classList.add('wipe');
  await waitForEvent(marker, 'animationend', QUEUE_WIPE_MS + 80);
  marker.classList.remove('wipe');
  void marker.offsetWidth;
  marker.classList.add('flash');
  await waitForEvent(marker, 'animationend', QUEUE_FLASH_MS + 80);
  return marker;
}

async function settleEnteredRows(entries, preset) {
  const queueEl = document.getElementById('queue');
  if (!queueEl || !entries || entries.length === 0 || animationsSkipped(preset)) return;
  const waits = [];
  for (const entry of entries) {
    const id = entry && entry.id != null ? entry.id : entry;
    const rowEl = queueEl.querySelector(`[data-row-id="${id}"]`);
    if (!rowEl) continue;
    const isMon = isMonsterQueueRow(entry);
    const cls = isMon ? 'queue-row-monster-enter' : 'queue-row-enter';
    rowEl.classList.add(cls);
    const timeout = isMon ? 450 : QUEUE_ENTER_MS + 80;
    waits.push(waitForEvent(rowEl, 'animationend', timeout).then(() => {
      rowEl.classList.remove('queue-row-enter', 'queue-row-monster-enter');
    }));
  }
  await Promise.all(waits);
}

/**
 * Full insert ceremony: empty gap grows → marker wipes → flashes → real row settles.
 * Event-gated via waitForEvent. Instant / reduced-motion skips straight to render.
 */
async function playInsertCeremony(entries, preset, bs, opts) {
  const reconcile = !opts || opts.reconcile !== false;
  const list = entries || [];
  const queueEl = document.getElementById('queue');
  if (list.length === 0 || !queueEl || animationsSkipped(preset)) {
    if (bs && reconcile) renderQueue(bs);
    return;
  }
  const monsters = (bs && bs.monsters) || [];
  for (const entry of list) {
    const gap = await openInsertGap(entry, queueEl, bs && bs.queue);
    await playInsertMarker(gap);
    if (bs) {
      const rowEl = buildQueueRow(entry, monsters, bs, true);
      const cls = isMonsterQueueRow(entry) ? 'queue-row-monster-enter' : 'queue-row-enter';
      rowEl.classList.add(cls);
      gap.replaceWith(rowEl);
      const timeout = isMonsterQueueRow(entry) ? 450 : QUEUE_ENTER_MS + 80;
      await waitForEvent(rowEl, 'animationend', timeout);
      rowEl.classList.remove('queue-row-enter', 'queue-row-monster-enter');
    } else {
      gap.remove();
    }
  }
  if (bs && reconcile) renderQueue(bs);
}

/** Hit-shake / fresh death cards started this tick. Resolves on animationend. */
async function awaitTickVisuals(deathBefore) {
  const els = [];
  const container = document.querySelector('.container');
  if (container && (container.classList.contains('container-shake') || container.classList.contains('container-crit-shake'))) {
    els.push(container);
  }
  document.querySelectorAll('.monster-hit, .monster-crit-hit').forEach(el => els.push(el));
  if (deathBefore) {
    for (const [key, entry] of deathCards) {
      if (!deathBefore.has(key) && entry.el) els.push(entry.el);
    }
  }
  if (els.length === 0) return;
  await Promise.all(els.map(el => waitForEvent(el, 'animationend', MONSTER_DEATH_MS + 80)));
}

/**
 * Hand-ready commit beat: the attack row lands through the full ceremony,
 * THEN the ready placeholder slides out. Runs before the next /tick so the
 * clock does not swallow the insert.
 */
async function playCommitArrival(runId) {
  const fullRun = await apiCall(`/runs/${runId}`, 'GET');
  const run = fullRun.run || fullRun;
  const rich = run.battle_state || {};
  const bs = {
    ...rich,
    player_hp: run.player_hp ?? rich.player?.hp ?? 0,
    max_hp: run.max_hp ?? rich.player?.max_hp ?? 100
  };
  const prev = lastBs;
  const preset = getSpeedPreset();
  const commits = findReadyCommits(prev?.queue || [], bs.queue || []);
  const narrateP = awaitNarration(bs.feed || []);
  const visualP = (async () => {
    if (commits.length === 0) return;
    // Attack slides into its slot first. Reconcile is deferred so the ready
    // placeholder is still in the DOM to slide out after the ceremony lands.
    await playInsertCeremony(commits.map(c => c.attack), preset, bs, { reconcile: false });
    for (const c of commits) {
      if (animationsSkipped(preset)) {
        const el = findQueueRowByIdentity(c.ready);
        if (el) el.remove();
      } else {
        await runQueueRemoval([c.ready.id]);
      }
    }
    renderQueue(bs);
  })();
  await Promise.all([narrateP, visualP]);
  lastBs = bs;
  renderPlayerHP(bs);
  renderLoadout(bs);
  if (commits.length === 0) renderQueue(bs);
}

// PC-52r/PC-63: monster condition words color by severity everywhere they render.
const BAND_CLASS = {
  healthy: 'st-green', injured: 'st-amber', battered: 'st-orange', critical: 'st-red'
};
function bandClass(m) {
  const word = String(m.hp_word || m.hpWord || 'Healthy').toLowerCase();
  return BAND_CLASS[word] || 'st-green';
}

// Settings now live in ./settings-controller.js (single source of truth for speed + font size)

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
  setRenderedFeedLines(0); // error screen replaces the log — next render starts fresh
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
  // Don't release busy if the clock is mid-transition — let _finish() / tickLoop handle it.
  // masterClockDepth covers the server tick loop, which is not the BattleClock state machine.
  if (!state && (battleClock.state !== 'IDLE' || masterClockDepth > 0)) return;
  busy = state;
  // Dynamic hand buttons + ITEM all live inside #action-menu; gate the whole row.
  document.querySelectorAll('#action-menu button').forEach(btn => {
    btn.disabled = state;
    btn.style.opacity = state ? '0.5' : '1';
  });
}

// PC-70: hit feedback — window shake when a monster hits the player, monster
// card shake + sprite white-flash when the player lands a hit. Durations must
// match the keyframes in run.html; the class-restart pattern (remove → reflow →
// re-add) replays the animation on rapid successive hits.
const HIT_FEEDBACK = {
  WINDOW_SHAKE_MS: 280,
  CARD_SHAKE_MS: 220,
  FLASH_MS: 180,
  // PC-74: harder/longer for crit juice (class restart still applies)
  CRIT_WINDOW_SHAKE_MS: 420,
  CRIT_FLASH_MS: 280
};
let windowShakeTimer = null;
let suppressHitFeedback = false; // intro-snap re-type narrates HISTORY — only NEW hits react
const cardHitTimers = new WeakMap(); // per-card cleanup timer for multi-target hits

// PC-71: monster death — a dead monster's card flashes red and fades out in
// place (run.html @keyframes monster-death), then is removed. Duration must
// match the keyframes; the +200ms timeout is the fallback for environments
// where animationend never fires (reduced-motion etc.).
const MONSTER_DEATH_MS = 1200;
// Death cards survive renderMonsters' innerHTML wipe: they're re-appended
// from this map (keyed by monster id) in their original arena position while
// the animation plays, so a fast follow-up action can't cut the beat short.
const deathCards = new Map(); // monster id -> { el, timer }

function triggerWindowShake() {
  const el = document.querySelector('.container');
  if (!el) return;
  clearTimeout(windowShakeTimer);
  el.classList.remove('container-shake');
  void el.offsetWidth;
  el.classList.add('container-shake');
  windowShakeTimer = setTimeout(() => el.classList.remove('container-shake'), HIT_FEEDBACK.WINDOW_SHAKE_MS);
}

function triggerMonsterHit(letter) {
  const card = document.querySelector(`.monster-card[data-letter="${letter}"]`);
  if (!card || card.classList.contains('monster-dying')) return;
  const sprite = card.querySelector('.monster-sprite');
  const prior = cardHitTimers.get(card);
  if (prior) clearTimeout(prior);
  card.classList.remove('monster-hit');
  if (sprite) sprite.classList.remove('sprite-flash');
  void card.offsetWidth;
  if (sprite) { void sprite.offsetWidth; sprite.classList.add('sprite-flash'); }
  card.classList.add('monster-hit');
  cardHitTimers.set(card, setTimeout(() => {
    card.classList.remove('monster-hit');
    if (sprite) sprite.classList.remove('sprite-flash');
  }, Math.max(HIT_FEEDBACK.CARD_SHAKE_MS, HIT_FEEDBACK.FLASH_MS)));
}

// PC-74 crit juice: harder shake on player being crit-hit, harder flash on player critting monster.
// Uses separate classes so normal hits stay exactly as-is; restart pattern preserved.
let critWindowShakeTimer = null;
function triggerCritWindowShake() {
  const el = document.querySelector('.container');
  if (!el) return;
  clearTimeout(critWindowShakeTimer);
  el.classList.remove('container-crit-shake');
  void el.offsetWidth;
  el.classList.add('container-crit-shake');
  critWindowShakeTimer = setTimeout(() => el.classList.remove('container-crit-shake'), HIT_FEEDBACK.CRIT_WINDOW_SHAKE_MS);
}

function triggerCritMonsterHit(letter) {
  const card = document.querySelector(`.monster-card[data-letter="${letter}"]`);
  if (!card || card.classList.contains('monster-dying')) return;
  const sprite = card.querySelector('.monster-sprite');
  const prior = cardHitTimers.get(card);
  if (prior) clearTimeout(prior);
  card.classList.remove('monster-crit-hit');
  if (sprite) sprite.classList.remove('sprite-crit-flash');
  void card.offsetWidth;
  if (sprite) { void sprite.offsetWidth; sprite.classList.add('sprite-crit-flash'); }
  card.classList.add('monster-crit-hit');
  cardHitTimers.set(card, setTimeout(() => {
    card.classList.remove('monster-crit-hit');
    if (sprite) sprite.classList.remove('sprite-crit-flash');
  }, HIT_FEEDBACK.CRIT_FLASH_MS));
}

// PC-74 sprite-swap seam (sprites don't exist yet — documented hook only; future unique crit sprite swap slots in here)
// Call setMonsterSprite(monsterId, 'crit') to mark a card for crit state (adds .crit class for CSS hook).
// TODO: when crit sprites land, implement the 'crit' case to swap sprite.src or background.
function setMonsterSprite(monsterId, state) {
  // monsterId can be label or numeric id; find the card and toggle class
  const cards = document.querySelectorAll('.monster-card');
  for (const card of cards) {
    if (card.dataset.id === String(monsterId) || card.dataset.letter === String(monsterId)) {
      if (state === 'crit') card.classList.add('crit');
      else card.classList.remove('crit');
      return;
    }
  }
}

// Route engine feed lines to the right reaction. parseHitLine is the single
// source of truth for what counts as a hit (misses/Ready/defeat → no feedback).
function handleHitLine(line) {
  if (suppressHitFeedback) return;
  const isCrit = typeof line === 'string' && line.includes(' CRITICAL!');
  const cleanLine = isCrit ? line.replace(/ CRITICAL!$/, '') : line;
  const hit = parseHitLine(cleanLine);
  if (!hit) return;
  if (hit.type === 'monster') {
    if (isCrit) triggerCritWindowShake();
    else triggerWindowShake();
  } else {
    if (isCrit) triggerCritMonsterHit(hit.letter);
    else triggerMonsterHit(hit.letter);
  }
}

function renderMonsters(monsters) {
  const container = document.getElementById('monsters');
  if (!container) return;
  // Fresh battle ceremony = a new arena — drop any in-flight death animations
  // from the previous battle rather than letting corpses linger into battle 2.
  if (monstersPendingReveal && deathCards.size > 0) {
    for (const entry of deathCards.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.el.remove();
    }
    deathCards.clear();
  }
  // Remove only living monster cards — death cards stay in-place so their
  // CSS animation (monster-death) never restarts from DOM re-insertion.
  Array.from(container.children).forEach(child => {
    if (!child.classList.contains('monster-dying')) child.remove();
  });
  const list = monsters || [];
  if (list.length === 0) {
    // No monsters in the new state — sweep any lingering death cards.
    for (const entry of deathCards.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.el.remove();
    }
    deathCards.clear();
    appendNoMonsters(container);
    return;
  }
  // Render in array order so a dying card keeps its slot among the living
  // (the API keeps dead monsters in place, flagged `dead: true`).
  for (const m of list) {
    if (m.dead) {
      const key = m.id != null ? m.id : m.label;
      const existing = deathCards.get(key);
      if (existing) {
        // already in the DOM from selective removal — no re-append needed
        continue;
      }
      const card = buildMonsterCard(m, true);
      const entry = { el: card, timer: null };
      deathCards.set(key, entry);
      container.appendChild(card);
      card.addEventListener('animationend', (e) => {
        // only the death beat ends the card — a hit-feedback shake on the
        // same tick (the killing blow) must not remove it early
        if (e.animationName === 'monster-death') finishDeath(key);
      });
      entry.timer = setTimeout(() => finishDeath(key), MONSTER_DEATH_MS + 200);
    } else {
      container.appendChild(buildMonsterCard(m, false));
    }
  }
  // "All dead with no death cards" edges into the fresh-battle clear above.
  // finishDeath adds the placeholder when the last animation completes.
}

function buildMonsterCard(m, dying) {
  const card = document.createElement('div');
  card.className = 'monster-card' + (dying ? ' monster-dying' : '');
  // PC-70: letter = the monster's arena key from its label (feed lines use
  // the raw label: "Monster A" / "A" / "Monster #12"). Same normalization as
  // parseHitLine + queueLabel. Index order is NOT the contract — labels are
  // "next free A-Z" at spawn and drift from array order when monsters die.
  card.dataset.letter = String(m.label || '').replace(/^Monster\s*/i, '');
  card.style.cssText = 'background:rgba(0,0,0,0.4);border:2px solid #4a90d9;padding:8px 10px;margin-bottom:6px;';
  const sprite = document.createElement('div');
  sprite.className = 'monster-sprite';
  sprite.style.cssText = 'width:64px;height:48px;background:#112233;border:1px solid #335577;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#66ccff;';
  sprite.textContent = m.name ? m.name.substring(0, 3).toUpperCase() : 'MON';
  const name = document.createElement('div');
  name.style.cssText = 'color:#ffcc66;font-size:11px;text-align:center;';
  name.textContent = m.name || 'Monster';
  const hp = document.createElement('div');
  hp.style.cssText = 'margin-top:4px;text-align:center;';
  if (dying) {
    // dead is not Critical — the card is leaving; the word is DEFEATED in red
    hp.innerHTML = '<span class="st-red" style="font-size:10px;">DEFEATED</span>';
  } else {
    const hpWord = m.hp_word || m.hpWord || 'Healthy';
    hp.innerHTML = `<span class="${bandClass(m)}" style="font-size:10px;">HP: ${hpWord}</span>`;
  }
  card.appendChild(sprite);
  card.appendChild(name);
  card.appendChild(hp);
  if (!dying && monstersPendingReveal) hideForReveal(card);
  return card;
}

function appendNoMonsters(container) {
  const empty = document.createElement('div');
  empty.style.cssText = 'color:#556677;font-size:11px;padding:12px;';
  empty.textContent = 'No monsters present.';
  if (monstersPendingReveal) hideForReveal(empty);
  container.appendChild(empty);
}

function finishDeath(key) {
  const entry = deathCards.get(key);
  if (!entry || entry.finished) return; // first caller wins
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  entry.finished = true;
  // Keep the card in the DOM (invisible from animation-fill-mode: forwards).
  // Do NOT delete from deathCards or remove the element — the engine keeps
  // dead:true in its list, and renderMonsters' selective removal skips
  // .monster-dying cards, so the death animation runs exactly once.
  // Last monster fell — restore the empty-arena placeholder.
  const container = document.getElementById('monsters');
  if (container && !Array.from(container.children).some(c =>
    !c.classList.contains('monster-dying')
  )) appendNoMonsters(container);
}
// While the roll plays, monster cards render invisible (laid out, opacity 0)
// and materialize one at a time once the roll completes.
function hideForReveal(el) {
  el.style.transition = `opacity ${MONSTER_FADE_MS}ms ease`;
  el.style.opacity = '0';
}

function revealMonsters(onDone) {
  debugLog('revealMonsters', `monstersPendingReveal=${monstersPendingReveal} n_cards=${document.getElementById('monsters')?.children?.length || 0}`);
  if (!monstersPendingReveal) {
    if (onDone) onDone(); // no ceremony pending — nothing to wait for
    return;
  }
  monstersPendingReveal = false;
  const container = document.getElementById('monsters');
  const cards = container ? Array.from(container.children) : [];
  if (cards.length === 0) {
    if (onDone) onDone();
    return;
  }
  cards.forEach((card, i) => {
    setTimeout(() => { card.style.opacity = '1'; }, i * MONSTER_FADE_STAGGER);
  });
  // onDone fires after the LAST card is fully in (stagger of the last card
  // plus its own fade) — the timing track and command window follow.
  if (onDone) setTimeout(onDone, (cards.length - 1) * MONSTER_FADE_STAGGER + MONSTER_FADE_MS);
}

// Ceremony-intro: once every monster is in, the timing track fills in from
// First (next) to last; the command window appears only after the track is
// full (the fill's onDone). Idempotent via the flag.
function finishBattleIntro() {
  debugLog('finishBattleIntro', `pending=${battleIntroPending}`);
  if (!battleIntroPending) return;
  battleIntroPending = false;

  const battleLabel = document.getElementById('battle-label');
  if (battleLabel) battleLabel.textContent = 'Setting up action queue';

  document.body.classList.remove('queue-filling');
  document.body.classList.remove('intro-pending');

  const el = document.getElementById('queue');
  if (el) el.innerHTML = '';

  const queue = lastBs ? lastBs.queue || [] : [];
  const monsters = lastBs ? lastBs.monsters || [] : [];

  queue.forEach((row, i) => {
    setTimeout(() => {
      if (el) {
        const rowEl = buildQueueRow(row, monsters, lastBs, false);
        rowEl.classList.add('queue-row-slide-in');
        el.appendChild(rowEl);
      }
    }, i * 200);
  });

  const totalDelay = (queue.length * 200) + 350;
  setTimeout(() => {
    renderFeed([]);
    // PC-91: Advance through approach phase until first decision point.
    // tickLoop handles pacing, feed narration, queue updates, and only shows
    // the action menu when a hand is Ready.
    if (currentRunId) {
      tickLoop(currentRunId).catch(err => console.error('tickLoop ceremony:', err));
    } else {
      renderActionMenu(lastBs);
    }
  }, totalDelay);
}

function renderPlayerHP(runOrState) {
  // Update HP text via #hp-value span (does not blow away sibling bar element)
  const valEl = document.getElementById('hp-value');
  // API exposes player_hp (numeric) only — no player hp_word. Design shows numbers.
  const hpVal = (runOrState && typeof runOrState.player_hp === 'number') ? runOrState.player_hp : null;
  const hpColor = '#fff'; // white reads cleanly on both red fill and black bg
  if (valEl) {
    valEl.style.color = hpColor;
    valEl.textContent = `HP: ${hpVal === null ? '—' : hpVal}`;
  }

  // HP bar: red fill = current HP (width %), black bg = missing HP
  const fillEl = document.getElementById('hp-bar-fill');
  if (fillEl) {
    let maxHp = runOrState && typeof runOrState.max_hp === 'number' ? runOrState.max_hp : null;
    if (maxHp === null && runOrState && runOrState.battle_state && runOrState.battle_state.player) {
      maxHp = runOrState.battle_state.player.max_hp;
    }
    const pct = (hpVal !== null && maxHp && maxHp > 0)
      ? Math.min(100, Math.max(0, (hpVal / maxHp) * 100))
      : 100;
    fillEl.style.width = pct + '%';
  }
}

function renderLoadout(bs) {
  const wl = bs.weapons || {};
  const lh = document.getElementById('loadout-lh');
  const rh = document.getElementById('loadout-rh');
  if (lh) lh.textContent = (wl.hand_l && wl.hand_l.name) || '—';
  if (rh) rh.textContent = (wl.hand_r && wl.hand_r.name) || '—';
}

async function animateQueueSpaceCreation(added, queueEl, preset) {
  if (!added || added.length === 0 || !queueEl) return;
  await playInsertCeremony(added, preset, null);
}

// PC-64: tic-0 countdown to the first decision point — theater over the
// authoritative state. Replays the approach: rows decrement per step, fires
// reveal their feed lines and HP/rail updates in order, then the real state
// snaps in and onDone() opens the command window.
function playIntroCountdown(bs, intro, onDone) {
  document.body.classList.remove('queue-filling'); // timing track appears
  const el = document.getElementById('queue');
  if (el) el.innerHTML = '';
  const monsters = bs.monsters || [];
  const rail = intro.rows.map(r => ({ label: r.label, event: r.event, tics: r.tics }));
  const ordered = sortQueueRows(rail);
  for (const row of ordered) {
    if (el) el.appendChild(buildQueueRow(row, monsters, bs, false));
  }
  renderPlayerHP({ player_hp: intro.hpStart });
  const battleLabel = document.getElementById('battle-label');
  if (battleLabel) battleLabel.textContent = battleLabel.textContent.replace(/— TIC \d+$/, '— TIC 0');

  const total = bs.tic || 0;
  if (total > 60 || !Array.isArray(intro.fires)) {
    // Defensive: unreasonably long countdown (or malformed intro) — snap to real state.
    finishIntroSnap(bs, onDone);
    return;
  }
  const dwell = Math.max(60, Math.min(600, Math.round(4500 / Math.max(total, 1))));
  let k = 0;
  clearIntroTimer();
  introTimer = setInterval(() => {
    k++;
    // Decrement every visible row's tics (floor 0).
    for (const row of ordered) {
      if (row.tics > 0) row.tics--;
    }
    // Reveal fires for the tic that just elapsed (pre-increment tic k-1), in order.
    const fires = (intro.fires || []).filter(f => f.tic === k - 1);
    for (const f of fires) {
      appendFeedLine(f.line);
      renderPlayerHP({ player_hp: f.hp, max_hp: bs.player.max_hp });
      if (f.after) {
        const row = ordered.find(r => r.label === f.label);
        if (row) {
          row.tics = f.after.tics;
          if (f.after.event) row.event = f.after.event;
        }
      } else {
        const idx = ordered.findIndex(r => r.label === f.label);
        if (idx !== -1) ordered.splice(idx, 1);
      }
    }
    addRenderedFeedLines(fires.length); // intro fires are feed lines — keep the diff counter in sync
    // Re-render the rail from the mirror so decrements + after-effects show.
    if (el) {
      el.innerHTML = '';
      for (const row of sortQueueRows(ordered)) {
        el.appendChild(buildQueueRow(row, monsters, bs, false));
      }
    }
    if (battleLabel) battleLabel.textContent = battleLabel.textContent.replace(/— TIC \d+$/, `— TIC ${k}`);
    if (k >= total) {
      clearIntroTimer();
      finishIntroSnap(bs, onDone);
    }
  }, dwell);
}

function clearIntroTimer() {
  if (introTimer) {
    clearInterval(introTimer);
    introTimer = null;
  }
}

function finishIntroSnap(bs, onDone) {
  renderQueue(bs); // real rows replace the mirrored DOM
  const feed = bs.feed || [];
  // PC-70: the snap re-narrates the FULL battle history (fires already played
  // with their shakes during the countdown) — suppress feedback so history
  // does not re-shake; only NEW lines react after the snap.
  suppressHitFeedback = true;
  const done = () => { suppressHitFeedback = false; if (onDone) onDone(); };
  const preset = getSpeedPreset();
  if (preset.charMs === 0) {
    renderFeed(feed);
    done();
    return;
  }
  // PC-DEC-044: hold onDone until typing completes; reset path in renderFeed clears for from-the-top reveal
  // always type the FULL feed (after placeholder) for intro snap
  if (feed.length > 0) {
    // clear any prior content (placeholder + any revealed) so we type the full post-reset feed
    const box = document.getElementById('message-box');
    if (box) box.innerHTML = '';
    setRenderedFeedLines(0); // full-feed re-type starts from the top
    typeFeedLines(feed, done, setBusy, handleHitLine);
    setRenderedFeedLines(feed.length);
  } else {
    done();
  }
}

function showAdvanceUI(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  setRenderedFeedLines(0);
  const actionWrap = document.getElementById('action-choices');
  if (actionWrap) actionWrap.innerHTML = '';

  // PC-XX: loss screen when player is dead
  if (state.player_dead) {
    showLossScreen(runId, state);
    return;
  }

  // Full-screen overlay modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:1000;font-family:"Pixeloid Mono","Courier New",monospace;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:#0a1a2e;border:2px solid #4a90d9;border-radius:4px;padding:20px;max-width:520px;width:90%;color:#e0f0ff;box-shadow:0 0 20px rgba(74,144,217,0.3);';

  // Header (populated with real values once the run is fetched)
  const header = document.createElement('div');
  header.style.cssText = 'text-align:center;margin-bottom:12px;font-size:14px;letter-spacing:1px;';
  header.innerHTML = '⚔ BATTLE COMPLETE ⚔';
  panel.appendChild(header);

  // Fetch run for prize_pool + tiers (async populate)
  let runData = null;
  let tiers = [];
  let currentTier = null;

  const content = document.createElement('div');
  content.innerHTML = '<div style="text-align:center;color:#88aadd;">Loading loot pool...</div>';
  panel.appendChild(content);

  // Fetch run and template
  (async () => {
    try {
      const runJson = await apiCall(`/runs/${runId}`);
      runData = runJson.run || runJson;
      header.innerHTML = `⚔ BATTLE ${runData.current_battle || '?'} OF ${runData.total_battles || '?'} COMPLETE ⚔<br>HP: ${runData.player_hp ?? state.player?.hp ?? 0}/${runData.max_hp ?? state.player?.max_hp ?? 1000}`;
      tiers = (runData.stop_share_tiers && Array.isArray(runData.stop_share_tiers) && runData.stop_share_tiers.length > 0)
        ? runData.stop_share_tiers
        : [
          {gold_pct: 0.20, sel_items: 0, rand_items: 0},
          {gold_pct: 0.20, sel_items: 0, rand_items: 1},
          {gold_pct: 0.30, sel_items: 1, rand_items: 1},
          {gold_pct: 0.60, sel_items: 1, rand_items: 2},
          {gold_pct: 0.80, sel_items: 2, rand_items: 2}
        ];
      const battleNum = runData ? (runData.current_battle || 1) : 1;
      const totalB = runData ? (runData.total_battles || 5) : 5;
      const idx = Math.max(0, Math.min(battleNum - 1, tiers.length - 1));
      currentTier = tiers[idx] || tiers[tiers.length-1];
      renderLootUI();
    } catch (e) {
      content.innerHTML = '<div style="color:#ff6666;">Failed to load loot data</div>';
    }
  })();

  function renderLootUI() {
    if (!runData) return;
    const pp = runData.prize_pool || { gold: 0, weapon_ids: [], lp_earned: 0 };
    const goldPct = currentTier ? currentTier.gold_pct : 0.2;
    const sel = currentTier ? currentTier.sel_items : 0;
    const rand = currentTier ? currentTier.rand_items : 0;
    const isLast = (runData.current_battle || 1) >= (runData.total_battles || 5);

    content.innerHTML = `
      <div style="border-top:1px solid #4a90d9;border-bottom:1px solid #4a90d9;padding:10px 0;margin:10px 0;font-size:13px;">
        <div style="margin-bottom:6px;color:#aaddff;">─── LOOT POOL ───</div>
        <div>Gold: <span style="color:#ffcc66;">${pp.gold || 0}</span></div>
        <div>Weapons: <span style="color:#aaddff;">${(pp.weapon_ids || []).length}</span></div>
        <div>LP Earned: <span style="color:#88ffaa;">${pp.lp_earned || 0}</span></div>
      </div>
      <div style="margin:10px 0;font-size:13px;">
        If you extract now:<br>
        Take: <span style="color:#ffcc66;">${Math.floor((pp.gold||0)*goldPct)} gold</span> (${Math.round(goldPct*100)}%)<br>
        Weapons: ${sel + rand}<br>
        <span style="color:#88aadd;font-size:11px;">(Battle ${runData.current_battle || 1} — ${isLast ? 'full extraction' : 'tiered extraction'})</span>
      </div>
      <div style="margin:10px 0;color:#ffaa66;font-size:12px;">──── OR ────<br>Risk it all for the full pool</div>
    `;

    // Weapon selection if sel_items > 0
    let selectedIds = [];
    const weaponsDiv = document.createElement('div');
    weaponsDiv.style.cssText = 'margin:8px 0;';
    if (sel > 0 && Array.isArray(pp.weapon_ids) && pp.weapon_ids.length > 0) {
      // Build id -> weapon-name map from prize_weapons (fall back to #id)
      const nameById = {};
      (runData.prize_weapons || []).forEach(w => { nameById[w.id] = w.name; });
      weaponsDiv.innerHTML = `<div style="color:#aaddff;margin-bottom:4px;">Select up to ${sel} weapons:</div>`;
      pp.weapon_ids.forEach(wid => {
        const wEl = document.createElement('div');
        wEl.textContent = nameById[wid] || `Weapon #${wid}`;
        wEl.style.cssText = 'display:block;margin:3px 0;padding:4px 8px;border:1px solid #4a90d9;cursor:pointer;font-size:12px;border-radius:2px;';
        wEl.onclick = () => {
          const isSel = selectedIds.includes(wid);
          if (isSel) {
            selectedIds = selectedIds.filter(id => id !== wid);
            wEl.style.border = '1px solid #4a90d9';
            wEl.style.background = 'transparent';
            wEl.style.boxShadow = 'none';
          } else if (selectedIds.length < sel) {
            selectedIds.push(wid);
            wEl.style.border = '2px solid #66ff99';
            wEl.style.background = '#112a44';
            wEl.style.boxShadow = '0 0 6px rgba(102,255,153,0.3)';
          }
        };
        weaponsDiv.appendChild(wEl);
      });
      content.appendChild(weaponsDiv);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:16px;';

    const extractBtn = document.createElement('button');
    extractBtn.textContent = 'EXTRACT & LEAVE';
    extractBtn.className = 'action-btn';
    extractBtn.style.cssText = 'background:#1a5a1a;color:#66ff99;border-color:#66ff99;';
    extractBtn.onclick = async () => {
      if (busy) return;
      setBusy(true);
      extractBtn.disabled = true;
      try {
        const payload = { choice: 'stop', selected_weapon_ids: selectedIds };
        const res = await apiCall(`/runs/${runId}/battle/end`, 'POST', payload);
        // Show extraction summary
        content.innerHTML = `
          <div style="text-align:center;color:#66ff99;margin:12px 0;">You extracted with:</div>
          <div style="border:1px solid #4a90d9;padding:8px;margin:8px 0;font-size:13px;">
            Gold: ${res.awarded_pool?.gold || 0}<br>
            Weapons: ${(res.awarded_pool?.weapon_ids || []).length}<br>
            LP: ${res.awarded_pool?.lp_earned || 0}
          </div>
        `;
        const townBtn = document.createElement('button');
        townBtn.textContent = 'Return to town';
        townBtn.className = 'action-btn';
        townBtn.style.cssText = 'background:#1a3a5a;color:#88ccff;';
        townBtn.onclick = () => { window.location.href = '/game.html'; };
        content.appendChild(townBtn);
      } catch (e) {
        showMessage(e.message, true);
        setBusy(false);
        extractBtn.disabled = false;
      }
    };

    const fightBtn = document.createElement('button');
    fightBtn.textContent = 'FIGHT ON';
    fightBtn.className = 'action-btn';
    fightBtn.style.cssText = 'background:#5a1a1a;color:#ff6666;border-color:#ff6666;';
    fightBtn.onclick = async () => {
      if (busy) return;
      setBusy(true);
      fightBtn.disabled = true;
      try {
        await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'continue' });
        overlay.remove();
        const mbox = document.getElementById('message-box');
        if (mbox) mbox.innerHTML = '';
        setRenderedFeedLines(0);
        showMessage('Advancing to next battle...');
        shouldAnimateDice = true;
        await loadBattle(runId);
      } catch (e) {
        showMessage(e.message, true);
      }
      setBusy(false);
    };

    btnRow.appendChild(extractBtn);
    btnRow.appendChild(fightBtn);
    content.appendChild(btnRow);

    // footer note
    const note = document.createElement('div');
    note.style.cssText = 'margin-top:12px;font-size:10px;color:#6688aa;text-align:center;';
    note.textContent = '(Extract = stop & keep share) (Die = lose everything)';
    content.appendChild(note);
  }

  overlay.appendChild(panel);
  // Append overlay to body so it is truly full screen above everything
  document.body.appendChild(overlay);

  // Also keep message-box clean
  box.appendChild(document.createElement('div')); // placeholder
}

/**
 * PC-XX: Loss/defeat screen shown when the player dies in battle.
 * Calls battle/end (stop) server-side to finalize the run with 'dead' status,
 * then shows defeat message + Return to Town link.
 */
function showLossScreen(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'msg-line loss-panel';
  panel.innerHTML = `<strong style="color:#ff4444;">You have been defeated.</strong><br>
    <span style="color:#999;">The run is over. No loot is earned.</span>`;

  const returnBtn = document.createElement('button');
  returnBtn.textContent = 'Return to Town';
  returnBtn.className = 'action-btn';
  returnBtn.style.marginTop = '12px';
  returnBtn.onclick = () => {
    window.location.href = '/game.html';
  };

  panel.appendChild(returnBtn);
  box.appendChild(panel);

  // Fire-and-forget: end the run server-side in the background.
  // The button navigates away regardless, so silence any errors.
  apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' }).catch(() => {});
}

async function doAttack(runId, hand, attackId, targetIds) {
  debugLog('doAttack', `hand=${hand} attack=${attackId} n_targets=${targetIds?.length || 0}`);
  if (busy) return;
  setBusy(true);
  try {
    const payload = { hand, attack_id: attackId, target_ids: targetIds || [] };
    await apiCall(`/runs/${runId}/commit`, 'POST', payload); // returns {committed: true}
    pendingAttack = null;
    // Hide the action menu — it will re-render on tickLoop break with fresh state
    const menuWrap = document.getElementById('action-choices');
    if (menuWrap) menuWrap.style.display = 'none';
    enterMasterClock();
    try {
      await playCommitArrival(runId);
    } catch (err) {
      console.error('commit ceremony:', err);
    }
    await tickLoop(runId);
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('Hand not ready')) {
      showMessage('Hand not ready — waiting engine advance');
    } else {
      showMessage(msg, true);
    }
  } finally {
    leaveMasterClock();
  }
  setBusy(false);
}

async function doSwap(runId, hand) {
  debugLog('doSwap', `hand=${hand}`);
  if (busy) return;
  setBusy(true);
  try {
    const data = await apiCall(`/runs/${runId}/swap`, 'POST', { hand });
    showMessage(`Belt swap (${hand}) — cooldown ${data.delay != null ? data.delay : ''} tics`);
    pendingAttack = null;
    const menuWrap = document.getElementById('action-choices');
    if (menuWrap) menuWrap.style.display = 'none';
    enterMasterClock();
    try {
      await playCommitArrival(runId);
    } catch (err) {
      console.error('commit ceremony:', err);
    }
    await tickLoop(runId);
  } catch (e) {
    showMessage(String(e.message || e), true);
  } finally {
    leaveMasterClock();
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
  debugLog('renderActionMenu', `n_hands=${Object.keys(bs.player?.hands || {}).length} n_monsters=${(bs.monsters||[]).filter(m=>!m.dead).length}`);
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
      const approachOrWindingRow = queue.find(q => (q.event === 'winding' || q.event === 'approach') && q.label === h);
      const row = approachOrWindingRow;
      return `${h} — ${row ? row.event : 'winding'}${row && row.tics != null ? ' ' + row.tics + ' tics' : ''}`;
    }).filter(Boolean).join('  ·  ') || 'No hand ready';
    wrap.appendChild(status);
    return;
  }

  const hand = readyHands[0];
  const w = weapons[hand === 'LH' ? 'hand_l' : 'hand_r'];
  const handLineText = hand === 'LH' ? 'L.HAND' : 'R.HAND';

  function potionFor(slot) {
    return potions[slot === 'A' ? 'potion_a' : 'potion_b'] || potions[slot] || null;
  }

  function showInfo(text) {
    const ar = document.getElementById('action-readout');
    if (ar) ar.innerHTML = text || '';
  }

  function attackInfo(a, weapon) {
    const src = weapon || w || {};
    const base = src.base_damage != null ? src.base_damage : (src.damage || 0);
    const range = src.damage_range != null ? src.damage_range : 0;
    const multi = a.is_multi_target ? ' <span style="color:#ffaa66">[MULTI]</span>' : '';
    const desc = a.description ? ` — ${escHtml(a.description)}` : '';
    const weaponSpeed = src.speed || 0;
    const pBase = (a.prepare_time || 0) + weaponSpeed;
    const pVar = a.prepare_time_range || 0;
    const cBase = (a.cooldown_time || 0) + weaponSpeed;
    const cVar = a.cooldown_time_range || 0;
    const pText = pVar > 0 ? `${pBase}-${pBase + pVar}` : `${pBase}`;
    const cText = cVar > 0 ? `${cBase}-${cBase + cVar}` : `${cBase}`;
    let h = `<div style="display:flex;flex-direction:column;gap:1px;width:100%;">`;
    h += `<div style="color:#ffcc66;font-weight:bold;white-space:nowrap;">${escHtml(a.name)}${multi}</div>`;
    h += `<div style="display:flex;flex-direction:column;gap:0;line-height:1.4;">`;
    h += `<div><span style="color:#7a8ca6;">Damage:</span> ${base}±${range}</div>`;
    h += `<div><span style="color:#7a8ca6;">Windup:</span> ${pText}t</div>`;
    h += `<div><span style="color:#7a8ca6;">Cooldown:</span> ${cText}t</div>`;
    h += `</div>`;
    if (desc) h += `<div style="color:#556677;font-size:11px;margin-top:2px;">${desc}</div>`;
    h += `</div>`;
    return h;
  }

  function setMarkers(attack) {
    const q = (lastBs && lastBs.queue) || [];
    setQueueBarInfo(computeTimingMarkers(q, attack, (w && w.speed) || 0));
    renderQueue(lastBs);
  }
  function clearMarkers() {
    clearQueueBarInfo();
    renderQueue(lastBs);
  }

  // ---- cascade stack: levels { kind: action|target|confirm, rows, activeIdx } ----
  // Cascade geometry (PC-DEC-043; shared/CascadeIssue.png "Desired"): every window
  // renders at the SAME box size — the tallest window's natural height, capped to
  // the root — so the fixed down-right step produces an even staircase: each window
  // overlaps the parent by a uniform amount. Per Spahrep 2026-09-17 the steps are
  // kept small because a parent's rows are obsolete once you advance ("you really
  // dont need to see it, so it can overlap the words too") — only the parent's
  // hand tab stays visible. No size-mismatch gaps.
  const CASCADE_STEP_X = 96; // px right per level — parent's left sliver stays readable
  const CASCADE_STEP_Y = 26; // px down per level — parent's hand tab stays visible; rows may be covered
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
    const weapon = (w && w.id) ? w : (weapons && weapons.fist) || null;
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
      kind: 'confirm',
      slot,
      text: `Use <strong>${escHtml(p.template_name)}</strong> (${escHtml(p.effect_label || '')})?`,
      rows: yesNoRows(() => usePotion(currentRunId, slot))
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
    const wins = [];
    stack.forEach((lvl, i) => {
      if (lvl.activeIdx == null) lvl.activeIdx = 0; // every window opens with row 0 selected
      const win = document.createElement('div');
      win.className = 'dw-window' + (i === topIdx ? ' top' : '');
      win.style.left = (i * CASCADE_STEP_X) + 'px';
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
          el.onmouseenter = () => { if (!keyboardActive && lvl.activeIdx !== ri) { lvl.activeIdx = ri; renderStack(); } };
        }
        win.appendChild(el);
      });
      root.appendChild(win);
      wins.push(win);
    });
    // Uniform cascade box: size every window to the tallest natural height so the
    // down-right steps form an even staircase (no mismatched sizes, no gaps).
    // Capped to the root's own height so the stack never spills onto the footer.
    const boxH = Math.min(
      root.clientHeight || 236,
      Math.max(0, ...wins.map(win => win.offsetHeight))
    );
    wins.forEach((win, i) => {
      win.style.height = boxH + 'px';
      win.style.top = (i * CASCADE_STEP_Y) + 'px';
    });
    paintReadout();
    // Position the attack-info readout to the right of the cascade stack
    const readout = document.getElementById('action-readout');
    if (readout) {
      const cascadeRight = 12 + (Math.max(0, stack.length - 1) * 96) + 316;
      readout.style.left = (cascadeRight + 8) + 'px';
      readout.style.top = '0px';
    }
  }

  // Footer info + '>' timing markers track the TOP window's selection.
  function paintReadout() {
    const top = stack[stack.length - 1];
    if (!top) { showInfo(''); clearMarkers(); return; }
    if (top.kind === 'action') {
      const row = top.rows[top.activeIdx];
      showInfo(row.info || '');
      if (row.attack) {
        if (row.beltSwap) {
          // Belt swap: flat delay, no weapon-speed offset
          const q = (lastBs && lastBs.queue) || [];
          setQueueBarInfo(computeTimingMarkers(q, row.attack, 0));
          renderQueue(lastBs);
        } else {
          setMarkers(row.attack);
        }
      } else if (row.potionTiming) {
        // Potion: prepare_time already includes weapon speed via potionPrePostTicks
        const q = (lastBs && lastBs.queue) || [];
        setQueueBarInfo(computeTimingMarkers(q, row.potionTiming, 0));
        renderQueue(lastBs);
      } else {
        clearMarkers();
      }
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
    const fistW = weapons.fist;
    if (fistW && fistW.attacks && fistW.attacks.length > 0) {
      const fist = fistW.attacks[0];
      rootRows.push({
        html: escHtml(fist.name),
        info: attackInfo(fist, fistW),
        attack: fist,
        enter() { pickTarget(fist); }
      });
    } else {
      // degrade without any numbers if server did not provide fist profile
      const attack = { id: 1, name: 'Fist (unarmed)', is_multi_target: false, description: '' };
      rootRows.push({
        html: 'Fist (unarmed)',
        info: '<strong>Fist (unarmed)</strong>',
        attack,
        enter() { pickTarget(attack); }
      });
    }
  }
  rootRows.push({ blank: true });
  ['A', 'B'].forEach(slot => {
    const p = potionFor(slot);
    const used = p && p.used;
    if (!p) {
      rootRows.push({ html: `Pouch ${slot}: <span class="dw-dim">empty</span>`, info: `Pouch ${slot}: no potion in this slot`, disabled: true });
      return;
    }
    if (used) {
      rootRows.push({ html: `${escHtml(p.template_name)} <span class="dw-dim">(USED)</span>`, info: `Pouch ${slot}: already used`, disabled: true });
      return;
    }
    rootRows.push({
      html: escHtml(p.template_name),
      info: `Pouch ${slot}: ${escHtml(p.template_name)} · ${escHtml(p.effect_label || '')}<br>`
        + `<span style="color:#7a8ca6;">Windup:</span> ${potionPrePostTicks((w && w.speed) || 0, p.rolled_speed || 0)}t`,
      potionTiming: {
        prepare_time: potionPrePostTicks((w && w.speed) || 0, p.rolled_speed || 0),
        prepare_time_range: 0,
        name: escHtml(p.template_name)
      },
      enter() { pickPotion(slot, p); }
    });
  });
  rootRows.push({ blank: true });
  const swapDelay = belt && belt.id && w && w.id ? Math.max((w.speed || 2), (belt.speed || 2)) : null;
  rootRows.push({
    html: `Belt Loop: <span class="${belt && belt.id ? 'dw-weapon' : 'dw-dim'}">${escHtml(belt && belt.id ? belt.name : 'none')}</span>`,
    info: belt && belt.id
      ? `Belt swap (${hand}): swap ${escHtml(belt.name)} into hand · ${swapDelay} tics equip delay`
      : 'No belt weapon equipped',
    disabled: !belt || !belt.id,
    beltSwap: true,
    attack: belt && belt.id ? { prepare_time: swapDelay, prepare_time_range: 0, name: 'Belt Swap' } : null,
    enter() { if (belt && belt.id) pickEquip(); }
  });
  stack.push({ kind: 'action', tab: handLineText, rows: rootRows, activeIdx: 0 });

  renderStack();
  clearMarkers(); // PC-56: initial render shows action info but no prediction bar until user hovers/clicks

  // keyboard: Up/Down move the cursor (skips blank/disabled rows), Enter selects,
  // Esc backs one window (root: no-op). Only the top window responds.
  let keyboardActive = false;

  // When the mouse actually moves (not just sits), re-enable hover selection.
  document.addEventListener('mousemove', () => { keyboardActive = false; }, { once: false });

  document.onkeydown = (e) => {
    if (busy) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyboardActive = true;
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
    enterMasterClock();
    try {
      await playCommitArrival(runId);
    } catch (err) {
      console.error('commit ceremony:', err);
    }
    await tickLoop(runId);
  } catch (e) {
    showMessage(e.message, true);
  } finally {
    leaveMasterClock();
  }
  setBusy(false);
}

async function loadBattle(runId) {
  debugLog('loadBattle', `runId=${runId}`);
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
    const bs = run.battle_state || {};
    const prevBs = lastBs;
    lastBs = bs;
    clearQueueBarInfo(); // PC-56: fresh battle state — no selection, no markers
    // Capture BEFORE renderDice — the animation path clears the flag.
    // Ceremony-intro: the command window and timing track are part of the same
    // ceremony — they stay hidden until the dice and monster typewriter finishes.
    const willRoll = shouldAnimateDice
      && !!(bs.dice && bs.dice.current && bs.dice.current.color && bs.dice.current.face != null);
    debugLog('loadBattle', `willRoll=${willRoll} shouldAnimateDice=${shouldAnimateDice} dice_current=${!!(bs.dice?.current)}`);
    monstersPendingReveal = willRoll;
    battleIntroPending = willRoll;
    if (!willRoll) shouldAnimateDice = false; // no roll playing — consume the flag
    // PC-64: the tic-0 countdown only plays when the ceremony runs AND the engine
    // captured fires (a battle that started pre-PC-64 has no intro to replay).
    const introPlays = battleIntroPending && bs.intro?.fires?.length > 0;
    if (battleLabel) {
      const cb = run.current_battle || 1;
      const tb = run.total_battles || 1;
      const bsTic = introPlays ? 0 : ((bs.tic != null) ? bs.tic : 0);
      battleLabel.textContent = `BATTLE ${cb} OF ${tb} — TIC ${bsTic}`;
    }

    if (introPlays) {
      // PC-64: show the pre-advance state — full HP; message log stays blank
      // during the ceremony (dice → populate monsters → action queue). Feed
      // renders only after the ceremony finishes (see finishBattleIntro).
      renderPlayerHP({ player_hp: bs.intro.hpStart });
    } else {
      renderPlayerHP(run);
    }
    // If a ceremony intro is pending, force the message box completely empty
    // so no old text bleeds through the ceremony phase. Feed is
    // populated later in finishBattleIntro (intro fires → playIntroCountdown;
    // no fires → renderFeed([])).
    if (battleIntroPending) {
      const msgBox = document.getElementById('message-box');
      if (msgBox) { msgBox.innerHTML = ''; }
      setRenderedFeedLines(0);
    }
    renderDice(bs.dice || {});
    renderMonsters(bs.monsters || []);
    renderLoadout(bs);
    if (battleIntroPending) {
      // Ceremony-intro: die still rolling — command window + timing track stay hidden.
      document.body.classList.add('intro-pending', 'queue-filling');
    } else {
      renderActionMenu(bs);
      // PC-DEC-045c: fresh page load in a mid-battle run shows history instantly;
      // incremental commit updates typewriter new lines.
      // prevBs distinguishes: on fresh page prevBs is null, on commit it's set.
      //
      // For commit updates, the queue render is deferred until the typewriter
      // finishes so the queue doesn't appear frozen at the end-state while the
      // feed narrates events that led to that state.
      if (prevBs) {
        const diff = diffQueueForAnimation(prevBs, bs);
        diff.readyCommits = findReadyCommits(prevBs.queue || [], bs.queue || []);
        diff.addedRows = (bs.queue || []).filter(r => (diff.added || []).some(a => a.id === r.id));
        // Pin the departing head through narration — no exit slide until the clock resolves.
        const pinned = (prevBs.queue || []).find(r => r.id === diff.resolved[0]);
        if (pinned) pinProcessedHead(pinned);
        battleClock.start(diff, bs, () => {
          renderQueue(bs);
        });
      }
      const feedCb = (battleClock.state !== 'IDLE') ? () => battleClock.onNarrateDone() : null;
      if (!prevBs && getRenderedFeedLines() === 0 && bs.feed && bs.feed.length > 0) {
        populateFeedInstantly(bs.feed);
        if (feedCb) feedCb();
      } else {
        renderFeed(bs.feed || [], feedCb);
      }
      // Queue rendered through battleClock for commits; fresh page / intro renders immediately
      if (!prevBs) renderQueue(bs);
      // Bug 2: staggered entry animations on fresh page loads (cascade effect)
      if (!prevBs) {
        const nqEl = document.getElementById('queue');
        if (nqEl) {
          Array.from(nqEl.children).forEach((row, i) => {
            setTimeout(() => {
              const isMonRow = row.querySelector('.name')?.textContent?.includes("'s ");
              const cls = isMonRow ? 'queue-row-monster-enter' : 'queue-row-enter';
              row.classList.add(cls);
              const timeout = isMonRow ? 450 : QUEUE_ENTER_MS + 80;
              waitForEvent(row, 'animationend', timeout).then(() => {
                row.classList.remove('queue-row-enter', 'queue-row-monster-enter');
              });
            }, i * 100);
          });
        }
      }
    }


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
  // PC follow-up: global playerName for queue labels
  const hudNameEl = document.getElementById('hud-name');
  playerName = hudNameEl ? hudNameEl.textContent : 'Player';

  const params = new URLSearchParams(window.location.search);
  const runId = params.get('id');
  if (!runId) {
    showErrorState('Missing run ID', 'Add ?id=NNN to the URL.', true);
    return;
  }

  // PC-72: the die ceremony plays only on a genuine first entry — the marker is
  // set by run-equip right before navigating to a NEW run. Any other load
  // (returning to a battle after exiting part way, a reload, a reopened tab, a
  // direct URL) is a resume: no roll animation, no re-typed history — the page
  // puts the player right back where they were.
  const freshKey = `pc_fresh_entry_${runId}`;
  const freshEntry = sessionStorage.getItem(freshKey) === '1';
  sessionStorage.removeItem(freshKey);
  shouldAnimateDice = freshEntry; // run start transition (fresh entry only)
  await loadBattle(runId);
  setupEndRunButton(runId);

  // PC-DEC-044: wire TEXT SPEED cycling control (now via controller)
  const speedEl = document.getElementById('text-speed');
  if (speedEl) {
    const SPEED_CYCLE = ['normal', 'slow', 'instant'];
    speedEl.onclick = () => {
      const current = getSpeedKey();
      const idx = SPEED_CYCLE.indexOf(current);
      const next = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length] || 'normal';
      setSpeed(next);
    };
    // initial label
    const p = getSpeedPreset();
    speedEl.textContent = `TEXT SPEED: ${p.label}`;
  }

  // Speed subscriber: update UI label on external changes
  onSpeedChange((key) => {
    const p = getSpeedPreset();
    if (speedEl) speedEl.textContent = `TEXT SPEED: ${p.label}`;
  });

  // Font size subscriber + initial class on .queue-panel
  onFontSizeChange((key) => {
    const panel = document.querySelector('.queue-panel');
    if (panel) {
      panel.classList.remove('queue-size-S', 'queue-size-M', 'queue-size-L');
      panel.classList.add(`queue-size-${key}`);
    }
  });
  const panel = document.querySelector('.queue-panel');
  if (panel) {
    panel.classList.remove('queue-size-S', 'queue-size-M', 'queue-size-L');
    panel.classList.add(`queue-size-${getFontSizeKey()}`);
  }

  // PC-DEC-044: click message log to instantly complete pending typing
  const msgBox = document.getElementById('message-box');
  if (msgBox) {
    msgBox.onclick = () => {
      if (isTypingInProgress()) {
        clearTyping();
      }
    };
    // DO-2 scroll-pinning: toggle pinned flag; typing only auto-scrolls while pinned
    msgBox.addEventListener('scroll', () => {
      const atBottom = msgBox.scrollTop + msgBox.clientHeight >= msgBox.scrollHeight - 8;
      setFeedPinned(atBottom);
    });
  }
}

async function tickLoop(runId) {
  debugLog('tickLoop', `runId=${runId}`);
  const outer = masterClockDepth === 0;
  enterMasterClock();
  try {
    let oldQueue = lastBs?.queue ? [...lastBs.queue] : [];
    while (true) {
      // Inter-tick pacing so each event is readable. Not a preview/entry barrier.
      const preset = getSpeedPreset();
      if (preset.charMs > 0) {
        const tickPacing = Math.min(500, Math.max(150, Math.round(preset.lineDelayMs / 3)));
        await new Promise(r => setTimeout(r, tickPacing));
      }

      // PC-DEC-045e: fetch full run state in parallel with tick so render
      // functions have monsters, player, weapons, dice, potions available.
      const [data, fullRun] = await Promise.all([
        apiCall(`/runs/${runId}/tick`, 'POST'),
        apiCall(`/runs/${runId}`, 'GET')
      ]);
      const tickState = data.state || {};
      const rich = (fullRun.run && fullRun.run.battle_state) || fullRun.battle_state || {};
      const bs = {
        ...rich,
        queue: tickState.queue || rich.queue || [],
        player: tickState.player || rich.player,
        feed: tickState.feed || rich.feed || [],
        tic: tickState.tic ?? rich.tic ?? 0,
        battle_over: tickState.battle_over,
        player_dead: tickState.player_dead,
        player_hp: tickState.player?.hp ?? fullRun.player_hp ?? rich.player?.hp ?? 0,
        max_hp: tickState.player?.max_hp ?? fullRun.max_hp ?? rich.player?.max_hp ?? 100
      };
      const processedHead = data.result?.row || null;
      const newQueue = bs.queue || [];

      // Processed head stays pinned through narration + visuals. Do not
      // renderQueue (which would drop it) until both have finished.
      pinProcessedHead(processedHead);

      const deathBefore = new Set(deathCards.keys());
      renderPlayerHP(bs);
      renderMonsters(bs.monsters || []);
      renderLoadout(bs);

      // Typewriter starts first (it kicks hit feedback), then both are awaited.
      const narrateP = awaitNarration(bs.feed);
      const visualsP = awaitTickVisuals(deathBefore);
      await Promise.all([narrateP, visualsP]);

      // removeHead LAST — fired head slides out + queue glides up.
      // Ready pauses are not a fired head. Same-key successors stay same-key.
      await animateFiredHeadExit(processedHead, newQueue, bs);

      const oldKeys = new Set(oldQueue.map(queueRowKey));
      const newKeys = new Set(newQueue.map(queueRowKey));
      const processedKey = processedHead ? queueRowKey(processedHead) : null;
      const readyCommits = findReadyCommits(oldQueue, newQueue);

      // Genuine non-head removals still slide out + group-lift.
      const nonHead = oldQueue.filter(r => {
        const k = queueRowKey(r);
        if (processedKey && k === processedKey) return false;
        if (readyCommits.some(c => queueRowKey(c.ready) === k)) return false;
        return !newKeys.has(k);
      }).slice(0, 1);
      if (nonHead.length > 0) {
        if (animationsSkipped(preset)) {
          nonHead.forEach(r => {
            const el = findQueueRowByIdentity(r);
            if (el) el.remove();
          });
        } else {
          await runQueueRemoval(nonHead.map(r => r.id));
        }
      }

      // Attack ceremony first, then the ready placeholder slides out.
      // added stays key-based so a same-key successor is not a new insert.
      const added = newQueue.filter(r => !oldKeys.has(queueRowKey(r)));
      const ceremonyEntries = [...added, ...readyCommits.map(c => c.attack)];
      if (ceremonyEntries.length > 0) {
        await playInsertCeremony(ceremonyEntries, preset, bs, { reconcile: readyCommits.length === 0 });
      }
      for (const c of readyCommits) {
        if (animationsSkipped(preset)) {
          const el = findQueueRowByIdentity(c.ready);
          if (el) el.remove();
        } else {
          await runQueueRemoval([c.ready.id]);
        }
      }
      if (readyCommits.length > 0 || ceremonyEntries.length === 0) {
        renderQueue(bs);
      }

      lastBs = bs;
      oldQueue = [...newQueue];

      if (data.result?.playerReady || data.result?.needsInput || data.result?.done || data.result?.battleOver || bs.battle_over) {
        renderActionMenu(bs);
        if (data.result?.battleOver || bs.battle_over) {
          showAdvanceUI(runId, bs);
        }
        break;
      }
    }
  } finally {
    leaveMasterClock();
    if (outer) setBusy(false);
  }
}

init();