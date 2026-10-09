/**
 * Queue rendering subsystem (PC-77).
 * DOM render, (label, event) reconciliation, exit-row cache, and the PC-56
 * prediction bar. A phase change is a new box. Only a tic countdown, or a
 * monster cooldown swapping "recovering" → "preparing to attack", retouches
 * the node that is already on screen.
 */
import { debugLog } from '../battle-debug.js';
import { assignArenaLetters, letterForMonster } from './arena-letters.js';
import { dur } from './ux-controller.js';
import { getSpeedPreset } from '../settings-controller.js';

// Queue beat lengths live in ux-controller TIMING. dur() applies ux_speed.
// The matching CSS (queue-row-exit, insert gap/wipe/flash, row enter) reads
// the custom properties applyTimingScale() sets, so the animation and the
// waitForEvent fallback stay the same length.

let queueBarInfo = null; // {kind:'bar',firstId,lastId} | null — PC-56 prediction bar

// Bug 4 fix: persistent cache for exit-animating queue rows (like deathCards for monsters)
const exitingQueueRows = new Map(); // rowId -> { element, finished }

// Set by renderQueue's full-rebuild fallback immediately before clearQueueDom
// so that path can tell an orphan (in the DOM, absent from the new queue)
// from a row that will be rebuilt. null keeps the old wipe for any other caller.
let rebuildReconciled = null; // { idents: Set<string>, ids: Set<string> } | null

export function setQueueBarInfo(info) {
  queueBarInfo = info;
}

export function clearQueueBarInfo() {
  queueBarInfo = null;
}

export function isQueueRowExiting(rowId) {
  return exitingQueueRows.has(rowId);
}

/** Drop a row from the exit cache after groupLiftRemaining releases it. */
export function forgetQueueRowExiting(rowId) {
  exitingQueueRows.delete(rowId);
}

/** Identity across renders is (label, event). The engine mints a fresh id per
 * entry and rewrites tics in place, so an id compare cannot tell a countdown
 * from a new box. Same label + same event = the same box (tic relabel).
 * A different event is a different box. */
export function queueEventIdentity(row) {
  if (!row) return '';
  return `${row.label}|${row.event}`;
}

function domEventIdentity(el) {
  if (!el) return '';
  return `${el.dataset.queueLabel}|${el.dataset.queueEvent}`;
}

function isMonsterLabel(row) {
  return !!(row && row.label && row.label !== 'LH' && row.label !== 'RH');
}

/** Canonical monster attack rows: name + tic, no timing bar. */
export function isMonsterQueueRow(row) {
  return isMonsterLabel(row) && (row.event === 'winding' || row.event === 'impact' || row.event === 'attack');
}

function isMonsterCooldownRow(row) {
  return isMonsterLabel(row) && row.event === 'cooldown';
}

/** Instant preset and reduced-motion skip queue motion. Mirrors battle-app
 * animationsSkipped without importing it (that module imports this one). */
function queueAnimationsSkipped() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
  } catch (_) { /* no window in some test hosts */ }
  const p = getSpeedPreset();
  return !p || p.charMs === 0;
}

/** Enter class for a phase change. Monsters pulse; player rows slide. */
export function queueRowEnterClass(row) {
  if (row && row.label && row.label !== 'LH' && row.label !== 'RH' &&
      (row.event === 'winding' || row.event === 'impact' || row.event === 'attack' || row.event === 'cooldown')) {
    return 'queue-row-monster-enter';
  }
  return 'queue-row-enter';
}

/** Play the enter animation on an existing or just-built node. No-op when
 * animations are skipped. The class comes off on animationend so a later
 * phase change can replay it. Does not rebuild the node. */
export function armQueueRowEnter(node, row) {
  if (!node || queueAnimationsSkipped()) return;
  const cls = queueRowEnterClass(row);
  node.classList.remove('queue-row-enter', 'queue-row-monster-enter');
  // Re-adding a class that was just removed needs a reflow or the browser
  // will not restart the animation.
  void node.offsetWidth;
  node.classList.add(cls);
  node.addEventListener('animationend', () => {
    node.classList.remove('queue-row-enter', 'queue-row-monster-enter');
  }, { once: true });
}

function monsterQueueName(row, monsters) {
  const mon = (monsters || []).find(m => m.label === row.label);
  if (mon && mon.name) {
    const letter = letterForMonster(mon, assignArenaLetters(monsters, new Map()));
    if (!letter || letter === '?') return mon.name;
    return `${mon.name} (${letter})`;
  }
  if (mon && mon.label) return mon.label;
  return queueLabel(row);
}

/**
 * Action Queue (next-up events column), per the design mockups: one row per
 * queued event, `Label EventName | tics-until-change`, next event on top.
 * Rows are countdowns to a state change: an attack landing, a hand freeing
 * ("Ready"), a monster striking, a potion taking effect.
 */
function paintPredictionBar(el) {
  el.querySelectorAll('.prediction-bar').forEach(node => node.remove());
  // Selecting an attack does not change queue row ids. The in-place paths
  // must still draw this strip, and must remove it when the selection clears.
  if (!(queueBarInfo && queueBarInfo.kind === 'bar' && queueBarInfo.firstId && queueBarInfo.lastId)) return;
    const bar = document.createElement('div');
    bar.className = 'prediction-bar';
    // Read-only tic→pixel ladder for the PC-56 prediction bar. The copy-sort
    // does not reorder the queue or the DOM (those stay in engine array order).
    const rowEls = Array.from(el.querySelectorAll('.queue-row'));
    const queueRect = el.getBoundingClientRect();
    const ladder = rowEls.filter(r => r.dataset.tics !== undefined).map(r => {
      const rect = r.getBoundingClientRect();
      return { tics: Number(r.dataset.tics), top: rect.top - queueRect.top, bottom: rect.bottom - queueRect.top, height: rect.height };
    });
    ladder.sort((a, b) => a.tics - b.tics);
    const gapPx = 2; // matches .queue-row margin-bottom
    function yAtTics(t) {
      if (ladder.length === 0) return 0;
      const first = ladder[0], last = ladder[ladder.length - 1];
      // Virtual extension above first row — proportional to tic distance
      if (t <= first.tics) {
        if (t === first.tics) return first.top;
        const stepTics = ladder.length > 1 ? ladder[1].tics - first.tics : Math.max(first.tics, 1);
        const frac = (first.tics - t) / stepTics;
        return first.top - frac * (last.height + gapPx);
      }
      // Virtual extension below last row — proportional to tic distance
      if (t >= last.tics) {
        if (t === last.tics) return last.bottom;
        const stepTics = ladder.length > 1 ? last.tics - ladder[ladder.length - 2].tics : Math.max(last.tics, 1);
        const frac = (t - last.tics) / stepTics;
        return last.bottom + frac * (last.height + gapPx);
      }
      // Between two rows — lerp across the gap
      let i = 0;
      while (i < ladder.length - 1 && ladder[i + 1].tics < t) i++;
      const lo = ladder[i], hi = ladder[i + 1];
      const frac = (t - lo.tics) / (hi.tics - lo.tics);
      return lo.bottom + frac * (hi.top - lo.bottom);
    }
    const minT = Number(queueBarInfo.minT);
    const maxT = Number(queueBarInfo.maxT);
    let barTop = yAtTics(minT);
    // Find clamping boundary for the bar top.
    // When the timing range contains a single row (firstId == lastId), the bar
    // floats in the gap above that row because yAtTics interpolates well above
    // it. Snapping to the inside row's own bottom does nothing. Instead, snap
    // to the row ABOVE the inside row so the bar is flush with both bounding
    // row boxes, not protruding into the upper gap.
    let topBoundEl = rowEls.find(r => r.dataset.rowId === queueBarInfo.firstId);
    if (queueBarInfo.hasInside && queueBarInfo.firstId === queueBarInfo.lastId) {
      const idx = rowEls.findIndex(r => r.dataset.rowId === queueBarInfo.firstId);
      if (idx > 0) topBoundEl = rowEls[idx - 1];
    }
    if (topBoundEl) {
      const rect = topBoundEl.getBoundingClientRect();
      barTop = Math.min(barTop, rect.bottom - queueRect.top - 3);
    }
    // When maxT lands exactly on a row's tics, bar bottom flushes with the box's bottom edge
    const exactRow = ladder.find(r => r.tics === maxT);
    let barBottom = exactRow ? exactRow.bottom : yAtTics(maxT);
    // Find clamping boundary for the bar bottom — mirrors the top-side logic.
    let bottomBoundEl = rowEls.find(r => r.dataset.rowId === queueBarInfo.lastId);
    if (queueBarInfo.hasInside && queueBarInfo.firstId === queueBarInfo.lastId) {
      const idx = rowEls.findIndex(r => r.dataset.rowId === queueBarInfo.lastId);
      if (idx < rowEls.length - 1) bottomBoundEl = rowEls[idx + 1];
    }
    if (bottomBoundEl) {
      const rect = bottomBoundEl.getBoundingClientRect();
      const lastLadderTic = ladder.length > 0 ? ladder[ladder.length - 1].tics : 0;
      if (queueBarInfo.hasInside === false && maxT > lastLadderTic) {
        // Attack lands after all visible queue rows — show as ~1 row height below the last row
        const rowH = ladder.length > 0 ? ladder[ladder.length - 1].height : 20;
        barBottom = rect.bottom - queueRect.top + rowH + gapPx;
      } else {
        barBottom = Math.max(barBottom, rect.top - queueRect.top);
      }
    }
    bar.style.top = `${barTop}px`;
    bar.style.height = `${Math.max(4, barBottom - barTop + 3)}px`;
    el.appendChild(bar);
  }

export function renderQueue(bs, fill = false, onDone = null) {
  debugLog('renderQueue', `fill=${fill} n_queue=${bs.queue?.length || 0} n_monsters=${bs.monsters?.length || 0}`);
  const el = document.getElementById('queue');
  if (!el) return;
  // Same (label, event) pairs in the same engine order: only the tic number
  // (or other text on that same entry) changed. Rewrite in place. Never move
  // a node and never slide — a countdown must not re-enter the row.
  // Ignore a row already sliding out; it is a different box leaving.
  const queue = bs.queue || [];
  const currentRows = Array.from(el.querySelectorAll('.queue-row:not(.queue-row-exit)'));
  const currentIdent = currentRows.map(domEventIdentity);
  const newIdent = queue.map(queueEventIdentity);
  if (currentIdent.length === newIdent.length && currentIdent.every((k, i) => k === newIdent[i])) {
    const monsters = bs.monsters || [];
    queue.forEach((row, index) => {
      updateQueueRowInPlace(currentRows[index], row, monsters, bs, index);
    });
    const titleEl = el.closest('.queue-panel')?.querySelector('.panel-title');
    if (titleEl) titleEl.textContent = 'Action Queue';
    if (fill && onDone) {
      const rows = Math.max(queue.length, 1);
      setTimeout(onDone, (rows - 1) * dur('queueFillStagger') + dur('queueFill'));
    }
    paintPredictionBar(el);
    return;
  }
  // Structural change: an event changed, a label arrived, or a label left.
  // The arrival sequence owns slide-in then slide-out. This fallback paints the
  // settled queue (initial load, skip path, post-arrival reconcile).
  // An orphan is marked queue-row-exit and left in flow — never popped.
  rebuildReconciled = {
    idents: new Set(queue.map(queueEventIdentity)),
    ids: new Set(queue.filter(r => r && r.id != null).map(r => String(r.id))),
  };
  clearQueueDom();
  const titleEl = el.closest('.queue-panel')?.querySelector('.panel-title');
  if (titleEl) {
    titleEl.textContent = 'Action Queue';
  }
  if (fill && onDone) {
    // Battle-initialization: signal completion after the last row's fade lands, so the
    // command window never waits on an animation that cannot start (empty queue).
    const rows = Math.max(queue.length, 1);
    setTimeout(onDone, (rows - 1) * dur('queueFillStagger') + dur('queueFill'));
  }
  if (queue.length === 0) return;
  const monsters = bs.monsters || [];
  queue.forEach((row, index) => {
    if (exitingQueueRows.has(row.id)) return;
    const ident = queueEventIdentity(row);
    const already = Array.from(el.querySelectorAll('.queue-row:not(.queue-row-exit)'))
      .find(node => domEventIdentity(node) === ident);
    if (already) {
      updateQueueRowInPlace(already, row, monsters, bs, index);
      return;
    }
    el.appendChild(buildQueueRow(row, monsters, bs, true, index));
  });
  paintPredictionBar(el);
  if (fill) {
    // Battle-initialization fill: reveal rows in engine array order, top to bottom.
    // Skip a row already sliding out — the fill must not clobber that exit.
    let stagger = 0;
    Array.from(el.children).forEach((row) => {
      if (row.classList.contains('queue-row-exit')) return;
      const i = stagger++;
      row.style.transition = `opacity ${dur('queueFill')}ms ease`;
      row.style.opacity = '0';
      setTimeout(() => { row.style.opacity = '1'; }, i * dur('queueFillStagger'));
    });
  }
}

// diff for resolve/enter animations (non-blocking).
// Same label + same event stays (tic relabel). A different event is a removal
// plus an insert — never a successor replace on one node.
export function diffQueueForAnimation(oldBs, newBs) {
  const oldRows = oldBs.queue || [];
  const newRows = newBs.queue || [];
  const oldIdents = new Set(oldRows.map(queueEventIdentity));
  const newIdents = new Set(newRows.map(queueEventIdentity));
  return {
    resolved: oldRows.filter(r => !newIdents.has(queueEventIdentity(r))).map(r => r.id),
    added: newRows.filter(r => !oldIdents.has(queueEventIdentity(r))).map(r => ({
      id: r.id,
      isMonster: isMonsterQueueRow(r)
    }))
  };
}

/** A queue row still present in the queue being rebuilt ((label, event), else id). */
function isReconciledQueueRow(child, reconciled) {
  const ident = domEventIdentity(child);
  if (ident && reconciled.idents && reconciled.idents.has(ident)) return true;
  const id = child.dataset.rowId;
  if (id && reconciled.ids.has(id)) return true;
  return false;
}

// Bug 4 helpers: preserve exit-animating rows across renders (robust cache + clear)
export function clearQueueDom() {
  const el = document.getElementById('queue');
  const reconciled = rebuildReconciled;
  rebuildReconciled = null;
  if (!el) return;
  [...el.children].forEach(child => {
    const id = child.dataset.rowId;
    if (id && exitingQueueRows.has(id)) {
      const entry = exitingQueueRows.get(id);
      if (entry.finished) {
        child.remove();
        exitingQueueRows.delete(id);
      }
      // else keep it (still animating), do not remove or replace
      return;
    }
    if (child.classList.contains('queue-row-exit')) {
      // Slide already started. Stay in flow for groupLiftRemaining.
      return;
    }
    // Orphan: in the DOM, not part of the reconciled queue, not yet exiting.
    // Slide out. groupLiftRemaining releases the space after the rebuild.
    if (reconciled && child.classList.contains('queue-row') && !isReconciledQueueRow(child, reconciled)) {
      child.classList.add('queue-row-exit');
      if (id) markQueueRowExiting(id);
      return;
    }
    child.remove();
  });
}

export function markQueueRowExiting(rowId) {
  const el = document.getElementById('queue');
  if (!el) return;
  const row = el.querySelector(`[data-row-id="${rowId}"]`);
  if (!row) return;
  row.classList.remove('queue-row-current');
  row.classList.add('queue-row-exit'); // slides fully out but STAYS in flow (space not released yet)

  if (!exitingQueueRows.has(rowId)) {
    exitingQueueRows.set(rowId, { element: row, finished: false });
  }
  // Removal + sibling group-lift is owned by groupLiftRemaining() (rare it
  // actually leaves the DOM after this). No auto-remove here so the rows below
  // never jump — they glide up together as one unit after the exit+gap.
}

// Ready / approach / monster-attack / recovering label. Shared by buildQueueRow
// and updateQueueRowInPlace so the two paths cannot drift.
// initial=true (battle-initialization fill only): a monster's first cooldown row reads
// "<Name> getting ready"; every later render says "<Name> recovering".
// Player hand rows that carry a committed target render it as an indented
// sub-line under the action (Option 4): "L. Hand Power Attack" / "  └─ Wolf A".
// Monster rows never get a target sub-line — monsters only ever target the
// player, so it would be dead weight.
function queueRowDisplayLabel(row, monsters, bs, initial = false, preparing = false) {
  if (row.event === 'ready' || row.event === 'approach') {
    return `${queueLabel(row)} Ready`;
  }
  if (isMonsterQueueRow(row)) {
    return `${monsterQueueName(row, monsters)}'s ${queueEventName(row, monsters, bs)}`;
  }
  if (isMonsterCooldownRow(row)) {
    const verb = preparing ? 'preparing to attack' : (initial ? 'getting ready' : 'recovering');
    return `${monsterQueueName(row, monsters)} ${verb}`;
  }
  return `${queueLabel(row)} ${queueEventName(row, monsters, bs)}`;
}

// Resolve a player hand row's committed target to its display name, matching
// the monster-card convention ("Wolf A"). row.targetIds is the array of monster
// ids chosen at commit time; the queue shows the first living one as an indented
// sub-line under the action. No target / none alive / non-player row → null.
function playerRowTargetName(row, monsters) {
  if (!row.targetIds || !row.targetIds.length) return null;
  const assigned = assignArenaLetters(monsters, new Map());
  for (const id of row.targetIds) {
    const mon = (monsters || []).find(m => m.id === id);
    if (mon) {
      const letter = letterForMonster(mon, assigned);
      const name = (mon && mon.name) || 'Monster';
      if (letter && letter !== '?') return `${name} (${letter})`;
      return name;
    }
  }
  return null;
}

// Shared rail-row builder: used by renderQueue and the PC-64 intro countdown so
// countdown rows are pixel-identical to the real queue (same sort, same DOM).
// withMarkers=false omits PC-56 '>' timing markers (no selection during the intro).
export function buildQueueRow(row, monsters, bs, withMarkers, index = -1, initial = false) {
  const div = document.createElement('div');
  div.className = 'queue-row';
  if (index >= 0 && index < 3) {
    div.classList.add('top-row');
  }
  div.dataset.rowId = row.id;
  div.dataset.tics = row.tics;
  div.dataset.queueLabel = row.label == null ? '' : String(row.label);
  div.dataset.queueEvent = row.event || '';
  if (index === 0 && row.event === 'ready') div.classList.add('queue-row-ready-head');
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  // Ready placeholder rows: show the hand label and "Ready" — no tic countdown
  if (row.event === 'ready') {
    nameSpan.textContent = queueRowDisplayLabel(row, monsters, bs, initial);
    const ticSpan = document.createElement('span');
    ticSpan.className = 'tic';
    ticSpan.textContent = '—';
    div.appendChild(nameSpan);
    div.appendChild(ticSpan);
    return div;
  }
  // Approach rows: show "L. Hand Ready" with tic count (approach still fires)
  if (row.event === 'approach') {
    nameSpan.textContent = queueRowDisplayLabel(row, monsters, bs, initial);
    const ticSpan = document.createElement('span');
    ticSpan.className = 'tic';
    ticSpan.textContent = String(row.tics != null ? row.tics : 0);
    div.appendChild(nameSpan);
    div.appendChild(ticSpan);
    return div;
  }
  // Monster winding/impact (and legacy attack): "<Monster name> (A)'s <Attack>".
  const isMonster = isMonsterQueueRow(row);
  if (isMonster) {
    nameSpan.textContent = queueRowDisplayLabel(row, monsters, bs, initial);
  } else if (isMonsterCooldownRow(row)) {
    // Clear row (player-style bar). Label "<Monster name> recovering".
    nameSpan.textContent = queueRowDisplayLabel(row, monsters, bs, initial);
  } else {
    nameSpan.textContent = queueRowDisplayLabel(row, monsters, bs, initial);
  }
  const ticSpan = document.createElement('span');
  ticSpan.className = 'tic';
  ticSpan.textContent = String(row.tics != null ? row.tics : 0);
  div.appendChild(nameSpan);
  div.appendChild(ticSpan);
  // Option 4: player attack rows with a committed target get an indented
  // sub-line naming the target ("└─ Wolf A"). Monster rows never do.
  const targetName = playerRowTargetName(row, monsters);
  if (targetName) {
    const targetSpan = document.createElement('span');
    targetSpan.className = 'queue-target';
    targetSpan.textContent = `└─ ${targetName}`;
    div.appendChild(targetSpan);
  }
  if (!isMonster) {
    const bar = document.createElement('div');
    bar.className = 'queue-bar';
    div.appendChild(bar);
  }
  // PC-56: bar-only mode — no pin markers; the prediction bar is added by renderQueue
  return div;
}

// In-place text/tics mutation for the two relabel cases only: a tic countdown
// on the same (label, event), and a monster cooldown swapping "recovering"
// to "preparing to attack" (dataset.preparing, same cooldown row). A phase
// change is a new box — this function refuses to morph the node.
export function updateQueueRowInPlace(div, row, monsters, bs, index = -1) {
  const preparing = div.dataset.preparing === '1' && isMonsterCooldownRow(row);
  const prevEvent = div.dataset.queueEvent || '';
  const nextEvent = row.event || '';
  if (prevEvent && prevEvent !== nextEvent && !preparing) return;
  div.dataset.rowId = row.id;
  div.dataset.tics = row.tics;
  div.dataset.queueLabel = row.label == null ? '' : String(row.label);
  div.dataset.queueEvent = nextEvent;
  div.classList.toggle('top-row', index >= 0 && index < 3);
  div.classList.toggle('queue-row-ready-head', index === 0 && row.event === 'ready');
  const isMonster = isMonsterQueueRow(row);
  const hasBar = !isMonster && row.event !== 'ready' && row.event !== 'approach';
  let nameSpan = div.querySelector('.name');
  let ticSpan = div.querySelector('.tic');
  let bar = div.querySelector('.queue-bar');
  if (!nameSpan) {
    nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    div.prepend(nameSpan);
  }
  if (!ticSpan) {
    ticSpan = document.createElement('span');
    ticSpan.className = 'tic';
    div.appendChild(ticSpan);
  }
  const label = queueRowDisplayLabel(row, monsters, bs, false, preparing);
  if (row.event === 'ready') {
    nameSpan.textContent = label;
    ticSpan.textContent = '—';
  } else {
    nameSpan.textContent = label;
    ticSpan.textContent = String(row.tics != null ? row.tics : 0);
  }
  if (hasBar && !bar) {
    bar = document.createElement('div');
    bar.className = 'queue-bar';
    div.appendChild(bar);
  } else if (!hasBar && bar) {
    bar.remove();
  }
  // Option 4: keep the target sub-line in sync on in-place updates. Create it
  // when a player attack row has a committed target, update its text, and
  // remove it when the target is gone (e.g. the monster died mid-windup).
  let targetSpan = div.querySelector('.queue-target');
  const targetName = playerRowTargetName(row, monsters);
  if (targetName) {
    if (!targetSpan) {
      targetSpan = document.createElement('span');
      targetSpan.className = 'queue-target';
      div.appendChild(targetSpan);
    }
    targetSpan.textContent = `└─ ${targetName}`;
  } else if (targetSpan) {
    targetSpan.remove();
  }
}

// Intro theater mirror only (playIntroCountdown). Live render follows engine
// array order and must not call this.
export function sortQueueRows(queue) {
  return [...queue].sort((a, b) => {
    if ((a.tics ?? 0) !== (b.tics ?? 0)) return (a.tics ?? 0) - (b.tics ?? 0);
    const aPlayer = a.label === 'LH' || a.label === 'RH' ? 0 : 1;
    const bPlayer = b.label === 'LH' || b.label === 'RH' ? 0 : 1;
    return aPlayer - bPlayer;
  });
}

function queueLabel(row) {
  if (row.label === 'LH') return 'L. Hand';
  if (row.label === 'RH') return 'R. Hand';
  // Monsters show as single-letter arena markers (A/B/C), like the mockups.
  return String(row.label || '?').replace(/^Monster\s*/i, '');
}

function queueEventName(row, monsters, bs) {
  if (row.event === 'approach') return '';
  // Monster cooldown is a clear recovering row, not a hand-ready countdown.
  if (isMonsterCooldownRow(row)) return 'recovering';
  // A hand freeing is a state change — the queue counts down to "Ready".
  if (row.event === 'cooldown' || row.event === 'recovery') return 'Ready';
  if (row.event === 'drinking') {
    const p = (bs.potions || {})[row.potionSlot];
    return (p && p.template_name) ? p.template_name : 'Potion';
  }
  if (row.attackName) return row.attackName;
  // Picked at winding seed (PC-72 / PC-97). Falls back to the primary attack.
  if (row.monsterAttackName) return row.monsterAttackName;
  // Monster winding/impact rows with no stored name — use the primary attack.
  const mon = monsters.find(m => m.label === row.label);
  if (mon && Array.isArray(mon.attacks) && mon.attacks.length && mon.attacks[0].name) {
    return mon.attacks[0].name;
  }
  return 'Attack';
}

