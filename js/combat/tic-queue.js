// js/combat/tic-queue.js
// Pure ESM. Insertion-ordered list of {id, label, event, tics}.
// Order is frozen at insert (addEvent appends). Tics are display-only and never
// drive order — nothing in this module re-sorts the queue. Head = first non-ready
// row in array order. F5: collision-free IDs via crypto.randomUUID().

export function createQueue() {
  return [];
}

export function addEvent(queue, label, event, tics, id = null) {
  const entry = { id: id ?? globalThis.crypto.randomUUID(), label, event, tics };
  queue.push(entry);
  return entry;
}

// Head = first non-ready row in insertion order. Leading ready rows are skipped.
// Does not sort and does not reorder.
function firstActionableIndex(queue) {
  let headIdx = 0;
  while (headIdx < queue.length && queue[headIdx].event === 'ready') {
    headIdx++;
  }
  return headIdx < queue.length ? headIdx : -1;
}

export function popNext(queue) {
  const headIdx = firstActionableIndex(queue);
  if (headIdx === -1) return null;
  const row = queue[headIdx];
  const ticOffset = row.tics;
  // Countdown readout only — decrement in place, never reorder.
  for (const r of queue) {
    r.tics = Math.max(0, r.tics - ticOffset);
  }
  queue.splice(headIdx, 1);
  return { row, ticOffset };
}

export function peekHead(queue) {
  const headIdx = firstActionableIndex(queue);
  if (headIdx === -1) return null;
  return queue[headIdx];
}

export function removeHead(queue) {
  const headIdx = firstActionableIndex(queue);
  if (headIdx === -1) return null;
  const row = queue[headIdx];
  queue.splice(headIdx, 1);
  return row;
}

export function commitNewRow(queue, label, event, tics) {
  return addEvent(queue, label, event, tics);
}

// PC-56: computeTimingMarkers returns bar info for prediction bar UX.
// The copy-sort below is READ-ONLY and exists only to find [minT, maxT] boundary
// rows for the prediction bar. It does NOT mutate queue order. Queue order is
// insertion order; tics are display values and never drive processing.
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
  // Read-only copy-sort for the PC-56 prediction bar. Not the queue order.
  const barOrder = [...queue].sort((a, b) => a.tics - b.tics);
  // Inclusive: rows with tics within [minT, maxT]
  const inside = barOrder.filter(r => r.tics >= minT && r.tics <= maxT);
  if (inside.length > 0) {
    return { kind: 'bar', firstId: inside[0].id, lastId: inside[inside.length - 1].id, minT, maxT, hasInside: true };
  }
  // No row inside: expand to nearest boundary rows
  const before = barOrder.filter(r => r.tics < minT);
  const after = barOrder.filter(r => r.tics > maxT);
  const firstId = before.length > 0 ? before[before.length - 1].id : barOrder[0].id;
  const lastId = after.length > 0 ? after[0].id : barOrder[barOrder.length - 1].id;
  return { kind: 'bar', firstId, lastId, minT, maxT, hasInside: false };
}
