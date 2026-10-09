/**
 * Dice rendering / animation subsystem (PC-78).
 * Moved verbatim from battle-app.js: tray render, sweep, and roll.
 * No behavior change. Imports debugLog only — initialization hooks are bound
 * from battle-app.js to avoid a circular import.
 */
import { debugLog } from '../battle-debug.js';

let appendFeedLine = () => {};
let revealMonsters = (onDone) => { if (onDone) onDone(); };
let finishBattleIntro = () => {};
let getShouldAnimateDice = () => false;
let setShouldAnimateDice = () => {};

export function bindDiceRender(deps) {
  appendFeedLine = deps.appendFeedLine;
  revealMonsters = deps.revealMonsters;
  finishBattleIntro = deps.finishBattleIntro;
  getShouldAnimateDice = deps.getShouldAnimateDice;
  setShouldAnimateDice = deps.setShouldAnimateDice;
}

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

export function renderDice(dice) {
  // shouldAnimateDice stays in battle-app.js. Local copy so battle initialization
  // reads the flag; the write-back below stops the 350ms re-render from re-rolling.
  let shouldAnimateDice = getShouldAnimateDice();
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
        setShouldAnimateDice(false);
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
            debugLog('initialization', 'roll settled, starting reveal');
            appendFeedLine(`${current.face} rolled`);
            updateCurrentDie(curEl, current); // persistent slot lights up
            appendFeedLine('Selecting Monsters...');
            revealMonsters(() => {
              debugLog('initialization', 'reveal complete, calling finishBattleIntro');
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

export function updateCurrentDie(curEl, current) {
  curEl.innerHTML = `
    <div class="die ${current.color}" style="width:32px;height:32px;font-size:14px;">${current.face}</div>
    <div style="font-size:9px;color:#88aaff;margin-top:2px;">${current.rolled_value != null ? current.rolled_value : ''}</div>
  `;
  curEl.style.display = 'flex';
}

export function performSweepAnimation(diceEls, targetIndex, onLand) {
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
export function rollDiceAnimation(box, current, faces, onDone) {
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
