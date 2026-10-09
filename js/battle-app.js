/**
 * Portal Colosseum - Battle Screen Live Combat Wiring (PC-47 pass 2)
 * Wires ATTACK (via /commit), ITEM (/use-potion), battle advance (/battle/end).
 * Matches CLI payloads exactly: {hand, attack_id, target_ids:[]}, {slot}.
 * hp_word ONLY for all HP display; busy-state gating on all actions.
 * Re-renders from action responses + GET restore.
 * No console errors; errors in message box.
 */

import { supabaseClient } from '../js/utils.js';
import { fillHudName } from './session.js';
import { apiCall, checkAuth } from './combat/combat-api.js';
import { computeTimingMarkers, replaceReadyWithSuccessor, queuesMatch } from './combat/tic-queue.js';
import { getSpeedPreset, getFontSizeKey, onFontSizeChange } from './settings-controller.js';
import './battle-debug.js'; // debugLog(tag, msg) — toggled via game_config.debug in Supabase
import { bindUxController, dur } from './battle/ux-controller.js';
import {
  renderQueue, diffQueueForAnimation, markQueueRowExiting,
  buildQueueRow, updateQueueRowInPlace,
  setQueueBarInfo, clearQueueBarInfo, isQueueRowExiting,
  isMonsterQueueRow, forgetQueueRowExiting, queueEventIdentity,
} from './battle/queue-render.js';

import {
  typeFeedLines, renderFeed, populateFeedInstantly,
  appendFeedLine, awaitNarration, completeCurrentTypingLine,
  bindFeedRender, getRenderedFeedLines, setRenderedFeedLines, addRenderedFeedLines,
  isTypingInProgress, setFeedPinned
} from './battle/feed-render.js';
import {
  renderDice, bindDiceRender
} from './battle/dice-render.js';
import { renderMonsters, revealMonsters, handleHitLine, handleDeferredHit,
         bandClass, setMonstersPendingReveal, syncArenaLetters, arenaLetterOf,
         setSuppressHitFeedback, deathCards } from './battle/monster-render.js';
import { escapeHtml } from './pure-utils.js';
import { potionCommitPayload } from './battle/potion-target.js';
import { shouldPlayIntroCountdown, INTRO_COUNTDOWN_STEPS } from './battle/intro-countdown.js';
import {
  attackInfo, showInfo, buildRootActionRows,
} from './battle/action-menu-rows.js';
import {
  bindLootExit,
  ensureAdvanceOverlayStyles,
  mountOverlay,
  showAdvanceUI,
  revealRandomLoot,
  showExtractionSummary,
} from './battle/loot-exit.js';

// PC-78: feed and dice own their state. Hooks stay here (busy gate, hit
// feedback, initialization) so the new modules do not import battle-app.js.
// The landed-hit shake is bound into the UX controller. handleDeferredHit
// already refuses when suppressHitFeedback is set OR screenshake_on is false,
// so window shake, card shake, and sprite flash share that one gate.
bindUxController({ handleDeferredHit });
bindFeedRender({
  setBusy,
  handleHitLine,
  setSuppressHitFeedback,
});
bindDiceRender({
  appendFeedLine,
  revealMonsters,
  finishBattleIntro,
  getShouldAnimateDice: () => shouldAnimateDice,
  setShouldAnimateDice: (v) => { shouldAnimateDice = v; },
});

// Loot overlay owns its DOM. These two actions stay here (busy gate,
// shouldAnimateDice, loadBattle) and are bound in so loot-exit.js does
// not import battle-app.js.
bindLootExit({ extractAndLeave, fightOn });


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

  /** Phase 1: successor slides in first, then resolved rows slide out.
   * The head stayed pinned through narration; exit is the last action. */
  async _runResolve() {
    const { _diff: diff } = this;
    const queueEl = document.getElementById('queue');

    if (!queueEl || diff.resolved.length === 0) {
      await this._runInsert();
      return;
    }

    // Insert first. Departing rows stay in the DOM until the exit below.
    this._holdDeparting = true;
    await this._renderNew();
    this._holdDeparting = false;

    const still = diff.resolved.filter(id => {
      const el = queueEl.querySelector(`[data-row-id="${id}"]`);
      return el && !el.classList.contains('queue-row-exit');
    });
    if (still.length) await runQueueRemoval(still);
    renderQueue(this._newBs);
    this._finish();
  }

  /** Phase 2: attack row plays the arrival sequence first; the ready placeholder
   * then slides out. Never suppressed just because a removal happened
   * in the same tick. */
  async _runInsert() {
    await this._renderNew();
    this._finish();
  }

  /** Phase 3: arrival sequence (event-gated), then ready slide-out, then entry settle.
   * When a departing row still has to slide out, the insert does not reconcile
   * it away — the caller exits it after this returns. */
  async _renderNew() {
    const { _diff: diff, _newBs: newBs } = this;
    const preset = getSpeedPreset();
    const commits = diff.readyCommits || [];
    const holdDeparting = !!this._holdDeparting;

    const addedRows = diff.addedRows
      || (newBs.queue || []).filter(r => (diff.added || []).some(a => a.id === r.id));
    const arrivalEntries = [];
    const seenIds = new Set();
    for (const row of [...addedRows, ...commits.map(c => c.attack)]) {
      if (!row || row.id == null || seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      arrivalEntries.push(row);
    }

    // Id-matched adds. Pulse is post-commit only; the tick loop does not flash.
    await playQueueTransition({
      arrivalEntries,
      readyCommits: holdDeparting ? [] : commits,
      bs: newBs,
      preset,
      reconcile: holdDeparting ? false : commits.length === 0,
      pulse: true,
      holdDeparting,
    });
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
function waitForEvent(el, eventName, timeoutMs = dur('queueExit') + 50) {
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
 * Genuine-removal choreography (shared by BattleClock._runResolve and advance):
 *   1) the resolved row(s) slide fully out over dur('queueExit') (stays in flow),
 *   2) dur('queueRemoveGap') pause,
 *   3) the remaining rows FLIP up together as one unit over dur('queueExit').
 * Every passed id slides out in parallel. advance passes every non-head loss;
 * one-at-a-time callers still slice.
 * The container is left with the remaining rows at their final positions; the
 * subsequent renderQueue() reconciles by (label, event) so a tic countdown
 * is not clobbered mid-animation.
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
  await sleep(dur('queueRemoveGap')); // 2) pause (gap is non-visual timing)
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
    r.style.transition = `transform ${dur('queueExit')}ms ease-in`;
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
let masterClockDepth = 0; // >0 while advance / commit arrival owns the clock; blocks setBusy(false)
let pendingAttack = null; // {hand, attackId} for commit via re-click or Enter
let playerName = 'Player';
let shouldAnimateDice = false;

// Battle-initialization: battle initialization also gates the command window and the
// timing track — both stay hidden while the die rolls. Once the last monster has faded
// in, the timing track fills (First → last); the command window appears only after the
// track is full (the fill's onDone removes intro-pending).
let battleIntroPending = false;
let introTimer = null; // PC-64: countdown interval for the battle-intro replay
let introCountdownPlayed = false; // advance-replay plays once per genuine battle entry
let introSeenBattle = 0; // portal_run.current_battle, for the per-battle seen key

// PC-81: action-menu input is bound once. renderActionMenu publishes the live
// cascade here; both handlers read it. Binding inside renderActionMenu leaked a
// document mousemove listener and clobbered document.onkeydown on every decision.
// PC-84: this module-scope binding is the input seam. Do not move it back inside
// renderActionMenu. Row click/hover is bindActionMenuRowInput (still per painted
// row — the document listeners stay once).
let keyboardActive = false;
let actionMenuLive = null; // { stack, renderStack, selectTop, back } | null

function onActionMenuMouseMove() {
  keyboardActive = false;
}

/** Top-window row click/hover. Hover yields while an arrow key owns the cursor. */
function bindActionMenuRowInput(el, lvl, ri, renderStack, selectTop) {
  el.onclick = () => { lvl.activeIdx = ri; renderStack(); selectTop(); };
  el.onmouseenter = () => {
    if (!keyboardActive && lvl.activeIdx !== ri) { lvl.activeIdx = ri; renderStack(); }
  };
}

function onActionMenuKeyDown(e) {
  if (busy) return;
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const menu = actionMenuLive;
  if (!menu) return;
  const top = menu.stack[menu.stack.length - 1];
  if (!top) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    keyboardActive = true;
    const selectable = [];
    top.rows.forEach((r, i) => { if (!r.blank && !r.disabled) selectable.push(i); });
    if (!selectable.length) return;
    const cur = selectable.indexOf(top.activeIdx);
    const dir = (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 1;
    top.activeIdx = selectable[(cur + dir + selectable.length) % selectable.length];
    menu.renderStack();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    menu.selectTop();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    menu.back();
    e.preventDefault();
  }
}

document.addEventListener('mousemove', onActionMenuMouseMove);
document.addEventListener('keydown', onActionMenuKeyDown);

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
  const ident = queueEventIdentity(row);
  const byEvent = Array.from(queueEl.querySelectorAll('.queue-row')).find(el =>
    !el.classList.contains('queue-row-exit') && queueEventIdentity({
      label: el.dataset.queueLabel,
      event: el.dataset.queueEvent
    }) === ident
  );
  if (byEvent) return byEvent;
  if (row.id != null) {
    return queueEl.querySelector(`[data-row-id="${row.id}"]`);
  }
  return null;
}

/** Hand-ready commit: the ready row is removed and a new action row is inserted. */
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

/** Compare queues by (label, event). Tic-only rows stay; an event change is
 * a removal plus an insert. Ids are not identity. */
function queueEventChanges(oldQueue, newQueue) {
  const oldCounts = new Map();
  for (const r of oldQueue || []) {
    const k = queueEventIdentity(r);
    oldCounts.set(k, (oldCounts.get(k) || 0) + 1);
  }
  const newCounts = new Map();
  for (const r of newQueue || []) {
    const k = queueEventIdentity(r);
    newCounts.set(k, (newCounts.get(k) || 0) + 1);
  }
  const unchanged = [];
  const added = [];
  const removed = [];
  const seenNew = new Map();
  for (const row of newQueue || []) {
    const k = queueEventIdentity(row);
    const used = seenNew.get(k) || 0;
    seenNew.set(k, used + 1);
    if (used < (oldCounts.get(k) || 0)) unchanged.push(row);
    else added.push(row);
  }
  const seenOld = new Map();
  for (const row of oldQueue || []) {
    const k = queueEventIdentity(row);
    const used = seenOld.get(k) || 0;
    seenOld.set(k, used + 1);
    if (used >= (newCounts.get(k) || 0)) removed.push(row);
  }
  return { unchanged, added, removed };
}

function pinProcessedHead(head) {
  const row = findQueueRowByIdentity(head);
  if (!row) return;
  row.classList.add('queue-row-current');
  row.classList.remove('queue-row-exit');
}

/** Monster cooldown at the top: the box holds and the text swaps
 * "recovering" → "preparing to attack". Not a new entry. No slide. */
function relabelMonsterPreparing(head, bs) {
  if (!head || head.event !== 'cooldown') return;
  if (!head.label || head.label === 'LH' || head.label === 'RH') return;
  const row = findQueueRowByIdentity(head);
  if (!row) return;
  row.dataset.preparing = '1';
  const monsters = (bs && bs.monsters) || [];
  updateQueueRowInPlace(row, head, monsters, bs, 0);
}

/**
 * Mark a processed head for exit, or delete it on the skipped-animation path.
 * The animated path adds queue-row-exit and leaves the node in flow so the
 * rows below can lift together — runQueueRemoval owns the wait and the lift.
 * Never clears the exit mark to reuse the node.
 */
function silentPopHead(head, preset) {
  if (!head) return;
  const row = findQueueRowByIdentity(head);
  if (!row) return;
  if (animationsSkipped(preset)) {
    row.classList.remove('queue-row-current', 'queue-row-exit');
    forgetQueueRowExiting(row.dataset.rowId);
    if (head.id != null) forgetQueueRowExiting(head.id);
    row.remove();
    return;
  }
  row.classList.remove('queue-row-current');
  const id = row.dataset.rowId || head.id;
  if (id != null) markQueueRowExiting(id);
}

/** Slide departing boxes out. The caller has already inserted successors.
 * Exit is the last action; runQueueRemoval then lifts the rest as one FLIP. */
async function releaseProcessedHead(head, removedRows, bs, preset) {
  const rows = (removedRows && removedRows.length) ? removedRows : (head ? [head] : []);
  if (!rows.length) return;
  if (animationsSkipped(preset)) {
    rows.forEach(r => {
      const el = findQueueRowByIdentity(r);
      if (!el) return;
      el.classList.remove('queue-row-current', 'queue-row-exit');
      forgetQueueRowExiting(el.dataset.rowId);
      if (r.id != null) forgetQueueRowExiting(r.id);
      el.remove();
    });
    return;
  }
  if (head) silentPopHead(head, preset);
  const ids = rows.map(r => r.id).filter(id => id != null);
  if (!ids.length) return;
  await runQueueRemoval(ids);
}

function measuredRowHeight(queueEl) {
  const sample = queueEl.querySelector('.queue-row:not(.queue-row-exit)');
  if (!sample) return 24;
  const h = sample.getBoundingClientRect().height;
  return h > 0 ? Math.round(h) : 24;
}

function domRowIsPlayer(el) {
  const label = el.dataset.queueLabel;
  return label === 'LH' || label === 'RH';
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
  await waitForEvent(gap, 'transitionend', dur('queueGap') + 80);
  return gap;
}

/** Distinct marker filling the open slot: wipe left→right, then one flash. */
async function playInsertMarker(gap) {
  const marker = document.createElement('div');
  marker.className = 'queue-insert-bar';
  gap.appendChild(marker);
  void marker.offsetWidth;
  marker.classList.add('wipe');
  await waitForEvent(marker, 'animationend', dur('queueWipe') + 80);
  marker.classList.remove('wipe');
  void marker.offsetWidth;
  marker.classList.add('flash');
  await waitForEvent(marker, 'animationend', dur('queueFlash') + 80);
  return marker;
}

/**
 * Full row-arrival: empty gap grows → marker wipes → flashes → real row settles.
 * Event-gated via waitForEvent. Instant / reduced-motion skips straight to render.
 */
async function playRowArrival(entries, preset, bs, opts) {
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
      const timeout = isMonsterQueueRow(entry) ? 450 : dur('queueEnter') + 80;
      await waitForEvent(rowEl, 'animationend', timeout);
      rowEl.classList.remove('queue-row-enter', 'queue-row-monster-enter');
    } else {
      gap.remove();
    }
  }
  if (bs && reconcile) renderQueue(bs);
}

/**
 * Queue-transition arrival sequence shared by BattleClock._renderNew and advance.
 * New rows slide in, then departing rows slide out. Callers pass entries
 * matched by (label, event), not by a shared hand node.
 *
 * reconcile stays false while a departing row still has to slide out —
 * playRowArrival's closing renderQueue would wipe it. holdDeparting
 * skips the exit and the closing render so the caller can exit last.
 * pulse is the post-commit panel flash only; the tick loop must not pulse.
 */
async function playQueueTransition({ arrivalEntries, readyCommits, bs, preset, reconcile, pulse, holdDeparting }) {
  const closeReconcile = holdDeparting ? false : (reconcile !== undefined ? reconcile : readyCommits.length === 0);

  if (arrivalEntries.length > 0) {
    await playRowArrival(arrivalEntries, preset, bs, { reconcile: closeReconcile });
  }

  if (!holdDeparting) {
    for (const c of readyCommits) {
      if (animationsSkipped(preset)) {
        const el = findQueueRowByIdentity(c.ready);
        if (el) el.remove();
      } else {
        await runQueueRemoval([c.ready.id]);
      }
    }
  }

  if (!holdDeparting && (readyCommits.length > 0 || arrivalEntries.length === 0)) {
    renderQueue(bs);
  }

  if (pulse) {
    const qp = document.querySelector('.queue-panel');
    if (qp && arrivalEntries.length > 0 && !animationsSkipped(preset)) {
      qp.classList.add('queue-arrived');
      await waitForEvent(qp, 'animationend', 400);
      qp.classList.remove('queue-arrived');
    }
  }
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
  await Promise.all(els.map(el => waitForEvent(el, 'animationend', dur('monsterDeath') + 80)));
}

/**
 * Commit-arrival beat of advance — not a presentation owner. advance is the
 * only caller. It owns every later queue transition and is the only thing
 * that decides when to stop for player input.
 *
 * A commit is a new entry. The winding/drinking/cooldown box slides in at
 * its sorted position, then the ready box slides out. Never relabel the
 * ready node into the new row. Runs before the next /tick so the clock
 * does not swallow the arrival.
 */
async function playCommitArrival(runId, commitData) {
  const fullRun = await apiCall(`/runs/${runId}`, 'GET');
  const run = fullRun.run || fullRun;
  const rich = run.battle_state || {};
  const serverQueue = (commitData && (commitData.queue || (commitData.state && commitData.state.queue))) || rich.queue || [];
  const bs = {
    ...rich,
    queue: serverQueue,
    player_hp: run.player_hp ?? rich.player?.hp ?? 0,
    max_hp: run.max_hp ?? rich.player?.max_hp ?? 100
  };
  const prevQueue = (lastBs && lastBs.queue) || [];
  const preset = getSpeedPreset();
  let removed = commitData && commitData.removed;
  let inserted = commitData && commitData.inserted;
  if (!removed || !inserted) {
    const inferred = findReadyCommits(prevQueue, serverQueue);
    if (inferred[0]) {
      removed = removed || inferred[0].ready;
      inserted = inserted || inferred[0].attack;
    }
  }
  // Commit arrival applies the mutation. Server queue wins if the two disagree.
  // A second call with the same inserted id is a no-op (idempotent).
  let local = replaceReadyWithSuccessor(prevQueue, removed, inserted);
  if (!queuesMatch(local, serverQueue)) local = serverQueue.map(r => ({ ...r }));
  bs.queue = local;
  const commits = findReadyCommits(prevQueue, local);
  const narrateP = awaitNarration(bs.feed || rich.feed || []);
  const visualP = (async () => {
    // A hand commit is a new entry. The ready placeholder is processed and
    // removed. The successor slides in first; the ready box slides out last.
    const entries = commits.length ? commits.map(c => c.attack) : (inserted ? [inserted] : []);
    if (entries.length === 0) {
      renderQueue(bs);
      return;
    }
    await playRowArrival(entries, preset, bs, { reconcile: false });
    const readyRows = commits.length ? commits : (removed ? [{ ready: removed }] : []);
    for (const c of readyRows) {
      if (!c.ready) continue;
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
}

// Settings now live in ./settings-controller.js (single source of truth for speed + font size)
// Auth fetch trio lives in ./combat/combat-api.js (checkAuth returns session).

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

// PC session-expiry safety net: a 401 from any battle API call must never
// strand the player. Show a full-screen escape with working buttons.
function showSessionExpired() {
  ensureAdvanceOverlayStyles();
  if (document.getElementById('pc-session-expired')) return; // already showing
  const overlay = document.createElement('div');
  overlay.id = 'pc-session-expired';
  overlay.className = 'advance-overlay';
  overlay.innerHTML = `
    <div class="advance-panel" style="text-align:center;">
      <div class="advance-header">SESSION EXPIRED</div>
      <div style="color:#e0f0ff;margin:12px 0;">Your login has expired. Log back in to continue your run.</div>
      <div class="advance-btn-row">
        <button class="action-btn advance-town" id="pc-session-login">Log In</button>
        <button class="action-btn advance-extract" id="pc-session-town">Return to Town</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#pc-session-login').onclick = () => { window.location.href = '/login.html'; };
  overlay.querySelector('#pc-session-town').onclick = () => { window.location.href = '/game.html'; };
}

function setBusy(state) {
  // Don't release busy if the clock is mid-transition — let _finish() / advance handle it.
  // masterClockDepth covers the server tick loop, which is not the BattleClock state machine.
  if (!state && (battleClock.state !== 'IDLE' || masterClockDepth > 0)) return;
  busy = state;
  // Dynamic hand buttons + ITEM all live inside #action-menu; gate the whole row.
  document.querySelectorAll('#action-menu button').forEach(btn => {
    btn.disabled = state;
    btn.style.opacity = state ? '0.5' : '1';
  });
}

// Battle-initialization: once every monster is in, the tic-0 timing track fills in
// one row at a time. Battle start does not run the clock (PC-DEC-060), so no
// hand is Ready yet. Do not replay intro.fires — that skip types both hands
// Ready before the player can act. After the track is full, advance plays
// whatever is next, including a monster cooldown that comes before either hand.
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

  // willReplay is false for a new battle: intro.fires is empty. Do not take
  // a replay branch even if a stale payload still carries fires.
  const intro = lastBs && lastBs.intro;
  const willReplay = !!(intro && Array.isArray(intro.fires) && intro.fires.length > 0 && !introAlreadySeen());
  if (willReplay) {
    debugLog('finishBattleIntro', 'ignoring intro.fires — replay is the skip');
  }

  queue.forEach((row, i) => {
    setTimeout(() => {
      if (el) {
        // Initial Action Queue creation: monster cooldown rows read
        // "<Name> getting ready" (they have not attacked yet), not "recovering".
        // Later renders (updateQueueRowInPlace / normal build) say "recovering".
        const rowEl = buildQueueRow(row, monsters, lastBs, false, -1, true);
        rowEl.classList.add('queue-row-slide-in');
        el.appendChild(rowEl);
      }
    }, i * 200);
  });

  const totalDelay = (queue.length * 200) + 350;
  setTimeout(() => {
    // Battle-initialization text stays. Do not renderFeed([]) — that wipes the box.
    // Do not type a pre-advanced feed or both Ready lines.
    beginAfterIntro(() => {
      if (currentRunId && !readyHeadOf(lastBs)) {
        advance(currentRunId).catch(err => console.error('tickLoop initialization:', err));
      } else {
        renderActionMenu(lastBs);
      }
    });
  }, totalDelay);
}

function readyHeadOf(bs) {
  const head = bs && bs.queue && bs.queue[0];
  if (!head || head.event !== 'ready') return null;
  if (head.label !== 'LH' && head.label !== 'RH') return null;
  return head;
}

function introSeenKey() {
  return `pc_intro_seen_${currentRunId || '0'}_b${introSeenBattle || 0}`;
}

function introAlreadySeen() {
  try { return sessionStorage.getItem(introSeenKey()) === '1'; } catch (_) { return false; }
}

function markIntroSeen() {
  try { sessionStorage.setItem(introSeenKey(), '1'); } catch (_) { /* private mode */ }
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

// Battle-start entry point. The 3-2-1 countdown stays gone (Spahrep 2026-10-01).
// PC-DEC-060: do not replay intro.fires. That replay skips monster actions and
// types both hands Ready before the player can act. shouldPlayIntroCountdown
// remains hard-false. A fresh battle paints the tic-0 queue in finishBattleIntro
// and then advance.
function beginAfterIntro(onDone) {
  const tic = lastBs?.tic ?? 0;
  if (shouldPlayIntroCountdown(tic, introCountdownPlayed)) {
    // Retired 3-2-1 path. The gate is hard-false; this branch does not run.
    introCountdownPlayed = true;
    playThreeTwoOne(onDone);
    return;
  }
  const intro = lastBs?.intro || null;
  const canReplay = !introCountdownPlayed
    && !introAlreadySeen()
    && intro && Array.isArray(intro.rows) && Array.isArray(intro.fires) && intro.fires.length > 0;
  if (!canReplay) {
    if (onDone) onDone();
    return;
  }
  // Non-empty fires is a pre-advanced skip. Do not type those lines.
  // playIntroCountdown returns without replaying.
  introCountdownPlayed = true;
  markIntroSeen();
  playIntroCountdown(lastBs, intro, onDone);
}

function playThreeTwoOne(onDone) {
  const steps = INTRO_COUNTDOWN_STEPS;
  const preset = getSpeedPreset();
  if (!preset || preset.charMs === 0) {
    steps.forEach(n => appendFeedLine(n));
    if (onDone) onDone();
    return;
  }
  let i = 0;
  clearIntroTimer();
  const step = () => {
    if (i >= steps.length) {
      introTimer = null;
      if (onDone) onDone();
      return;
    }
    appendFeedLine(steps[i]);
    i++;
    introTimer = setTimeout(step, 800);
  };
  step();
}

function playIntroCountdown(bs, intro, onDone) {
  // 3-2-1 stays gone. Do not replay intro.fires — that skip types both hands
  // Ready before the player can act (PC-DEC-060). A fresh battle has empty
  // fires; finishBattleIntro paints the tic-0 queue and advance plays it.
  void bs;
  void intro;
  if (onDone) onDone();
}

function setIntroTicLabel(tic) {
  const battleLabel = document.getElementById('battle-label');
  if (battleLabel) battleLabel.textContent = battleLabel.textContent.replace(/— TIC \d+$/, `— TIC ${tic}`);
}

function clearIntroTimer() {
  if (introTimer) {
    clearInterval(introTimer);
    clearTimeout(introTimer);
    introTimer = null;
  }
}

function finishIntroSnap(bs, onDone) {
  renderQueue(bs); // real rows replace the mirrored DOM
  setIntroTicLabel(bs.tic ?? 0);
  const maxHp = bs.player && bs.player.max_hp;
  const hp = bs.player && typeof bs.player.hp === 'number' ? bs.player.hp : null;
  if (hp !== null) renderPlayerHP({ player_hp: hp, max_hp: maxHp });
  const feed = bs.feed || [];
  // The replay already typed seed + fire lines. Do not clear the box and
  // re-type history — that is the double-presentation bug.
  if (getRenderedFeedLines() >= feed.length) {
    if (onDone) onDone();
    return;
  }
  const tail = feed.slice(getRenderedFeedLines());
  const preset = getSpeedPreset();
  if (!tail.length || !preset || preset.charMs === 0) {
    tail.forEach(line => appendFeedLine(line));
    addRenderedFeedLines(tail.length);
    if (onDone) onDone();
    return;
  }
  typeFeedLines(tail, () => {
    addRenderedFeedLines(tail.length);
    if (onDone) onDone();
  }, setBusy, handleHitLine);
}


async function extractAndLeave(runId, selectedIds, content, extractBtn, runData) {
  if (busy) return;
  setBusy(true);
  extractBtn.disabled = true;
  try {
    const payload = { choice: 'stop', selected_weapon_ids: selectedIds };
    const res = await apiCall(`/runs/${runId}/battle/end`, 'POST', payload);
    const pool = res.awarded_pool || {};
    const randomIds = Array.isArray(pool.random_weapon_ids) ? pool.random_weapon_ids : [];
    if (randomIds.length > 0) {
      await revealRandomLoot(content, runData, pool, res.prize_pool);
    }
    showExtractionSummary(content, pool);
  } catch (e) {
    showMessage(e.message, true);
    setBusy(false);
    extractBtn.disabled = false;
  }
}


async function fightOn(runId, overlay, fightBtn) {
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
}


/**
 * PC-91: one commit-then-tick arrival for attack, swap, and potion.
 * postFn performs the action POST and returns its JSON. message is a string
 * or (data) => string, shown only after a successful POST and before the clock
 * (doSwap builds its cooldown line from data.delay). hideMenu hides
 * #action-choices. Errors propagate after the clock is left and busy is
 * cleared so each caller keeps its own message.
 * setBusy(false) stays in the finally, after leaveMasterClock: setBusy no-ops
 * while masterClockDepth > 0, and a thrown POST must still release the gate.
 *
 * Single-owner contract: POST, then advance. advance presents the commit
 * arrival (same-key relabel) and every later queue transition, and it alone
 * decides when to stop for input. This function does not play an arrival sequence.
 * enterMasterClock stays so advance is not the outer clock owner and a
 * thrown POST still releases the busy gate in this finally.
 */
async function commitThenTick(runId, postFn, { message, hideMenu } = {}) {
  if (busy) return;
  setBusy(true);
  let data;
  try {
    data = await postFn();
    const text = typeof message === 'function' ? message(data) : message;
    if (text) showMessage(text);
    if (hideMenu) {
      // Hide the action menu — it will re-render on advance break with fresh state
      const menuWrap = document.getElementById('action-choices');
      if (menuWrap) menuWrap.style.display = 'none';
    }
    enterMasterClock();
    await advance(runId, { fromCommit: true, commitData: data });
  } finally {
    leaveMasterClock();
    setBusy(false);
  }
  return data;
}

async function doAttack(runId, hand, attackId, targetIds) {
  debugLog('doAttack', `hand=${hand} attack=${attackId} n_targets=${targetIds?.length || 0}`);
  try {
    await commitThenTick(runId, () => {
      const payload = { hand, attack_id: attackId, target_ids: targetIds || [] };
      return apiCall(`/runs/${runId}/commit`, 'POST', payload).then((res) => {
        pendingAttack = null; // only clear on success — a failed commit keeps the selection
        return res;
      }); // returns {committed: true}
    }, { hideMenu: true });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('Hand not ready')) {
      showMessage('Hand not ready — waiting engine advance');
    } else {
      showMessage(msg, true);
    }
  }
}

async function doSwap(runId, hand) {
  debugLog('doSwap', `hand=${hand}`);
  try {
    await commitThenTick(runId, async () => {
      const data = await apiCall(`/runs/${runId}/swap`, 'POST', { hand });
      pendingAttack = null;
      return data;
    }, {
      hideMenu: true,
      message: (data) => `Belt swap (${hand}) — cooldown ${data.delay != null ? data.delay : ''} tics`,
    });
  } catch (e) {
    showMessage(String(e.message || e), true);
  }
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
  // Drop the previous cascade before rebuild or early return so a gone menu
  // cannot keep receiving keys. Hover starts enabled until an arrow key.
  actionMenuLive = null;
  keyboardActive = false;
  const wrap = document.getElementById('action-choices');
  if (!wrap) return;
  wrap.innerHTML = '';
  pendingAttack = null;
  wrap.style.display = 'block';

  const weapons = bs.weapons || {};
  const queue = bs.queue || [];
  const monsters = (bs.monsters || []).filter(m => !m.dead);
  const potions = bs.potions || {};
  const belt = weapons.belt || null;
  // Stable arena letters — not the living-array index. Sync from the full
  // roster (including the dead) so a kill cannot relabel the survivors.
  syncArenaLetters(bs.monsters || []);

  // The menu opens only when the queue head is a ready row. Hand state alone
  // is not a turn — a monster row ahead of a ready token keeps the menu shut.
  const head = readyHeadOf(bs);
  if (!head) {
    const status = document.createElement('div');
    status.className = 'action-status';
    const top = queue[0];
    status.textContent = top
      ? `${top.label || 'Next'} — ${top.event}${top.tics != null ? ' ' + top.tics + ' tics' : ''}`
      : 'No hand ready';
    wrap.appendChild(status);
    return;
  }

  const hand = head.label;
  const w = weapons[hand === 'LH' ? 'hand_l' : 'hand_r'];
  const handLineText = hand === 'LH' ? 'L.HAND' : 'R.HAND';

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
        rows: monsters.map((m) => {
          const letter = arenaLetterOf(m);
          return {
            html: `<span class="dw-letter">${letter}</span>: ${escapeHtml(m.name)} - <span class="${bandClass(m)}">${escapeHtml(m.hp_word || m.hpWord || 'Healthy')}</span>`,
            monster: m,
            letter
          };
        })
      });
    }
    renderStack();
  }

  function pickPotion(slot, p) {
    // Hand-target step. The open menu's hand is the drink target — do not
    // offer the other hand, and do not reuse a stale hand from a previous menu.
    const drinkHand = hand;
    const handLabel = drinkHand === 'LH' ? 'L.HAND' : 'R.HAND';
    stack.push({
      kind: 'target',
      potion: p,
      slot,
      hand: drinkHand,
      info: `Drink on ${handLabel}`,
      rows: [{ html: handLabel, label: handLabel, hand: drinkHand }]
    });
    renderStack();
  }

  function pickEquip() {
    stack.push({
      kind: 'confirm',
      text: `Swap ${handLineText} with <span class="dw-weapon">${escapeHtml(belt.name)}</span>?`,
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
        const drinkHand = row.hand || lvl.hand || hand;
        stack.push({
          kind: 'confirm',
          text: `Use <strong>${escapeHtml(lvl.potion.template_name)}</strong> (${escapeHtml(lvl.potion.effect_label || '')}) on ${row.label}?`,
          rows: yesNoRows(() => usePotion(currentRunId, lvl.slot, drinkHand))
        });
      } else {
        const live = monsters.filter(m => (m.current_hp ?? 1) > 0).map(m => m.id);
        const ids = row.monster ? [row.monster.id] : live;
        const label = row.monster ? `${row.letter} ${row.monster.name}` : 'ALL MONSTERS';
        stack.push({
          kind: 'confirm',
          text: `Confirm ${escapeHtml(lvl.attack.name)}: ${escapeHtml(label)}`,
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
          bindActionMenuRowInput(el, lvl, ri, renderStack, selectTop);
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
        // Potion windup already includes weapon speed via potionPrePostTicks
        const q = (lastBs && lastBs.queue) || [];
        setQueueBarInfo(computeTimingMarkers(q, row.potionTiming, 0));
        renderQueue(lastBs);
      } else {
        clearMarkers();
      }
      return;
    }
    if (top.kind === 'target') {
      if (top.attack) { showInfo(attackInfo(top.attack, top.weapon, w)); return; } // markers persist from the action pick
      if (top.info) { showInfo(top.info); return; }
    }
    // confirm level: readout stays as the pending action until it executes
  }

  // ---- root command window rows (real per-weapon attacks via template mapping) ----
  // PC-84: row HTML lives in action-menu-rows.js. Callbacks keep the cascade here.
  const rootRows = buildRootActionRows({
    w, weapons, potions, belt, hand,
    onPickTarget: pickTarget,
    onPickPotion: pickPotion,
    onPickEquip: pickEquip,
  });
  stack.push({ kind: 'action', tab: handLineText, rows: rootRows, activeIdx: 0 });

  renderStack();
  clearMarkers(); // PC-56: initial render shows action info but no prediction bar until user hovers/clicks

  // keyboard: Up/Down move the cursor (skips blank/disabled rows), Enter selects,
  // Esc backs one window (root: no-op). Only the top window responds.
  // PC-81: handlers are bound once at module scope and read this cascade.
  actionMenuLive = { stack, renderStack, selectTop, back };
}




async function usePotion(runId, slot, openHand) {
  try {
    await commitThenTick(runId, () => {
      // Opening hand wins. A stale other-hand argument is ignored inside
      // potionCommitPayload.
      const payload = potionCommitPayload(openHand, slot);
      return apiCall(`/runs/${runId}/use-potion`, 'POST', payload);
    }, { message: `Potion ${slot} used on ${openHand}` });
  } catch (e) {
    showMessage(e.message, true);
  }
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
    // Battle-initialization: the command window and timing track are part of the same
    // initialization — they stay hidden until the dice and monster typewriter finishes.
    const willRoll = shouldAnimateDice
      && !!(bs.dice && bs.dice.current && bs.dice.current.color && bs.dice.current.face != null);
    debugLog('loadBattle', `willRoll=${willRoll} shouldAnimateDice=${shouldAnimateDice} dice_current=${!!(bs.dice?.current)}`);
    setMonstersPendingReveal(willRoll);
    battleIntroPending = willRoll;
    if (!willRoll) shouldAnimateDice = false; // no roll playing — consume the flag
    introSeenBattle = run.current_battle || 1;
    // Server startBattle already advanced past tic 0. Replay when this battle's
    // intro has not been seen yet (genuine first entry). A mid-battle reload
    // has intro stripped by loadState, or the seen key set, so it does not replay.
    const introReady = !!(bs.intro && Array.isArray(bs.intro.rows) && Array.isArray(bs.intro.fires) && bs.intro.fires.length > 0);
    if ((battleIntroPending || !prevBs) && introReady && !introAlreadySeen()) {
      introCountdownPlayed = false;
    }
    const introPlays = introReady && !introAlreadySeen() && (battleIntroPending || !prevBs);
    if (battleLabel) {
      const cb = run.current_battle || 1;
      const tb = run.total_battles || 1;
      const bsTic = introPlays ? 0 : ((bs.tic != null) ? bs.tic : 0);
      battleLabel.textContent = `BATTLE ${cb} OF ${tb} — TIC ${bsTic}`;
    }

    if (introPlays) {
      // Pre-advance HP. Feed stays blank until the replay (or battle initialization).
      renderPlayerHP({ player_hp: bs.intro.hpStart, max_hp: bs.player && bs.player.max_hp });
    } else {
      renderPlayerHP(run);
    }
    // If battle initialization is pending, force the message box completely empty
    // so no old text bleeds through the initialization phase. Feed is
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
      // Battle-initialization: die still rolling — command window + timing track stay hidden.
      document.body.classList.add('intro-pending', 'queue-filling');
    } else {
      // Genuine first entry replays the seeded advance, then opens the menu.
      // tic is already past 0 (startBattle advanced); intro is the tic-0 snapshot.
      const showMenu = () => {
        document.body.classList.remove('intro-pending', 'queue-filling');
        if (readyHeadOf(bs)) renderActionMenu(bs);
        else if (currentRunId && !((bs.monsters || []).length > 0 && (bs.monsters || []).every(m => m.dead))) {
          advance(currentRunId).catch(err => console.error('tickLoop resume:', err));
        }
      };
      const countdownFirst = !prevBs && introReady && !introAlreadySeen();
      if (!countdownFirst) showMenu();
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
        // Not the player-commit path. commitThenTick POSTs and then advance
        // is the single presentation owner. This branch is a page-load / next-battle
        // diff (fightOn still has lastBs) coordinated with feed narration via
        // onNarrateDone. Routing it through advance would POST /tick during
        // intro or next-battle setup and race battle initialization.
        battleClock.start(diff, bs, () => {
          renderQueue(bs);
        });
      }
      const feedCb = (battleClock.state !== 'IDLE') ? () => battleClock.onNarrateDone() : null;
      if (!prevBs && !countdownFirst && getRenderedFeedLines() === 0 && bs.feed && bs.feed.length > 0) {
        populateFeedInstantly(bs.feed);
        if (feedCb) feedCb();
      } else if (!countdownFirst) {
        renderFeed(bs.feed || [], feedCb);
      }
      // Queue rendered through battleClock for commits; fresh page renders immediately.
      // Intro replay owns the rail on genuine first entry — do not also stagger it.
      if (!prevBs && !countdownFirst) renderQueue(bs);
      if (!prevBs && !countdownFirst) {
        const nqEl = document.getElementById('queue');
        const queueRows = bs.queue || [];
        if (nqEl) {
          Array.from(nqEl.children).forEach((row, i) => {
            setTimeout(() => {
              const entry = queueRows.find(r => String(r.id) === row.dataset.rowId) || queueRows[i];
              const isMonRow = entry ? isMonsterQueueRow(entry) : false;
              const cls = isMonRow ? 'queue-row-monster-enter' : 'queue-row-enter';
              row.classList.add(cls);
              const timeout = isMonRow ? 450 : dur('queueEnter') + 80;
              waitForEvent(row, 'animationend', timeout).then(() => {
                row.classList.remove('queue-row-enter', 'queue-row-monster-enter');
              });
            }, i * 100);
          });
        }
      }
      if (countdownFirst) {
        document.body.classList.add('intro-pending');
        document.body.classList.remove('queue-filling');
        beginAfterIntro(showMenu);
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
    const dialog = mountOverlay('end-run-overlay');
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
  supabase = supabaseClient();
  if (!(await checkAuth())) return;

  // PC-52: fill hud-name from session (front-end only, placeholder dock)
  const { data: { session } } = await supabase.auth.getSession();
  fillHudName(session);
  // PC follow-up: global playerName for queue labels
  const hudNameEl = document.getElementById('hud-name');
  playerName = hudNameEl ? hudNameEl.textContent : 'Player';

  const params = new URLSearchParams(window.location.search);
  const runId = params.get('id');
  if (!runId) {
    showErrorState('Missing run ID', 'Add ?id=NNN to the URL.', true);
    return;
  }

  // A 401 from any battle API call surfaces a session-expired escape screen.
  window.addEventListener('pc:session-expired', showSessionExpired);

  // PC-72: battle initialization plays only on a genuine first entry — the marker is
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

  // PC-DEC-044: click message log to finish the CURRENT line only.
  // completeCurrentTypingLine does not drop still-queued feed entries.
  const msgBox = document.getElementById('message-box');
  if (msgBox) {
    msgBox.onclick = () => {
      if (isTypingInProgress()) {
        completeCurrentTypingLine();
      }
    };
    // DO-2 scroll-pinning: toggle pinned flag; typing only auto-scrolls while pinned
    msgBox.addEventListener('scroll', () => {
      const atBottom = msgBox.scrollTop + msgBox.clientHeight >= msgBox.scrollHeight - 8;
      setFeedPinned(atBottom);
    });
  }
}

/**
 * Single-advance driver and the only presentation owner after a player commit.
 * One server response → one readable cycle → stop only when the server's
 * returned player_ready says the player decides. Each iteration is one
 * /tick and one complete presentation; the loop yields on that server gate
 * (playerReady, needsInput, done, or battle over). The server queue head
 * is the only turn authority.
 *
 * fromCommit: the action POST already landed. Present that arrival here —
 * playCommitArrival inserts the new entry, then slides the ready box out —
 * before the first /tick. This function then owns every later queue
 * transition and the stop. Intro and resume callers omit fromCommit; they
 * must not replay a commit.
 */
async function advance(runId, { fromCommit = false, commitData = null } = {}) {
  debugLog('tickLoop', `runId=${runId}`);
  const outer = masterClockDepth === 0;
  enterMasterClock();
  try {
    if (fromCommit) {
      try {
        await playCommitArrival(runId, commitData);
      } catch (err) {
        console.error('commit arrival:', err);
      }
    }
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
      // A ready-head pause returns the row still in the queue. Do not pop it.
      const headStillQueued = !!(processedHead && newQueue.some(r => r.id === processedHead.id));

      if (!headStillQueued) {
        pinProcessedHead(processedHead);
        relabelMonsterPreparing(processedHead, bs);
      }

      const deathBefore = new Set(deathCards.keys());
      renderPlayerHP(bs);
      renderMonsters(bs.monsters || []);
      renderLoadout(bs);

      // Typewriter starts first (it kicks hit feedback), then both are awaited.
      const narrateP = awaitNarration(bs.feed);
      const visualsP = awaitTickVisuals(deathBefore);
      await Promise.all([narrateP, visualsP]);

      // Tic countdown: same label + same event, only the number changes.
      // The box stays. An event change is not in this list.
      const changes = queueEventChanges(oldQueue, newQueue);
      const monstersNow = bs.monsters || [];
      changes.unchanged.forEach((row) => {
        const el = findQueueRowByIdentity(row);
        if (!el) return;
        updateQueueRowInPlace(el, row, monstersNow, bs, newQueue.indexOf(row));
      });

      // New entries slide in first (row-arrival). Event changes are a
      // new box, not a relabel of the box being processed.
      if (changes.added.length > 0) {
        await playQueueTransition({
          arrivalEntries: changes.added,
          readyCommits: [],
          bs,
          preset,
          reconcile: false,
          pulse: false,
        });
      }

      // Processed box slides out last, with any other departure, then one lift.
      if (!headStillQueued) {
        const departing = changes.removed.length ? changes.removed : (processedHead ? [processedHead] : []);
        if (departing.length) {
          await releaseProcessedHead(processedHead, departing, bs, preset);
        }
      }

      renderQueue(bs);

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