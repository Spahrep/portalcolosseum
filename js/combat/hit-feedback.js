/**
 * PC-70: hit-feedback event parsing.
 *
 * Pure module (no DOM) so the feed-line → event mapping is unit-testable.
 * Engine feed formats (js/combat/engine.js log() + api/combat/[...path].js):
 *   tic N — <monsterLabel> <attackName> hits you for <dmg> damage   (monster → player)
 *   tic N — LH|RH <attackName> hits <monsterLabel> for <dmg>    (player → monster)
 * Monster labels have the format <name> <letter>, e.g. "Wolf A", "Glimmerling B",
 * or bare "Monster A", "A", or the "Monster #<id>" fallback
 * (api/combat/[...path].js:110). `letter` is the normalized arena key:
 * "Wolf A" → "A", "Monster A" → "A", bare "A" → "A", "Monster #12" → "#12"
 * — the SAME normalization the UI applies to monster cards (data-letter, queueLabel).
 * Miss/Ready/defeat/potion lines return null — misses get no feedback
 * (a whiff is a low-tension beat; feedback must not lie about impact).
 */
const ARENA_LABEL = '(?:Monster #[0-9]+|[A-Z]|[A-Za-z]+(?: [A-Za-z]+)* [A-Z])';
// Monster→player: "<label> <attackName> hits you for <dmg> damage[( CRITICAL!)]".
// `<atk>` is greedy up to the literal " hits you for " so it captures the full
// attack phrase (e.g. "Claw", "Fire Claw"), with a fallback for a bare label.
const MONSTER_HIT = new RegExp(`^tic \\d+ — (${ARENA_LABEL}) (.*?) hits you for (\\d+) damage(?: CRITICAL!)?$`);
const MONSTER_HIT_NOATK = new RegExp(`^tic \\d+ — (${ARENA_LABEL}) hits you for (\\d+) damage(?: CRITICAL!)?$`);
// Player→monster: "<LH|RH> <attack> hits <label> for <dmg>[( damage)][( CRITICAL!)]".
// NOTE: the engine emits a trailing " damage" on player→monster lines too
// (engine.js:229 — `${r.target} for ${r.damage} damage`), and that suffix is
// OPTIONAL because the legacy LH/RH comet path and bare-label tests omit it.
// Matching it (when present) keeps the landed-hit beat firing for player
// attacks; without it the regex only ever matched the synthetic bare lines.
const PLAYER_HIT = new RegExp(`^tic \\d+ — (LH|RH) (.*?) hits (${ARENA_LABEL}) for (\\d+)(?: damage)?(?: CRITICAL!)?$`);

export function parseHitLine(line) {
  if (typeof line !== 'string') return null;
  const monsterHit = line.match(MONSTER_HIT) || line.match(MONSTER_HIT_NOATK);
  if (monsterHit) {
    const atk = monsterHit.length > 3 ? monsterHit[2] : null;
    const dmgIdx = monsterHit.length > 3 ? 3 : 2;
    return { type: 'monster', letter: arenaKey(monsterHit[1]), attack: atk?.trim() || null, damage: Number(monsterHit[dmgIdx]) };
  }
  const playerHit = line.match(PLAYER_HIT);
  if (playerHit) {
    return { type: 'player', letter: arenaKey(playerHit[3]), attack: playerHit[2].trim(), damage: Number(playerHit[4]) };
  }
  return null;
}

/**
 * PC-117: split a landed-hit feed line into a "tell" (attack identity / intent)
 * and a "payload" (the damage consequence) so the battle log can play the beat
 * name → pause → impact → damage. Non-hit lines (misses, "prepares", system)
 * return null and are typed as a single line, unchanged.
 *
 * Monster→player: "Imp A Claw hits you for 5 damage" → "Imp A attacks…" / "You take 5 damage."
 * Player→monster: "RH Fire Bow hits Wolf A for 8"     → "RH Fire Bow hits Wolf A…" / "…for 8 damage."
 *
 * The tell names the attacker and intent; the SHORT PAUSE + impact (shake/flash)
 * happens between them; the payload delivers the number as its own hard beat.
 */
export function splitHitLine(line) {
  if (typeof line !== 'string') return null;
  const isCrit = line.includes(' CRITICAL!');
  const clean = isCrit ? line.replace(/ CRITICAL!$/, '') : line;
  const hit = parseHitLine(clean);
  if (!hit) return null;
  if (hit.type === 'monster') {
    // Full attacker label = the leading <name> <letter> (e.g. "Imp A", "Giant Rat B").
    const labelMatch = clean.match(new RegExp(`^tic \\d+ — (${ARENA_LABEL})\\b`));
    const attacker = labelMatch ? labelMatch[1] : hit.letter;
    return {
      kind: 'monster',
      tell: `${attacker} attacks…`,
      payload: `You take ${hit.damage} damage.`,
      letter: hit.letter,
      isCrit,
    };
  }
  // player → monster: keep the whole "LH/RH <attack> hits <label>" as the tell.
  // Trailing " damage" is part of the real engine line (engine.js:229) and must
  // be tolerated, or the landed-hit beat silently dies for player attacks.
  const m = clean.match(/^tic \d+ — (LH|RH) (.*?) hits (.+?) for (\d+)(?: damage)?$/);
  if (!m) return null;
  const handAtk = m[2].trim();
  const tgt = arenaKey(m[3]);
  // "RH Fire Bow hits Wolf A…" then "…for 8 damage."
  // (kept minimal — the hand is already shown on the queue rail label)
  return {
    kind: 'player',
    tell: `${m[1]} ${handAtk} hits ${tgt}…`,
    payload: `…for ${hit.damage} damage${isCrit ? ' CRITICAL!' : ''}.`,
    letter: hit.letter,
    isCrit,
  };
}

// "Wolf A" → "A", "Monster A" → "A", "A" → "A", "Monster #12" → "#12". Mirrors queueLabel().
export function arenaKey(label) {
  const s = String(label || '');
  // "Monster #12" → "#12"
  const numMatch = s.match(/(#\d+)$/);
  if (numMatch) return numMatch[1];
  // Extract trailing capital letter (works for "Wolf A", "Monster A", and bare "A")
  const letterMatch = s.match(/([A-Z])$/);
  return letterMatch ? letterMatch[1] : s;
}