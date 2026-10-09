/**
 * Monster rendering + hit-feedback subsystem (PC-79).
 * Moved verbatim from battle-app.js: monster cards, death animations,
 * and feed-line hit reactions. No behavior change.
 */
import { debugLog } from '../battle-debug.js';
import { parseHitLine } from '../combat/hit-feedback.js';
import { assignArenaLetters, letterForMonster } from './arena-letters.js';
import { dur, screenshakeEnabled } from './ux-controller.js';

// PC-51: monsters stay hidden while battle initialization plays, then
// fade in one at a time. Set in the battle render when a roll will run;
// revealMonsters() clears it when the roll completes.
let monstersPendingReveal = false;

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
// card shake + sprite white-flash when the player lands a hit. Lengths come
// from dur() and the matching --ux-* custom properties on the keyframes.
// The class-restart pattern (remove → reflow → re-add) replays the animation
// on rapid successive hits.
let windowShakeTimer = null;
let suppressHitFeedback = false; // intro-snap re-type narrates HISTORY — only NEW hits react
export function setSuppressHitFeedback(flag) {
  suppressHitFeedback = flag;
}
const cardHitTimers = new WeakMap(); // per-card cleanup timer for multi-target hits

function hitFeedbackBlocked() {
  // Resume/history re-type AND the user's screenshake_on:false toggle.
  // Both kill window shake, card shake, and the sprite flash.
  return suppressHitFeedback || !screenshakeEnabled();
}

// PC-71: monster death — a dead monster's card flashes red and fades out in
// place (run.html @keyframes monster-death). dur('monsterDeath') matches
// --ux-death. The +200ms timeout is the fallback when animationend never
// fires (reduced-motion etc.).
// Death cards survive renderMonsters' innerHTML wipe: they're re-appended
// from this map (keyed by monster id) in their original arena position while
// the animation plays, so a fast follow-up action can't cut the beat short.
const deathCards = new Map(); // monster id -> { el, timer }
// Stable A/B/C assigned at first sight. Survives deaths so B is not relabeled A.
let arenaLetters = new Map();

function triggerWindowShake() {
  const el = document.querySelector('.container');
  if (!el) return null;
  clearTimeout(windowShakeTimer);
  el.classList.remove('container-shake');
  void el.offsetWidth;
  el.classList.add('container-shake');
  windowShakeTimer = setTimeout(() => el.classList.remove('container-shake'), dur('shake'));
  return el;
}

function triggerMonsterHit(letter) {
  const card = document.querySelector(`.monster-card[data-letter="${letter}"]`);
  if (!card || card.classList.contains('monster-dying')) return null;
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
  }, Math.max(dur('cardShake'), dur('flash'))));
  return card;
}

// PC-74 crit juice: harder shake on player being crit-hit, harder flash on player critting monster.
// Uses separate classes so normal hits stay exactly as-is; restart pattern preserved.
let critWindowShakeTimer = null;
function triggerCritWindowShake() {
  const el = document.querySelector('.container');
  if (!el) return null;
  clearTimeout(critWindowShakeTimer);
  el.classList.remove('container-crit-shake');
  void el.offsetWidth;
  el.classList.add('container-crit-shake');
  critWindowShakeTimer = setTimeout(() => el.classList.remove('container-crit-shake'), dur('critShake'));
  return el;
}

function triggerCritMonsterHit(letter) {
  const card = document.querySelector(`.monster-card[data-letter="${letter}"]`);
  if (!card || card.classList.contains('monster-dying')) return null;
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
  }, Math.max(dur('critCardShake'), dur('critFlash'))));
  return card;
}

// Resolve when the hit animation ends. Reduced-motion and a missing element
// resolve immediately so narration is not held open for a shake that will
// never fire animationend. The timeout is the same fallback awaitTickVisuals uses.
function waitForHitAnimation(el, timeoutMs) {
  return new Promise(resolve => {
    if (!el || typeof el.addEventListener !== 'function') {
      resolve();
      return;
    }
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduce = false;
    }
    if (reduce) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('animationend', onEnd);
      resolve();
    };
    const onEnd = (e) => {
      if (e.target !== el) return;
      finish();
    };
    el.addEventListener('animationend', onEnd);
    setTimeout(finish, timeoutMs);
  });
}

// Route engine feed lines to the right reaction. parseHitLine is the single
// source of truth for what counts as a hit (misses/Ready/defeat → no feedback).
function handleHitLine(line) {
  if (hitFeedbackBlocked()) return;
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

/**
 * PC-117: fire the impact shake/flash for an already-split hit. The typewriter
 * withholds this until the "tell" has typed and the short pause has passed, so
 * the impact lands AFTER the attack name is on screen — not (as before) at the
 * very onset of the line. Suppression (resume/history re-type) still applies.
 * @param {{kind:'monster'|'player', letter:string, isCrit:boolean}} hit
 */
function handleDeferredHit(hit) {
  if (!hit || hitFeedbackBlocked()) return Promise.resolve();
  if (hit.kind === 'monster') {
    if (hit.isCrit) return waitForHitAnimation(triggerCritWindowShake(), dur('critShake') + 80);
    return waitForHitAnimation(triggerWindowShake(), dur('shake') + 80);
  }
  if (hit.isCrit) {
    return waitForHitAnimation(triggerCritMonsterHit(hit.letter), Math.max(dur('critCardShake'), dur('critFlash')) + 80);
  }
  return waitForHitAnimation(triggerMonsterHit(hit.letter), Math.max(dur('cardShake'), dur('flash')) + 80);
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
  // Fresh battle initialization = a new arena — drop any in-flight death animations
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
      entry.timer = setTimeout(() => finishDeath(key), dur('monsterDeath') + 200);
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
  el.style.transition = `opacity ${dur('monsterFade')}ms ease`;
  el.style.opacity = '0';
}

function revealMonsters(onDone) {
  debugLog('revealMonsters', `monstersPendingReveal=${monstersPendingReveal} n_cards=${document.getElementById('monsters')?.children?.length || 0}`);
  if (!monstersPendingReveal) {
    if (onDone) onDone(); // no initialization pending — nothing to wait for
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
    setTimeout(() => { card.style.opacity = '1'; }, i * dur('monsterFadeStagger'));
  });
  // onDone fires after the LAST card is fully in (stagger of the last card
  // plus its own fade) — the timing track and command window follow.
  if (onDone) setTimeout(onDone, (cards.length - 1) * dur('monsterFadeStagger') + dur('monsterFade'));
}

// tickLoop / awaitTickVisuals in battle-app.js still read the death-card map.
// Death length is dur('monsterDeath') — no exported constant.
export {
  renderMonsters,
  buildMonsterCard,
  appendNoMonsters,
  finishDeath,
  hideForReveal,
  revealMonsters,
  handleHitLine,
  handleDeferredHit,
  bandClass,
  deathCards,
  syncArenaLetters,
  arenaLetterOf,
};
