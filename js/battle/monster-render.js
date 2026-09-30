/**
 * Monster rendering + hit-feedback subsystem (PC-79).
 * Moved verbatim from battle-app.js: monster cards, death animations,
 * and feed-line hit reactions. No behavior change.
 */
import { debugLog } from '../battle-debug.js';
import { parseHitLine } from '../combat/hit-feedback.js';
import { assignArenaLetters, letterForMonster } from './arena-letters.js';

// PC-51: monsters stay hidden while the dice roll ceremony plays, then
// fade in one at a time. Set in the battle render when a roll will run;
// revealMonsters() clears it when the roll completes.
let monstersPendingReveal = false;
const MONSTER_FADE_STAGGER = 1000; // ms pause between monster reveals (one at a time, with a beat)
const MONSTER_FADE_MS = 1400;      // per-monster fade duration

export function setMonstersPendingReveal(flag) {
  monstersPendingReveal = flag;
}

// PC-52r/PC-63: monster condition words color by severity everywhere they render.
const BAND_CLASS = {
  healthy: 'st-green', injured: 'st-amber', battered: 'st-orange', critical: 'st-red'
};
function bandClass(m) {
  const word = String(m.hp_word || m.hpWord || 'Healthy').toLowerCase();
  return BAND_CLASS[word] || 'st-green';
}

// PC-70: hit feedback — window shake when a monster hits the player, monster
// card shake + sprite white-flash when the player lands a hit. Durations must
// match the keyframes in run.html; the class-restart pattern (remove → reflow →
// re-add) replays the animation on rapid successive hits.
const HIT_FEEDBACK = {
  WINDOW_SHAKE_MS: 280,
  CARD_SHAKE_MS: 220,
  FLASH_MS: 180,
  // PC-74: harder/longer for crit juice (class restart still applies)
  CRIT_WINDOW_SHAKE_MS: 420,
  CRIT_FLASH_MS: 280
};
let windowShakeTimer = null;
let suppressHitFeedback = false; // intro-snap re-type narrates HISTORY — only NEW hits react
export function setSuppressHitFeedback(flag) {
  suppressHitFeedback = flag;
}
const cardHitTimers = new WeakMap(); // per-card cleanup timer for multi-target hits

// PC-71: monster death — a dead monster's card flashes red and fades out in
// place (run.html @keyframes monster-death), then is removed. Duration must
// match the keyframes; the +200ms timeout is the fallback for environments
// where animationend never fires (reduced-motion etc.).
const MONSTER_DEATH_MS = 1200;
// Death cards survive renderMonsters' innerHTML wipe: they're re-appended
// from this map (keyed by monster id) in their original arena position while
// the animation plays, so a fast follow-up action can't cut the beat short.
const deathCards = new Map(); // monster id -> { el, timer }
// Stable A/B/C assigned at first sight. Survives deaths so B is not relabeled A.
let arenaLetters = new Map();

function triggerWindowShake() {
  const el = document.querySelector('.container');
  if (!el) return;
  clearTimeout(windowShakeTimer);
  el.classList.remove('container-shake');
  void el.offsetWidth;
  el.classList.add('container-shake');
  windowShakeTimer = setTimeout(() => el.classList.remove('container-shake'), HIT_FEEDBACK.WINDOW_SHAKE_MS);
}

function triggerMonsterHit(letter) {
  const card = document.querySelector(`.monster-card[data-letter="${letter}"]`);
  if (!card || card.classList.contains('monster-dying')) return;
  const sprite = card.querySelector('.monster-sprite');
  const prior = cardHitTimers.get(card);
  if (prior) clearTimeout(prior);
  card.classList.remove('monster-hit');
  if (sprite) sprite.classList.remove('sprite-flash');
  void card.offsetWidth;
  if (sprite) { void sprite.offsetWidth; sprite.classList.add('sprite-flash'); }
  card.classList.add('monster-hit');
  cardHitTimers.set(card, setTimeout(() => {
    card.classList.remove('monster-hit');
    if (sprite) sprite.classList.remove('sprite-flash');
  }, Math.max(HIT_FEEDBACK.CARD_SHAKE_MS, HIT_FEEDBACK.FLASH_MS)));
}

// PC-74 crit juice: harder shake on player being crit-hit, harder flash on player critting monster.
// Uses separate classes so normal hits stay exactly as-is; restart pattern preserved.
let critWindowShakeTimer = null;
function triggerCritWindowShake() {
  const el = document.querySelector('.container');
  if (!el) return;
  clearTimeout(critWindowShakeTimer);
  el.classList.remove('container-crit-shake');
  void el.offsetWidth;
  el.classList.add('container-crit-shake');
  critWindowShakeTimer = setTimeout(() => el.classList.remove('container-crit-shake'), HIT_FEEDBACK.CRIT_WINDOW_SHAKE_MS);
}

function triggerCritMonsterHit(letter) {
  const card = document.querySelector(`.monster-card[data-letter="${letter}"]`);
  if (!card || card.classList.contains('monster-dying')) return;
  const sprite = card.querySelector('.monster-sprite');
  const prior = cardHitTimers.get(card);
  if (prior) clearTimeout(prior);
  card.classList.remove('monster-crit-hit');
  if (sprite) sprite.classList.remove('sprite-crit-flash');
  void card.offsetWidth;
  if (sprite) { void sprite.offsetWidth; sprite.classList.add('sprite-crit-flash'); }
  card.classList.add('monster-crit-hit');
  cardHitTimers.set(card, setTimeout(() => {
    card.classList.remove('monster-crit-hit');
    if (sprite) sprite.classList.remove('sprite-crit-flash');
  }, HIT_FEEDBACK.CRIT_FLASH_MS));
}

// Route engine feed lines to the right reaction. parseHitLine is the single
// source of truth for what counts as a hit (misses/Ready/defeat → no feedback).
function handleHitLine(line) {
  if (suppressHitFeedback) return;
  const isCrit = typeof line === 'string' && line.includes(' CRITICAL!');
  const cleanLine = isCrit ? line.replace(/ CRITICAL!$/, '') : line;
  const hit = parseHitLine(cleanLine);
  if (!hit) return;
  if (hit.type === 'monster') {
    if (isCrit) triggerCritWindowShake();
    else triggerWindowShake();
  } else {
    if (isCrit) triggerCritMonsterHit(hit.letter);
    else triggerMonsterHit(hit.letter);
  }
}

function syncArenaLetters(monsters) {
  arenaLetters = assignArenaLetters(monsters || [], arenaLetters);
  return arenaLetters;
}

function arenaLetterOf(monster) {
  return letterForMonster(monster, arenaLetters);
}

function renderMonsters(monsters) {
  const container = document.getElementById('monsters');
  if (!container) return;
  // Fresh battle ceremony = a new arena — drop any in-flight death animations
  // from the previous battle rather than letting corpses linger into battle 2.
  if (monstersPendingReveal && deathCards.size > 0) {
    for (const entry of deathCards.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.el.remove();
    }
    deathCards.clear();
  }
  // Remove only living monster cards — death cards stay in-place so their
  // CSS animation (monster-death) never restarts from DOM re-insertion.
  Array.from(container.children).forEach(child => {
    if (!child.classList.contains('monster-dying')) child.remove();
  });
  const list = monsters || [];
  syncArenaLetters(list);
  if (list.length === 0) {
    // No monsters in the new state — sweep any lingering death cards.
    for (const entry of deathCards.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.el.remove();
    }
    deathCards.clear();
    appendNoMonsters(container);
    return;
  }
  // Render in array order so a dying card keeps its slot among the living
  // (the API keeps dead monsters in place, flagged `dead: true`).
  for (const m of list) {
    if (m.dead) {
      const key = m.id != null ? m.id : m.label;
      const existing = deathCards.get(key);
      if (existing) {
        // already in the DOM from selective removal — no re-append needed
        continue;
      }
      const card = buildMonsterCard(m, true);
      const entry = { el: card, timer: null };
      deathCards.set(key, entry);
      container.appendChild(card);
      card.addEventListener('animationend', (e) => {
        // only the death beat ends the card — a hit-feedback shake on the
        // same tick (the killing blow) must not remove it early
        if (e.animationName === 'monster-death') finishDeath(key);
      });
      entry.timer = setTimeout(() => finishDeath(key), MONSTER_DEATH_MS + 200);
    } else {
      container.appendChild(buildMonsterCard(m, false));
    }
  }
  // "All dead with no death cards" edges into the fresh-battle clear above.
  // finishDeath adds the placeholder when the last animation completes.
}

function buildMonsterCard(m, dying) {
  const card = document.createElement('div');
  card.className = 'monster-card' + (dying ? ' monster-dying' : '');
  // Stable arena letter (assigned at battle start, not the living-array index).
  // Damage-report feed lines use the same letter via the engine label, which
  // assignArenaLetters prefers so the card and the hit line agree.
  // Card DOM itself is not unit-tested — letterForMonster is.
  const letter = letterForMonster(m, arenaLetters);
  card.dataset.letter = letter;
  card.style.cssText = 'background:rgba(0,0,0,0.4);border:2px solid #4a90d9;padding:8px 10px;margin-bottom:6px;';
  const sprite = document.createElement('div');
  sprite.className = 'monster-sprite';
  sprite.style.cssText = 'width:64px;height:48px;background:#112233;border:1px solid #335577;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#66ccff;';
  sprite.textContent = m.name ? m.name.substring(0, 3).toUpperCase() : 'MON';
  const name = document.createElement('div');
  name.style.cssText = 'color:#ffcc66;font-size:11px;text-align:center;';
  name.textContent = m.name ? `${letter}: ${m.name}` : letter;
  const hp = document.createElement('div');
  hp.style.cssText = 'margin-top:4px;text-align:center;';
  if (dying) {
    // dead is not Critical — the card is leaving; the word is DEFEATED in red
    hp.innerHTML = '<span class="st-red" style="font-size:10px;">DEFEATED</span>';
  } else {
    const hpWord = m.hp_word || m.hpWord || 'Healthy';
    hp.innerHTML = `<span class="${bandClass(m)}" style="font-size:10px;">HP: ${hpWord}</span>`;
  }
  card.appendChild(sprite);
  card.appendChild(name);
  card.appendChild(hp);
  if (!dying && monstersPendingReveal) hideForReveal(card);
  return card;
}

function appendNoMonsters(container) {
  const empty = document.createElement('div');
  empty.style.cssText = 'color:#556677;font-size:11px;padding:12px;';
  empty.textContent = 'No monsters present.';
  if (monstersPendingReveal) hideForReveal(empty);
  container.appendChild(empty);
}

function finishDeath(key) {
  const entry = deathCards.get(key);
  if (!entry || entry.finished) return; // first caller wins
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  entry.finished = true;
  // Keep the card in the DOM (invisible from animation-fill-mode: forwards).
  // Do NOT delete from deathCards or remove the element — the engine keeps
  // dead:true in its list, and renderMonsters' selective removal skips
  // .monster-dying cards, so the death animation runs exactly once.
  // Last monster fell — restore the empty-arena placeholder.
  const container = document.getElementById('monsters');
  if (container && !Array.from(container.children).some(c =>
    !c.classList.contains('monster-dying')
  )) appendNoMonsters(container);
}
// While the roll plays, monster cards render invisible (laid out, opacity 0)
// and materialize one at a time once the roll completes.
function hideForReveal(el) {
  el.style.transition = `opacity ${MONSTER_FADE_MS}ms ease`;
  el.style.opacity = '0';
}

function revealMonsters(onDone) {
  debugLog('revealMonsters', `monstersPendingReveal=${monstersPendingReveal} n_cards=${document.getElementById('monsters')?.children?.length || 0}`);
  if (!monstersPendingReveal) {
    if (onDone) onDone(); // no ceremony pending — nothing to wait for
    return;
  }
  monstersPendingReveal = false;
  const container = document.getElementById('monsters');
  const cards = container ? Array.from(container.children) : [];
  if (cards.length === 0) {
    if (onDone) onDone();
    return;
  }
  cards.forEach((card, i) => {
    setTimeout(() => { card.style.opacity = '1'; }, i * MONSTER_FADE_STAGGER);
  });
  // onDone fires after the LAST card is fully in (stagger of the last card
  // plus its own fade) — the timing track and command window follow.
  if (onDone) setTimeout(onDone, (cards.length - 1) * MONSTER_FADE_STAGGER + MONSTER_FADE_MS);
}

// tickLoop / awaitTickVisuals in battle-app.js still read the death-card map
// and the death duration. Exported so those call sites stay verbatim.
export {
  renderMonsters,
  buildMonsterCard,
  appendNoMonsters,
  finishDeath,
  hideForReveal,
  revealMonsters,
  handleHitLine,
  bandClass,
  deathCards,
  MONSTER_DEATH_MS,
  syncArenaLetters,
  arenaLetterOf,
};
