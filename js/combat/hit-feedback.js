/**
 * PC-70: hit-feedback event parsing.
 *
 * Pure module (no DOM) so the feed-line → event mapping is unit-testable.
 * Engine feed formats (js/combat/engine.js log() + api/combat/[...path].js):
 *   tic N — <monsterLabel> <attackName> hits player for <dmg>   (monster → player)
 *   tic N — LH|RH <attackName> hits <monsterLabel> for <dmg>    (player → monster)
 * Monster labels are "Monster A", "A", or the "Monster #<id>" fallback
 * (api/combat/[...path].js:110). `letter` is the normalized arena key:
 * "Monster A" → "A", bare "A" → "A", "Monster #12" → "#12" — the SAME
 * normalization the UI applies to monster cards (data-letter, queueLabel).
 * Miss/Ready/defeat/potion lines return null — misses get no feedback
 * (a whiff is a low-tension beat; feedback must not lie about impact).
 */
const ARENA_LABEL = '(?:Monster #[0-9]+|Monster [A-Z]|[A-Z])';
const MONSTER_HIT = new RegExp(`^tic \\d+ — (${ARENA_LABEL})(?: .*)? hits player for (\\d+)(?: CRITICAL!)?$`);
const PLAYER_HIT = new RegExp(`^tic \\d+ — (LH|RH) .*? hits (${ARENA_LABEL}) for (\\d+)(?: CRITICAL!)?$`);

export function parseHitLine(line) {
  if (typeof line !== 'string') return null;
  const monsterHit = line.match(MONSTER_HIT);
  if (monsterHit) {
    return { type: 'monster', letter: arenaKey(monsterHit[1]), damage: Number(monsterHit[2]) };
  }
  const playerHit = line.match(PLAYER_HIT);
  if (playerHit) {
    return { type: 'player', letter: arenaKey(playerHit[2]), damage: Number(playerHit[3]) };
  }
  return null;
}

// "Monster A" → "A"; "Monster #12" → "#12"; "A" → "A". Mirrors queueLabel().
export function arenaKey(label) {
  return String(label || '').replace(/^Monster /i, '');
}
