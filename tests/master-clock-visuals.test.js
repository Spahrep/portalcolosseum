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
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 2 },
      monsters: [{ id: 1, max_hp: 80, damage: 10, speed: 8, accuracy: 70, label: 'A' }]
    });
    // startBattle leaves the tic-0 seed. Rewind anyway so this test still
    // proves tick() processes the peeked approach head, not a later row.
    const intro = persisted(eng).intro;
    writeState(eng, snap => {
      snap.tic = 0;
      snap.queue = intro.rows.map(r => ({ ...r }));
      snap.player.hands.LH.state = 'Approach';
      snap.player.hands.RH.state = 'Approach';
      snap.player.hp = intro.hpStart;
      snap.feed = [...(intro.seedFeed || [])];
    });
    const head = peekHead(persisted(eng).queue);
    assert.ok(head, 'queue has a non-ready head');
    // LH approach key 1 is ahead of RH 2 and the monster cooldown (speed 8).
    assert.equal(head.label, 'LH');
    assert.equal(head.event, 'approach');
    assert.equal(head.tics, 1);
    const feedBefore = persisted(eng).feed.length;
    const result = eng.tick();
    assert.equal(result.row.id, head.id, 'tick returns the peeked head');
    assert.equal(result.row.event, 'approach');
    assert.equal(persisted(eng).queue.some(r => r.id === head.id), false, 'processed head is gone after tick');
    assert.ok(persisted(eng).feed.length > feedBefore, 'process ran and wrote narration before return');
    assert.equal(persisted(eng).player.hands.LH.state, 'Ready');
    assert.equal(result.needsInput, true, 'approach insert leaves a ready head, so the clock pauses');
    assert.equal(peekHead(persisted(eng).queue).event, 'ready');
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

  it('a hand landing on READY at the head is remove + insert — ready slides in, cooldown slides out', () => {
    const loop = fnBody(app, 'advance');
    const insertAt = loop.indexOf('playQueueTransition(');
    const releaseAt = loop.indexOf('releaseProcessedHead(processedHead');
    assert.ok(insertAt >= 0 && releaseAt > insertAt,
      'the ready box slides in before the cooldown box slides out');
    const releaseFn = fnBodyUntilNext(app, 'async function releaseProcessedHead', ['function measuredRowHeight']);
    assert.match(releaseFn, /runQueueRemoval/);
    assert.equal(releaseFn.includes('updateQueueRowInPlace'), false,
      'cooldown→ready does not relabel the cooldown node into ready');
    assert.equal(app.includes('reseatSameKeySuccessor'), false);
    assert.equal(app.includes('queueRowKey'), false);
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
