/**
 * Consumable use targets the hand whose menu is open. A stale other-hand
 * value must not win — drinking on the wrong hand while this menu is up is
 * the bug. The server payload names that hand explicitly.
 */
const HANDS = new Set(['LH', 'RH']);

export function potionCommitPayload(openHand, slot, staleHand) {
  const hand = String(openHand || '').toUpperCase();
  if (!HANDS.has(hand)) {
    throw new Error('Potion requires the open menu hand');
  }
  // staleHand is never consulted. The open menu's hand is the only legal target.
  void staleHand;
  const normalizedSlot = String(slot || '').toUpperCase();
  return { slot: normalizedSlot, hand };
}
