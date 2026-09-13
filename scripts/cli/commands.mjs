// scripts/cli/commands.mjs
// Core command implementations for Phase A + Phase B dev surface
// Matches cli-app.js behavior + playthrough.mjs patterns exactly where overlap
// run new: interactive getId loop + one-shot --lh --rh --belt --ca --cb flags
// attack: ALWAYS target_ids: [] (engine auto-target; no numeric hp filter)
// wait: explicit busy-hand commit using real loaded attack (no fake ids, no swallow)
// All state changes print state unless --quiet/--json
// Dev commands gated behind grant (local devMode), exact help text + error msgs from cli-app.js

import readline from 'readline';
import { apiCall } from './api.mjs';
import { printError, printGreen, printAmber, printState, printDim, isQuiet, isJson } from './render.mjs';

const seenFeed = new Set();

function narrateFeed(feedLines, participants = null) {
  if (!feedLines || !Array.isArray(feedLines) || feedLines.length === 0) return;
  if (isQuiet && isQuiet()) return;

  const monsterLabels = [];
  const p = participants || {};
  if (p.monsters && Array.isArray(p.monsters)) {
    p.monsters.forEach(m => { if (m && m.label) monsterLabels.push(m.label); });
  }
  const getMonsterLabel = (text) => {
    for (const lbl of monsterLabels) if (text.includes(lbl)) return lbl;
    const m = text.match(/tic \d+ — ([A-Za-z]+(?:\s+[A-Z])?)/);
    return m ? m[1] : null;
  };

  const newLines = feedLines.filter(l => !seenFeed.has(l));
  newLines.forEach(l => seenFeed.add(l));

  const outputEntries = []; // {text, matched} for defect 3
  let consecutiveHits = [];

  const flushHits = () => {
    if (consecutiveHits.length >= 3) {
      const mons = [];
      const dmgs = [];
      consecutiveHits.forEach(h => {
        const mm = h.raw.match(/([A-Za-z]+(?:\s+[A-Z])?) .*? hits player for (\d+)/);
        if (mm) { mons.push(mm[1]); dmgs.push(mm[2]); }
      });
      if (mons.length >= 3) {
        // defect 4: abbreviate shared prefix
        let monStr;
        const firstWords = mons.map(m => m.split(' '));
        const minLen = Math.min(...firstWords.map(w => w.length));
        let commonPrefixWords = 0;
        for (let i = 0; i < minLen; i++) {
          const w = firstWords[0][i];
          if (firstWords.every(fw => fw[i] === w)) commonPrefixWords++;
          else break;
        }
        if (commonPrefixWords > 0) {
          const prefix = firstWords[0].slice(0, commonPrefixWords).join(' ') + ' ';
          const suffixes = mons.map((m, i) => firstWords[i].slice(commonPrefixWords).join(' '));
          const last = suffixes.pop();
          monStr = suffixes.join(', ') + ', and ' + last;
          monStr = prefix + monStr;
        } else {
          const last = mons.pop();
          monStr = mons.join(', ') + ', and ' + last;
        }
        const lastD = dmgs.pop();
        const dmgStr = dmgs.join(', ') + ', and ' + lastD;
        outputEntries.push({ text: `${monStr} attack you for ${dmgStr}.`, matched: true });
      }
      // no fallback re-push; group regex handles all since labels from participants
    } else if (consecutiveHits.length > 0) {
      consecutiveHits.forEach(h => outputEntries.push({ text: h.mapped, matched: true }));
    }
    consecutiveHits = [];
  };

  for (const raw of newLines) {
    let mapped = null;
    // DEFECT 1: getMonsterLabel + greedy fallback for hits
    let label = getMonsterLabel(raw);
    let m;
    if (label) {
      const remainder = raw.replace(label, '').replace(/^tic \d+ — \s*/, '');
      m = remainder.match(/^(.+?) hits player for (\d+)$/);
      if (m) {
        const atk = m[1].trim();
        mapped = `${label}'s ${atk} hits you for ${m[2]}.`;
        consecutiveHits.push({ mapped, raw });
        continue;
      }
    }
    m = raw.match(/^tic \d+ — ([A-Za-z]+(?: [A-Z])?) (.+?) hits player for (\d+)$/);
    if (m) {
      const mon = m[1];
      const atk = m[2].trim();
      mapped = `${mon}'s ${atk} hits you for ${m[3]}.`;
      consecutiveHits.push({ mapped, raw });
      continue;
    }

    // misses
    label = getMonsterLabel(raw);
    if (label) {
      const remainder = raw.replace(label, '').replace(/^tic \d+ — \s*/, '');
      m = remainder.match(/^(.+?) misses$/);
      if (m) {
        flushHits();
        const atk = m[1].trim();
        mapped = `${label}'s ${atk} misses you.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }
    }
    m = raw.match(/^tic \d+ — ([A-Za-z]+(?: [A-Z])?) (.+?) misses$/);
    if (m) {
      flushHits();
      const mon = m[1];
      const atk = m[2].trim();
      mapped = `${mon}'s ${atk} misses you.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    m = raw.match(/^tic \d+ — (.+?) is defeated$/);
    if (m) { flushHits(); mapped = `${m[1]} is defeated!`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — LH Ready$/);
    if (m) { flushHits(); mapped = 'Your left hand is ready.'; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — RH Ready$/);
    if (m) { flushHits(); mapped = 'Your right hand is ready.'; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — LH commits (.+?) \(cast \d+\)$/);
    if (m) { flushHits(); mapped = `Your left hand begins casting ${m[1]}…`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — RH commits (.+?) \(cast \d+\)$/);
    if (m) { flushHits(); mapped = `Your right hand begins casting ${m[1]}…`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — LH (.+?) hits (.+?) for (\d+)$/);
    if (m) { flushHits(); mapped = `Your left hand's ${m[1]} hits ${m[2]} for ${m[3]}.`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — RH (.+?) hits (.+?) for (\d+)$/);
    if (m) { flushHits(); mapped = `Your right hand's ${m[1]} hits ${m[2]} for ${m[3]}.`; outputEntries.push({ text: mapped, matched: true }); continue; }

    flushHits();
    outputEntries.push({ text: raw, matched: false });
  }
  flushHits();

  let finalEntries = outputEntries;
  if (finalEntries.length > 5) {
    finalEntries = finalEntries.slice(0, 5);
    finalEntries.push({ text: '…the fight continues.', matched: false });
  }

  finalEntries.forEach((entry, idx) => {
    const isTrailer = idx === finalEntries.length - 1 && entry.text.includes('…the fight continues');
    if (isTrailer || !entry.matched) {
      printDim(entry.text);
    } else {
      printGreen(entry.text);
    }
  });
}

function turnPromptFromState(stateObj) {
  if (isQuiet && isQuiet()) return;
  const s = stateObj && stateObj.state ? stateObj.state : stateObj;
  if (!s) { printAmber('Ready — what do you do?'); return; }
  if (s.player_dead) { printAmber('You have been defeated.'); return; }
  if (s.battle_over) { printGreen('The battle is over. The crowd roars.'); return; }
  const parts = s.participants || {};
  const player = parts.player || {};
  const hands = player.hands || {};
  // defect 2 fix
  const lhEmpty = !hands.LH || hands.LH.weaponId == null;
  const rhEmpty = !hands.RH || hands.RH.weaponId == null;
  if (lhEmpty && rhEmpty) {
    return; // empty hands: nothing printed
  }
  const ready = [];
  if (hands.LH && hands.LH.state === 'Ready' && hands.LH.weaponId != null) ready.push('left');
  if (hands.RH && hands.RH.state === 'Ready' && hands.RH.weaponId != null) ready.push('right');
  if (ready.length === 0) {
    printAmber('Both hands are busy — waiting…');
  } else if (ready.length === 1) {
    printGreen(`Your ${ready[0]} hand is ready.`);
  } else {
    printGreen('Your left hand is ready.');
    printGreen('Your right hand is ready.');
  }
}
import { getCurrentRunId, saveCurrentRunId, clearCurrentRunId, login as doLogin, logout as doLogout, loadDevMode, saveDevMode, clearDevMode } from './auth.mjs';

let currentRunId = getCurrentRunId();
let devMode = loadDevMode();

function updateRunId(id) {
  currentRunId = id;
  if (id) saveCurrentRunId(id);
  else clearCurrentRunId();
}

export function setDevMode(v) { devMode = !!v; } // for static verification of grant gating
export function getDevMode() { return devMode; }

export async function cmdLogin(args) {
  try {
    const email = args[0];
    const pass = args[1];
    const sess = await doLogin(email, pass);
    printGreen(`Logged in as ${sess.user.email}`);
    if (isJson()) console.log(JSON.stringify({ ok: true, user: sess.user }));
  } catch (e) {
    printError('login: ' + e.message);
  }
}

export async function cmdLogout() {
  await doLogout();
  clearDevMode();
  updateRunId(null);
  printGreen('Logged out (session cleared)');
}

export async function cmdRunNew(args, flags = {}) {
  try {
    // fetch inventory (non-fatal)
    let wData = { weapons: [] };
    let cData = { consumables: [] };
    try { wData = await apiCall('GET', '/weapons'); } catch (_) {}
    try { cData = await apiCall('GET', '/consumables'); } catch (_) {}

    if (!isQuiet() && !isJson()) {
      console.log('=== Loadout for new run (weapons + consumables) ===');
      console.log('weapons:');
      (wData.weapons || []).forEach(w => {
        const atkList = w.attacks.map(a => `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`).join(' ');
        console.log(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`);
      });
      console.log('consumables:');
      if (!cData.consumables || cData.consumables.length === 0) {
        console.log('  (consumables on hold)');
      } else {
        cData.consumables.forEach(c => console.log(`#${c.id} ${c.name} qty=${c.quantity ?? 1}`));
      }
    }

    // one-shot flags take precedence
    let lh = flags.lh != null ? parseInt(flags.lh, 10) : null;
    let rh = flags.rh != null ? parseInt(flags.rh, 10) : null;
    let belt = flags.belt != null ? parseInt(flags.belt, 10) : null;
    let ca = flags.ca != null ? parseInt(flags.ca, 10) : null;
    let cb = flags.cb != null ? parseInt(flags.cb, 10) : null;

    if (lh == null || rh == null) {
      // interactive prompt loop (exact getId behavior from cli-app.js:286)
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
      const getId = async (label, allowEmpty = true) => {
        while (true) {
          const ans = await new Promise(r => rl.question(`${label} (id${allowEmpty ? ' or empty to skip' : ''}, 'inventory' to re-list): `, r));
          const trimmed = (ans || '').trim();
          if (trimmed.toLowerCase() === 'inventory') {
            console.log('weapons:');
            (wData.weapons || []).forEach(w => {
              const atkList = w.attacks.map(a => `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`).join(' ');
              console.log(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`);
            });
            console.log('consumables:');
            (cData.consumables || []).forEach(c => console.log(`#${c.id} ${c.name} qty=${c.quantity ?? 1}`));
            continue;
          }
          if (!trimmed && allowEmpty) return null;
          const m = trimmed.match(/(\d+)\s*$/);
          if (m) {
            const id = parseInt(m[1], 10);
            if (Number.isFinite(id)) return id;
          }
          printAmber('invalid id, try again');
        }
      };
      if (lh == null) lh = await getId('LH');
      if (rh == null) rh = await getId('RH');
      if (belt == null) belt = await getId('Belt');
      if (ca == null) ca = await getId('Consume A', true);
      if (cb == null) cb = await getId('Consume B', true);
      rl.close();
    }

    const payload = { portal_template_id: 1 };
    if (lh != null) payload.hand_l_weapon_id = lh;
    if (rh != null) payload.hand_r_weapon_id = rh;
    if (belt != null) payload.belt_weapon_id = belt;
    if (ca != null) payload.consume_a = ca;
    if (cb != null) payload.consume_b = cb;

    const data = await apiCall('POST', '/runs', payload);
    updateRunId(data.run.id);
    printGreen(`Created run #${data.run.id}`);
    if (isJson()) {
      console.log(JSON.stringify({ run: data.run }));
      return;
    }
    // render dice + monsters if present (but avoid any numeric_hp usage)
    // fetch full state — creation response's battle_state.participants lacks hp_word/current die
    let bs = {};
    try {
      const fresh = await apiCall('GET', `/runs/${data.run.id}`);
      bs = (fresh.run && fresh.run.battle_state) || {};
    } catch {
      bs = (data.run && data.run.battle_state) || {};
    }
    const d = bs.dice || {};
    if (d.remaining || d.current) {
      const fmtC = (o) => `G${o.green ?? 0} Y${o.yellow ?? 0} R${o.red ?? 0}`;
      const cur = d.current ? `current: ${d.current.color} die face=${d.current.face} budget=${d.current.rolled_value}` : 'current: —';
      printGreen(`dice remaining: ${fmtC(d.remaining || {})}  used: ${fmtC(d.used || {})}  ${cur}`);
    }
    const mons = (data.participants || bs.monsters || []);
    if (mons.length) {
      printDim('battle-1 monsters:');
      mons.forEach(m => {
        // do not print numeric hp — spec forbids numeric_hp entirely in new code
        printGreen(`monster ${m.label || m.name} hp_word=${m.hp_word || 'Unknown'} dmg ${m.damage} spd ${m.speed} acc ${m.accuracy}`);
      });
    }
    await cmdState([], { silentIfJson: true });
  } catch (e) {
    printError('run new: ' + e.message);
  }
}

export async function cmdRun() {
  if (!currentRunId) {
    printAmber('No current run. Use run new first.');
    return;
  }
  if (isJson()) {
    try {
      const data = await apiCall('GET', `/runs/${currentRunId}`);
      console.log(JSON.stringify(data.run));
    } catch (e) { printError(e.message); }
    return;
  }
  await cmdState();
}

export async function cmdState(args = [], opts = {}) {
  if (!currentRunId) {
    printAmber('No current run id. Use \"run new\" first.');
    return;
  }
  try {
    const data = await apiCall('GET', `/runs/${currentRunId}`);
    if (isJson() && !opts.silentIfJson) {
      console.log(JSON.stringify(data.run, null, 2));
      return;
    }
    printState(data.run);
  } catch (e) {
    printError('state fetch: ' + e.message);
  }
}

export async function cmdBattleStart() {
  if (!currentRunId) { printError('no run'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/battle/start`, {});
    printGreen('Battle started');
    if (isJson()) {
      await cmdState();
    } else {
      if (data && data.feed) narrateFeed(data.feed, data.participants);
      turnPromptFromState(data);
    }
  } catch (e) {
    if ((e.message || '').includes('Battle already in progress')) {
      printAmber('Battle already in progress');
      await cmdState();
      return;
    }
    printError('battle start: ' + e.message);
  }
}

export async function cmdAttack(args) {
  if (!currentRunId) { printError('no run'); return; }
  if (args.length < 2) { printError('usage: attack LH|RH attack_id [target_ids...]'); return; }
  const hand = args[0].toUpperCase();
  const attackId = parseInt(args[1], 10);
  if (!['LH', 'RH'].includes(hand) || isNaN(attackId)) {
    printError('invalid hand or attack_id');
    return;
  }
  // ALWAYS send target_ids: [] — let engine auto-pick (playthrough pattern, forbidden filter avoided)
  const payload = { hand, attack_id: attackId, target_ids: [] };
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/commit`, payload);
    printGreen(`Attack ${hand} #${attackId} → auto`);
    if (data.advanced) printAmber(' (advanced)');
    if (isJson()) {
      console.log(JSON.stringify(data));
      return;
    }
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    turnPromptFromState(data.state || data);
  } catch (e) {
    if ((e.message || '').includes('Hand not ready')) {
      printAmber('Hand not ready (use wait to advance)');
      return;
    }
    printError('attack: ' + e.message);
  }
}

export async function cmdBattleEnd(args) {
  if (!currentRunId) { printError('no run'); return; }
  const choice = (args[0] || '').toLowerCase();
  if (!['continue', 'stop'].includes(choice)) { printError('usage: battle end continue|stop'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/battle/end`, { choice });
    printGreen(`Battle ended: ${data.status} battle ${data.current_battle}`);
    await cmdState();
  } catch (e) {
    printError('battle end: ' + e.message);
  }
}

export async function cmdInventory() {
  try {
    const w = await apiCall('GET', '/weapons').catch(() => ({ weapons: [] }));
    const c = await apiCall('GET', '/consumables').catch(() => ({ consumables: [] }));
    if (isJson()) {
      console.log(JSON.stringify({ weapons: w.weapons || [], consumables: c.consumables || [] }));
      return;
    }
    console.log('weapons:');
    (w.weapons || []).forEach(ww => console.log(`#${ww.id} ${ww.name} dmg=${ww.damage}`));
    console.log('consumables:');
    if (!c.consumables || c.consumables.length === 0) {
      console.log('  (on hold)');
    } else {
      (c.consumables || []).forEach(cc => console.log(`#${cc.id} ${cc.name}`));
    }
  } catch (e) {
    printError('inventory: ' + e.message);
  }
}

export async function cmdWait() {
  if (!currentRunId) { printError('no run'); return; }
  try {
    // PROVEN pattern from playthrough.mjs: load real hand/attack from current state, commit, handle 'Hand not ready' as advanced without swallowing other errors
    const stateData = await apiCall('GET', `/runs/${currentRunId}`);
    const bs = stateData.run?.battle_state || {};
    const weapons = bs.weapons || {};
    const handW = weapons.hand_l || weapons.hand_r;
    if (!handW || !handW.attacks || handW.attacks.length === 0) {
      printError('wait: no ready weapon hand with attacks');
      return;
    }
    const attackId = handW.attacks[0].id;
    const hand = weapons.hand_l === handW ? 'LH' : 'RH';
    const data = await apiCall('POST', `/runs/${currentRunId}/commit`, { hand, attack_id: attackId, target_ids: [] });
    if (data.advanced) {
      printAmber('(advanced)');
    }
    if (isJson()) {
      console.log(JSON.stringify({ advanced: !!data.advanced }));
      return;
    }
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    turnPromptFromState(data.state || data);
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('Hand not ready')) {
      printAmber('(advanced)');
      if (isJson()) console.log(JSON.stringify({ advanced: true }));
      if (isJson()) {
        await cmdState();
      } else {
        const feedSrc = data.state && data.state.feed ? data.state : data;
        if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
        turnPromptFromState(data.state || data);
      }
      return;
    }
    printError('wait: ' + msg);
  }
}

export async function cmdClear() {
  console.clear();
}

export async function cmdGrant() {
  try {
    const data = await apiCall('POST', '/dev/grant', {});
    if (data.dev_mode === true) {
      devMode = true;
      saveDevMode(true);
      printGreen('Dev tools unlocked. Type help for the full command list.');
    } else {
      appendLine ? appendLine(JSON.stringify(data), 'dim') : printDim(JSON.stringify(data));
    }
  } catch (e) {
    if ((e.message || '').includes('Admin access required') || (e.message || '').includes('403')) {
      printAmber('403 Admin access required (non-admin caller)');
    } else {
      printError('grant: ' + e.message);
    }
  }
}

// Dev slash command implementations (exact payloads + error messages from cli-app.js)
export async function cmdDevEquip(args) {
  if (!currentRunId) { printError('no run — use run new first'); return; }
  let slot = args[0] ? args[0].toLowerCase() : null;
  if (slot && !['lh', 'rh', 'belt'].includes(slot)) slot = null;
  if (slot) slot = slot === 'belt' ? 'belt' : slot.toUpperCase();
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
      await cmdState();
    } catch (e) { printError('equip: ' + e.message); }
    return;
  }
  try {
    const data = await apiCall('POST', '/dev/equip', { slot: slot || undefined });
    const w = data.weapon;
    let msg = `${data.slot} → ${w.template_name} (dmg ${w.damage}, #${w.instance_id})`;
    if (data.displaced) msg += ` (displaced ${data.displaced.template_name} → inventory)`;
    printGreen(msg);
    await cmdState();
  } catch (e) { printError('equip: ' + e.message); }
}

export async function cmdDevRoll(args) {
  if (!currentRunId) { printError('no run — use run new first'); return; }
  const sub = args[0];
  if (sub === 'weapon') {
    const template_id = parseInt(args[1], 10);
    if (!Number.isFinite(template_id)) { printError('usage: /roll weapon <id> [LH|RH|belt] | /roll monster <id>'); return; }
    let slot = args[2] ? args[2].toLowerCase() : 'lh';
    if (!['lh', 'rh', 'belt'].includes(slot)) slot = 'lh';
    slot = slot === 'belt' ? 'belt' : slot.toUpperCase();
    try {
      const data = await apiCall('POST', '/dev/roll-weapon', { template_id, slot });
      const w = data.weapon;
      printGreen(`${data.slot} → ${w.template_name} (dmg ${w.damage}, #${w.instance_id})`);
      await cmdState();
    } catch (e) {
      printError('roll: ' + e.message);
    }
  } else if (sub === 'monster') {
    const template_id = parseInt(args[1], 10);
    if (!Number.isFinite(template_id)) { printError('usage: /roll weapon <id> [LH|RH|belt] | /roll monster <id>'); return; }
    try {
      const data = await apiCall('POST', '/dev/roll-monster', { template_id });
      const m = data.monster;
      printGreen(`monster ${m.label} hp_word=${m.hp_word || 'Unknown'} dmg ${m.damage} spd ${m.speed} acc ${m.accuracy}`);
      await cmdState();
    } catch (e) {
      printError('roll: ' + e.message);
    }
  } else {
    printError('usage: /roll weapon <id> [LH|RH|belt] | /roll monster <id>');
  }
}

export async function cmdDevNuke() {
  try {
    const res = await apiCall('POST', '/dev/nuke-monsters', {});
    if (res.error) {
      printError(res.error);
      return;
    }
    const n = res.removed || 0;
    if (n > 0) {
      printGreen(`removed ${n} monster(s)`);
      await cmdState();
    } else {
      printDim('no monsters to remove');
    }
  } catch (e) {
    printError('nuke: ' + e.message);
  }
}

export async function cmdDevAbandon() {
  try {
    const res = await apiCall('POST', '/dev/abandon-run', {});
    if (res.error) {
      printError(res.error);
      return;
    }
    const rid = currentRunId;
    updateRunId(null);
    printGreen(`run #${rid} abandoned — use run new to start fresh`);
    await cmdState();
  } catch (e) {
    printError('abandon: ' + e.message);
  }
}

export async function cmdListTemplates() {
  try {
    const res = await apiCall('GET', '/dev/templates');
    if (res.error) {
      printError(res.error);
      return;
    }
    printDim('Weapons:');
    for (const w of (res.weapons || [])) {
      printDim(`  #${w.id} ${w.name}`);
    }
    printDim('Monsters:');
    for (const m of (res.monsters || [])) {
      printDim(`  #${m.id} ${m.name}`);
    }
  } catch (e) {
    printError('list templates: ' + e.message);
  }
}

export async function cmdInspect(args) {
  const idStr = (args[0] || '').trim();
  if (!idStr) {
    try {
      const res = await apiCall('GET', '/dev/templates');
      if (res.error) {
        printError(res.error);
        return;
      }
      for (const m of (res.monsters || [])) {
        printDim(`#${m.id} ${m.name}`);
      }
      return;
    } catch (e) {
      printError('inspect: ' + e.message);
      return;
    }
  }
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id < 1) {
    printError('Invalid template id');
    return;
  }
  try {
    const res = await apiCall('GET', `/templates/monster/${id}`);
    if (res.error) {
      printError(res.error);
      return;
    }
    printDim(`${res.name} (#${res.id})`);
    printDim(`base_hp: ${res.base_hp}  dmg: ${res.damage}  spd: ${res.speed}  acc: ${res.accuracy}`);
    if (res.attacks && res.attacks.length) {
      printDim('attacks:');
      for (const a of res.attacks) {
        const multi = a.is_multi_target ? ', multi' : '';
        printDim(`  #${a.id} ${a.name} (prep ${a.prepare_time}, cd ${a.cooldown_time}${multi})`);
      }
    }
  } catch (e) {
    printError('inspect: ' + e.message);
  }
}

export async function cmdDevSet(args) {
  if (!currentRunId) { printError('no run — use run new first'); return; }
  if (args[0] !== 'hp') { printError('usage: /set hp <player|monster> <n>'); return; }
  const target = args[1];
  const hp = parseInt(args[2], 10);
  if (!Number.isFinite(hp) || hp < 0) { printError('usage: /set hp <player|monster> <n>'); return; }
  try {
    const data = await apiCall('POST', '/dev/set-hp', { target, hp });
    printGreen(`set ${data.target} hp → ${data.hp}`);
    await cmdState();
  } catch (e) {
    printError('set: ' + e.message);
  }
}

export async function handleSlashCommand(cmd, args) {
  if (!cmd.startsWith('/')) return false;
  if (cmd === '/inventory') { await cmdInventory(); return true; }
  if (!devMode) { printAmber('Dev tools locked — type grant'); return true; }
  const fnMap = {
    '/equip': cmdDevEquip,
    '/roll': cmdDevRoll,
    '/nuke': cmdDevNuke,
    '/abandon': cmdDevAbandon,
    '/inspect': cmdInspect,
    '/list': (a) => { if (a[0]==='templates') return cmdListTemplates(); printError('usage: /list templates'); },
    '/set': cmdDevSet,
  };
  const fn = fnMap[cmd];
  if (!fn) { printAmber('unknown dev command — type help'); return true; }
  await fn(args);
  return true;
}

export function getCurrentRun() { return currentRunId; }
export function setCurrentRun(id) { updateRunId(id); }
