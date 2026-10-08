import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine from '../js/combat/engine.js';
import { peekHead } from '../js/combat/tic-queue.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Queue rows are pushed in the given order. orderedInsertIndex is not used,
// so "listed before" is the frozen array order peekHead walks.
function engineWith(queue, hands = {}) {
  const eng = createEngine(seededRNG(7));
  eng.startBattle({
    loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 2 },
    monsters: [{ id: 1, name: 'Wolf', max_hp: 80, damage: 10, speed: 8, accuracy: 70, label: 'A' }]
  });
  if (hands.LH) eng.state.player.hands.LH.state = hands.LH;
  if (hands.RH) eng.state.player.hands.RH.state = hands.RH;
  eng.state.queue.length = 0;
  for (const row of queue) eng.state.queue.push({ ...row });
  return eng;
}

function assertNoPrompt(result, why) {
  assert.equal(result.playerReady, false, why);
  assert.equal(result.needsInput, false, why);
}

function assertPrompt(result, why) {
  assert.ok(result.playerReady === true || result.needsInput === true, why);
}

describe('Master clock decision point — queue is the single driver', () => {
  it('(a) monster cooldown at the processing head does not prompt, even if a hand is Ready', () => {
    // LH cooldown fires and flips that hand to Ready, but Wolf recovering
    // is still the processing head. Hand state must not open the menu.
    const eng = engineWith([
      { id: 'lh-cd', label: 'LH', event: 'cooldown', tics: 0 },
      { id: 'wolf-cd', label: 'A', event: 'cooldown', tics: 4 }
    ], { LH: 'cooldown', RH: 'winding' });

    const result = eng.tick();
    assert.equal(result.row.label, 'LH');
    assert.equal(result.row.event, 'cooldown');
    assert.equal(eng.state.player.hands.LH.state, 'Ready');
    const head = peekHead(eng.state.queue);
    assert.equal(head.label, 'A');
    assert.equal(head.event, 'cooldown');
    assertNoPrompt(result, 'wolf cooldown still ahead of the ready row');

    // A cooldown that is itself the head, with a hand already Ready, is the
    // same rule: this tick processes that row and must not prompt while a
    // non-ready successor is still the head.
    const eng2 = engineWith([
      { id: 'wolf-cd', label: 'A', event: 'cooldown', tics: 3 },
      { id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 }
    ], { LH: 'Ready', RH: 'winding' });
    const processed = eng2.tick();
    assert.equal(processed.row.event, 'cooldown');
    assert.equal(processed.row.label, 'A');
    assert.notEqual(peekHead(eng2.state.queue)?.event, 'ready');
    assertNoPrompt(processed, 'processing the cooldown must not prompt from hand state');

    // When nothing non-ready remains and the frozen front is a player ready row, prompt.
    eng2.state.queue.length = 0;
    eng2.state.queue.push({ id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 });
    eng2.state.player.hands.LH.state = 'Approach';
    const prompted = eng2.tick();
    assert.equal(prompted.needsInput, true);
    assert.equal(prompted.playerReady, true);
    assert.equal(prompted.row, null);
  });

  it('(b) monster winding at the head does not prompt until that row is gone and a ready row is the head', () => {
    const eng = engineWith([
      { id: 'wolf-w', label: 'A', event: 'winding', tics: 2, monsterAttackName: 'Bite', cooldownTicks: 3, damage: 10, accuracy: 70 },
      { id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 }
    ], { LH: 'Ready', RH: 'winding' });

    const result = eng.tick();
    assert.equal(result.row.event, 'winding');
    assert.equal(result.row.label, 'A');
    assert.equal(peekHead(eng.state.queue).event, 'impact');
    assertNoPrompt(result, 'impact successor is still ahead of the ready row');

    eng.state.queue.length = 0;
    eng.state.queue.push({ id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 });
    const prompted = eng.tick();
    assertPrompt(prompted, 'ready row is the head');
    assert.equal(prompted.needsInput, true);
  });

  it('(b) monster impact at the head does not prompt while the cooldown successor is still ahead', () => {
    const eng = engineWith([
      { id: 'wolf-i', label: 'A', event: 'impact', tics: 0, monsterAttackName: 'Bite', cooldownTicks: 4, damage: 1, accuracy: 0 },
      { id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 }
    ], { LH: 'Ready', RH: 'winding' });

    const result = eng.tick();
    assert.equal(result.row.event, 'impact');
    const head = peekHead(eng.state.queue);
    assert.equal(head.label, 'A');
    assert.equal(head.event, 'cooldown');
    assertNoPrompt(result, 'wolf recovering is the queue head');

    eng.state.queue.length = 0;
    eng.state.queue.push({ id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 });
    const prompted = eng.tick();
    assert.equal(prompted.needsInput, true);
    assert.equal(prompted.playerReady, true);
  });

  it('(c) same-tic tie at zero processes the wolf winding before the player ready row', () => {
    const eng = engineWith([
      { id: 'wolf-w', label: 'A', event: 'winding', tics: 0, monsterAttackName: 'Bite', cooldownTicks: 2, damage: 10, accuracy: 70 },
      { id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 }
    ], { LH: 'Ready', RH: 'Ready' });

    const result = eng.tick();
    assert.equal(result.row.label, 'A');
    assert.equal(result.row.event, 'winding');
    assertNoPrompt(result, 'doc §11: other events before ready; no premature prompt');
    assert.ok(eng.state.queue.some(r => r.id === 'lh-ready' && r.event === 'ready'));
    assert.notEqual(peekHead(eng.state.queue)?.event, 'ready');
  });

  it('(d) both hands Ready and the queue head is a player ready row prompts', () => {
    const eng = engineWith([
      { id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 },
      { id: 'rh-ready', label: 'RH', event: 'ready', tics: 0 }
    ], { LH: 'Ready', RH: 'Ready' });

    const result = eng.tick();
    assert.equal(result.needsInput, true);
    assert.equal(result.playerReady, true);
    assert.equal(result.row, null);
    assert.equal(eng.state.queue[0].label, 'LH');
    assert.equal(eng.state.queue[0].event, 'ready');
  });

  it('(e) empty queue with no ready rows is done; a ready row with no non-ready rows prompts', () => {
    const empty = engineWith([], { LH: 'Approach', RH: 'Approach' });
    const done = empty.tick();
    assert.deepEqual(done, { done: true });

    // Hand state Ready is not an authority. No ready row → not a decision.
    const stateOnly = engineWith([], { LH: 'Ready', RH: 'winding' });
    assert.deepEqual(stateOnly.tick(), { done: true });

    // Empty of non-ready rows, player ready row at the front → prompt,
    // even if hand state has not been flipped to Ready.
    const ready = engineWith([
      { id: 'lh-ready', label: 'LH', event: 'ready', tics: 0 }
    ], { LH: 'Approach', RH: 'Approach' });
    const prompted = ready.tick();
    assert.equal(prompted.needsInput, true);
    assert.equal(prompted.playerReady, true);
    assert.equal(prompted.row, null);
  });

  it('does not prompt while the other hand winding is still ahead of a ready row', () => {
    const eng = engineWith([
      { id: 'lh-ap', label: 'LH', event: 'approach', tics: 0 },
      { id: 'rh-w', label: 'RH', event: 'winding', tics: 4, cooldownTicks: 2, damage: 10, accuracy: 100, attackName: 'Slash' }
    ], { LH: 'Approach', RH: 'winding' });

    const result = eng.tick();
    assert.equal(result.row.event, 'approach');
    assert.equal(eng.state.player.hands.LH.state, 'Ready');
    assert.equal(peekHead(eng.state.queue).label, 'RH');
    assert.equal(peekHead(eng.state.queue).event, 'winding');
    assertNoPrompt(result, 'other-hand winding is still the processing head');
  });
});
