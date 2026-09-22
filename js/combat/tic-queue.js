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

export function popNext(queue) {
  sortQueue(queue);
  let headIdx = 0;
  while (headIdx < queue.length && queue[headIdx].event === 'ready') {
    headIdx++;
  }
  if (headIdx >= queue.length) return null;
  const row = queue[headIdx];
  const ticOffset = row.tics;
  for (const r of queue) {
    r.tics = Math.max(0, r.tics - ticOffset);
  }
  queue.splice(headIdx, 1);
  return { row, ticOffset };
}

export function peekHead(queue) {
  sortQueue(queue);
  let headIdx = 0;
  while (headIdx < queue.length && queue[headIdx].event === 'ready') {
    headIdx++;
  }
  if (headIdx >= queue.length) return null;
  return queue[headIdx];
}

export function removeHead(queue) {
  sortQueue(queue);
  let headIdx = 0;
  while (headIdx < queue.length && queue[headIdx].event === 'ready') {
    headIdx++;
  }
  if (headIdx >= queue.length) return null;
  const row = queue[headIdx];
  queue.splice(headIdx, 1);
  return row;
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
//   {kind: 'bar', firstId: string, lastId: string, hasInside: boolean}
//     hasInside=true — the bar spans rows that contain the timing range (attack CAN land in these)
//     hasInside=false — no rows fall inside [minT,maxT]; bar sits in the GAP between boundary rows
//     firstId is the first inside row (hasInside=true) or the last row with tics < minT (hasInside=false)
//     lastId is the last inside row (hasInside=true) or the first row with tics > maxT (hasInside=false)
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
    return { kind: 'bar', firstId: inside[0].id, lastId: inside[inside.length - 1].id, minT, maxT, hasInside: true };
  }
  // No row inside: expand to nearest boundary rows
  const before = sorted.filter(r => r.tics < minT);
  const after = sorted.filter(r => r.tics > maxT);
  const firstId = before.length > 0 ? before[before.length - 1].id : sorted[0].id;
  const lastId = after.length > 0 ? after[0].id : sorted[sorted.length - 1].id;
  return { kind: 'bar', firstId, lastId, minT, maxT, hasInside: false };
}
