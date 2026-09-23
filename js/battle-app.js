/**
 * Portal Colosseum - Battle Screen Live Combat Wiring (PC-47 pass 2)
 * Wires ATTACK (via /commit), ITEM (/use-potion), battle advance (/battle/end).
 * Matches CLI payloads exactly: {hand, attack_id, target_ids:[]}, {slot}.
 * hp_word ONLY for all HP display; busy-state gating on all actions.
 * Re-renders from action responses + GET restore.
 * No console errors; errors in message box.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';
import { computeTimingMarkers } from './combat/tic-queue.js';
import { potionPrePostTicks } from './combat/potion-contract.js';
import { parseHitLine } from './combat/hit-feedback.js';
import { getSpeedPreset, getSpeedKey, getFontSizePreset, getFontSizeKey, onSpeedChange, onFontSizeChange, setSpeed } from './settings-controller.js';
import './battle-debug.js'; // debugLog(tag, msg) — toggled via game_config.debug in Supabase

/**
 * BattleClock — orchestrates post-commit animation sequencing.
 * Phase flow:
 *   IDLE → SCHEDULED (wait for feed narration) → ANIMATING →
 *     → resolve (flash+shrink on old DOM) → push-down preview
 *     → renderQueue(bs) → entry enter animations → IDLE
 *
 * Busy is held for the entire duration (setBusy filters releases during clock activity),
 * preventing race conditions from rapid commits.
 *
 * Singleton — one instance per module, created at the bottom of this class block.
 */
class BattleClock {
  constructor() {
    this.state = 'IDLE'; // IDLE | SCHEDULED | ANIMATING
    this._diff = null;
    this._newBs = null;
    this._onComplete = null;
    this._timer = null;
  }

  abort() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.state = 'IDLE';
    this._onComplete = null;
  }

  /** Begin the post-commit transition. Called from loadBattle after highlighting. */
  start(diff, newBs, onComplete) {
    this.abort();
    if (diff.resolved.length === 0 && diff.added.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    this._diff = diff;
    this._newBs = newBs;
    this._onComplete = onComplete;
    this.state = 'SCHEDULED';
  }

  /** Call this when feed narration completes (from renderFeed's onComplete). */
  onNarrateDone() {
    if (this.state !== 'SCHEDULED') return;
    this.state = 'ANIMATING';
    this._runResolve();
  }

  /** Phase 1: Resolve animation — flash + shrink on resolved entries. */
  _runResolve() {
    const { _diff: diff } = this;
    const queueEl = document.getElementById('queue');

    if (!queueEl || diff.resolved.length === 0) {
      this._runInsert();
      return;
    }

    // Flash
    diff.resolved.forEach(id => {
      const rowEl = queueEl.querySelector(`[data-row-id="${id}"]`);
      if (rowEl) {
        rowEl.classList.remove('queue-row-current');
        rowEl.classList.add('queue-row-flash');
      }
    });

    // Shrink, then insert
    this._timer = setTimeout(() => {
      diff.resolved.forEach(id => {
        const rowEl = queueEl.querySelector(`[data-row-id="${id}"]`);
        if (rowEl) rowEl.classList.add('queue-row-shrink');
      });
      this._timer = setTimeout(() => this._runInsert(), 350);
    }, 400);
  }

  /**
   * Phase 2: Insert preview — push-down via preview marker on the old DOM,
   * then renderQueue replaces it with the new state.
   */
  _runInsert() {
    const { _diff: diff } = this;
    const queueEl = document.getElementById('queue');

    if (!queueEl || diff.added.length === 0) {
      this._renderNew();
      return;
    }

    // Build a preview bar at the insertion boundary.  The OLD queue DOM is still
    // intact (resolved entries might be shrunk but remain as placeholders).
    // Create a dashed preview marker; its CSS transition animates height 0→slot,
    // pushing remaining old rows downward to make room.
    const preview = document.createElement('div');
    preview.className = 'queue-insert-preview';
    // Insert at the top of the OLD queue (new entries always go above existing
    // pending rows in the sorted order, or at the top when the queue is empty).
    const firstRow = queueEl.querySelector('.queue-row');
    if (firstRow) {
      queueEl.insertBefore(preview, firstRow);
    } else {
      queueEl.appendChild(preview);
    }

    // Activate — CSS transitions height from 0 to 24px over 250ms
    requestAnimationFrame(() => preview.classList.add('active'));

    // After push-down completes, render the new queue state
    this._timer = setTimeout(() => {
      preview.remove();
      this._renderNew();
    }, 300);
  }

  /** Phase 3: Render updated queue, then apply entry-enter animations. */
  _renderNew() {
    const { _diff: diff, _newBs: newBs } = this;

    // Always render the full queue — this is where entries actually appear
    renderQueue(newBs);

    // Cosmetic entry-enter animations on freshly rendered entries
    if (diff.added.length > 0) {
      const nqEl = document.getElementById('queue');
      if (nqEl) {
        diff.added.forEach(entry => {
          const id = entry && entry.id ? entry.id : entry;
          const rowEl = nqEl.querySelector(`[data-row-id="${id}"]`);
          if (rowEl) {
            if (entry && entry.isMonster) {
              rowEl.classList.add('queue-row-monster-enter');
              setTimeout(() => rowEl.classList.remove('queue-row-monster-enter'), 400);
            } else {
              rowEl.classList.add('queue-row-enter');
              setTimeout(() => rowEl.classList.remove('queue-row-enter'), 1200);
            }
          }
        });
        // Panel flash
        const qp = document.querySelector('.queue-panel');
        if (qp) {
          qp.classList.add('queue-arrived');
          setTimeout(() => qp.classList.remove('queue-arrived'), 350);
        }
      }
    }

    this._finish();
  }

  /** All done — release busy gate, call onComplete, return to IDLE. */
  _finish() {
    this.state = 'IDLE';
    setBusy(false); // Release the gate (setBusy respects clock state)
    if (this._onComplete) {
      const cb = this._onComplete;
      this._onComplete = null;
      cb();
    }
  }
}

const battleClock = new BattleClock();

const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabase;
let currentRunId = null;
let lastBs = null; // last loaded battle_state (safeState) — source for attack/potion lookups
let busy = false;
let pendingAttack = null; // {hand, attackId} for commit via re-click or Enter
let queueBarInfo = null; // {kind:'bar',firstId,lastId} | null — PC-56 prediction bar
let playerName = 'Player';
let shouldAnimateDice = false;
// PC-51: monsters stay hidden while the dice roll ceremony plays, then
// fade in one at a time. Set in the battle render when a roll will run;
// revealMonsters() clears it when the roll completes.
let monstersPendingReveal = false;
const MONSTER_FADE_STAGGER = 1000; // ms pause between monster reveals (one at a time, with a beat)
const MONSTER_FADE_MS = 1400;      // per-monster fade duration

// Ceremony-intro: the battle-start dice ceremony also gates the command window and the
// timing track — both stay hidden while the die rolls. Once the last monster has faded
// in, the timing track fills (First → last); the command window appears only after the
// track is full (the fill's onDone removes intro-pending).
let battleIntroPending = false;
let introTimer = null; // PC-64: countdown interval for the battle-intro replay
const QUEUE_FILL_STAGGER = 600; // ms between timing rows appearing (First → last, one at a time)
const QUEUE_FILL_MS = 700;      // per-row fade

// Tuning constants for dice-selection roulette (client theater only).
// Sweep: uniform left→right walk, stops on random same-color box (incl phantom).
// Landed box IS selection (no morph). Roll: real faces from payload, weighty decel.
const DICE_ANIM = {
  COUNTDOWN_WHIR: 12,   // Spahrep's countdown: steps = 12*(n-1) + r, r in 1..n solved so the countdown ends on a drawn-color box
  SWEEP_FAST: 35,       // ms per die at full whir (sweep start)
  SWEEP_TAIL: 16,       // final sweep steps that decelerate into the landing
  SWEEP_SLOW: 240,      // ms on the very last step (weighty arrival, no instant stop)
  LAND_PAUSE: 350,      // beat on the landed box before the roll starts
  ROLL_TICKS: 16,       // tumbles before settle (longer, weightier roll)
  ROLL_INITIAL: 80,     // ms start for the roll (quick transitions)
  ROLL_DECEL: 1.16,     // per-tick decel factor
  ROLL_MIN: 400         // final dwell cap (~4.4s total roll)
};

// PC-52r/PC-63: monster condition words color by severity everywhere they render.
const BAND_CLASS = {
  healthy: 'st-green', injured: 'st-amber', battered: 'st-orange', critical: 'st-red'
};
function bandClass(m) {
  const word = String(m.hp_word || m.hpWord || 'Healthy').toLowerCase();
  return BAND_CLASS[word] || 'st-green';
}

// Settings now live in ./settings-controller.js (single source of truth for speed + font size)

// PC-DEC-044: typewriter state + helpers (only new lines type; appendFeedLine + system paths stay instant)
let typingInProgress = false;
let typingTimeouts = [];
let typingSetBusy = false; // track if *this* typing batch set the busy gate
let feedPinned = true; // DO-2: auto-scroll only while pinned; user scroll-up pauses for the batch
// Feed lines already displayed in #message-box. The box is NOT a pure feed
// mirror — it also holds the battle-complete panel, "Advancing..." and
// "Attack committed" system lines — so the incremental feed diff must track
// the feed by count, not box children (children-based diffs drop history
// lines once any system content sits in the box, and can let a stale
// battle-complete panel survive into the next battle).
let renderedFeedLines = 0;

function clearTyping() {
  typingTimeouts.forEach(t => clearTimeout(t));
  typingTimeouts = [];
  typingInProgress = false;
  if (typingSetBusy) {
    setBusy(false);
    document.body.classList.remove('command-hidden');
    typingSetBusy = false;
  }
}

function typeFeedLines(lines, onComplete) {
  // Latest-feed-wins: a commit/Enter can land mid-batch (keyboard path bypasses the
  // disabled buttons). If a batch is already typing, complete it instantly first so
  // only ONE typing loop runs at a time — same skip semantics as click-to-complete.
  if (typingInProgress) clearTyping();
  const box = document.getElementById('message-box');
  if (!box) {
    if (onComplete) onComplete();
    return;
  }
  const preset = getSpeedPreset();
  if (preset.charMs === 0 || lines.length === 0) {
    lines.forEach(l => appendFeedLine(l));
    if (onComplete) onComplete();
    return;
  }
  typingInProgress = true;
  setBusy(true); // gate action menu during typing per spec
  document.body.classList.add('command-hidden');
  typingSetBusy = true;
  feedPinned = true; // start pinned for this batch; scroll-up will unpin for remainder of batch
  let lineIndex = 0;
  function typeNextLine() {
    if (lineIndex >= lines.length) {
      typingInProgress = false;
      setBusy(false);
      document.body.classList.remove('command-hidden');
      if (onComplete) onComplete();
      return;
    }
    const lineText = lines[lineIndex];
    // PC-70: the hit reaction fires as the line STARTS typing — impact lands
    // with the message, not after it finishes narrating.
    handleHitLine(lineText);
    const div = document.createElement('div');
    div.className = 'msg-line';
    box.appendChild(div);
    if (feedPinned) box.scrollTop = box.scrollHeight;
    let charIndex = 0;
    function typeChar() {
      if (charIndex < lineText.length) {
        div.textContent = lineText.slice(0, charIndex + 1);
        charIndex++;
        if (feedPinned) box.scrollTop = box.scrollHeight;
        const t = setTimeout(typeChar, preset.charMs);
        typingTimeouts.push(t);
      } else {
        lineIndex++;
        const t = setTimeout(typeNextLine, preset.lineDelayMs);
        typingTimeouts.push(t);
      }
    }
    typeChar();
  }
  typeNextLine();
}

function getAuthToken() {
  return supabase?.auth?.getSession?.().then(({ data }) => data?.session?.access_token);
}

async function apiCall(path, method = 'GET', body = null) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/combat${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function checkAuth() {
  if (!supabase) {
    window.location.href = '/login.html';
    return false;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

function showMessage(text, isError = false) {
  const box = document.getElementById('message-box');
  if (!box) return;
  const line = document.createElement('div');
  line.className = isError ? 'msg-error' : 'msg-line';
  line.textContent = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function showErrorState(title, detail, showReturn = true) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  renderedFeedLines = 0; // error screen replaces the log — next render starts fresh
  const err = document.createElement('div');
  err.className = 'msg-error';
  err.innerHTML = `<strong>${title}</strong><br>${detail || ''}`;
  if (showReturn) {
    const link = document.createElement('a');
    link.href = '/game.html';
    link.textContent = 'Return to Town';
    link.style.cssText = 'display:block;margin-top:8px;color:#66ccff;';
    err.appendChild(link);
  }
  box.appendChild(err);
}

function setBusy(state) {
  // Don't release busy if the clock is mid-transition — let _finish() handle it
  if (!state && battleClock.state !== 'IDLE') return;
  busy = state;
  // Dynamic hand buttons + ITEM all live inside #action-menu; gate the whole row.
  document.querySelectorAll('#action-menu button').forEach(btn => {
    btn.disabled = state;
    btn.style.opacity = state ? '0.5' : '1';
  });
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

// PC-74 sprite-swap seam (sprites don't exist yet — documented hook only; future unique crit sprite swap slots in here)
// Call setMonsterSprite(monsterId, 'crit') to mark a card for crit state (adds .crit class for CSS hook).
// TODO: when crit sprites land, implement the 'crit' case to swap sprite.src or background.
function setMonsterSprite(monsterId, state) {
  // monsterId can be label or numeric id; find the card and toggle class
  const cards = document.querySelectorAll('.monster-card');
  for (const card of cards) {
    if (card.dataset.id === String(monsterId) || card.dataset.letter === String(monsterId)) {
      if (state === 'crit') card.classList.add('crit');
      else card.classList.remove('crit');
      return;
    }
  }
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

function renderDice(dice) {
  debugLog('renderDice', `remaining=${dice.remaining?.green || 0}g/${dice.remaining?.yellow || 0}y/${dice.remaining?.red || 0}r willRoll=${shouldAnimateDice}`);
  const tray = document.getElementById('dice-tray');
  const labels = document.getElementById('dice-labels');
  if (!tray || !labels || !dice) return;
  tray.innerHTML = '';
  const rem = dice.remaining || { green: 0, yellow: 0, red: 0 };
  const used = dice.used || { green: 0, yellow: 0, red: 0 };
  const current = dice.current;
  // Die-box markers (presentation only): the single color letters were
  // swapped for glyphs — green ?? / yellow ?! / red !!.
  const MARK = { green: '??', yellow: '?!', red: '!!' };

  const remRow = document.createElement('div');
  remRow.style.cssText = 'display:flex;gap:3px;margin-bottom:4px;';
  for (let i = 0; i < (rem.green || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die green';
    d.textContent = MARK.green;
    remRow.appendChild(d);
  }
  for (let i = 0; i < (rem.yellow || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die yellow';
    d.textContent = MARK.yellow;
    remRow.appendChild(d);
  }
  for (let i = 0; i < (rem.red || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die red';
    d.textContent = MARK.red;
    remRow.appendChild(d);
  }
  tray.appendChild(remRow);

  labels.innerHTML = `
    <div>REMAINING (${(rem.green||0)+(rem.yellow||0)+(rem.red||0)})</div>
    <div>USED (${(used.green||0)+(used.yellow||0)+(used.red||0)})</div>
  `;

  const curEl = document.getElementById('current-die');
  if (curEl) {
    if (current && current.color && current.face != null) {
      if (shouldAnimateDice) {
        shouldAnimateDice = false;
        appendFeedLine('Selecting portal difficulty...');
        curEl.style.display = 'none';
        // Stage 1 (selection): sweep row = remaining pool + the drawn die as an
        // extra box, so the roulette can land ON it. It shows the color marker
        // like every other box — never the face, or the result is spoiled early.
        const drawnEl = document.createElement('div');
        drawnEl.className = `die ${current.color}`;
        drawnEl.textContent = MARK[current.color] || '??';
        // Phantom inserted at END of its color block (G→Y→R natural order preserved).
        // This keeps same-color boxes contiguous; out-of-order would be a tell.
        // Sweep will pick uniformly among same-color boxes (incl. phantom) and
        // walk to it; landing box IS the drawn die (no morph ever).
        let insertAt;
        if (current.color === 'green') insertAt = rem.green || 0;
        else if (current.color === 'yellow') insertAt = (rem.green || 0) + (rem.yellow || 0);
        else insertAt = (rem.green || 0) + (rem.yellow || 0) + (rem.red || 0);
        remRow.insertBefore(drawnEl, remRow.children[insertAt] || null);
        // Labels match visible pool during sweep: REMAINING counts the
        // phantom (+1, die still "in play"); USED must NOT count it yet
        // (server already moved it to used) — so show usedTotal - 1.
        // The cleanup render below restores true post-draw counts.
        const remTotal = (rem.green || 0) + (rem.yellow || 0) + (rem.red || 0);
        const usedTotal = (used.green || 0) + (used.yellow || 0) + (used.red || 0);
        labels.innerHTML = `
          <div>REMAINING (${remTotal + 1})</div>
          <div>USED (${usedTotal - 1})</div>
        `;
        const diceEls = Array.from(remRow.children); // >= 1 (drawn die appended)
        // Stage 2 (roll) plays out IN the box the sweep landed on — the
        // current-die slot stays hidden until the reveal, so the chosen
        // die is never shown sitting at the row's right edge mid-roll.
        // After it lands, re-render the tray so the phantom drawn-die box
        // and its highlight are cleared — final state = true post-draw.
        const selectAndRoll = (landedBox) => {
          const colorLabel = current.color.charAt(0).toUpperCase() + current.color.slice(1);
          appendFeedLine(`${colorLabel} die selected`);
          appendFeedLine('Rolling Portal Die...');
          rollDiceAnimation(landedBox, current, dice.faces, () => {
            debugLog('ceremony', 'roll settled, starting reveal');
            appendFeedLine(`${current.face} rolled`);
            updateCurrentDie(curEl, current); // persistent slot lights up
            appendFeedLine('Selecting Monsters...');
            revealMonsters(() => {
              debugLog('ceremony', 'reveal complete, calling finishBattleIntro');
              appendFeedLine('Creating Action Queue...');
              finishBattleIntro();
            });
            setTimeout(() => renderDice(dice), 350);
          });
        };
        if (diceEls.length === 1) {
          // Only the drawn die in the tray: brief highlight, then roll.
          diceEls[0].classList.add('highlight');
          setTimeout(() => selectAndRoll(diceEls[0]), DICE_ANIM.LAND_PAUSE);
        } else {
          // Spahrep's spec: the landed box IS the drawn die — no morph,
          // ever. Land on a random box OF THE DRAWN COLOR (existing
          // same-color boxes + the phantom), then walk from 0 to it.
          const candidates = [];
          diceEls.forEach((el, i) => {
            if (el.classList.contains(current.color)) candidates.push(i);
          });
          // Phantom guarantees >= 1 same-color box; fall back defensively.
          const targetIndex = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : Math.floor(Math.random() * diceEls.length);
          performSweepAnimation(diceEls, targetIndex, selectAndRoll);
        }
      } else {
        updateCurrentDie(curEl, current);
      }
    } else {
      curEl.style.display = 'none';
    }
  }
}

function updateCurrentDie(curEl, current) {
  curEl.innerHTML = `
    <div class="die ${current.color}" style="width:32px;height:32px;font-size:14px;">${current.face}</div>
    <div style="font-size:9px;color:#88aaff;margin-top:2px;">${current.rolled_value != null ? current.rolled_value : ''}</div>
  `;
  curEl.style.display = 'flex';
}

function performSweepAnimation(diceEls, targetIndex, onLand) {
  const total = diceEls.length;
  // Spahrep's countdown: start at the first die, hop to the next, reduce
  // the count, stop on zero. Count = 12*(n-1) + r (r in 1..n) — the whir
  // term is pure theater (12-ish laps of the loop at high speed, same
  // every run, no info about the draw), and r is SOLVED BACKWARDS so the
  // countdown lands exactly on the target box. The caller picked the
  // target uniformly from the drawn color's boxes, so the landing IS the
  // selection — no morph, ever.
  const whir = DICE_ANIM.COUNTDOWN_WHIR * (total - 1);
  const r = ((targetIndex + DICE_ANIM.COUNTDOWN_WHIR) % total) || total; // (r + whir) % total === targetIndex, r in 1..n
  let count = whir + r; // steps remaining
  let idx = 0;

  function step() {
    diceEls.forEach(el => el.classList.remove('highlight'));
    diceEls[idx % total].classList.add('highlight');
    if (count === 0) {
      // countdown hit zero: this box IS the drawn die
      setTimeout(() => onLand(diceEls[idx % total]), DICE_ANIM.LAND_PAUSE);
      return;
    }
    idx++;
    count--;
    setTimeout(step, stepDelay(count));
  }

  function stepDelay(count) {
    // Pacing only — the countdown math above is untouched. Full-speed whir
    // for most of the spin, then the final SWEEP_TAIL steps interpolate
    // down to SWEEP_SLOW, so the highlight decelerates into the landing
    // instead of stopping dead.
    if (count > DICE_ANIM.SWEEP_TAIL) return DICE_ANIM.SWEEP_FAST;
    const t = (count - 1) / Math.max(1, DICE_ANIM.SWEEP_TAIL - 1);
    return DICE_ANIM.SWEEP_SLOW - (DICE_ANIM.SWEEP_SLOW - DICE_ANIM.SWEEP_FAST) * t;
  }

  step();
}

// Roll tumbles real faces[color] from payload (defensive [face] if missing).
// No invented values — repeated faces are legitimate (dice carry the same
// value on several faces), so each tick spins a fresh face span in instead:
// the number visibly rotates between rolls even when it stays the same.
// Settles with pop; #current-die lights only after.
function rollDiceAnimation(box, current, faces, onDone) {
  debugLog('rollDiceAnimation', `color=${current.color} face=${current.face} n_faces=${faces?.[current.color]?.length || 'fallback'}`);
  // The box keeps its color and highlight — it is already the draw's die.
  const pool = (faces && faces[current.color] && faces[current.color].length > 0)
    ? faces[current.color]
    : [current.face]; // defensive: unknown pool → die just settles

  let tick = 0;
  let interval = DICE_ANIM.ROLL_INITIAL;
  // The reel animation lives on the span, and each tick creates a NEW span —
  // the spin replays automatically, no class-toggle dance needed.
  box.classList.add('rolling');
  function step() {
    if (tick >= DICE_ANIM.ROLL_TICKS) {
      box.classList.remove('rolling');
      box.textContent = current.face;
      box.classList.remove('rolled');
      void box.offsetWidth; // force reflow so the pop animation restarts
      box.classList.add('rolled');
      onDone();
      debugLog('rollDiceAnimation', `settled face=${current.face}`);
      return;
    }
    const face = document.createElement('span');
    face.className = 'die-face';
    face.textContent = pool[Math.floor(Math.random() * pool.length)];
    box.replaceChildren(face);
    tick++;
    interval = Math.min(DICE_ANIM.ROLL_MIN, Math.floor(interval * DICE_ANIM.ROLL_DECEL));
    setTimeout(step, interval);
  }
  step();
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
  // PC-70: letter = the monster's arena key from its label (feed lines use
  // the raw label: "Monster A" / "A" / "Monster #12"). Same normalization as
  // parseHitLine + queueLabel. Index order is NOT the contract — labels are
  // "next free A-Z" at spawn and drift from array order when monsters die.
  card.dataset.letter = String(m.label || '').replace(/^Monster\s*/i, '');
  card.style.cssText = 'background:rgba(0,0,0,0.4);border:2px solid #4a90d9;padding:8px 10px;margin-bottom:6px;';
  const sprite = document.createElement('div');
  sprite.className = 'monster-sprite';
  sprite.style.cssText = 'width:64px;height:48px;background:#112233;border:1px solid #335577;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#66ccff;';
  sprite.textContent = m.name ? m.name.substring(0, 3).toUpperCase() : 'MON';
  const name = document.createElement('div');
  name.style.cssText = 'color:#ffcc66;font-size:11px;text-align:center;';
  name.textContent = m.name || 'Monster';
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

// Ceremony-intro: once every monster is in, the timing track fills in from
// First (next) to last; the command window appears only after the track is
// full (the fill's onDone). Idempotent via the flag.
function finishBattleIntro() {
  debugLog('finishBattleIntro', `pending=${battleIntroPending} n_fires=${lastBs?.intro?.fires?.length || 0}`);
  if (!battleIntroPending) return;
  battleIntroPending = false;
  if (lastBs && lastBs.intro?.fires?.length > 0) {
    debugLog('finishBattleIntro', 'playing intro fires countdown');
    playIntroCountdown(lastBs, lastBs.intro, () => {
      document.body.classList.remove('intro-pending');
      renderActionMenu(lastBs);
    });
  } else {
    debugLog('finishBattleIntro', 'filling queue (no intro fires)');
    document.body.classList.remove('queue-filling'); // timing track appears (rows still hidden)
    renderQueue(lastBs, true, () => {
      renderFeed([]);
      document.body.classList.remove('intro-pending'); // command window only after the track is full
      renderActionMenu(lastBs);
    });
  }
}

function renderFeed(feed, onComplete) {
  debugLog('renderFeed', `n_lines=${feed?.length || 0} rendered=${renderedFeedLines}`);
  const box = document.getElementById('message-box');
  if (!box) return;
  const currentLines = feed || [];
  // EMPTY feed = new-battle reset signal (tic-0 ceremony): clear box, show placeholder instantly, reset state
  if (currentLines.length === 0) {
    box.innerHTML = '';
    renderedFeedLines = 0; // placeholder is a system line, not feed
    appendFeedLine('Battle begins...');
    if (onComplete) onComplete();
    typingInProgress = false;
    typingSetBusy = false;
    typingTimeouts = [];
    return;
  }
  // incremental: only type NEW lines (diff by feed count, not box children —
  // the box also holds panel/system lines that must not shift the feed diff)
  if (currentLines.length <= renderedFeedLines) {
    // Feed cap collision: engine once capped at 10 lines, so feed content can
    // shift at the same length. Detect by comparing last lines — if different,
    // reset and re-render the full feed.
    if (currentLines.length > 0 && currentLines.length === renderedFeedLines) {
      const lastShown = box.querySelector('.msg-line:last-child');
      const lastFeed = currentLines[currentLines.length - 1];
      if (!lastShown || lastShown.textContent !== lastFeed) {
        // content shifted — clear and re-display everything
        renderedFeedLines = 0;
        // fall through to render all lines below
      } else {
        if (onComplete) onComplete();
        return; // genuinely nothing new
      }
    } else {
      if (onComplete) onComplete();
      return;
    }
  }
  const newLines = currentLines.slice(renderedFeedLines);
  const preset = getSpeedPreset();
  if (preset.charMs === 0) {
    newLines.forEach(lineText => appendFeedLine(lineText));
    if (onComplete) onComplete();
    renderedFeedLines = currentLines.length;
    return;
  }
  typeFeedLines(newLines, onComplete);
  renderedFeedLines = currentLines.length;
}

// PC-72: resume path — the battle already happened; restore the log at once
// instead of typing history (the typewriter is for NEW lines only). Hit
// reactions stay suppressed: re-shaking every historical hit would read as
// fresh damage, not a resume.
function populateFeedInstantly(feed) {
  const lines = feed || [];
  if (lines.length === 0) {
    renderFeed([]); // empty state — 'Battle begins...' placeholder
    return;
  }
  suppressHitFeedback = true;
  try {
    // Only append feed lines not yet shown (PC-72 resume: full feed on a
    // fresh page because the counter starts at 0; commits append only the
    // new lines — no duplicates, and system lines never shift the diff).
    const fresh = lines.slice(renderedFeedLines);
    fresh.forEach(line => appendFeedLine(line));
    renderedFeedLines = lines.length;
  } finally {
    suppressHitFeedback = false;
  }
}

function renderPlayerHP(runOrState) {
  // Update HP text via #hp-value span (does not blow away sibling bar element)
  const valEl = document.getElementById('hp-value');
  // API exposes player_hp (numeric) only — no player hp_word. Design shows numbers.
  const hpVal = (runOrState && typeof runOrState.player_hp === 'number') ? runOrState.player_hp : null;
  const hpColor = '#fff'; // white reads cleanly on both red fill and black bg
  if (valEl) {
    valEl.style.color = hpColor;
    valEl.textContent = `HP: ${hpVal === null ? '—' : hpVal}`;
  }

  // HP bar: red fill = current HP (width %), black bg = missing HP
  const fillEl = document.getElementById('hp-bar-fill');
  if (fillEl) {
    let maxHp = runOrState && typeof runOrState.max_hp === 'number' ? runOrState.max_hp : null;
    if (maxHp === null && runOrState && runOrState.battle_state && runOrState.battle_state.player) {
      maxHp = runOrState.battle_state.player.max_hp;
    }
    const pct = (hpVal !== null && maxHp && maxHp > 0)
      ? Math.min(100, Math.max(0, (hpVal / maxHp) * 100))
      : 100;
    fillEl.style.width = pct + '%';
  }
}

function renderLoadout(bs) {
  const wl = bs.weapons || {};
  const lh = document.getElementById('loadout-lh');
  const rh = document.getElementById('loadout-rh');
  if (lh) lh.textContent = (wl.hand_l && wl.hand_l.name) || '—';
  if (rh) rh.textContent = (wl.hand_r && wl.hand_r.name) || '—';
}

/**
 * Action Queue (next-up events column), per the design mockups: one row per
 * queued event, `Label EventName | tics-until-change`, next event on top.
 * Rows are countdowns to a state change: an attack landing, a hand freeing
 * ("Ready"), a monster striking, a potion taking effect.
 */
function renderQueue(bs, fill = false, onDone = null) {
  debugLog('renderQueue', `fill=${fill} n_queue=${bs.queue?.length || 0} n_monsters=${bs.monsters?.length || 0}`);
  const el = document.getElementById('queue');
  if (!el) return;
  el.innerHTML = '';
  const titleEl = el.closest('.queue-panel')?.querySelector('.panel-title');
  if (titleEl) {
    titleEl.textContent = 'Action Queue';
  }
  const queue = bs.queue || [];
  if (fill && onDone) {
    // Ceremony-intro: signal completion after the last row's fade lands, so the
    // command window never waits on an animation that cannot start (empty queue).
    const rows = Math.max(queue.length, 1);
    setTimeout(onDone, (rows - 1) * QUEUE_FILL_STAGGER + QUEUE_FILL_MS);
  }
  if (queue.length === 0) return;
  const monsters = bs.monsters || [];
  const sorted = sortQueueRows(queue);
  sorted.forEach((row, index) => {
    el.appendChild(buildQueueRow(row, monsters, bs, true, index));
  });
  // PC-56: Prediction bar — maps [minT, maxT] onto continuous tic → pixel interpolation
  if (queueBarInfo && queueBarInfo.kind === 'bar' && queueBarInfo.firstId && queueBarInfo.lastId) {
    const bar = document.createElement('div');
    bar.className = 'prediction-bar';
    // Build a tic→position ladder from DOM rows (in DOM order, already sorted)
    const rowEls = Array.from(el.querySelectorAll('.queue-row'));
    const queueRect = el.getBoundingClientRect();
    const ladder = rowEls.filter(r => r.dataset.tics !== undefined).map(r => {
      const rect = r.getBoundingClientRect();
      return { tics: Number(r.dataset.tics), top: rect.top - queueRect.top, bottom: rect.bottom - queueRect.top, height: rect.height };
    });
    ladder.sort((a, b) => a.tics - b.tics);
    const gapPx = 2; // matches .queue-row margin-bottom
    function yAtTics(t) {
      if (ladder.length === 0) return 0;
      const first = ladder[0], last = ladder[ladder.length - 1];
      // Virtual extension above first row — proportional to tic distance
      if (t <= first.tics) {
        if (t === first.tics) return first.top;
        const stepTics = ladder.length > 1 ? ladder[1].tics - first.tics : Math.max(first.tics, 1);
        const frac = (first.tics - t) / stepTics;
        return first.top - frac * (last.height + gapPx);
      }
      // Virtual extension below last row — proportional to tic distance
      if (t >= last.tics) {
        if (t === last.tics) return last.bottom;
        const stepTics = ladder.length > 1 ? last.tics - ladder[ladder.length - 2].tics : Math.max(last.tics, 1);
        const frac = (t - last.tics) / stepTics;
        return last.bottom + frac * (last.height + gapPx);
      }
      // Between two rows — lerp across the gap
      let i = 0;
      while (i < ladder.length - 1 && ladder[i + 1].tics < t) i++;
      const lo = ladder[i], hi = ladder[i + 1];
      const frac = (t - lo.tics) / (hi.tics - lo.tics);
      return lo.bottom + frac * (hi.top - lo.bottom);
    }
    const minT = Number(queueBarInfo.minT);
    const maxT = Number(queueBarInfo.maxT);
    let barTop = yAtTics(minT);
    // Find clamping boundary for the bar top.
    // When the timing range contains a single row (firstId == lastId), the bar
    // floats in the gap above that row because yAtTics interpolates well above
    // it. Snapping to the inside row's own bottom does nothing. Instead, snap
    // to the row ABOVE the inside row so the bar is flush with both bounding
    // row boxes, not protruding into the upper gap.
    let topBoundEl = rowEls.find(r => r.dataset.rowId === queueBarInfo.firstId);
    if (queueBarInfo.hasInside && queueBarInfo.firstId === queueBarInfo.lastId) {
      const idx = rowEls.findIndex(r => r.dataset.rowId === queueBarInfo.firstId);
      if (idx > 0) topBoundEl = rowEls[idx - 1];
    }
    if (topBoundEl) {
      const rect = topBoundEl.getBoundingClientRect();
      barTop = Math.min(barTop, rect.bottom - queueRect.top - 3);
    }
    // When maxT lands exactly on a row's tics, bar bottom flushes with the box's bottom edge
    const exactRow = ladder.find(r => r.tics === maxT);
    let barBottom = exactRow ? exactRow.bottom : yAtTics(maxT);
    // Find clamping boundary for the bar bottom — mirrors the top-side logic.
    let bottomBoundEl = rowEls.find(r => r.dataset.rowId === queueBarInfo.lastId);
    if (queueBarInfo.hasInside && queueBarInfo.firstId === queueBarInfo.lastId) {
      const idx = rowEls.findIndex(r => r.dataset.rowId === queueBarInfo.lastId);
      if (idx < rowEls.length - 1) bottomBoundEl = rowEls[idx + 1];
    }
    if (bottomBoundEl) {
      const rect = bottomBoundEl.getBoundingClientRect();
      const lastLadderTic = ladder.length > 0 ? ladder[ladder.length - 1].tics : 0;
      if (queueBarInfo.hasInside === false && maxT > lastLadderTic) {
        // Attack lands after all visible queue rows — show as ~1 row height below the last row
        const rowH = ladder.length > 0 ? ladder[ladder.length - 1].height : 20;
        barBottom = rect.bottom - queueRect.top + rowH + gapPx;
      } else {
        barBottom = Math.max(barBottom, rect.top - queueRect.top);
      }
    }
    bar.style.top = `${barTop}px`;
    bar.style.height = `${Math.max(4, barBottom - barTop + 3)}px`;
    el.appendChild(bar);
  }
  if (fill) {
    // Ceremony-intro: intro fill — rows are sorted by tics, so the top row is First
    // (next); reveal them in that order, top to bottom, one at a time.
    Array.from(el.children).forEach((row, i) => {
      row.style.transition = `opacity ${QUEUE_FILL_MS}ms ease`;
      row.style.opacity = '0';
      setTimeout(() => { row.style.opacity = '1'; }, i * QUEUE_FILL_STAGGER);
    });
  }
}

// diff for resolve/enter animations (non-blocking)
function diffQueueForAnimation(oldBs, newBs) {
  const oldRows = sortQueueRows(oldBs.queue || []);
  const newRows = sortQueueRows(newBs.queue || []);
  const oldIds = new Set(oldRows.map(r => r.id));
  const newIds = new Set(newRows.map(r => r.id));
  return {
    resolved: oldRows.filter(r => !newIds.has(r.id)).map(r => r.id),
    added: newRows.filter(r => !oldIds.has(r.id)).map(r => ({
      id: r.id,
      isMonster: r.label !== 'LH' && r.label !== 'RH' && r.event === 'attack'
    }))
  };
}

// Shared rail-row builder: used by renderQueue and the PC-64 intro countdown so
// countdown rows are pixel-identical to the real queue (same sort, same DOM).
// withMarkers=false omits PC-56 '>' timing markers (no selection during the intro).
function buildQueueRow(row, monsters, bs, withMarkers, index = -1) {
  const div = document.createElement('div');
  div.className = 'queue-row';
  if (index >= 0 && index < 3) {
    div.classList.add('top-row');
  }
  div.dataset.rowId = row.id;
  div.dataset.tics = row.tics;
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  // Ready placeholder rows: show the hand label and "Ready" — no tic countdown
  if (row.event === 'ready') {
    nameSpan.textContent = `${queueLabel(row)} Ready`;
    const ticSpan = document.createElement('span');
    ticSpan.className = 'tic';
    ticSpan.textContent = '—';
    div.appendChild(nameSpan);
    div.appendChild(ticSpan);
    return div;
  }
  // Monster attack rows: show "<Monster name>'s <Attack>" (e.g. "Imp's Bite")
  const isMonster = row.event === 'attack' && row.label && row.label !== 'LH' && row.label !== 'RH';
  if (isMonster) {
    const mon = monsters.find(m => m.label === row.label);
    const monName = (mon && mon.name) ? mon.name : (mon && mon.label) ? mon.label : queueLabel(row);
    const atkName = queueEventName(row, monsters, bs);
    nameSpan.textContent = `${monName}'s ${atkName}`;
  } else {
    nameSpan.textContent = `${queueLabel(row)} ${queueEventName(row, monsters, bs)}`;
  }
  const ticSpan = document.createElement('span');
  ticSpan.className = 'tic';
  ticSpan.textContent = String(row.tics != null ? row.tics : 0);
  div.appendChild(nameSpan);
  div.appendChild(ticSpan);
  if (!isMonster) {
    const bar = document.createElement('div');
    bar.className = 'queue-bar';
    div.appendChild(bar);
  }
  // PC-56: bar-only mode — no pin markers; the prediction bar is added by renderQueue
  return div;
}

// PC-64 battle intro: rows sorted by tics ascending with player-first ties —
// identical ordering to renderQueue (see sortQueueRows below).
function sortQueueRows(queue) {
  return [...queue].sort((a, b) => {
    if ((a.tics ?? 0) !== (b.tics ?? 0)) return (a.tics ?? 0) - (b.tics ?? 0);
    const aPlayer = a.label === 'LH' || a.label === 'RH' ? 0 : 1;
    const bPlayer = b.label === 'LH' || b.label === 'RH' ? 0 : 1;
    return aPlayer - bPlayer;
  });
}

// PC-64: tic-0 countdown to the first decision point — theater over the
// authoritative state. Replays the approach: rows decrement per step, fires
// reveal their feed lines and HP/rail updates in order, then the real state
// snaps in and onDone() opens the command window.
function playIntroCountdown(bs, intro, onDone) {
  document.body.classList.remove('queue-filling'); // timing track appears
  const el = document.getElementById('queue');
  if (el) el.innerHTML = '';
  const monsters = bs.monsters || [];
  const rail = intro.rows.map(r => ({ label: r.label, event: r.event, tics: r.tics }));
  const ordered = sortQueueRows(rail);
  for (const row of ordered) {
    if (el) el.appendChild(buildQueueRow(row, monsters, bs, false));
  }
  renderPlayerHP({ player_hp: intro.hpStart });
  const battleLabel = document.getElementById('battle-label');
  if (battleLabel) battleLabel.textContent = battleLabel.textContent.replace(/— TIC \d+$/, '— TIC 0');

  const total = bs.tic || 0;
  if (total > 60 || !Array.isArray(intro.fires)) {
    // Defensive: unreasonably long countdown (or malformed intro) — snap to real state.
    finishIntroSnap(bs, onDone);
    return;
  }
  const dwell = Math.max(60, Math.min(600, Math.round(4500 / Math.max(total, 1))));
  let k = 0;
  clearIntroTimer();
  introTimer = setInterval(() => {
    k++;
    // Decrement every visible row's tics (floor 0).
    for (const row of ordered) {
      if (row.tics > 0) row.tics--;
    }
    // Reveal fires for the tic that just elapsed (pre-increment tic k-1), in order.
    const fires = (intro.fires || []).filter(f => f.tic === k - 1);
    for (const f of fires) {
      appendFeedLine(f.line);
      renderPlayerHP({ player_hp: f.hp, max_hp: bs.player.max_hp });
      if (f.after) {
        const row = ordered.find(r => r.label === f.label);
        if (row) row.tics = f.after.tics;
      } else {
        const idx = ordered.findIndex(r => r.label === f.label);
        if (idx !== -1) ordered.splice(idx, 1);
      }
    }
    renderedFeedLines += fires.length; // intro fires are feed lines — keep the diff counter in sync
    // Re-render the rail from the mirror so decrements + after-effects show.
    if (el) {
      el.innerHTML = '';
      for (const row of sortQueueRows(ordered)) {
        el.appendChild(buildQueueRow(row, monsters, bs, false));
      }
    }
    if (battleLabel) battleLabel.textContent = battleLabel.textContent.replace(/— TIC \d+$/, `— TIC ${k}`);
    if (k >= total) {
      clearIntroTimer();
      finishIntroSnap(bs, onDone);
    }
  }, dwell);
}

function appendFeedLine(line) {
  // PC-70: every feed line passes the hit router — covers the instant text
  // preset, the intro-countdown fires, and one-shot lines.
  handleHitLine(line);
  const box = document.getElementById('message-box');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'msg-line';
  div.textContent = line;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function clearIntroTimer() {
  if (introTimer) {
    clearInterval(introTimer);
    introTimer = null;
  }
}

function finishIntroSnap(bs, onDone) {
  renderQueue(bs); // real rows replace the mirrored DOM
  const feed = bs.feed || [];
  // PC-70: the snap re-narrates the FULL battle history (fires already played
  // with their shakes during the countdown) — suppress feedback so history
  // does not re-shake; only NEW lines react after the snap.
  suppressHitFeedback = true;
  const done = () => { suppressHitFeedback = false; if (onDone) onDone(); };
  const preset = getSpeedPreset();
  if (preset.charMs === 0) {
    renderFeed(feed);
    done();
    return;
  }
  // PC-DEC-044: hold onDone until typing completes; reset path in renderFeed clears for from-the-top reveal
  // always type the FULL feed (after placeholder) for intro snap
  if (feed.length > 0) {
    // clear any prior content (placeholder + any revealed) so we type the full post-reset feed
    const box = document.getElementById('message-box');
    if (box) box.innerHTML = '';
    renderedFeedLines = 0; // full-feed re-type starts from the top
    typeFeedLines(feed, done);
    renderedFeedLines = feed.length;
  } else {
    done();
  }
}

function queueLabel(row) {
  if (row.label === 'LH') return 'L. Hand';
  if (row.label === 'RH') return 'R. Hand';
  // Monsters show as single-letter arena markers (A/B/C), like the mockups.
  return String(row.label || '?').replace(/^Monster\s*/i, '');
}

function queueEventName(row, monsters, bs) {
  if (row.event === 'approach') return '';
  // A hand freeing is a state change — the queue counts down to "Ready".
  if (row.event === 'cooldown' || row.event === 'recovery') return 'Ready';
  if (row.event === 'drinking') {
    const p = (bs.potions || {})[row.potionSlot];
    return (p && p.template_name) ? p.template_name : 'Potion';
  }
  if (row.attackName) return row.attackName;
  // Monster attack rows carry no name — use the monster's primary attack.
  const mon = monsters.find(m => m.label === row.label);
  if (mon && Array.isArray(mon.attacks) && mon.attacks.length && mon.attacks[0].name) {
    return mon.attacks[0].name;
  }
  return 'Attack';
}

function showAdvanceUI(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  renderedFeedLines = 0; // the panel is not feed — next battle's log starts fresh
  // No more actions to pick — clear the action row.
  const actionWrap = document.getElementById('action-choices');
  if (actionWrap) actionWrap.innerHTML = '';
  const adv = document.createElement('div');
  adv.className = 'msg-line';
  const monstersDead = state.monsters_dead ?? (Array.isArray(state.monsters) && state.monsters.length > 0 && state.monsters.every(m => m.dead));
  adv.innerHTML = `<strong>Battle complete.</strong> ${monstersDead ? 'Monsters defeated.' : ''}`;
  const contBtn = document.createElement('button');
  contBtn.textContent = 'Continue to next battle';
  contBtn.className = 'action-btn';
  contBtn.style.marginTop = '8px';
  contBtn.onclick = async () => {
    if (busy) return; // also covers typing-gate: the panel buttons are not disabled by setBusy
    setBusy(true);
    contBtn.disabled = true; // double-click would double-advance the run server-side
    try {
      await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'continue' });
      // New battle starts with a clean log: the battle-complete panel must
      // never survive into the next battle (it obscures the fresh feed).
      const box = document.getElementById('message-box');
      if (box) box.innerHTML = '';
      renderedFeedLines = 0;
      showMessage('Advancing to next battle...');
      shouldAnimateDice = true;
      await loadBattle(runId);
    } catch (e) {
      showMessage(e.message, true);
    }
    setBusy(false);
    contBtn.disabled = false;
  };
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop run';
  stopBtn.className = 'action-btn';
  stopBtn.style.marginTop = '8px';
  stopBtn.onclick = async () => {
    setBusy(true);
    try {
      await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' });
      showErrorState('Run stopped', 'You abandoned the run.', true);
    } catch (e) {
      showMessage(e.message, true);
    }
    setBusy(false);
  };
  adv.appendChild(contBtn);
  adv.appendChild(stopBtn);
  box.appendChild(adv);
}

async function doAttack(runId, hand, attackId, targetIds) {
  debugLog('doAttack', `hand=${hand} attack=${attackId} n_targets=${targetIds?.length || 0}`);
  if (busy) return;
  setBusy(true);
  try {
    const payload = { hand, attack_id: attackId, target_ids: targetIds || [] };
    await apiCall(`/runs/${runId}/commit`, 'POST', payload); // returns {committed: true}
    pendingAttack = null;
    await tickLoop(runId);
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('Hand not ready')) {
      showMessage('Hand not ready — waiting engine advance');
    } else {
      showMessage(msg, true);
    }
  }
  setBusy(false);
}

async function doSwap(runId, hand) {
  debugLog('doSwap', `hand=${hand}`);
  if (busy) return;
  setBusy(true);
  try {
    const data = await apiCall(`/runs/${runId}/swap`, 'POST', { hand });
    showMessage(`Belt swap (${hand}) — cooldown ${data.delay != null ? data.delay : ''} tics`);
    pendingAttack = null;
    await tickLoop(runId);
  } catch (e) {
    showMessage(String(e.message || e), true);
  }
  setBusy(false);
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * PC-63 DW cascading command menu — three-window modal cascade per the locked
 * spec (docs/battle-status-ui.md Cascading Window Spec; shared/CommandSelection.png):
 *   1. COMMAND window (blue hand tab; attack rows + potions + Equip row)
 *   2. TARGET window (lettered monsters w/ HP word, or L.HAND/R.HAND, or ALL MONSTERS)
 *   3. CONFIRM window ("Confirm <attack>: <letter> <name>" + Yes/No)
 * Esc backs one window at every level; the root window never closes (PC-DEC-022).
 * Menu rows derive from the real per-weapon attacks via the weapon template
 * mapping — never a hardcoded list. Payloads/CLI parity unchanged
 * ({hand, attack_id, target_ids}). Both-hands order is the engine's call
 * (PC-DEC-028/030, initiative on PC-64): the UI opens the first ready hand,
 * LH → RH — no hand-switch chip, no override. Keyboard: Up/Down move the
 * green hand cursor, Enter selects, Esc backs out. Mouse: hover moves the
 * cursor, click selects (active/top window only — one modal stack).
 */
function renderActionMenu(bs) {
  debugLog('renderActionMenu', `n_hands=${Object.keys(bs.player?.hands || {}).length} n_monsters=${(bs.monsters||[]).filter(m=>!m.dead).length}`);
  const wrap = document.getElementById('action-choices');
  if (!wrap) return;
  wrap.innerHTML = '';
  pendingAttack = null;
  wrap.style.display = 'block';

  const hands = (bs.player && bs.player.hands) || {};
  const weapons = bs.weapons || {};
  const queue = bs.queue || [];
  const monsters = (bs.monsters || []).filter(m => !m.dead);
  const potions = bs.potions || {};
  const belt = weapons.belt || null;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // PC-52r: an empty hand is a Ready hand — it always has legal actions
  // (potion, Fist unarmed attack), so the queue never waits on an impossible action.
  const readyHands = ['LH', 'RH'].filter(h => {
    const w = weapons[h === 'LH' ? 'hand_l' : 'hand_r'];
    return hands[h] && hands[h].state === 'Ready' && (!w || w.id);
  }).sort((a, b) => {
    // PC-DEC-028: both ready → faster base attack (lower weapon speed) opens first; tie → LH.
    // Missing speed (empty hand / anomalous data) sorts last — never a surprise first-mover.
    const sa = weapons[a === 'LH' ? 'hand_l' : 'hand_r']?.speed ?? Number.MAX_SAFE_INTEGER;
    const sb = weapons[b === 'LH' ? 'hand_l' : 'hand_r']?.speed ?? Number.MAX_SAFE_INTEGER;
    return sa !== sb ? sa - sb : (a === 'LH' ? -1 : 1);
  });
  if (!readyHands.length) {
    // no ready hand — show winding status
    const status = document.createElement('div');
    status.className = 'action-status';
    status.textContent = ['LH', 'RH'].map(h => {
      const w = weapons[h === 'LH' ? 'hand_l' : 'hand_r'];
      if (!w || !w.id) return null;
      const approachOrWindingRow = queue.find(q => (q.event === 'winding' || q.event === 'approach') && q.label === h);
      const row = approachOrWindingRow;
      return `${h} — ${row ? row.event : 'winding'}${row && row.tics != null ? ' ' + row.tics + ' tics' : ''}`;
    }).filter(Boolean).join('  ·  ') || 'No hand ready';
    wrap.appendChild(status);
    return;
  }

  const hand = readyHands[0];
  const w = weapons[hand === 'LH' ? 'hand_l' : 'hand_r'];
  const handLineText = hand === 'LH' ? 'L.HAND' : 'R.HAND';

  function potionFor(slot) {
    return potions[slot === 'A' ? 'potion_a' : 'potion_b'] || potions[slot] || null;
  }

  function showInfo(text) {
    const ar = document.getElementById('action-readout');
    if (ar) ar.innerHTML = text || '';
  }

  function attackInfo(a, weapon) {
    const src = weapon || w || {};
    const base = src.base_damage != null ? src.base_damage : (src.damage || 0);
    const range = src.damage_range != null ? src.damage_range : 0;
    const multi = a.is_multi_target ? ' <span style="color:#ffaa66">[MULTI]</span>' : '';
    const desc = a.description ? ` — ${escHtml(a.description)}` : '';
    const weaponSpeed = src.speed || 0;
    const pBase = (a.prepare_time || 0) + weaponSpeed;
    const pVar = a.prepare_time_range || 0;
    const cBase = (a.cooldown_time || 0) + weaponSpeed;
    const cVar = a.cooldown_time_range || 0;
    const pText = pVar > 0 ? `${pBase}-${pBase + pVar}` : `${pBase}`;
    const cText = cVar > 0 ? `${cBase}-${cBase + cVar}` : `${cBase}`;
    let h = `<div style="display:flex;flex-direction:column;gap:1px;width:100%;">`;
    h += `<div style="color:#ffcc66;font-weight:bold;white-space:nowrap;">${escHtml(a.name)}${multi}</div>`;
    h += `<div style="display:flex;flex-direction:column;gap:0;line-height:1.4;">`;
    h += `<div><span style="color:#7a8ca6;">Damage:</span> ${base}±${range}</div>`;
    h += `<div><span style="color:#7a8ca6;">Windup:</span> ${pText}t</div>`;
    h += `<div><span style="color:#7a8ca6;">Cooldown:</span> ${cText}t</div>`;
    h += `</div>`;
    if (desc) h += `<div style="color:#556677;font-size:11px;margin-top:2px;">${desc}</div>`;
    h += `</div>`;
    return h;
  }

  function setMarkers(attack) {
    const q = (lastBs && lastBs.queue) || [];
    queueBarInfo = computeTimingMarkers(q, attack, (w && w.speed) || 0);
    renderQueue(lastBs);
  }
  function clearMarkers() {
    queueBarInfo = null;
    renderQueue(lastBs);
  }

  // ---- cascade stack: levels { kind: action|target|confirm, rows, activeIdx } ----
  // Cascade geometry (PC-DEC-043; shared/CascadeIssue.png "Desired"): every window
  // renders at the SAME box size — the tallest window's natural height, capped to
  // the root — so the fixed down-right step produces an even staircase: each window
  // overlaps the parent by a uniform amount. Per Spahrep 2026-09-17 the steps are
  // kept small because a parent's rows are obsolete once you advance ("you really
  // dont need to see it, so it can overlap the words too") — only the parent's
  // hand tab stays visible. No size-mismatch gaps.
  const CASCADE_STEP_X = 96; // px right per level — parent's left sliver stays readable
  const CASCADE_STEP_Y = 26; // px down per level — parent's hand tab stays visible; rows may be covered
  const stack = [];

  function yesNoRows(onYes) {
    return [
      { html: 'Yes', action: onYes },
      { html: 'No', action: () => back() }
    ];
  }

  function back() {
    if (stack.length > 1) {
      stack.pop();
      renderStack();
    } else {
      // root window cannot close (PC-DEC-022) — clear the readout only
      clearMarkers();
      showInfo('');
    }
  }

  function pickTarget(a) {
    if (!monsters.length) {
      // nothing to target — commit with auto-target (CLI parity)
      doAttack(currentRunId, hand, a.id, []);
      return;
    }
    const weapon = (w && w.id) ? w : (weapons && weapons.fist) || null;
    if (a.is_multi_target) {
      // multi-target hits ALL live monsters — a single row, no pick (CLI parity: ids)
      stack.push({ kind: 'target', attack: a, weapon, rows: [{ html: 'ALL MONSTERS' }] });
    } else {
      stack.push({
        kind: 'target',
        attack: a,
        weapon,
        rows: monsters.map((m, i) => ({
          html: `<span class="dw-letter">${LETTERS[i]}</span>: ${escHtml(m.name)} - <span class="${bandClass(m)}">${escHtml(m.hp_word || m.hpWord || 'Healthy')}</span>`,
          monster: m,
          letter: LETTERS[i]
        }))
      });
    }
    renderStack();
  }

  function pickPotion(slot, p) {
    stack.push({
      kind: 'confirm',
      slot,
      text: `Use <strong>${escHtml(p.template_name)}</strong> (${escHtml(p.effect_label || '')})?`,
      rows: yesNoRows(() => usePotion(currentRunId, slot))
    });
    renderStack();
  }

  function pickEquip() {
    stack.push({
      kind: 'confirm',
      text: `Swap ${handLineText} with <span class="dw-weapon">${escHtml(belt.name)}</span>?`,
      rows: yesNoRows(() => doSwap(currentRunId, hand))
    });
    renderStack();
  }

  function selectTop() {
    const lvl = stack[stack.length - 1];
    const row = lvl.rows[lvl.activeIdx];
    if (!row || row.disabled) return;
    if (lvl.kind === 'action') {
      if (row.enter) row.enter();
      return;
    }
    if (lvl.kind === 'target') {
      if (lvl.potion) {
        stack.push({
          kind: 'confirm',
          text: `Use <strong>${escHtml(lvl.potion.template_name)}</strong> (${escHtml(lvl.potion.effect_label || '')}) on ${row.label}?`,
          rows: yesNoRows(() => usePotion(currentRunId, lvl.slot))
        });
      } else {
        const live = monsters.filter(m => (m.current_hp ?? 1) > 0).map(m => m.id);
        const ids = row.monster ? [row.monster.id] : live;
        const label = row.monster ? `${row.letter} ${row.monster.name}` : 'ALL MONSTERS';
        stack.push({
          kind: 'confirm',
          text: `Confirm ${escHtml(lvl.attack.name)}: ${escHtml(label)}`,
          rows: yesNoRows(() => doAttack(currentRunId, hand, lvl.attack.id, ids))
        });
      }
      renderStack();
      return;
    }
    if (lvl.kind === 'confirm') {
      if (row.action) row.action();
    }
  }

  function renderStack() {
    wrap.querySelectorAll('.dw-root').forEach(el => el.remove());
    const root = document.createElement('div');
    root.className = 'dw-root';
    wrap.appendChild(root);
    const topIdx = stack.length - 1;
    const wins = [];
    stack.forEach((lvl, i) => {
      if (lvl.activeIdx == null) lvl.activeIdx = 0; // every window opens with row 0 selected
      const win = document.createElement('div');
      win.className = 'dw-window' + (i === topIdx ? ' top' : '');
      win.style.left = (i * CASCADE_STEP_X) + 'px';
      win.style.zIndex = String(10 + i);
      if (i === 0 && lvl.tab) {
        const tab = document.createElement('div');
        tab.className = 'dw-tab';
        tab.textContent = lvl.tab;
        win.appendChild(tab);
      }
      if (lvl.text) {
        const t = document.createElement('div');
        t.className = 'dw-text';
        t.innerHTML = lvl.text;
        win.appendChild(t);
      }
      lvl.rows.forEach((row, ri) => {
        if (row.blank) {
          const g = document.createElement('div');
          g.className = 'dw-gap';
          win.appendChild(g);
          return;
        }
        const el = document.createElement('div');
        el.className = 'dw-row'
          + (row.disabled ? ' disabled' : '')
          + (ri === lvl.activeIdx ? ' active' : '');
        el.innerHTML = row.html;
        if (i === topIdx && !row.disabled) {
          el.onclick = () => { lvl.activeIdx = ri; renderStack(); selectTop(); };
          el.onmouseenter = () => { if (!keyboardActive && lvl.activeIdx !== ri) { lvl.activeIdx = ri; renderStack(); } };
        }
        win.appendChild(el);
      });
      root.appendChild(win);
      wins.push(win);
    });
    // Uniform cascade box: size every window to the tallest natural height so the
    // down-right steps form an even staircase (no mismatched sizes, no gaps).
    // Capped to the root's own height so the stack never spills onto the footer.
    const boxH = Math.min(
      root.clientHeight || 236,
      Math.max(0, ...wins.map(win => win.offsetHeight))
    );
    wins.forEach((win, i) => {
      win.style.height = boxH + 'px';
      win.style.top = (i * CASCADE_STEP_Y) + 'px';
    });
    paintReadout();
    // Position the attack-info readout to the right of the cascade stack
    const readout = document.getElementById('action-readout');
    if (readout) {
      const cascadeRight = 12 + (Math.max(0, stack.length - 1) * 96) + 316;
      readout.style.left = (cascadeRight + 8) + 'px';
      readout.style.top = '0px';
    }
  }

  // Footer info + '>' timing markers track the TOP window's selection.
  function paintReadout() {
    const top = stack[stack.length - 1];
    if (!top) { showInfo(''); clearMarkers(); return; }
    if (top.kind === 'action') {
      const row = top.rows[top.activeIdx];
      showInfo(row.info || '');
      if (row.attack) {
        if (row.beltSwap) {
          // Belt swap: flat delay, no weapon-speed offset
          const q = (lastBs && lastBs.queue) || [];
          queueBarInfo = computeTimingMarkers(q, row.attack, 0);
          renderQueue(lastBs);
        } else {
          setMarkers(row.attack);
        }
      } else if (row.potionTiming) {
        // Potion: prepare_time already includes weapon speed via potionPrePostTicks
        const q = (lastBs && lastBs.queue) || [];
        queueBarInfo = computeTimingMarkers(q, row.potionTiming, 0);
        renderQueue(lastBs);
      } else {
        clearMarkers();
      }
      return;
    }
    if (top.kind === 'target') {
      if (top.attack) { showInfo(attackInfo(top.attack, top.weapon)); return; } // markers persist from the action pick
      if (top.info) { showInfo(top.info); return; }
    }
    // confirm level: readout stays as the pending action until it executes
  }

  // ---- root command window rows (real per-weapon attacks via template mapping) ----
  const rootRows = [];
  if (w && w.id) {
    (w.attacks || []).forEach(a => {
      rootRows.push({
        html: escHtml(a.name),
        info: attackInfo(a),
        attack: a,
        enter() { pickTarget(a); }
      });
    });
  } else {
    const fistW = weapons.fist;
    if (fistW && fistW.attacks && fistW.attacks.length > 0) {
      const fist = fistW.attacks[0];
      rootRows.push({
        html: escHtml(fist.name),
        info: attackInfo(fist, fistW),
        attack: fist,
        enter() { pickTarget(fist); }
      });
    } else {
      // degrade without any numbers if server did not provide fist profile
      const attack = { id: 1, name: 'Fist (unarmed)', is_multi_target: false, description: '' };
      rootRows.push({
        html: 'Fist (unarmed)',
        info: '<strong>Fist (unarmed)</strong>',
        attack,
        enter() { pickTarget(attack); }
      });
    }
  }
  rootRows.push({ blank: true });
  ['A', 'B'].forEach(slot => {
    const p = potionFor(slot);
    const used = p && p.used;
    if (!p) {
      rootRows.push({ html: `Pouch ${slot}: <span class="dw-dim">empty</span>`, info: `Pouch ${slot}: no potion in this slot`, disabled: true });
      return;
    }
    if (used) {
      rootRows.push({ html: `${escHtml(p.template_name)} <span class="dw-dim">(USED)</span>`, info: `Pouch ${slot}: already used`, disabled: true });
      return;
    }
    rootRows.push({
      html: escHtml(p.template_name),
      info: `Pouch ${slot}: ${escHtml(p.template_name)} · ${escHtml(p.effect_label || '')}<br>`
        + `<span style="color:#7a8ca6;">Windup:</span> ${potionPrePostTicks((w && w.speed) || 0, p.rolled_speed || 0)}t`,
      potionTiming: {
        prepare_time: potionPrePostTicks((w && w.speed) || 0, p.rolled_speed || 0),
        prepare_time_range: 0,
        name: escHtml(p.template_name)
      },
      enter() { pickPotion(slot, p); }
    });
  });
  rootRows.push({ blank: true });
  const swapDelay = belt && belt.id && w && w.id ? Math.max((w.speed || 2), (belt.speed || 2)) : null;
  rootRows.push({
    html: `Belt Loop: <span class="${belt && belt.id ? 'dw-weapon' : 'dw-dim'}">${escHtml(belt && belt.id ? belt.name : 'none')}</span>`,
    info: belt && belt.id
      ? `Belt swap (${hand}): swap ${escHtml(belt.name)} into hand · ${swapDelay} tics equip delay`
      : 'No belt weapon equipped',
    disabled: !belt || !belt.id,
    beltSwap: true,
    attack: belt && belt.id ? { prepare_time: swapDelay, prepare_time_range: 0, name: 'Belt Swap' } : null,
    enter() { if (belt && belt.id) pickEquip(); }
  });
  stack.push({ kind: 'action', tab: handLineText, rows: rootRows, activeIdx: 0 });

  renderStack();
  clearMarkers(); // PC-56: initial render shows action info but no prediction bar until user hovers/clicks

  // keyboard: Up/Down move the cursor (skips blank/disabled rows), Enter selects,
  // Esc backs one window (root: no-op). Only the top window responds.
  let keyboardActive = false;

  // When the mouse actually moves (not just sits), re-enable hover selection.
  document.addEventListener('mousemove', () => { keyboardActive = false; }, { once: false });

  document.onkeydown = (e) => {
    if (busy) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyboardActive = true;
      const selectable = [];
      top.rows.forEach((r, i) => { if (!r.blank && !r.disabled) selectable.push(i); });
      if (!selectable.length) return;
      const cur = selectable.indexOf(top.activeIdx);
      const dir = (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 1;
      top.activeIdx = selectable[(cur + dir + selectable.length) % selectable.length];
      renderStack();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      selectTop();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      back();
      e.preventDefault();
    }
  };
}




async function usePotion(runId, slot) {
  if (busy) return;
  setBusy(true);
  try {
    const payload = { slot };
    await apiCall(`/runs/${runId}/use-potion`, 'POST', payload);
    showMessage(`Potion ${slot} used`);
    await tickLoop(runId);
  } catch (e) {
    showMessage(e.message, true);
  }
  setBusy(false);
}

async function loadBattle(runId) {
  debugLog('loadBattle', `runId=${runId}`);
  currentRunId = runId;
  const box = document.getElementById('message-box');
  try {
    const data = await apiCall(`/runs/${runId}`);
    const run = data.run || data;
    if (!run || !run.id) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
      return;
    }
    if (run.status === 'completed' || run.status === 'inactive' || run.status === 'dead' || run.status === 'abandoned') {
      showErrorState('Run ' + run.status, 'This run is no longer active.', true);
      return;
    }

    const runTitle = document.getElementById('run-title');
    if (runTitle) runTitle.textContent = `PORTAL · RUN ${run.id}`;
    const battleLabel = document.getElementById('battle-label');
    const bs = run.battle_state || {};
    const prevBs = lastBs;
    lastBs = bs;
    queueBarInfo = null; // PC-56: fresh battle state — no selection, no markers
    // Capture BEFORE renderDice — the animation path clears the flag.
    // Ceremony-intro: the command window and timing track are part of the same
    // ceremony — they stay hidden until the dice and monster typewriter finishes.
    const willRoll = shouldAnimateDice
      && !!(bs.dice && bs.dice.current && bs.dice.current.color && bs.dice.current.face != null);
    debugLog('loadBattle', `willRoll=${willRoll} shouldAnimateDice=${shouldAnimateDice} dice_current=${!!(bs.dice?.current)}`);
    monstersPendingReveal = willRoll;
    battleIntroPending = willRoll;
    if (!willRoll) shouldAnimateDice = false; // no roll playing — consume the flag
    // PC-64: the tic-0 countdown only plays when the ceremony runs AND the engine
    // captured fires (a battle that started pre-PC-64 has no intro to replay).
    const introPlays = battleIntroPending && bs.intro?.fires?.length > 0;
    if (battleLabel) {
      const cb = run.current_battle || 1;
      const tb = run.total_battles || 1;
      const bsTic = introPlays ? 0 : ((bs.tic != null) ? bs.tic : 0);
      battleLabel.textContent = `BATTLE ${cb} OF ${tb} — TIC ${bsTic}`;
    }

    if (introPlays) {
      // PC-64: show the pre-advance state — full HP; message log stays blank
      // during the ceremony (dice → populate monsters → action queue). Feed
      // renders only after the ceremony finishes (see finishBattleIntro).
      renderPlayerHP({ player_hp: bs.intro.hpStart });
    } else {
      renderPlayerHP(run);
    }
    // If a ceremony intro is pending, force the message box completely empty
    // so no old text bleeds through the ceremony phase. Feed is
    // populated later in finishBattleIntro (intro fires → playIntroCountdown;
    // no fires → renderFeed([])).
    if (battleIntroPending) {
      const msgBox = document.getElementById('message-box');
      if (msgBox) { msgBox.innerHTML = ''; }
      renderedFeedLines = 0;
    }
    renderDice(bs.dice || {});
    renderMonsters(bs.monsters || []);
    renderLoadout(bs);
    if (battleIntroPending) {
      // Ceremony-intro: die still rolling — command window + timing track stay hidden.
      document.body.classList.add('intro-pending', 'queue-filling');
    } else {
      renderActionMenu(bs);
      // PC-DEC-045c: fresh page load in a mid-battle run shows history instantly;
      // incremental commit updates typewriter new lines.
      // prevBs distinguishes: on fresh page prevBs is null, on commit it's set.
      //
      // For commit updates, the queue render is deferred until the typewriter
      // finishes so the queue doesn't appear frozen at the end-state while the
      // feed narrates events that led to that state.
      if (prevBs) {
        const diff = diffQueueForAnimation(prevBs, bs);
        const queueEl = document.getElementById('queue');
        // Mark first resolved entry as "current" during narration — it stays
        // at the top while the typewriter describes the action.
        if (queueEl && diff.resolved.length > 0) {
          const firstEl = queueEl.querySelector(`[data-row-id="${diff.resolved[0]}"]`);
          if (firstEl) firstEl.classList.add('queue-row-current');
        }
        // BattleClock handles the entire post-commit sequence:
        //   highlight → feed narration → resolve flash+shrink → renderQueue → entry animations
        battleClock.start(diff, bs, () => {
          renderQueue(bs);
        });
      }
      const feedCb = (battleClock.state !== 'IDLE') ? () => battleClock.onNarrateDone() : null;
      if (!prevBs && renderedFeedLines === 0 && bs.feed && bs.feed.length > 0) {
        populateFeedInstantly(bs.feed);
        if (feedCb) feedCb();
      } else {
        renderFeed(bs.feed || [], feedCb);
      }
      // Queue rendered through battleClock for commits; fresh page / intro renders immediately
      if (!prevBs) renderQueue(bs);
    }


    // battle-over detection on reload: safeState has no battle_over flag —
    // all monsters dead means the battle is winnable/over.
    const monsterList = bs.monsters || [];
    const allMonstersDead = monsterList.length > 0 && monsterList.every(m => m.dead);
    if (allMonstersDead) {
      showAdvanceUI(runId, bs);
    }

  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('not found') || msg.includes('404')) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
    } else if (msg.includes('inactive') || msg.includes('completed')) {
      showErrorState('Run inactive', 'This run is no longer active.', true);
    } else {
      showErrorState('Load failed', msg, true);
    }
  }
}

function setupEndRunButton(runId) {
  const btn = document.getElementById('end-run-btn');
  if (!btn) return;
  btn.onclick = () => {
    // exact dialog per spec
    const dialog = document.createElement('div');
    dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
    dialog.innerHTML = `
      <div style="background:#112233;border:3px solid #4a90d9;padding:20px;max-width:420px;color:#e0e0ff;font-family:'Pixeloid Mono',monospace;font-size:12px;">
        <div style="margin-bottom:12px;">you will lose all loot from this run and nothing will be refunded. Type 'End Run' to confirm.</div>
        <input id="end-run-input" type="text" style="width:100%;background:#000;border:2px solid #335577;color:#e0e0ff;padding:6px;margin-bottom:12px;" placeholder="type here">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="end-run-cancel" class="action-btn">Cancel</button>
          <button id="end-run-confirm" class="action-btn" disabled>Confirm End Run</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const input = dialog.querySelector('#end-run-input');
    const confirmBtn = dialog.querySelector('#end-run-confirm');
    const cancelBtn = dialog.querySelector('#end-run-cancel');
    const checkInput = () => {
      const val = (input.value || '').trim().toLowerCase();
      confirmBtn.disabled = val !== 'end run';
    };
    input.oninput = checkInput;
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
    };
    cancelBtn.onclick = () => dialog.remove();
    confirmBtn.onclick = async () => {
      dialog.remove();
      try {
        await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' });
        localStorage.removeItem('currentRunId');
        window.location.href = '/game.html';
      } catch (e) {
        // surface error without crash
        alert('End Run failed: ' + (e.message || e));
      }
    };
    input.focus();
  };
}

async function init() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showErrorState('Configuration error', 'Missing Supabase ENV.');
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key)
      }
    }
  });
  if (!(await checkAuth())) return;

  // PC-52: fill hud-name from session (front-end only, placeholder dock)
  const { data: { session } } = await supabase.auth.getSession();
  const hudName = document.getElementById('hud-name');
  if (hudName && session && session.user) {
    const meta = session.user.user_metadata || {};
    hudName.textContent = meta.username || meta.full_name || (session.user.email ? session.user.email.split('@')[0] : 'PLAYER');
  }
  // PC follow-up: global playerName for queue labels
  const hudNameEl = document.getElementById('hud-name');
  playerName = hudNameEl ? hudNameEl.textContent : 'Player';

  const params = new URLSearchParams(window.location.search);
  const runId = params.get('id');
  if (!runId) {
    showErrorState('Missing run ID', 'Add ?id=NNN to the URL.', true);
    return;
  }

  // PC-72: the die ceremony plays only on a genuine first entry — the marker is
  // set by run-equip right before navigating to a NEW run. Any other load
  // (returning to a battle after exiting part way, a reload, a reopened tab, a
  // direct URL) is a resume: no roll animation, no re-typed history — the page
  // puts the player right back where they were.
  const freshKey = `pc_fresh_entry_${runId}`;
  const freshEntry = sessionStorage.getItem(freshKey) === '1';
  sessionStorage.removeItem(freshKey);
  shouldAnimateDice = freshEntry; // run start transition (fresh entry only)
  await loadBattle(runId);
  setupEndRunButton(runId);

  // PC-DEC-044: wire TEXT SPEED cycling control (now via controller)
  const speedEl = document.getElementById('text-speed');
  if (speedEl) {
    const SPEED_CYCLE = ['normal', 'slow', 'instant'];
    speedEl.onclick = () => {
      const current = getSpeedKey();
      const idx = SPEED_CYCLE.indexOf(current);
      const next = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length] || 'normal';
      setSpeed(next);
    };
    // initial label
    const p = getSpeedPreset();
    speedEl.textContent = `TEXT SPEED: ${p.label}`;
  }

  // Speed subscriber: update UI label on external changes
  onSpeedChange((key) => {
    const p = getSpeedPreset();
    if (speedEl) speedEl.textContent = `TEXT SPEED: ${p.label}`;
  });

  // Font size subscriber + initial class on .queue-panel
  onFontSizeChange((key) => {
    const panel = document.querySelector('.queue-panel');
    if (panel) {
      panel.classList.remove('queue-size-S', 'queue-size-M', 'queue-size-L');
      panel.classList.add(`queue-size-${key}`);
    }
  });
  const panel = document.querySelector('.queue-panel');
  if (panel) {
    panel.classList.remove('queue-size-S', 'queue-size-M', 'queue-size-L');
    panel.classList.add(`queue-size-${getFontSizeKey()}`);
  }

  // PC-DEC-044: click message log to instantly complete pending typing
  const msgBox = document.getElementById('message-box');
  if (msgBox) {
    msgBox.onclick = () => {
      if (typingInProgress) {
        clearTyping();
      }
    };
    // DO-2 scroll-pinning: toggle pinned flag; typing only auto-scrolls while pinned
    msgBox.addEventListener('scroll', () => {
      const atBottom = msgBox.scrollTop + msgBox.clientHeight >= msgBox.scrollHeight - 8;
      feedPinned = atBottom;
    });
  }
}

async function tickLoop(runId) {
  debugLog('tickLoop', `runId=${runId}`);
  while (true) {
    const data = await apiCall(`/runs/${runId}/tick`, 'POST');
    const bs = data.state || {};
    lastBs = bs;

    renderPlayerHP(bs);
    renderMonsters(bs.monsters || []);
    renderLoadout(bs);
    renderActionMenu(bs);
    renderQueue(bs);

    // One tick = one event processed = one new narration line.
    // Append it individually for clean typewriter animation.
    const narrate = data.result?.narrate;
    if (narrate) {
      appendFeedLine(narrate);
      renderedFeedLines = (bs.feed || []).length;
    } else if (bs.feed && bs.feed.length > renderedFeedLines) {
      // Fallback: render full feed with diff
      renderFeed(bs.feed, null);
      renderedFeedLines = bs.feed.length;
    }

    if (data.result?.playerReady || data.result?.battleOver || bs.battle_over) {
      if (data.result?.battleOver || bs.battle_over) {
        showAdvanceUI(runId, bs);
      }
      break;
    }
  }
}

init();