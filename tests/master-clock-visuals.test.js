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
    // startBattle advances to the first decision. Rewind to the seeded queue
    // so this test still proves tick() processes the peeked approach head.
    const intro = eng.state.intro;
    eng.state.tic = 0;
    eng.state.queue = intro.rows.map(r => ({ ...r }));
    eng.state.player.hands.LH.state = 'Approach';
    eng.state.player.hands.RH.state = 'Approach';
    eng.state.player.hp = intro.hpStart;
    eng.state.feed = [...(intro.seedFeed || [])];
    const head = peekHead(eng.state.queue);
    assert.ok(head, 'queue has a non-ready head');
    // LH approach key 1 is ahead of RH 2 and the monster attack (speed 8 + prepare 1).
    assert.equal(head.label, 'LH');
    assert.equal(head.event, 'approach');
    assert.equal(head.tics, 1);
    const feedBefore = eng.state.feed.length;
    const result = eng.tick();
    assert.equal(result.row, head, 'tick returns the peeked head');
    assert.equal(result.row.event, 'approach');
    assert.equal(eng.state.queue.includes(head), false, 'processed head is gone after tick');
    assert.ok(eng.state.feed.length > feedBefore, 'process ran and wrote narration before return');
    assert.equal(eng.state.player.hands.LH.state, 'Ready');
    assert.equal(result.needsInput, true, 'approach insert leaves a ready head, so the clock pauses');
    assert.equal(peekHead(eng.state.queue).event, 'ready');
  });

  it('tick() source removes the head before process', () => {
    const src = read('js/combat/engine.js');
    const tick = src.slice(src.indexOf('function tick()'), src.indexOf('function legacyNonReadyIndex'));
    const processAt = tick.indexOf('process(removed)');
    const removeAt = tick.indexOf('const removed = remove()');
    assert.ok(removeAt > 0, 'remove() is in tick()');
    assert.ok(processAt > removeAt, 'remove() fires before process — a ready head is not this path');
    assert.match(tick, /row: removed/);
    assert.match(tick, /head\.event === 'ready'/);
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

  it('tickLoop pins the head through narration, then the successor lands before the head slides out', () => {
    const loop = fnBody(app, 'tickLoop');
    const post = loop.indexOf('/tick');
    const pin = loop.indexOf('pinProcessedHead(processedHead)');
    const narrate = loop.indexOf('awaitNarration(');
    const both = loop.indexOf('await Promise.all([narrateP, visualsP])');
    const release = loop.indexOf('releaseProcessedHead(processedHead');
    assert.ok(post >= 0 && pin > post && narrate > pin && both > narrate && release > both,
      'order is POST → pin → narrate → await both → release head');
    const releaseFn = fnBodyUntilNext(app, 'async function releaseProcessedHead', ['function measuredRowHeight']);
    // PC-107: player hands use the same reseat-then-exit order as enemies.
    // The old isEnemyQueueHead early-return pinned the silent pop.
    assert.equal(releaseFn.includes('isEnemyQueueHead'), false);
    assert.match(releaseFn, /runQueueRemoval/);
    assert.match(releaseFn, /reseatSameKeySuccessor/);
    assert.match(releaseFn, /animationsSkipped/);
    assert.ok(releaseFn.indexOf('reseatSameKeySuccessor') < releaseFn.indexOf('runQueueRemoval'),
      'successor lands before the processed row leaves');
    const popFn = fnBodyUntilNext(app, 'function silentPopHead', ['function reseatSameKeySuccessor']);
    assert.equal(popFn.includes('runQueueRemoval'), false, 'pop marks exiting; the lift stays in releaseProcessedHead');
    assert.match(popFn, /markQueueRowExiting/, 'animated path slides out with queue-row-exit');
    assert.match(popFn, /animationsSkipped/);
    assert.ok(popFn.indexOf('animationsSkipped') < popFn.indexOf('row.remove()'),
      'instant remove stays on the skipped path only');
    assert.ok(popFn.indexOf('row.remove()') < popFn.indexOf('markQueueRowExiting'),
      'row.remove() is not the animated branch');
    const reseatFn = fnBodyUntilNext(app, 'function reseatSameKeySuccessor', ['async function releaseProcessedHead']);
    assert.match(reseatFn, /armQueueRowEnter/);
    assert.match(reseatFn, /animationsSkipped/);
    assert.equal(/buildQueueRow\(successor,\s*monsters,\s*bs,\s*true\)/.test(reseatFn), false,
      '4th arg is withMarkers, not the enter flag');
    assert.match(loop, /runQueueRemoval/); // non-head path still slides
    const ceremonyAt = loop.indexOf('playInsertCeremony');
    const readyRemove = loop.indexOf('runQueueRemoval([c.ready.id])');
    assert.ok(ceremonyAt >= 0 && readyRemove > ceremonyAt, 'tickLoop: attack ceremony before ready slide-out');
  });

  it('live render follows engine array order and does not re-sort or rebuild a same-id tick', () => {
    const queueRender = read('js/battle/queue-render.js');
    const render = fnBodyUntilNext(queueRender, 'function renderQueue', ['function diffQueueForAnimation']);
    const ceremony = fnBodyUntilNext(app, 'async function playInsertCeremony', ['async function awaitTickVisuals']);
    assert.equal(render.includes('sortQueueRows'), false, 'renderQueue must not sort');
    assert.equal(ceremony.includes('sortQueueRows'), false, 'playInsertCeremony must not sort');
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

  it('hand-ready commit plays the ceremony before the ready row slides out', () => {
    const commit = fnBody(app, 'playCommitArrival');
    const removeAt = commit.indexOf('runQueueRemoval');
    const ceremonyAt = commit.indexOf('playInsertCeremony');
    assert.ok(ceremonyAt >= 0 && removeAt > ceremonyAt, 'attack lands, then ready row slides out');
    assert.ok(commit.indexOf('replaceReadyWithSuccessor') >= 0 && commit.indexOf('replaceReadyWithSuccessor') < ceremonyAt,
      'ceremony applies the queue mutation before painting the successor');
    assert.match(commit, /await Promise\.all\(\[narrateP, visualP\]\)/);
    const insert = fnBodyUntilNext(app, 'async _runInsert()', ['class BattleClock', 'async _runResolve()', 'async _renderNew()']);
    assert.equal(insert.includes('resolved.length === 0'), false);
    const renderNew = fnBodyUntilNext(app, 'async _renderNew()', ['/** All done']);
    const clockCeremony = renderNew.indexOf('playInsertCeremony');
    const clockRemove = renderNew.indexOf('runQueueRemoval');
    assert.ok(clockCeremony >= 0 && clockRemove > clockCeremony, 'battle clock: attack ceremony before ready slide-out');
  });

  it('same-key phase change arms the enter class without rebuilding the queue', () => {
    const queueRender = read('js/battle/queue-render.js');
    const upd = fnBodyUntilNext(queueRender, 'function updateQueueRowInPlace', ['function sortQueueRows']);
    assert.match(upd, /dataset\.queueEvent/);
    assert.match(upd, /armQueueRowEnter/);
    const arm = fnBodyUntilNext(queueRender, 'function armQueueRowEnter', ['function monsterQueueName']);
    assert.match(arm, /queue-row-enter/);
    assert.match(arm, /queue-row-monster-enter/);
    assert.match(arm, /queueAnimationsSkipped/);
    const render = fnBodyUntilNext(queueRender, 'function renderQueue', ['function diffQueueForAnimation']);
    const stable = render.indexOf('domKeys.size === newKeys.length');
    const clear = render.indexOf('clearQueueDom()');
    assert.ok(stable >= 0 && clear > stable, 'stable-key path returns before any full rebuild');
    assert.ok(render.slice(stable, clear).includes('return;'), 'stable-key path does not fall through to clearQueueDom');
    assert.equal(render.slice(stable, clear).includes('clearQueueDom'), false);
  });

  it('monster winding, impact, and cooldown stay one stable key', () => {
    const queueRender = read('js/battle/queue-render.js');
    const keyFn = fnBodyUntilNext(queueRender, 'function queueRowKey', ['function isMonsterLabel']);
    assert.match(keyFn, /row\.event === 'winding'/);
    assert.match(keyFn, /row\.event === 'impact'/);
    assert.match(keyFn, /row\.event === 'cooldown'/);
    assert.match(keyFn, /`m:\$\{row\.label\}`/);
  });
});
