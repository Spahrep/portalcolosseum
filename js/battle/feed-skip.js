/**
 * Click-to-complete decision. Finishes the line currently typing and leaves
 * every still-queued line queued. shownCount must not jump to lines.length
 * while unread lines remain — that drop is the bug.
 *
 * phase 'chars' = mid-line. phase 'delay' = beat after the current line
 * already finished; the upcoming line is still queued and must still render.
 */
export function nextTypingStateAfterClick(state) {
  const lines = (state && state.lines) || [];
  const lineIndex = state && Number.isFinite(state.lineIndex) ? state.lineIndex : 0;
  const phase = (state && state.phase) || 'chars';
  if (lineIndex >= lines.length) {
    return {
      lineIndex,
      phase: 'done',
      finishCurrent: false,
      skipRemaining: false,
      shownCount: lineIndex,
      done: true,
    };
  }
  if (phase === 'delay') {
    return {
      lineIndex,
      phase: 'chars',
      finishCurrent: false,
      skipRemaining: false,
      shownCount: lineIndex,
      done: false,
    };
  }
  const nextIndex = lineIndex + 1;
  return {
    lineIndex: nextIndex,
    phase: nextIndex >= lines.length ? 'done' : 'chars',
    finishCurrent: true,
    finishedText: lines[lineIndex],
    skipRemaining: false,
    shownCount: nextIndex,
    done: nextIndex >= lines.length,
  };
}
