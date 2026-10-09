/**
 * Inventory command. No DOM and no session bindings of its own.
 * Contract: createInventoryCommands({ apiCall, appendLine, printError }) -> { cmdInventory }.
 */
export function createInventoryCommands({ apiCall, appendLine, printError }) {
  async function cmdInventory() {
    try {
      const [wData, cData] = await Promise.allSettled([
        apiCall('GET', '/weapons'),
        apiCall('GET', '/consumables')
      ]);
      const weapons = (wData.status === 'fulfilled' ? wData.value.weapons : []) || [];
      const consumables = (cData.status === 'fulfilled' ? cData.value.consumables : []) || [];

      appendLine('inventory — weapons:', 'dim');
      if (weapons.length === 0) {
        appendLine('  (none)', 'dim');
      } else {
        weapons.forEach(w => {
          const atkList = w.attacks.map(a => {
            const pVar = a.prepare_time_range || 0;
            const cVar = a.cooldown_time_range || 0;
            const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
            const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
            return `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} ${pPart}/${cPart}`;
          }).join(' ');
          appendLine(`#${w.id} ${w.name} dmg=${w.damage} crit=${w.crit_chance ?? 5}  attacks: ${atkList || 'none'}`, 'green');
        });
      }

      appendLine('inventory — consumables:', 'dim');
      if (consumables.length === 0) {
        appendLine('  (none)', 'dim');
      } else {
        consumables.forEach(c => {
          appendLine(`#${c.id} ${c.name} qty=${c.quantity ?? 1}`, 'green');
        });
      }
    } catch (e) {
      printError('gear: ' + e.message);
    }
  }
  return { cmdInventory };
}
