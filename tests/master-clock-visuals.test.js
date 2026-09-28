import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import createEngine from '../js/combat/engine.js';
import { peekHead } from '../js/combat/tic-queue.js';

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
    const head = peekHead(eng.state.queue);
    assert.ok(head, 'queue has a non-ready head');
    assert.equal(head.event, 'attack', 'monster attack is inserted before approach rows');
    const feedBefore = eng.state.feed.length;
    const result = eng.tick();
    assert.equal(result.row, head, 'tick returns the peeked head');
    assert.equal(result.row.event, 'attack');
    assert.equal(eng.state.queue.includes(head), false, 'processed head is gone after tick');
    assert.ok(eng.state.feed.length > feedBefore, 'process ran and wrote narration before return');
    assert.equal(eng.state.player.hands.LH.state, 'Approach', 'approach rows stay behind the inserted-first attack');
    assert.equal(result.needsInput, false);
  });

  it('tick() source removes only after process', () => {
    const src = read('js/combat/engine.js');
    const tick = src.slice(src.indexOf('function tick()'), src.indexOf('function cancelQueuedAttacksOnDeadTargets'));
    const processAt = tick.indexOf('process(head)');
    const removeAt = tick.indexOf('remove()');
    assert.ok(processAt > 0, 'process(head) is in tick()');
    assert.ok(removeAt > processAt, 'remove() fires after process(head)');
    assert.match(tick, /row: head/);
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
    const settle = fnBody(app, 'playInsertCeremony');
    assert.match(settle, /waitForEvent\(rowEl, 'animationend'/);
  });

  it('tickLoop pins the head through narration, then silent-pops — no exit slide', () => {
    const loop = fnBody(app, 'tickLoop');
    const post = loop.indexOf('/tick');
    const pin = loop.indexOf('pinProcessedHead(processedHead)');
    const narrate = loop.indexOf('awaitNarration(');
    const both = loop.indexOf('await Promise.all([narrateP, visualsP])');
    const pop = loop.indexOf('silentPopHead(processedHead');
    assert.ok(post >= 0 && pin > post && narrate > pin && both > narrate && pop > both,
      'order is POST → pin → narrate → await both → silent pop');
    const popFn = fnBodyUntilNext(app, 'function silentPopHead', ['function measuredRowHeight']);
    assert.equal(popFn.includes('queue-row-exit'), true); // removes the class, does not add it
    assert.equal(/classList\.add\([^)]*queue-row-exit/.test(popFn), false);
    assert.match(popFn, /\.remove\(\)/);
    assert.match(loop, /runQueueRemoval/); // non-head path still slides
  });

  it('hand-ready commit plays the ceremony instead of suppressing it', () => {
    const commit = fnBody(app, 'playCommitArrival');
    const removeAt = commit.indexOf('runQueueRemoval');
    const ceremonyAt = commit.indexOf('playInsertCeremony');
    assert.ok(removeAt >= 0 && ceremonyAt > removeAt, 'ready row leaves, then ceremony');
    assert.match(commit, /await Promise.all\(\[narrateP, visualP\]\)/);
    const insert = fnBodyUntilNext(app, 'async _runInsert()', ['class BattleClock', 'async _runResolve()', 'async _renderNew()']);
    assert.equal(insert.includes('resolved.length === 0'), false);
  });
});
