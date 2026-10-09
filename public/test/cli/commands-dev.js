/**
 * Dev slash commands plus grant/inspect (inspect is also a player command).
 * No DOM. Session access is only through the contract below.
 * Contract: createDevCommands({ apiCall, appendLine, printError, printGreen,
 *   printAmber, refreshRunPanels, getRunId, clearRunId, getFlowState, unlockDevMode })
 *   -> { commands, cmdInspect, cmdGrant }.
 */
import { buildItemInspectText } from './text-builders.js';

export function createDevCommands({
  apiCall,
  appendLine,
  printError,
  printGreen,
  printAmber,
  refreshRunPanels,
  getRunId,
  clearRunId,
  getFlowState,
  unlockDevMode,
}) {
  async function cmdDevEquip(args) {
    if (!getRunId()) { printError('no run — use run new first'); return; }
    let slot = args[0] ? args[0].toUpperCase() : null;
    if (slot && !['LH','RH','belt'].includes(slot)) slot = null;
    const instArg = args[1];
    if (instArg) {
      let n = instArg.startsWith('#') ? instArg.slice(1) : instArg;
      const instance_id = parseInt(n, 10);
      if (isNaN(instance_id) || instance_id <= 0) { printError('usage: /equip [LH|RH|belt] [#N]'); return; }
      const body = { instance_id, slot: slot || undefined };
      try {
        const data = await apiCall('POST', '/dev/equip-instance', body);
        const w = data.weapon;
        let msg = `${data.slot} → ${w.template_name} (dmg ${w.damage}, #${w.instance_id})`;
        if (data.displaced) msg += ` (displaced ${data.displaced.template_name} → inventory)`;
        printGreen(msg);
        await refreshRunPanels();
      } catch (e) { printError('equip: ' + e.message); }
      return;
    }
    try {
      const data = await apiCall('POST', '/dev/equip', { slot: slot || undefined });
      const w = data.weapon;
      let msg = `${data.slot} → ${w.template_name} (dmg ${w.damage}, #${w.instance_id})`;
      if (data.displaced) msg += ` (displaced ${data.displaced.template_name} → inventory)`;
      printGreen(msg);
      await refreshRunPanels();
    } catch (e) { printError('equip: ' + e.message); }
  }

  async function cmdDevRoll(args) {
    if (!getRunId()) { printError('no run — use run new first'); return; }
    const sub = args[0];
    if (sub === 'weapon') {
      const template_id = parseInt(args[1], 10);
      if (!Number.isFinite(template_id)) { printError('usage: /roll weapon <id> [LH|RH|belt] | /roll monster <id>'); return; }
      let slot = args[2] ? args[2].toLowerCase() : 'lh';
      if (!['lh','rh','belt'].includes(slot)) slot = 'lh';
      slot = slot === 'belt' ? 'belt' : slot.toUpperCase();
      try {
        const data = await apiCall('POST', '/dev/roll-weapon', { template_id, slot });
        const w = data.weapon;
        printGreen(`${data.slot} → ${w.template_name} (dmg ${w.damage}, #${w.instance_id})`);
        await refreshRunPanels();
      } catch (e) {
        printError('roll: ' + e.message);
      }
    } else if (sub === 'monster') {
      const template_id = parseInt(args[1], 10);
      if (!Number.isFinite(template_id)) { printError('usage: /roll weapon <id> [LH|RH|belt] | /roll monster <id>'); return; }
      try {
        const data = await apiCall('POST', '/dev/roll-monster', { template_id });
        const m = data.monster;
        printGreen(`monster ${m.label} hp ${m.current_hp ?? m.max_hp}/${m.max_hp} dmg ${m.damage} spd ${m.speed} acc ${m.accuracy}`);
        await refreshRunPanels();
      } catch (e) {
        printError('roll: ' + e.message);
      }
    } else {
      printError('usage: /roll weapon <id> [LH|RH|belt] | /roll monster <id>');
    }
  }

  async function cmdDevDel(args) {
    if (!getRunId()) { printError('no run — use run new first'); return; }
    if (args[0] !== 'monster') { printError('usage: /del monster <label|id>'); return; }
    const target = args[1];
    if (!target) { printError('usage: /del monster <label|id>'); return; }
    try {
      const data = await apiCall('POST', '/dev/del-monster', { target });
      printGreen(`removed ${data.removed.label} (#${data.removed.id})`);
      await refreshRunPanels();
    } catch (e) {
      printError('del: ' + e.message);
    }
  }

  async function cmdDevSet(args) {
    const sub = args[0];
    if (sub === 'weapon') {
      const instance_id = parseInt(args[1], 10);
      const flags = args.slice(2);
      let damage, speed, accuracy, crit;
      for (let i = 0; i < flags.length; i += 2) {
        const k = flags[i];
        const v = parseInt(flags[i + 1], 10);
        if (k === 'dmg' || k === 'damage') damage = v;
        else if (k === 'spd' || k === 'speed') speed = v;
        else if (k === 'acc' || k === 'accuracy') accuracy = v;
        else if (k === 'crit') crit = v;
      }
      if (isNaN(instance_id) || instance_id <= 0 || (!damage && !speed && !accuracy && crit === undefined) || [damage, speed, accuracy].some(v => v !== undefined && (isNaN(v) || v < 1)) || (crit !== undefined && (isNaN(crit) || crit < 0))) {
        printError('usage: /set weapon <instance_id> [dmg N] [spd N] [acc N] [crit N]');
        return;
      }
      try {
        const data = await apiCall('POST', '/dev/set-weapon-stats', { instance_id, damage, speed, accuracy, crit });
        printGreen(`#${data.instance_id} ${data.template_name}: dmg ${data.damage} spd ${data.speed} acc ${data.accuracy} crit ${data.crit_chance ?? 0} ${data.grade}`);
      } catch (e) {
        printError('set: ' + e.message);
      }
      return;
    }
    if (sub === 'potion') {
      const instance_id = parseInt(args[1], 10);
      const flags = args.slice(2);
      let floor, window, speed, crit;
      for (let i = 0; i < flags.length; i += 2) {
        const k = flags[i];
        const v = parseInt(flags[i + 1], 10);
        if (k === 'floor') floor = v;
        else if (k === 'window') window = v;
        else if (k === 'spd' || k === 'speed') speed = v;
        else if (k === 'crit') crit = v;
      }
      if (isNaN(instance_id) || instance_id <= 0 || (!floor && !window && !speed && crit === undefined) || [floor, window, speed].some(v => v !== undefined && (isNaN(v) || v < 1)) || (crit !== undefined && (isNaN(crit) || crit < 0))) {
        printError('usage: /set potion <instance_id> [floor N] [window N] [spd N] [crit N]');
        return;
      }
      try {
        const data = await apiCall('POST', '/dev/set-consumable-stats', { instance_id, floor, window, speed, crit });
        printGreen(`#${data.instance_id} ${data.template_name}: floor ${data.floor} window ${data.window} spd ${data.speed} crit ${data.crit_chance ?? 0} ${data.grade}`);
      } catch (e) {
        printError('set: ' + e.message);
      }
      return;
    }
    // hp branch keeps original run guard
    if (!getRunId()) { printError('no run — use run new first'); return; }
    if (sub !== 'hp') { printError('usage: /set hp <player|monster> <n>'); return; }
    const target = args[1];
    const hp = parseInt(args[2], 10);
    if (!Number.isFinite(hp) || hp < 0) { printError('usage: /set hp <player|monster> <n>'); return; }
    try {
      const data = await apiCall('POST', '/dev/set-hp', { target, hp });
      printGreen(`set ${data.target} hp → ${data.hp}`);
      await refreshRunPanels();
    } catch (e) {
      printError('set: ' + e.message);
    }
  }

  async function cmdDevWin(args) {
    if (!getRunId()) { printError('no run — use run new first'); return; }
    if (args[0] !== 'battle') { printError('usage: /win battle'); return; }
    try {
      const data = await apiCall('POST', '/dev/win-battle', {});
      printGreen('battle won');
      appendLine(JSON.stringify(data, null, 0), 'dim');
      await refreshRunPanels();
    } catch (e) {
      printError('win: ' + e.message);
    }
  }

  async function cmdDevKill(args) {
    if (!getRunId()) { printError('no run — use run new first'); return; }
    if (args[0] !== 'player') { printError('usage: /kill player'); return; }
    try {
      const data = await apiCall('POST', '/dev/kill-player', {});
      printGreen('player killed');
      appendLine(JSON.stringify(data, null, 0), 'dim');
      await refreshRunPanels();
    } catch (e) {
      printError('kill: ' + e.message);
    }
  }

  async function cmdDevList(args) {
    const sub = args[0] || 'weapons';
    if (sub === 'weapons') {
      const username = args[1];
      if (username) {
        try {
          const data = await apiCall('GET', `/dev/weapons?username=${encodeURIComponent(username)}`);
          if (!data.weapons || data.weapons.length === 0) {
            appendLine('No weapons.', 'amber');
            return;
          }
          data.weapons.forEach(w => {
            appendLine(`#${w.instance_id} ${w.template_name} dmg ${w.damage} spd ${w.speed} acc ${w.accuracy} crit ${w.crit_chance ?? 5} ${w.grade}`, 'green');
          });
        } catch (e) {
          printError('list: ' + e.message);
        }
      } else {
        // existing caller-own behavior untouched
        try {
          const data = await apiCall('GET', '/weapons');
          if (!data.weapons || data.weapons.length === 0) {
            appendLine('No weapons owned.', 'amber');
            return;
          }
          data.weapons.forEach(w => {
            const atkList = w.attacks.map(a => {
              const pVar = a.prepare_time_range || 0;
              const cVar = a.cooldown_time_range || 0;
              const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
              const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
              return `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} ${pPart}/${cPart}`;
            }).join(' ');
            appendLine(`#${w.id} ${w.name} dmg=${w.damage} crit=${w.crit_chance ?? 5}  attacks: ${atkList || 'none'}`, 'green');
          });
        } catch (e) {
          printError('list: ' + e.message);
        }
      }
    } else if (sub === 'potions') {
      const username = args[1];
      try {
        const url = username ? `/dev/potions?username=${encodeURIComponent(username)}` : '/dev/potions';
        const data = await apiCall('GET', url);
        if (!data.potions || data.potions.length === 0) {
          appendLine('No potions.', 'amber');
          return;
        }
  data.potions.forEach(p => {
          appendLine(`#${p.instance_id} ${p.template_name} floor ${p.floor} window ${p.window} spd ${p.speed} ${p.grade}`, 'green');
        });
      } catch (e) {
        printError('list: ' + e.message);
      }
    } else if (sub === 'monsters') {
      if (!getRunId()) { appendLine('no active run', 'amber'); return; }
      try {
        const data = await apiCall('GET', `/runs/${getRunId()}`);
        const mons = (data.run && data.run.battle_state && data.run.battle_state.monsters) || [];
        if (mons.length === 0) {
          appendLine('no monsters', 'dim');
          return;
        }
        mons.forEach(m => {
          appendLine(`Monster ${m.label} hp ${m.current_hp}/${m.max_hp}`, 'green');
        });
      } catch (e) {
        printError('list: ' + e.message);
      }
    } else if (sub === 'users') {
      try {
        const data = await apiCall('GET', '/dev/users');
        if (!data.users || data.users.length === 0) {
          appendLine('No users.', 'amber');
          return;
        }
        data.users.forEach(u => {
          const role = u.is_admin ? 'admin' : 'player';
          appendLine(`${u.username} (${role})`, 'green');
        });
      } catch (e) {
        printError('list: ' + e.message);
      }
    } else {
      printError('usage: /list weapons|monsters|users|potions [username]');
    }
  }

  async function cmdDevGive(args) {
    const sub = args[0];
    if (sub === 'weapon') {
      const username = args[1];
      const templateId = parseInt(args[2], 10);
      let count = parseInt(args[3], 10);
      if (!username || isNaN(templateId) || templateId <= 0) {
        printError('usage: /give weapon <user> <template_id> [count]');
        return;
      }
      if (isNaN(count) || count < 1) count = 1;
      try {
        const res = await apiCall('POST', '/dev/give-weapon', { username, template_id: templateId, count });
        appendLine(`granted ${res.granted.length} × ${res.template_name} to ${res.username}`, 'green');
        res.granted.forEach(g => {
          appendLine(`#${g.instance_id} dmg ${g.damage} spd ${g.speed} acc ${g.accuracy} ${g.grade}`, 'dim');
        });
      } catch (e) {
        printError('give: ' + e.message);
      }
    } else if (sub === 'sss') {
      const username = args[1];
      if (!username) {
        printError('usage: /give sss <user>');
        return;
      }
      try {
        const res = await apiCall('POST', '/dev/give-starter', { username });
        if (res.granted) {
          appendLine(`SSS granted to ${username}`, 'green');
          const inst = res.instance;
          appendLine(`#${inst.instance_id} dmg ${inst.damage} spd ${inst.speed} acc ${inst.accuracy} ${inst.grade}`, 'dim');
        } else {
          appendLine(res.reason || 'already has starter', 'dim');
        }
      } catch (e) {
        printError('give: ' + e.message);
      }
    } else {
      printError('usage: /give weapon <user> <template_id> [count] | /give sss <user>');
    }
  }

  async function cmdDevNuke(args) {
    const res = await apiCall('POST', '/dev/nuke-monsters', {});
    if (res.error) {
      printError(res.error);
      return;
    }
    const n = res.removed || 0;
    if (n > 0) {
      printGreen(`removed ${n} monster(s)`);
      await refreshRunPanels();
    } else {
      appendLine('no monsters to remove', 'dim');
    }
  }

  async function cmdListTemplates(args) {
    const res = await apiCall('GET', '/dev/templates');
    if (res.error) {
      printError(res.error);
      return;
    }
    appendLine('Weapons:', 'dim');
    for (const w of (res.weapons || [])) {
      appendLine(`  #${w.id} ${w.name}`, 'dim');
    }
    appendLine('Monsters:', 'dim');
    for (const m of (res.monsters || [])) {
      appendLine(`  #${m.id} ${m.name}`, 'dim');
    }
  }

  async function cmdInspect(args) {
    const flowState = getFlowState();
    // During the run-start gate, inspect means ITEM inspect (from inventory payloads)
    if (flowState === 'preamble' || flowState === 'confirm') {
      const idStr = (args[0] || '').trim();
      if (!idStr) {
        printAmber('Usage: inspect #');
        return;
      }
      const id = parseInt(idStr, 10);
      if (isNaN(id) || id < 1) {
        printAmber('Invalid id');
        return;
      }
      try {
        const [wData, cData] = await Promise.allSettled([
          apiCall('GET', '/weapons'),
          apiCall('GET', '/consumables')
        ]);
        const weapons = (wData.status === 'fulfilled' ? wData.value.weapons : []) || [];
        const consumables = (cData.status === 'fulfilled' ? cData.value.consumables : []) || [];
        appendLine(buildItemInspectText(weapons, consumables, id), 'green');
      } catch (e) {
        printError('inspect: ' + e.message);
      }
      return;
    }
    const idStr = (args[0] || '').trim();
    if (!idStr) {
      const res = await apiCall('GET', '/dev/templates');
      if (res.error) {
        printError(res.error);
        return;
      }
      for (const m of (res.monsters || [])) {
        appendLine(`#${m.id} ${m.name}`, 'dim');
      }
      return;
    }
    const id = parseInt(idStr, 10);
    if (isNaN(id) || id < 1) {
      printError('Invalid template id');
      return;
    }
    const res = await apiCall('GET', `/templates/monster/${id}`);
    if (res.error) {
      printError(res.error);
      return;
    }
    appendLine(`${res.name} (#${res.id})`, 'dim');
    appendLine(`base_hp: ${res.base_hp}  dmg: ${res.damage}  spd: ${res.speed}  acc: ${res.accuracy}`);
    if (res.attacks && res.attacks.length) {
      appendLine('attacks:');
      for (const a of res.attacks) {
        const multi = a.is_multi_target ? ', multi' : '';
        appendLine(`  #${a.id} ${a.name} (prep ${a.prepare_time}, cd ${a.cooldown_time}${multi})`);
      }
    }
  }

  async function cmdDevAbandonRun(args) {
    const res = await apiCall('POST', '/dev/abandon-run', {});
    if (res.error) {
      printError(res.error);
      return;
    }
    clearRunId();
    printGreen(`run #${res.run_id} abandoned — use run new to start fresh`);
    await refreshRunPanels();
  }

  async function cmdGrant() {
    try {
      const data = await apiCall('POST', '/dev/grant', {});
      if (data.dev_mode === true) {
        unlockDevMode();
        printGreen('Dev tools unlocked. Type help for the full command list.');
      } else {
        appendLine(JSON.stringify(data), 'dim');
      }
    } catch (e) {
      if (e.message.includes('Admin access required') || e.message.includes('403')) {
        printAmber('403 Admin access required (non-admin caller)');
      } else {
        printError('grant: ' + e.message);
      }
    }
  }
  const commands = {
    '/equip': cmdDevEquip,
    '/roll': cmdDevRoll,
    '/del': cmdDevDel,
    '/list': cmdDevList,
    '/set': cmdDevSet,
    '/win': cmdDevWin,
    '/kill': cmdDevKill,
    '/nuke': cmdDevNuke,
    '/inspect': cmdInspect,
    '/abandon': cmdDevAbandonRun,
    '/give': cmdDevGive
  };
  return { commands, cmdInspect, cmdGrant };
}
