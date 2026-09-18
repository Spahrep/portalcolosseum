/**
 * PC-70: hit-feedback event parsing.
 *
 * Pure module (no DOM) so the feed-line → event mapping is unit-testable.
 * Engine feed formats (js/combat/engine.js):
 *   tic N — A <attackName> hits player for <dmg>   (monster → player; attack name optional)
 *   tic N — LH <attackName> hits A for <dmg>       (player → monster; fallback name is 'attack')
 * Any other line (miss, Ready, defeated, potion, heal, placeholder) returns null —
 * a miss must not trigger feedback: it is a low-tension beat, and the feedback
 * would lie about an impact that never landed.
 */

export function parseHitLine(line) {
  if (typeof line !== 'string') return null;

  // Monster → player: single arena letter (A/B/C…), optional attack name before "hits player for N".
  const monsterHit = line.match(/^tic \d+ — ([A-Z]) (?:.* )?hits player for (\d+)$/);
  if (monsterHit) {
    return { type: 'monster', letter: monsterHit[1], damage: Number(monsterHit[2]) };
  }

  // Player → monster: LH/RH hand, attack name, then "hits <letter> for N".
  // Lazy name + anchored end keeps attack names containing "hits" correct.
  const playerHit = line.match(/^tic \d+ — (LH|RH) .*? hits ([A-Z]) for (\d+)$/);
  if (playerHit) {
    return { type: 'player', letter: playerHit[2], damage: Number(playerHit[3]) };
  }

  return null;
}
