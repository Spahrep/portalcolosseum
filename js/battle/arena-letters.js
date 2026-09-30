/**
 * Stable arena letters. Assigned once per monster id at first sight (battle
 * start order) and never recomputed from the living-array index. When monster
 * A dies, B stays B.
 *
 * An engine label that is already a single letter (or ends in one) wins, so
 * damage-report feed lines and target cards share the same letter.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function arenaLetterFromLabel(label) {
  const s = String(label || '').replace(/^Monster\s*/i, '').trim();
  if (/^[A-Z]$/.test(s)) return s;
  const trail = s.match(/([A-Z])$/);
  return trail ? trail[1] : null;
}

function monsterKey(monster) {
  if (!monster) return null;
  if (monster.id != null) return `id:${monster.id}`;
  if (monster.label) return `label:${monster.label}`;
  return null;
}

/**
 * Pure assignment. `prior` is the id→letter map from earlier in the battle.
 * Returns a new map; does not mutate `prior`.
 * A disjoint id set (next battle) starts over at A.
 */
export function assignArenaLetters(monsters, prior) {
  const list = monsters || [];
  const prev = prior || new Map();
  const ids = list.map(monsterKey).filter(Boolean);
  const overlap = ids.some(k => prev.has(k));
  const assigned = overlap ? new Map(prev) : new Map();
  const used = new Set(assigned.values());
  let nextIdx = 0;
  while (nextIdx < LETTERS.length && used.has(LETTERS[nextIdx])) nextIdx++;

  for (const m of list) {
    const key = monsterKey(m);
    if (!key || assigned.has(key)) continue;
    const fromLabel = arenaLetterFromLabel(m.label);
    let letter = fromLabel && !used.has(fromLabel) ? fromLabel : null;
    if (!letter) {
      while (nextIdx < LETTERS.length && used.has(LETTERS[nextIdx])) nextIdx++;
      letter = LETTERS[nextIdx] || '?';
      nextIdx++;
    } else {
      const idx = LETTERS.indexOf(letter);
      if (idx >= nextIdx) nextIdx = idx + 1;
    }
    assigned.set(key, letter);
    used.add(letter);
  }
  return assigned;
}

export function letterForMonster(monster, assigned) {
  const key = monsterKey(monster);
  if (key && assigned && assigned.has(key)) return assigned.get(key);
  return arenaLetterFromLabel(monster && monster.label) || '?';
}

/** Target-card / confirm label. Letter is never the living-array index. */
export function targetCardLabel(monster, assigned) {
  const letter = letterForMonster(monster, assigned);
  const name = (monster && monster.name) || 'Monster';
  return `${letter}: ${name}`;
}
