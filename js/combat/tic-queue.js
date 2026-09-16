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

export function tick(queue, onFire) {
  const fired = [];
  for (const row of queue) {
    if (row.tics > 0) row.tics--;
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

// PC-56: computeTimingMarkers for '>' timing markers (MVP)
// Matches dw-app.js updateTimingMarkers algorithm EXACTLY.
// input: queue (array of {id, tics, ...}), attack {prepare_time, prepare_time_range}
// if no tics strictly inside (minT < t < maxT) -> SINGLE '>' on first row with tics >= maxT (or none)
// if some inside -> PAIR: last with tics < minT and first with tics > maxT
// empty queue -> []
// returns {id, marker: '>' }[] (order of appearance in sorted tics order, caller matches by id)
export function computeTimingMarkers(queue, attack) {
  if (!queue || queue.length === 0 || !attack) return [];
  const minT = Number(attack.prepare_time || attack.prepareTime || 0);
  const range = Number(attack.prepare_time_range || attack.prepareTimeRange || 0);
  const maxT = minT + range;
  const sorted = [...queue].sort((a, b) => a.tics - b.tics);
  // check for any strictly inside
  let hasInside = false;
  for (const row of sorted) {
    if (row.tics > minT && row.tics < maxT) {
      hasInside = true;
      break;
    }
  }
  const markers = [];
  if (!hasInside) {
    // SINGLE '>' on the first row with tics >= maxT (or no marker if none)
    for (const row of sorted) {
      if (row.tics >= maxT) {
        markers.push({ id: row.id, marker: '>' });
        break;
      }
    }
  } else {
    // PAIR: last row with tics < minT AND first row with tics > maxT
    let before = null;
    let after = null;
    for (const row of sorted) {
      if (row.tics < minT) before = row;
      if (row.tics > maxT && !after) after = row;
    }
    if (before) markers.push({ id: before.id, marker: '>' });
    if (after) markers.push({ id: after.id, marker: '>' });
  }
  return markers;
}
