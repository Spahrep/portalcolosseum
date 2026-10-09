/**
 * Queue / roster label helpers. No DOM, no session.
 * Contract: QUEUE_ACTION_LABELS, monsterQueueLabel, letterOf.
 */
// Queue events shown in the state dump, humanized (engine sends raw event names).
export const QUEUE_ACTION_LABELS = { cooldown: 'Ready', winding: 'Casting', impact: 'Attack', attack: 'Attack', approach: 'Approach' };

// Monster winding/impact are canonical attack rows (name + tic). Cooldown is
// "<Monster> recovering". Hand rows stay on QUEUE_ACTION_LABELS.
export function monsterQueueLabel(q, monsters) {
  if (!q || !q.label || q.label === 'LH' || q.label === 'RH') return null;
  const mon = (monsters || []).find(m => m.label === q.label);
  const monName = mon ? (mon.name || mon.label) : q.label;
  if (q.event === 'winding' || q.event === 'impact' || q.event === 'attack') {
    return `${monName}'s ${q.monsterAttackName || 'Attack'}`;
  }
  if (q.event === 'cooldown') return `${monName} recovering`;
  return null;
}

// monster labels end in a letter ('Giant Rat A'); letterOf extracts it for roster prints
export const letterOf = (label) => (label && /[A-Z]$/.test(label)) ? label.slice(-1) : '';
