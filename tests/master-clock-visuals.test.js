import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import createEngine from '../js/combat/engine.js';
import { peekHead } from '../js/combat/tic-queue.js';
import { persisted, writeState } from './live-clock.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function fnBody(src, name) {
  const start = src.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  return src.slice(start);
}

// Slice a function's body up to the NEXT top-level declaration, so assertions
// don't accidentally reach into a later function (index.to.src looked up by
// charOffset is unreliable; top-level declarations start at col 0 or lead with
// "async function"/"class ").
function fnBodyUntilNext(src, startMarker, nextMarkers) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} exists`);
  const tail = src.slice(start);
  let end = tail.length;
  for (const m of nextMarkers) {
    const at = tail.indexOf(m);
    if (at > 0) end = Math.min(end, at);
  }
  return tail.slice(0, end);
}

describe('Master clock tick order (PC-94)', () => {
  it('returns the processed head and removes it after process', () => {
    const eng = createEngine(seededRNG(3));
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 8, hand_r_speed: 9 },
      monsters: [{ id: 1, max_hp: 80, damage: 10, speed: 1, accuracy: 70, label: 'A' }]
    });
    // A monster cooldown is a real process: successor inserts, then the head
    // leaves. A hand approach reaching Ready is a relabel (PC-DEC-071) and is
    // covered below — it must not be the fixture for this removal contract.
    const head = peekHead(persisted(eng).queue);
    assert.equal(head.label, 'A');
    assert.equal(head.event, 'cooldown');
    assert.equal(head.tics, 1);
    const feedBefore = persisted(eng).feed.length;
    const result = eng.tick();
    assert.equal(result.row.id, head.id, 'tick returns the peeked head');
    assert.equal(result.row.event, 'cooldown');
    assert.equal(persisted(eng).queue.some(r => r.id === head.id), false, 'processed head is gone after tick');
    assert.ok(persisted(eng).feed.length > feedBefore, 'process ran and wrote narration before return');
    assert.ok(persisted(eng).queue.some(r => r.label === 'A' && r.event === 'winding'), 'successor inserted before the head left');
    assert.equal(result.playerReady, false);
  });
});

describe('Master clock visual fidelity (client contract)', () => {
  const app = read('js/battle-app.js');
  const css = read('run.html');

  it('dotted insert-preview box is gone', () => {
    assert.equal(app.includes('queue-insert-preview'), false);
    assert.equal(css.includes('queue-insert-preview'), false);
    assert.match(css, /\.queue-insert-gap\s*\{[^}]*border:\s*none/);
    assert.match(css, /\.queue-insert-gap\s*\{[^}]*background:\s*transparent/);
  });

  it('insert marker wipe+flash is a distinct element, event-gated', () => {
    assert.match(css, /\.queue-insert-bar\b/);
    assert.match(css, /@keyframes queue-insert-wipe[\s\S]*width:\s*0[\s\S]*width:\s*100%/);
    assert.match(css, /@keyframes insert-flash/);
    assert.equal(css.includes('queue-bar-entry'), false);
    const marker = fnBody(app, 'playInsertMarker');
    assert.match(marker, /queue-insert-bar/);
    assert.ok(marker.indexOf("waitForEvent(marker, 'animationend'") >= 0);
    assert.ok(marker.indexOf("classList.add('wipe')") < marker.indexOf("classList.add('flash')"));
  });

  it('preview and entry barriers are waitForEvent, not sleep magic numbers', () => {
    assert.equal(app.includes('setTimeout(r, 300)'), false);
    assert.equal(app.includes('setTimeout(1200)'), false);
    assert.equal(/setTimeout\(\(\) => rowEl\.classList\.remove\('queue-row-enter'\), 1200\)/.test(app), false);
    const gap = fnBody(app, 'openInsertGap');
    assert.match(gap, /waitForEvent\(gap, 'transitionend'/);
    const settle = fnBody(app, 'playRowArrival');
    assert.match(settle, /waitForEvent\(rowEl, 'animationend'/);
  });

  it('advance pins the head through narration, then the successor lands before the head slides out', () => {
    const loop = fnBody(app, 'advance');
    const post = loop.indexOf('/tick');
    const pin = loop.indexOf('pinProcessedHead(processedHead)');
    const narrate = loop.indexOf('awaitNarration(');
    const both = loop.indexOf('await Promise.all([narrateP, visualsP])');
    const release = loop.indexOf('releaseProcessedHead(processedHead');
    assert.ok(post >= 0 && pin > post && narrate > pin && both > narrate && release > both,
      'order is POST → pin → narrate → await both → release head');
    const releaseFn = fnBodyUntilNext(app, 'async function releaseProcessedHead', ['function measuredRowHeight']);
    // Exit is the last action. The successor is inserted by playQueueTransition
    // before this function runs — release only slides the processed box out.
    assert.equal(releaseFn.includes('isEnemyQueueHead'), false);
    assert.match(releaseFn, /runQueueRemoval/);
    assert.match(releaseFn, /animationsSkipped/);
    assert.equal(releaseFn.includes('updateQueueRowInPlace'), false,
      'the processed box is removed, not relabeled into its successor');
    const insertAt = loop.indexOf('playQueueTransition(');
    assert.ok(insertAt > both && release > insertAt,
      'successor slides in before the processed box slides out');
    const popFn = fnBodyUntilNext(app, 'function silentPopHead', ['Slide departing boxes out']);
    assert.equal(popFn.includes('runQueueRemoval'), false, 'pop marks exiting; the lift stays in releaseProcessedHead');
    assert.match(popFn, /markQueueRowExiting/, 'animated path slides out with queue-row-exit');
    assert.match(popFn, /animationsSkipped/);
    assert.ok(popFn.indexOf('animationsSkipped') < popFn.indexOf('row.remove()'),
      'instant remove stays on the skipped path only');
    assert.ok(popFn.indexOf('row.remove()') < popFn.indexOf('markQueueRowExiting'),
      'row.remove() is not the animated branch');
    assert.match(loop, /playQueueTransition\(/, 'advance delegates the queue-transition arrival sequence');
    assert.equal(loop.includes('playRowArrival'), false, 'advance does not inline the arrival sequence');
    const transition = fnBodyUntilNext(app, 'async function playQueueTransition', ['async function awaitTickVisuals']);
    const arrivalAt = transition.indexOf('playRowArrival');
    const readyRemove = transition.indexOf('runQueueRemoval([c.ready.id])');
    assert.ok(arrivalAt >= 0 && readyRemove > arrivalAt, 'playQueueTransition: attack arrival before ready slide-out');
  });

  it('live render follows engine array order and does not re-sort or rebuild a same-id tick', () => {
    const queueRender = read('js/battle/queue-render.js');
    const render = fnBodyUntilNext(queueRender, 'function renderQueue', ['function diffQueueForAnimation']);
    const arrival = fnBodyUntilNext(app, 'async function playRowArrival', ['async function awaitTickVisuals']);
    assert.equal(render.includes('sortQueueRows'), false, 'renderQueue must not sort');
    assert.equal(arrival.includes('sortQueueRows'), false, 'playRowArrival must not sort');
    assert.ok(render.indexOf('updateQueueRowInPlace') >= 0 && render.indexOf('updateQueueRowInPlace') < render.indexOf('buildQueueRow'),
      'same-id path updates in place before any rebuild');
    assert.equal(render.includes('clearQueueDom'), true, 'rebuild remains the fallback for a real shape change');
    const intro = app.indexOf('function playIntroCountdown');
    // appendFeedLine moved to js/battle/feed-render.js (PC-78); clearIntroTimer is the next function.
    const afterIntro = app.indexOf('function clearIntroTimer');
    assert.ok(queueRender.includes('function sortQueueRows'), 'sortQueueRows is defined for the intro theater only');
    assert.equal(app.includes('function sortQueueRows'), false, 'live battle-app.js does not redefine the intro sort');
    let from = 0;
    while (true) {
      const at = app.indexOf('sortQueueRows(', from);
      if (at < 0) break;
      assert.ok(at > intro && at < afterIntro, 'sortQueueRows calls stay inside the intro theater');
      from = at + 1;
    }
  });

  it('hand-ready commit plays the arrival sequence before the ready row slides out', () => {
    const commit = fnBody(app, 'playCommitArrival');
    const removeAt = commit.indexOf('runQueueRemoval');
    const arrivalAt = commit.indexOf('playRowArrival');
    assert.ok(arrivalAt >= 0 && removeAt > arrivalAt, 'attack lands, then ready row slides out');
    assert.ok(commit.indexOf('replaceReadyWithSuccessor') >= 0 && commit.indexOf('replaceReadyWithSuccessor') < arrivalAt,
      'commit arrival applies the queue mutation before painting the successor');
    assert.match(commit, /await Promise\.all\(\[narrateP, visualP\]\)/);
    const insert = fnBodyUntilNext(app, 'async _runInsert()', ['class BattleClock', 'async _runResolve()', 'async _renderNew()']);
    assert.equal(insert.includes('resolved.length === 0'), false);
    const renderNew = fnBodyUntilNext(app, 'async _renderNew()', ['/** All done']);
    assert.match(renderNew, /playQueueTransition\(/, 'battle clock delegates the queue-transition arrival sequence');
    assert.equal(renderNew.includes('playRowArrival'), false, 'battle clock does not inline the arrival sequence');
    assert.equal(renderNew.includes('runQueueRemoval'), false, 'battle clock does not inline the ready slide-out');
    const transition = fnBodyUntilNext(app, 'async function playQueueTransition', ['async function awaitTickVisuals']);
    const clockArrival = transition.indexOf('playRowArrival');
    const clockRemove = transition.indexOf('runQueueRemoval');
    assert.ok(clockArrival >= 0 && clockRemove > clockArrival, 'battle clock: attack arrival before ready slide-out');
  });

  it('tic-only change relabels in place — no slide', () => {
    const queueRender = read('js/battle/queue-render.js');
    const render = fnBodyUntilNext(queueRender, 'function renderQueue', ['function diffQueueForAnimation']);
    assert.match(render, /queueEventIdentity/);
    assert.match(render, /currentIdent\.every\(/, 'fast path compares (label, event)');
    const branchStart = render.indexOf('currentIdent.every');
    const branchEnd = render.indexOf('return;', branchStart);
    const branch = render.slice(branchStart, branchEnd);
    assert.ok(branch.includes('updateQueueRowInPlace'), 'tic path updates the number in place');
    assert.equal(branch.includes('queue-row-exit'), false, 'tic path does not slide out');
    assert.equal(branch.includes('markQueueRowExiting'), false, 'tic path does not mark an exit');
    assert.equal(branch.includes('insertBefore'), false, 'tic path does not move a node');
    const upd = fnBodyUntilNext(queueRender, 'function updateQueueRowInPlace', ['function sortQueueRows']);
    assert.equal(upd.includes('armQueueRowEnter'), false, 'in-place update does not play an enter slide');
    assert.equal(upd.includes('queue-row-exit'), false, 'in-place update does not exit');
    assert.match(upd, /prevEvent !== nextEvent/, 'a phase change is refused — not painted onto this node');
  });

  it('event change is remove + insert, and the processed box exits last', () => {
    const loop = fnBody(app, 'advance');
    const insertAt = loop.indexOf('playQueueTransition(');
    const releaseAt = loop.indexOf('releaseProcessedHead(processedHead');
    assert.ok(insertAt >= 0 && releaseAt > insertAt, 'new box slides in before the processed box slides out');
    assert.equal(loop.includes('playRowArrival'), false, 'advance delegates the row-arrival');
    const releaseFn = fnBodyUntilNext(app, 'async function releaseProcessedHead', ['function measuredRowHeight']);
    assert.match(releaseFn, /runQueueRemoval/, 'departing boxes slide out');
    assert.equal(releaseFn.includes('updateQueueRowInPlace'), false, 'exit does not relabel the departing box');
    const commit = fnBodyUntilNext(app, 'async function playCommitArrival', ['function showMessage']);
    assert.ok(commit.indexOf('playRowArrival') < commit.indexOf('runQueueRemoval'),
      'a commit inserts the new entry before the ready box exits');
    assert.equal(commit.includes('updateQueueRowInPlace'), false, 'a commit is a new entry, not an in-place relabel');
    const diff = fnBodyUntilNext(read('js/battle/queue-render.js'), 'function diffQueueForAnimation', ['function isReconciledQueueRow']);
    assert.match(diff, /queueEventIdentity/);
    assert.equal(diff.includes('queueRowKey'), false);
  });

  it('monster recovering → preparing to attack relabels in place', () => {
    const queueRender = read('js/battle/queue-render.js');
    const relabel = fnBodyUntilNext(app, 'function relabelMonsterPreparing', ['Mark a processed head for exit']);
    assert.match(relabel, /updateQueueRowInPlace/);
    assert.match(relabel, /dataset\.preparing/);
    assert.equal(relabel.includes('runQueueRemoval'), false, 'the preparing swap does not slide the box out');
    assert.equal(relabel.includes('markQueueRowExiting'), false, 'the preparing swap does not mark an exit');
    assert.match(queueRender, /preparing to attack/);
    const loop = fnBody(app, 'advance');
    const pin = loop.indexOf('pinProcessedHead(processedHead)');
    const relabelCall = loop.indexOf('relabelMonsterPreparing(');
    const narrate = loop.indexOf('awaitNarration(');
    assert.ok(pin >= 0 && relabelCall > pin && narrate > relabelCall,
      'text swaps while the box is pinned, before narration finishes');
  });

  it('a hand reaching Ready at the top relabels in place — no slide-out, no slide-in', () => {
    const relabel = fnBodyUntilNext(app, 'function relabelHandReady', ['function relabelMonsterPreparing']);
    assert.match(relabel, /updateQueueRowInPlace/, 'cooldown/approach → ready reuses the in-place relabel');
    assert.equal(relabel.includes('queue-row-exit'), false, 'the ready swap does not slide the box out');
    assert.equal(relabel.includes('queue-row-enter'), false, 'the ready swap does not slide a new box in');
    assert.equal(relabel.includes('runQueueRemoval'), false, 'the ready swap does not remove the node');
    assert.equal(relabel.includes('markQueueRowExiting'), false, 'the ready swap does not mark an exit');
    assert.equal(relabel.includes('playQueueTransition'), false);
    assert.equal(relabel.includes('playRowArrival'), false);
    const loop = fnBody(app, 'advance');
    const relabelCall = loop.indexOf('relabelHandReady(');
    const narrate = loop.indexOf('awaitNarration(');
    const insertAt = loop.indexOf('playQueueTransition(');
    const releaseAt = loop.indexOf('releaseProcessedHead(processedHead');
    assert.ok(relabelCall >= 0 && narrate > relabelCall, 'text swaps while the box holds, before narration');
    assert.ok(insertAt > relabelCall && releaseAt > insertAt, 'a real successor still slides in before a processed box slides out');
    const changes = fnBodyUntilNext(app, 'function queueEventChanges', ['function pinProcessedHead']);
    assert.match(changes, /isHandReadyRelabel/, 'cooldown/approach → ready is not classified as remove+insert');
    assert.match(changes, /relabels/);
    const queueRender = read('js/battle/queue-render.js');
    const helper = fnBodyUntilNext(queueRender, 'function isHandReadyRelabel', ['function domRowSnapshot']);
    assert.match(helper, /cooldown/);
    assert.match(helper, /approach/);
    assert.match(helper, /ready/);
    const upd = fnBodyUntilNext(queueRender, 'function updateQueueRowInPlace', ['function sortQueueRows']);
    assert.match(upd, /isHandReadyRelabel/, 'the in-place update accepts a hand reaching Ready');
    assert.match(upd, /prevEvent !== nextEvent/, 'any other phase change is still refused');
    assert.match(upd, /ticSpan\.textContent = '—'/ , 'the countdown number swaps to the actionable signal');
    assert.equal(upd.includes('queue-row-exit'), false, 'in-place update does not exit');
    assert.equal(upd.includes('queue-row-enter'), false, 'in-place update does not enter');
    assert.equal(app.includes('reseatSameKeySuccessor'), false);
    assert.equal(app.includes('queueRowKey'), false);
    const engine = read('js/combat/engine.js');
    const mark = fnBodyUntilNext(engine, 'function markHandReady', ['function handleHandFire']);
    assert.equal(/addEvent\(/.test(mark), false, 'markHandReady does not insert a fresh ready row');
    assert.match(mark, /row\.event = 'ready'/);
    const hand = fnBodyUntilNext(engine, 'function handleHandFire', ['function resolveMonsterImpact']);
    assert.equal(/addEvent\([^)]*'ready'/.test(hand), false, 'cooldown/approach fire path does not addEvent a ready row');
    assert.match(hand, /row\.event === 'cooldown'/);
    assert.match(hand, /row\.event === 'approach'/);
    assert.match(hand, /markHandReady\(state, row\)/);
  });

  it('renderQueue fast path compares (label, event), not raw ids (no node move on tic)', () => {
    const queueRender = read('js/battle/queue-render.js');
    const render = fnBodyUntilNext(queueRender, 'function renderQueue', ['function diffQueueForAnimation']);
    assert.match(render, /queueEventIdentity/, 'fast path derives identity from label + event');
    assert.match(render, /domEventIdentity/);
    assert.match(queueRender, /dataset\.queueLabel/);
    assert.match(queueRender, /dataset\.queueEvent/);
    assert.match(render, /currentIdent\.every\(/);
    assert.equal(render.includes('queueRowKey'), false);
    assert.equal(render.includes('stableKey'), false);
    const upd = render.indexOf('updateQueueRowInPlace');
    const clear = render.indexOf('clearQueueDom()');
    assert.ok(upd >= 0 && upd < clear, 'in-place tic update returns before any rebuild');
    assert.ok(render.slice(0, clear).includes('return;'));
    assert.equal(render.includes('insertBefore'), false, 'a tic does not move a node');
  });
});

function handRows(eng, label) {
  return persisted(eng).queue.filter(r => r.label === label);
}

describe('PC-DEC-071 hand reaching Ready is a relabel', () => {
  it('approach → ready relabels in place (same entry, clock pauses)', () => {
    const eng = createEngine(seededRNG(3));
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 8 },
      monsters: [{ id: 1, max_hp: 80, damage: 1, speed: 8, accuracy: 1, label: 'A' }]
    });
    const head = peekHead(persisted(eng).queue);
    assert.equal(head.label, 'LH');
    assert.equal(head.event, 'approach');
    const result = eng.tick();
    const lh = handRows(eng, 'LH');
    assert.equal(lh.length, 1, 'one row per hand');
    assert.equal(lh[0].id, head.id, 'same entry, not a fresh insert');
    assert.equal(lh[0].event, 'ready');
    assert.equal(lh[0].tics, 0);
    assert.equal(result.row.id, head.id);
    assert.equal(result.needsInput, true);
    assert.equal(result.playerReady, true);
    assert.equal(peekHead(persisted(eng).queue).id, head.id);
    assert.equal(persisted(eng).player.hands.LH.state, 'Ready');
    assert.ok(persisted(eng).feed.some(l => l.includes('LH Ready')));
  });

  it('cooldown → ready relabels in place (same entry, no second row)', () => {
    const eng = createEngine(seededRNG(5));
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 20, hand_r_speed: 20 },
      monsters: [{ id: 1, max_hp: 80, damage: 1, speed: 20, accuracy: 1, label: 'A' }]
    });
    writeState(eng, snap => {
      snap.queue = [
        { id: 'cd-lh', label: 'LH', event: 'cooldown', tics: 2 },
        { id: 'ap-rh', label: 'RH', event: 'approach', tics: 12 },
        { id: 'mon-a', label: 'A', event: 'cooldown', tics: 12 }
      ];
      snap.player.hands.LH.state = 'winding';
      snap.player.hands.RH.state = 'Approach';
    });
    const result = eng.tick();
    const lh = handRows(eng, 'LH');
    assert.equal(lh.length, 1);
    assert.equal(lh[0].id, 'cd-lh', 'cooldown box became Ready; it was not replaced');
    assert.equal(lh[0].event, 'ready');
    assert.equal(lh[0].tics, 0);
    assert.equal(result.playerReady, true);
    assert.equal(result.needsInput, true);
    assert.equal(persisted(eng).queue.some(r => r.id === 'cd-lh' && r.event === 'ready'), true);
    assert.equal(persisted(eng).player.hands.LH.state, 'Ready');
  });

  it('a processed head is still remove + insert: successor first, exit last', () => {
    const eng = createEngine(seededRNG(9));
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 40 },
      monsters: [{ id: 1, max_hp: 500, damage: 1, speed: 40, accuracy: 1, label: 'A' }]
    });
    eng.tick();
    const ready = handRows(eng, 'LH')[0];
    assert.equal(ready.event, 'ready');
    const committed = eng.commitAttack('LH', 1, [1], {
      castTicks: 1, cooldownTicks: 1, playerDamage: 1, playerAccuracy: 0, attackName: 'Attack'
    });
    assert.equal(committed.removed.id, ready.id, 'player commit removes the ready head');
    assert.equal(committed.inserted.event, 'winding');
    assert.notEqual(committed.inserted.id, ready.id, 'the successor is a new entry');
    assert.equal(persisted(eng).queue.some(r => r.id === ready.id), false);
    assert.equal(handRows(eng, 'LH').length, 1);

    const winding = handRows(eng, 'LH')[0];
    const fired = eng.tick();
    assert.equal(fired.row.id, winding.id, 'clock fire returns the processed winding head');
    assert.equal(persisted(eng).queue.some(r => r.id === winding.id), false, 'processed head is removed');
    const impact = handRows(eng, 'LH')[0];
    assert.equal(impact.event, 'impact');
    assert.notEqual(impact.id, winding.id, 'impact is an insert, not a relabel');
    assert.equal(handRows(eng, 'LH').length, 1);
  });

  it('one row per hand through ready → winding → impact → cooldown → ready', () => {
    const eng = createEngine(seededRNG(11));
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 40 },
      monsters: [{ id: 1, max_hp: 500, damage: 1, speed: 40, accuracy: 1, label: 'A' }]
    });
    const approachId = peekHead(persisted(eng).queue).id;
    eng.tick();
    assert.equal(handRows(eng, 'LH').length, 1);
    assert.equal(handRows(eng, 'LH')[0].id, approachId);
    assert.equal(handRows(eng, 'LH')[0].event, 'ready');

    eng.commitAttack('LH', 1, [1], {
      castTicks: 1, cooldownTicks: 1, playerDamage: 1, playerAccuracy: 0, attackName: 'Attack'
    });
    assert.equal(handRows(eng, 'LH').length, 1);
    assert.equal(handRows(eng, 'LH')[0].event, 'winding');

    eng.tick();
    assert.equal(handRows(eng, 'LH').length, 1);
    assert.equal(handRows(eng, 'LH')[0].event, 'impact');

    eng.tick();
    const cooldown = handRows(eng, 'LH')[0];
    assert.equal(handRows(eng, 'LH').length, 1);
    assert.equal(cooldown.event, 'cooldown');

    const result = eng.tick();
    const ready = handRows(eng, 'LH');
    assert.equal(ready.length, 1, 'cooldown → ready did not insert a second hand row');
    assert.equal(ready[0].id, cooldown.id, 'the cooldown entry became Ready');
    assert.equal(ready[0].event, 'ready');
    assert.equal(ready[0].tics, 0);
    assert.equal(result.playerReady, true);
    assert.equal(result.needsInput, true);
    assert.equal(handRows(eng, 'RH').length, 1);
  });
});
