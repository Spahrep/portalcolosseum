// js/combat/tic-queue.js
// Pure ESM. Ordered list of {id, label, event, tics}.
// `tics` is an ordering key only: each new row is spliced into tics-ascending
// position once, at insert, and the array is never globally re-sorted.
// Ties at the same tic: status/buff/expiry first, then every other event
// (including ready). Within a category: LH before RH before monsters.
// A ready row sharing a tic with a monster impact therefore sorts first
// (player-first). Head = queue[0]. Ready rows are not skipped.
// F5: collision-free IDs via crypto.randomUUID().

export function createQueue() {
  return [];
}

// §7 categories. buff_expiry is inserted with label null and must still sort first.
// ready is a normal event (category 1), not a trailer. Player-first comes from
// label rank: LH, then RH, then monsters.
function tieCategory(entry) {
  const event = entry.event || '';
  if (event === 'buff_expiry' || event === 'status' || event === 'buff' || event === 'dot' || event === 'expiry') {
    return 0;
  }
  return 1;
}

// LH before RH before monsters (and any other label, including null) inside a category.
function labelRank(label) {
  if (label === 'LH') return 0;
  if (label === 'RH') return 1;
  return 2;
}

// Index where `entry` belongs. Does not sort the existing rows.
function orderedInsertIndex(queue, entry) {
  const entryTics = entry.tics ?? 0;
  const entryCat = tieCategory(entry);
  const entryRank = labelRank(entry.label);
  for (let i = 0; i < queue.length; i++) {
    const row = queue[i];
    const rowTics = row.tics ?? 0;
    if (entryTics < rowTics) return i;
    if (entryTics !== rowTics) continue;
    const rowCat = tieCategory(row);
    if (entryCat < rowCat) return i;
    if (entryCat === rowCat && entryRank < labelRank(row.label)) return i;
  }
  return queue.length;
}

export function addEvent(queue, label, event, tics, id = null) {
  const entry = { id: id ?? globalThis.crypto.randomUUID(), label, event, tics };
  queue.splice(orderedInsertIndex(queue, entry), 0, entry);
  return entry;
}

// Head is the first row. A ready row at index 0 is that actor's turn.
// Does not sort and does not reorder.
function firstActionableIndex(queue) {
  return queue.length > 0 ? 0 : -1;
}

export function popNext(queue) {
  const headIdx = firstActionableIndex(queue);
  if (headIdx === -1) return null;
  const row = queue[headIdx];
  // Remove only. Sibling ordering keys are not rewritten — order was fixed at insert.
  queue.splice(headIdx, 1);
  return { row, ticOffset: row.tics };
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

// Client ceremony and engine commit share this mutation: drop the consumed
// ready row, splice the successor at its ordering key. Idempotent if the
// successor id is already present (reconcile against a server-confirmed row).
export function replaceReadyWithSuccessor(queue, readyRow, successor) {
  const next = (queue || []).filter(r => !readyRow || r.id !== readyRow.id);
  if (!successor) return next;
  if (next.some(r => r.id === successor.id)) return next;
  const entry = { ...successor };
  next.splice(orderedInsertIndex(next, entry), 0, entry);
  return next;
}

export function queuesMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].event !== b[i].event || a[i].label !== b[i].label) return false;
  }
  return true;
}

// PC-56: computeTimingMarkers returns bar info for prediction bar UX.
// The copy-sort below is READ-ONLY and exists only to find [minT, maxT] boundary
// rows for the prediction bar. It does NOT mutate queue order. Live queue order
// is the array order fixed at insert.
// Returns:
//   {kind: 'bar', firstId: string, lastId: string, hasInside: boolean}
//     hasInside=true — the bar spans rows that contain the timing range (attack CAN land in these)
//     hasInside=false — no rows fall inside [minT,maxT]; bar sits in the GAP between boundary rows
//     firstId is the first inside row (hasInside=true) or the last row with tics < minT (hasInside=false)
//     lastId is the last inside row (hasInside=true) or the first row with tics > maxT (hasInside=false)
//   null — empty queue or no attack
export function computeTimingMarkers(queue, attack, weaponSpeed = 0) {
  if (!queue || queue.length === 0 || !attack) return null;
  const minT = Number(weaponSpeed) * Number(attack.prepare_time_multiplier ?? 1);
  const range = Number(weaponSpeed) * Number(attack.prepare_time_multiplier_range ?? 0);
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
