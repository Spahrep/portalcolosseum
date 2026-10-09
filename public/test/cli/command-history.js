/**
 * Command history. Owns the recall buffer and the browse cursor.
 * Contract: createCommandHistory() -> { push, onArrowUp, onArrowDown, resetBrowse }.
 * The input loop passes the input element in; this module does not hold it.
 */
const HISTORY_KEY = 'cli_command_history';
const HISTORY_MAX = 5;

export function createCommandHistory() {
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { history = []; }
  let historyIdx = -1;      // -1 = not browsing history (fresh line)
  let historyDraft = '';    // preserves the in-progress line while browsing

  // Record a completed command into history (most recent first), capped at HISTORY_MAX.
  function push(cmd) {
    history = [cmd, ...history.filter(h => h !== cmd)].slice(0, HISTORY_MAX);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
  }

  function onArrowUp(inputEl) {
    if (history.length === 0) return;
    if (historyIdx === -1) historyDraft = inputEl.value;   // save the line being edited
    historyIdx = Math.min(historyIdx + 1, history.length - 1);
    inputEl.value = history[historyIdx];
  }

  function onArrowDown(inputEl) {
    if (historyIdx === -1) return;
    historyIdx -= 1;
    inputEl.value = historyIdx >= 0 ? history[historyIdx] : historyDraft;
    if (historyIdx === -1) historyDraft = '';
  }

  function resetBrowse() {
    historyIdx = -1;
    historyDraft = '';
  }

  return { push, onArrowUp, onArrowDown, resetBrowse };
}
