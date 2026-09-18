// js/combat/tic-queue.js
// Pure ESM. Sorted array of {id, label, event, tics}. tick() decrements, fires at 0.
// Player-first on ties. Re-sort only on commit. Hand rows morph (identity preserved).
// F5: collision-free IDs via crypto.randomUUID() (stateless serverless safe).

export function createQueue() {
  return [];
}

export function addEvent(queue, label, event, tics, id = null) {
  const entry = { id: id ?? globalThis.crypto.randomUUID(), label, event, tics };
  queue.push(entry);
  // stable insert; sort only on commit per spec
  return entry;
}

export function tick(queue, onFire, skip = 1) {
  // PC-66: time-skip — subtract `skip` (default 1 = old per-tic behavior) from
  // every row at once and fire the rows that land on 0. Callers that jump a
  // gap pass the gap; callers processing a single iteration pass 1. Rows are
  // clamped at 0 so morphed 0-tic rows (winding → impact) fire every iteration
  // until their handler moves them on — exactly the old per-tic behavior.
  const fired = [];
  for (const row of queue) {
    row.tics = Math.max(0, row.tics - skip);
    if (row.tics === 0) {
      fired.push(row);
    }
  }
  // Fire in player-first order (LH/RH before monster labels)
  fired.sort((a, b) => {
    const aPlayer = a.label === 'LH' || a.label === 'RH' ? 0 : 1;
    const bPlayer = b.label === 'LH' || b.label === 'RH' ? 0 : 1;
    if (aPlayer !== bPlayer) return aPlayer - bPlayer;
    return 0; // stable
  });
  for (const row of fired) {
    onFire(row);
  }
  // F15: removed dead cleanup branch for never-emitted 'ready'/'*_land' events.
  // Actual events ('winding','impact','cooldown','attack') are removed inside handleFire where appropriate.
  // Rows with tics===0 after morph stay until their final handler removes them.
  return fired;
}

export function sortQueue(queue) {
  queue.sort((a, b) => {
    if (a.tics !== b.tics) return a.tics - b.tics;
    const aPlayer = a.label === 'LH' || a.label === 'RH' ? 0 : 1;
    const bPlayer = b.label === 'LH' || b.label === 'RH' ? 0 : 1;
    if (aPlayer !== bPlayer) return aPlayer - bPlayer;
    return 0;
  });
}

export function commitNewRow(queue, label, event, tics) {
  const entry = addEvent(queue, label, event, tics);
  sortQueue(queue);
  return entry;
}

export function morphHandRow(queue, handLabel, newEvent, newTics) {
  const row = queue.find(r => r.label === handLabel);
  if (row) {
    row.event = newEvent;
    row.tics = newTics;
    sortQueue(queue);
  }
  return row;
}

// PC-56: computeTimingMarkers returns bar info for prediction bar UX
// Returns:
//   {kind: 'bar', firstId: string, lastId: string} — ALWAYS a bar covering the timing range,
//     expanded to the nearest boundary row(s) when no row falls inside [minT, maxT].
//     firstId is the first row with tics >= minT (or the last row with tics < minT if none).
//     lastId is the last row with tics <= maxT (or the first row with tics > maxT if none).
//   null — empty queue or no attack
export function computeTimingMarkers(queue, attack, weaponSpeed = 0) {
  if (!queue || queue.length === 0 || !attack) return null;
  const minT = Number(weaponSpeed) + Number(attack.prepare_time || attack.prepareTime || 0);
  const range = Number(attack.prepare_time_range || attack.prepareTimeRange || 0);
  const maxT = minT + range;
  const sorted = [...queue].sort((a, b) => a.tics - b.tics);
  // Inclusive: rows with tics within [minT, maxT]
  const inside = sorted.filter(r => r.tics >= minT && r.tics <= maxT);
  if (inside.length > 0) {
    return { kind: 'bar', firstId: inside[0].id, lastId: inside[inside.length - 1].id };
  }
  // No row inside: expand to nearest boundary rows
  const before = sorted.filter(r => r.tics < minT);
  const after = sorted.filter(r => r.tics > maxT);
  const firstId = before.length > 0 ? before[before.length - 1].id : sorted[0].id;
  const lastId = after.length > 0 ? after[0].id : sorted[sorted.length - 1].id;
  return { kind: 'bar', firstId, lastId };
}
