/**
 * Feed / typewriter subsystem (PC-78).
 * Moved verbatim from battle-app.js: typewriter state, incremental feed diff,
 * and busy-gated narration. No behavior change.
 */
import { debugLog } from '../battle-debug.js';
import { getSpeedPreset } from '../settings-controller.js';

// setBusy + handleHitLine stay in battle-app.js. Bound here (and overridable
// via typeFeedLines params) so this module does not import battle-app.js.
let setBusy = () => {};
let handleHitLine = () => {};
let setSuppressHitFeedback = () => {};

export function bindFeedRender(deps) {
  setBusy = deps.setBusy;
  handleHitLine = deps.handleHitLine;
  setSuppressHitFeedback = deps.setSuppressHitFeedback;
}

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

export function getRenderedFeedLines() { return renderedFeedLines; }
export function setRenderedFeedLines(n) { renderedFeedLines = n; }
export function addRenderedFeedLines(n) { renderedFeedLines += n; }
export function isTypingInProgress() { return typingInProgress; }
export function setFeedPinned(pinned) { feedPinned = pinned; }

export function typeFeedLinesAsync(lines) {
  return new Promise(resolve => {
    typeFeedLines(lines || [], resolve, setBusy, handleHitLine);
  });
}

/** Type every feed line not yet shown, and resolve when the typewriter finishes. */
export async function awaitNarration(feed) {
  const lines = feed || [];
  if (lines.length <= renderedFeedLines) return;
  const fresh = lines.slice(renderedFeedLines);
  await typeFeedLinesAsync(fresh);
  renderedFeedLines = lines.length;
}

export function clearTyping() {
  typingTimeouts.forEach(t => clearTimeout(t));
  typingTimeouts = [];
  typingInProgress = false;
  if (typingSetBusy) {
    setBusy(false);
    document.body.classList.remove('command-hidden');
    typingSetBusy = false;
  }
}

export function typeFeedLines(lines, onComplete, setBusyParam, handleHitLineParam) {
  // setBusy and handleHitLine stay in battle-app.js — passed in to avoid a circular import.
  if (typeof setBusyParam === 'function') setBusy = setBusyParam;
  if (typeof handleHitLineParam === 'function') handleHitLine = handleHitLineParam;
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

export function renderFeed(feed, onComplete) {
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
  typeFeedLines(newLines, onComplete, setBusy, handleHitLine);
  renderedFeedLines = currentLines.length;
}

// PC-72: resume path — the battle already happened; restore the log at once
// instead of typing history (the typewriter is for NEW lines only). Hit
// reactions stay suppressed: re-shaking every historical hit would read as
// fresh damage, not a resume.
export function populateFeedInstantly(feed) {
  const lines = feed || [];
  if (lines.length === 0) {
    renderFeed([]); // empty state — 'Battle begins...' placeholder
    return;
  }
  setSuppressHitFeedback(true);
  try {
    // Only append feed lines not yet shown (PC-72 resume: full feed on a
    // fresh page because the counter starts at 0; commits append only the
    // new lines — no duplicates, and system lines never shift the diff).
    const fresh = lines.slice(renderedFeedLines);
    fresh.forEach(line => appendFeedLine(line));
    renderedFeedLines = lines.length;
  } finally {
    setSuppressHitFeedback(false);
  }
}

export function appendFeedLine(line) {
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
