/**
 * Battle-start countdown. Disabled: the 3-2-1 intro was an unrequested
 * addition (Spahrep 2026-10-01) and no longer plays. Battles open straight
 * to the first decision point. shouldPlayIntroCountdown always returns false
 * so beginAfterIntro() calls onDone() immediately.
 */
export const INTRO_COUNTDOWN_STEPS = ['3', '2', '1'];

export function shouldPlayIntroCountdown(_tic, _alreadyPlayed) {
  return false;
}