/**
 * Pure CLI copy builders (PC-36). No DOM, no session.
 * Contract: the six build* functions. cli-app.js imports them; this file
 * imports nothing.
 */
// --- PC-36 pure text builders (tested in isolation) ---

export function buildPreambleText() {
  // PC-36 short placeholder per spec (replaces atmospheric text; leading \n preserved for output parity)
  return '\nPrepare to start your run.\n\nCommands: inventory | inspect # | equip LH|RH <id> | ready | cancel\nType "ready" when ready.\n';
}

export function buildRecapText(weapons, consumables, picks) {
  const lines = [];
  lines.push('You check your straps one last time.');
  lines.push('');
  lines.push('Your loadout for this run:');
  const fmtAtk = (w) => {
    if (!w || !w.attacks || !w.attacks.length) return '';
    return w.attacks.map(a => {
      const pVar = a.prepare_time_range || 0;
      const cVar = a.cooldown_time_range || 0;
      const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
      const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
      return `#${a.id} ${a.name} (${pPart}/${cPart})`;
    }).join(', ');
  };
  const findW = (id) => (weapons || []).find(w => w.id === id) || null;
  const findC = (id) => (consumables || []).find(c => c.id === id) || null;
  const lh = picks && picks.lh != null ? findW(picks.lh) : null;
  const rh = picks && picks.rh != null ? findW(picks.rh) : null;
  const belt = picks && picks.belt != null ? findW(picks.belt) : null;
  const ca = picks && picks.ca != null ? findC(picks.ca) : null;
  const cb = picks && picks.cb != null ? findC(picks.cb) : null;
  const fmtSlot = (id, item, isWeapon) => {
    if (id == null) return 'empty';
    if (item) return isWeapon
      ? `#${item.id} ${item.name} (${item.damage} dmg) — ${fmtAtk(item)}`
      : `#${item.id} ${item.name} ×${item.quantity ?? 1}`;
    return `#${id} (unavailable)`;
  };
  lines.push(`  Left Hand: ${fmtSlot(picks.lh, lh, true)}`);
  lines.push(`  Right Hand: ${fmtSlot(picks.rh, rh, true)}`);
  lines.push(`  Belt: ${fmtSlot(picks.belt, belt, true)}`);
  lines.push(`  Consume A: ${fmtSlot(picks.ca, ca, false)}`);
  lines.push(`  Consume B: ${fmtSlot(picks.cb, cb, false)}`);
  lines.push('');
  lines.push('This loadout locks the moment you step through the portal. You cannot change it between fights.');
  lines.push('');
  lines.push('Type "confirm" to enter, or "inventory" to adjust.');
  return lines.join('\n');
}

export function buildAfterBattleOffer(currentBattle, totalBattles, hpCur, hpMax, isFirstWin, potionHint = null) {
  const lines = [];
  if (isFirstWin) {
    lines.push('The first monster falls. The pool stirs.');
    lines.push('');
  }
  const hpPart = hpMax ? `Your HP: ${hpCur}/${hpMax}.` : `Your HP: ${hpCur}.`;
  const battleLine = totalBattles ? `Battle ${currentBattle} of ${totalBattles} complete.` : `Battle ${currentBattle} complete.`;
  lines.push(`${battleLine} ${hpPart}`);
  lines.push('The prize pool has grown.');
  lines.push('');
  if (potionHint) {
    lines.push(`Type "use ${potionHint}" to drink your remaining potion first, "continue" to risk the next fight, or "stop" to claim your current share and end the run.`);
  } else {
    lines.push('Type "continue" to risk the next fight, or "stop" to claim your current share and end the run. (e.g. 20% of gold, 0 items)');
  }
  return lines.join('\n');
}

export function buildItemInspectText(weapons, consumables, id) {
  const w = (weapons || []).find(x => x.id === id);
  if (w) {
    const atks = (w.attacks || []).map(a => {
      const pVar = a.prepare_time_range || 0;
      const cVar = a.cooldown_time_range || 0;
      const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
      const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
      return `#${a.id} ${a.name} (${pPart}/${cPart})`;
    }).join(', ');
    return `#${w.id} ${w.name} (${w.damage} dmg)\n  Attacks: ${atks || 'none'}`;
  }
  const c = (consumables || []).find(x => x.id === id);
  if (c) {
    // consumable rows carry template_name + effect_label (API /consumables shape)
    const parts = [`#${c.id}`, c.template_name || 'Unknown'];
    if (c.effect_label) parts.push(c.effect_label);
    if (c.grade) parts.push(`grade ${c.grade}`);
    if (c.used) parts.push('(used)');
    return parts.join(' ');
  }
  return `No item #${id} found in your inventory.`;
}

export function buildPreambleDenied() {
  return 'Type "inventory", "inspect #", "ready", or "help".';
}

export function buildConfirmDenied() {
  return 'Type "confirm" to enter, or "inventory" to adjust.';
}
