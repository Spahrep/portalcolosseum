/**
 * Tic-0 battle-start countdown. The 3-2-1 intro plays once when a battle
 * starts at tic 0. It does not replay on later ticks or after it has run.
 */
export const INTRO_COUNTDOWN_STEPS = ['3', '2', '1'];

export function shouldPlayIntroCountdown(tic, alreadyPlayed) {
  return !alreadyPlayed && (tic ?? 0) === 0;
}
