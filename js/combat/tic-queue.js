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
    const bPlayer = b.label === 'LH' || a.label === 'RH' ? 0 : 1;
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
    const bPlayer = b.label === 'LH' || a.label === 'RH' ? 0 : 1;
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
// Returns array of {id, marker: '>'} for rows that should show the marker(s)
// PAIR when range spans multiple, SINGLE when contained between two.
export function computeTimingMarkers(queue, attack) {
  if (!attack || !queue || queue.length === 0) return [];
  const P = Number(attack.prepare_time || attack.prepareTime || 0);
  const R = Number(attack.prepare_time_range || attack.prepareTimeRange || 0);
  const landMin = P;
  const landMax = P + R;
  const markers = [];
  const sorted = [...queue].sort((a, b) => a.tics - b.tics);
  if (R === 0 || landMin === landMax) {
    // SINGLE '>' : find first row at or after landMin, or last if none
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].tics >= landMin) {
        markers.push({ id: sorted[i].id, marker: '>' });
        break;
      }
    }
    if (markers.length === 0 && sorted.length > 0) {
      markers.push({ id: sorted[sorted.length - 1].id, marker: '>' });
    }
  } else {
    // PAIR of '>' on rows whose tics fall in [landMin, landMax]
    for (const row of sorted) {
      if (row.tics >= landMin && row.tics <= landMax) {
        markers.push({ id: row.id, marker: '>' });
      }
    }
    if (markers.length === 0) {
      // find bounding rows for contained case
      let prev = null;
      let next = null;
      for (const row of sorted) {
        if (row.tics < landMin) prev = row;
        if (row.tics > landMax && !next) next = row;
      }
      if (prev) markers.push({ id: prev.id, marker: '>' });
      if (next) markers.push({ id: next.id, marker: '>' });
    }
  }
  return markers;
}
