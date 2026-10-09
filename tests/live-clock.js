// Live-clock helpers. tick() pauses on a ready head and does not skip it.
// Tests that used to walk past a ready row must commit that hand, then tick.

export function persisted(eng) {
  return eng.getPersistedState();
}

export function writeState(eng, mutator) {
  const snap = eng.getPersistedState();
  mutator(snap);
  eng.loadState(snap);
}

function targetIds(snap) {
  const living = (snap.monsters || []).find(m => (m.current_hp || 0) > 0);
  return living ? [living.id] : [];
}

const HOLD = { castTicks: 80, cooldownTicks: 80, playerDamage: 1, playerAccuracy: 0, attackName: 'Hold' };

function parkReadyHead(eng) {
  const snap = eng.getPersistedState();
  const head = snap.queue[0];
  if (!head || head.event !== 'ready') return false;
  eng.commitAttack(head.label, 1, targetIds(snap), HOLD);
  return true;
}

export function tickUntilInput(eng, max = 80) {
  let result = null;
  for (let i = 0; i < max; i++) {
    const head = eng.getPersistedState().queue[0];
    if (head && head.event === 'ready') return eng.tick();
    result = eng.tick();
    if (result.needsInput || result.done || result.battleOver) return result;
  }
  return result;
}

// Surface `hand` as the ready head. A different ready head is parked on a
// long miss so the clock can reach the requested approach.
export function readyHand(eng, hand, max = 40) {
  for (let i = 0; i < max; i++) {
    const snap = eng.getPersistedState();
    const head = snap.queue[0];
    if (head && head.event === 'ready' && head.label === hand && snap.player?.hands?.[hand]?.state === 'Ready') {
      return eng.tick();
    }
    if (!head) break;
    if (head.event === 'ready') {
      parkReadyHead(eng);
      continue;
    }
    const result = eng.tick();
    if (result.done || result.battleOver) break;
  }
  return null;
}

// Tick while pred(getState()) is false. Stops at a ready head — does not skip it.
export function tickUntil(eng, pred, max = 80) {
  let view = eng.getState();
  for (let i = 0; i < max && !pred(view); i++) {
    const result = eng.tick();
    view = eng.getState();
    if (result.done || result.needsInput || result.battleOver) break;
  }
  return view;
}

// Live protocol for an event sitting behind a ready head: commit that hand
// onto a long miss (no HP change), then keep ticking. Do not use this when
// the assertion needs that hand to stay Ready.
export function tickPast(eng, pred, max = 80) {
  let view = eng.getState();
  for (let i = 0; i < max && !pred(view); i++) {
    const snap = eng.getPersistedState();
    const head = snap.queue[0];
    if (!head || view.battle_over || view.player_dead) break;
    if (head.event === 'ready') {
      parkReadyHead(eng);
      view = eng.getState();
      continue;
    }
    const result = eng.tick();
    view = eng.getState();
    if (result.done) break;
  }
  return view;
}

// Like tickPast, but a ready head for `hand` is the stop, not a park.
// Other ready heads are parked so `hand`'s rows can reach the front.
export function tickUntilHand(eng, hand, pred, max = 80) {
  let view = eng.getState();
  for (let i = 0; i < max && !pred(view); i++) {
    const snap = eng.getPersistedState();
    const head = snap.queue[0];
    if (!head || view.battle_over || view.player_dead) break;
    if (head.event === 'ready' && head.label !== hand) {
      parkReadyHead(eng);
      view = eng.getState();
      continue;
    }
    if (head.event === 'ready' && head.label === hand) break;
    const result = eng.tick();
    view = eng.getState();
    if (result.done) break;
  }
  return view;
}

// One live tick of a non-ready head, recorded like the retired capture list:
// the fired event and the successor handleFire already inserted.
export function tickFire(eng, fires) {
  const before = eng.getPersistedState();
  const head = before.queue[0];
  if (!head || head.event === 'ready') return eng.tick();
  eng.tick();
  const after = eng.getPersistedState();
  const successor = after.queue.find(r => r.label === head.label);
  fires.push({
    label: head.label,
    event: head.event,
    after: successor ? { event: successor.event, tics: successor.tics } : null
  });
}
