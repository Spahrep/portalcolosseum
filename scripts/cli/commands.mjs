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
import { printError, printGreen, printAmber, printState, printDim, printQueueWithMarkers, isQuiet, isJson } from './render.mjs';
import { parsePotionSlot, classifyPotionError, formatPotionSummary, mapPotionFeedLine, formatConsumableSummary } from './potion-format.mjs';
import { computeTimingMarkers } from '../../js/combat/tic-queue.js';

const seenFeed = new Set();

// --- PC-56 interactive menu support ---
// Mirror of cli-app.js's promptUser/pendingInputResolver: cmdMenu asks a
// question and awaits the next input line, which cli.js routes here before
// dispatch (see resolvePromptLine).
let pendingPromptResolver = null;
export function promptUser(question) {
  printAmber(question);
  return new Promise((resolve) => {
    pendingPromptResolver = resolve;
  });
}
export function resolvePromptLine(line) {
  if (!pendingPromptResolver) return false;
  const resolve = pendingPromptResolver;
  pendingPromptResolver = null;
  resolve(line.trim());
  return true;
}

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

  const outputEntries = []; // {text, matched}

  for (const raw of newLines) {
    let mapped = null;
    // DEFECT 1: getMonsterLabel + greedy fallback for hits
    let label = getMonsterLabel(raw);
    let m;
    if (label) {
      const remainder = raw.replace(label, '').replace(/^tic \d+ — \s*/, '');
      m = remainder.match(/^(.+?)?\s*hits player for (\d+)$/);
      if (m) {
        mapped = m[1] && m[1].trim() ? `${label}'s ${m[1].trim()} hits you for ${m[2]}.` : `${label} hits you for ${m[2]}.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }
    }
    m = raw.match(/^tic \d+ — ([A-Za-z]+(?: [A-Z])?)(?: (.+?))? hits player for (\d+)$/);
    if (m) {
      const mon = m[1];
      mapped = m[2] && m[2].trim() ? `${mon}'s ${m[2].trim()} hits you for ${m[3]}.` : `${mon} hits you for ${m[3]}.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // misses
    label = getMonsterLabel(raw);
    if (label) {
      const remainder = raw.replace(label, '').replace(/^tic \d+ — \s*/, '');
      m = remainder.match(/^(.+?)?\s*misses$/);
      if (m) {
        mapped = m[1] && m[1].trim() ? `${label}'s ${m[1].trim()} misses you.` : `${label} misses you.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }
    }
    m = raw.match(/^tic \d+ — ([A-Za-z]+(?: [A-Z])?)(?: (.+?))? misses$/);
    if (m) {
      const mon = m[1];
      mapped = m[2] && m[2].trim() ? `${mon}'s ${m[2].trim()} misses you.` : `${mon} misses you.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    m = raw.match(/^tic \d+ — (.+?) is defeated$/);
    if (m) { mapped = `${m[1]} is defeated!`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — LH commits (.+?) \(cast \d+\)$/);
    if (m) { mapped = `Your left hand begins casting ${m[1]}…`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — RH commits (.+?) \(cast \d+\)$/);
    if (m) { mapped = `Your right hand begins casting ${m[1]}…`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — LH (.+?) hits (.+?) for (\d+)$/);
    if (m) { mapped = `Your left hand's ${m[1]} hits ${m[2]} for ${m[3]}.`; outputEntries.push({ text: mapped, matched: true }); continue; }
    m = raw.match(/^tic \d+ — RH (.+?) hits (.+?) for (\d+)$/);
    if (m) { mapped = `Your right hand's ${m[1]} hits ${m[2]} for ${m[3]}.`; outputEntries.push({ text: mapped, matched: true }); continue; }
    // PC-39 potion feed lines (drink commit / effect land / between-fights / buff expiry)
    const potionLine = mapPotionFeedLine(raw);
    if (potionLine.matched) {
      outputEntries.push({ text: potionLine.text, matched: true });
      continue;
    }
    outputEntries.push({ text: raw, matched: false });
  }

  outputEntries.forEach(entry => {
    if (!entry.matched) {
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
  if (s.battle_over) {
    printGreen('The battle is over. The crowd roars.');
    // AFTER-BATTLE OFFER — once per completed battle, keyed on the run row's
    // current_battle (the engine state exposes no battle counter).
    if (!isQuiet() && !isJson() && currentRunId) {
      (async () => {
        try {
          const runData = await apiCall('GET', `/runs/${currentRunId}`);
          const run = runData.run || {};
          const curB = run.current_battle;
          if (curB != null && offeredBattleNum !== curB) {
            offeredBattleNum = curB;
            const hpCur = (s.player && s.player.hp) || run.player_hp || 0;
            console.log(buildAfterBattleOffer(curB, run.total_battles, hpCur, null, curB === 1, pickUnusedPotionHint(run)));
          }
        } catch (_) {
          // silent — the offer is cosmetic; a later commit retries
        }
      })();
    }
    return;
  }
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

// --- PC-36 pure text builders (exported for isolated testing) ---
const letterOf = (label) => (label && /[A-Z]$/.test(label)) ? label.slice(-1) : '';

export function buildPreambleText() {
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
  const hpLine = (hpMax == null || hpMax === 0) ? `Your HP: ${hpCur}.` : `Your HP: ${hpCur}/${hpMax}.`;
  const numPart = totalBattles ? `Battle ${currentBattle} of ${totalBattles} complete.` : `Battle ${currentBattle} complete.`;
  lines.push(`${numPart} ${hpLine}`);
  lines.push('The prize pool has grown.');
  lines.push('');
  if (potionHint) {
    lines.push(`Type "use ${potionHint}" to drink your remaining potion first, "continue" to risk the next fight, or "stop" to claim your current share and end the run.`);
  } else {
    lines.push('Type "continue" to risk the next fight, or "stop" to claim your current share and end the run.');
  }
  return lines.join('\n');
}

// PC-39: which slot still holds an unused potion (A before B)? null when none.
export function pickUnusedPotionHint(run) {
  if (!run) return null;
  if (run.consume_a_id && !run.consume_a_used) return 'A';
  if (run.consume_b_id && !run.consume_b_used) return 'B';
  return null;
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
    return formatConsumableSummary(c);
  }
  return `No item #${id} found in your inventory.`;
}

export function buildPreambleDenied() {
  return 'Type "inventory", "inspect #", "ready", or "help".';
}

export function buildConfirmDenied() {
  return 'Type "confirm" to enter, or "inventory" to adjust.';
}

// Module state for the three-phase run-start gate (interactive no-flag REPL only)
let flowState = null; // 'preamble' | 'confirm' | null
let pendingPicks = null;
let offeredBattleNum = null; // last completed battle the after-battle offer was shown for

export function isInFlowGate() {
  return flowState !== null;
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
  const hasFlags = !!(flags.lh != null || flags.rh != null || flags.belt != null || flags.ca != null || flags.cb != null);
  if (hasFlags || isQuiet() || isJson()) {
    // ORIGINAL create path, byte-for-byte (flags / quiet / json bypass the gate)
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
        const atkList = w.attacks.map(a => {
          const pVar = a.prepare_time_range || 0;
          const cVar = a.cooldown_time_range || 0;
          const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
          const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
          return `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} ${pPart}/${cPart}`;
        }).join(' ');
        console.log(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`);
      });
      console.log('consumables:');
      if (!cData.consumables || cData.consumables.length === 0) {
        console.log('  (consumables on hold)');
      } else {
        cData.consumables.forEach(c => console.log(`  ${formatConsumableSummary(c)}`));
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
              const atkList = w.attacks.map(a => {
          const pVar = a.prepare_time_range || 0;
          const cVar = a.cooldown_time_range || 0;
          const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
          const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
          return `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} ${pPart}/${cPart}`;
        }).join(' ');
              console.log(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`);
            });
            console.log('consumables:');
            (cData.consumables || []).forEach(c => console.log(`  ${formatConsumableSummary(c)}`));
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
        const letter = letterOf(m.label);
        printGreen(`monster ${m.name || m.label}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Unknown'}`);
      });
    }
    await cmdState([], { silentIfJson: true });
    } catch (e) {
      printError('run new: ' + e.message);
    }
    return;
  }

  // Interactive three-phase gate path (no flags, not quiet, not json, REPL)
  // Re-entry from any gate phase always lands back at the preamble, so
  // 'ready' works no matter when 'run new' is typed.
  flowState = 'preamble';
  pendingPicks = { lh: null, rh: null, belt: null, ca: null, cb: null };
  console.log(buildPreambleText());
}

export async function cmdReady() {
  if (flowState !== 'preamble') {
    if (!isQuiet() && !isJson()) console.log(buildPreambleDenied());
    return;
  }
  // PC-36 rework: ready shows the current pendingPicks recap (set via equip);
  // the interactive picks loop was removed per spec — belt/consume stay empty.
  try {
    let wData = { weapons: [] };
    let cData = { consumables: [] };
    try { wData = await apiCall('GET', '/weapons'); } catch (_) {}
    try { cData = await apiCall('GET', '/consumables'); } catch (_) {}
    if (!pendingPicks) pendingPicks = { lh: null, rh: null, belt: null, ca: null, cb: null };
    if (!isQuiet() && !isJson()) console.log(buildRecapText(wData.weapons || [], cData.consumables || [], pendingPicks));
    flowState = 'confirm';
  } catch (e) {
    printError('ready: ' + e.message);
    flowState = null;
    pendingPicks = null;
  }
}

export async function cmdConfirm() {
  if (flowState !== 'confirm' || !pendingPicks) {
    if (flowState === null) {
      if (!isQuiet() && !isJson()) console.log('Type "run new" to begin.');
    } else {
      if (!isQuiet() && !isJson()) console.log(buildConfirmDenied());
    }
    return;
  }
  try {
    const p = pendingPicks;
    const payload = { portal_template_id: 1 };
    if (p.lh != null) payload.hand_l_weapon_id = p.lh;
    if (p.rh != null) payload.hand_r_weapon_id = p.rh;
    if (p.belt != null) payload.belt_weapon_id = p.belt;
    if (p.ca != null) payload.consume_a = p.ca;
    if (p.cb != null) payload.consume_b = p.cb;

    const data = await apiCall('POST', '/runs', payload);
    setCurrentRun(data.run.id);
    console.log('The portal pulls you through.');
    printGreen(`Created run #${data.run.id}`);
    if (isJson()) {
      console.log(JSON.stringify({ run: data.run }));
      flowState = null;
      pendingPicks = null;
      offeredBattleNum = null;
      return;
    }
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
        const letter = letterOf(m.label);
        printGreen(`monster ${m.name || m.label}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Unknown'}`);
      });
    }
    await cmdState([], { silentIfJson: true });
    console.log('Type "battle start" to begin.');
    flowState = null;
    pendingPicks = null;
    offeredBattleNum = null;
  } catch (e) {
    printError('confirm: ' + e.message);
    flowState = null;
    pendingPicks = null;
  }
}

export async function cmdInspect(args) {
  // Pre-run item pretty-print (PC-36): inspect <id> → item card from the
  // same /weapons + /consumables payloads the inventory re-list uses.
  if (!args[0]) { printError('usage: inspect <id>'); return; }
  const id = parseInt(args[0], 10);
  if (!Number.isFinite(id)) { printError('usage: inspect <id>'); return; }
  try {
    let wData = { weapons: [] };
    let cData = { consumables: [] };
    try { wData = await apiCall('GET', '/weapons'); } catch (_) {}
    try { cData = await apiCall('GET', '/consumables'); } catch (_) {}
    console.log(buildItemInspectText(wData.weapons || [], cData.consumables || [], id));
  } catch (e) {
    printError('inspect: ' + e.message);
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

// PC-56: Dragon-Warrior-style interactive combat menu (per-hand rows, letter
// labels, '>' timing markers, attack→target→confirm, potion + BL rows).
// Mirrors the web GUI + parity port cli-app.js exactly.
export async function cmdMenu(args = []) {
  if (!currentRunId) { printError('no run'); return; }
  let hand = (args[0] || 'LH').toUpperCase();
  if (!['LH', 'RH'].includes(hand)) { printError('usage: menu [LH|RH]'); return; }

  const data = await apiCall('GET', `/runs/${currentRunId}`);
  const run = data.run || data;
  const bs = run.battle_state || {};
  const weapons = bs.weapons || {};
  const monsters = (bs.monsters || []).filter(m => !m.dead && (m.current_hp || m.hp || 0) > 0);

  if (!isQuiet() && !isJson()) {
    console.log(`RUN #${run.id} battle ${run.current_battle}/${run.total_battles}  tic ${bs.tic || 0}`);
    console.log(`player_hp: ${run.player_hp}`);
  }

  // rows: [ {kind:'attack', label, attack, letter}, {kind:'bl',...}, {kind:'c1',...}, {kind:'c2',...} ]
  const buildRows = (h) => {
    const wKey = h === 'LH' ? 'hand_l' : 'hand_r';
    const w = weapons[wKey];
    const rows = [];
    let letter = 97; // 'a'
    for (const a of (w && w.attacks) || []) {
      rows.push({ kind: 'attack', attack: a, letter: String.fromCharCode(letter++) });
    }
    rows.push({ kind: 'bl', letter: String.fromCharCode(letter++) });
    rows.push({ kind: 'c1', letter: String.fromCharCode(letter++) });
    rows.push({ kind: 'c2', letter: String.fromCharCode(letter++) });
    return rows;
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const wKey = hand === 'LH' ? 'hand_l' : 'hand_r';
    const w = weapons[wKey];
    if (!isQuiet() && !isJson()) {
      console.log('');
      console.log(`${hand} — ${w ? `${w.name} (spd ${w.speed})` : 'no weapon'}`);
      for (const r of buildRows(hand)) {
        if (r.kind === 'attack') {
          const p = `${r.attack.prepare_time}${r.attack.prepare_time_range ? '-' + (r.attack.prepare_time + r.attack.prepare_time_range) : ''}`;
          const c = `${r.attack.cooldown_time}${r.attack.cooldown_time_range ? '-' + (r.attack.cooldown_time + r.attack.cooldown_time_range) : ''}`;
          console.log(`  ${r.letter}) ${r.attack.name} (p${p}/c${c})`);
        } else if (r.kind === 'bl') {
          const belt = weapons.belt;
          console.log(`  ${r.letter}) BL: ${belt ? `${belt.name} (spd ${belt.speed})` : 'no belt weapon'}`);
        } else if (r.kind === 'c1') {
          const p = bs.potions && (bs.potions.potion_a || bs.potions.A);
          console.log(`  ${r.letter}) C1: ${p ? (p.template_name || 'Potion') : 'no potion'}`);
        } else {
          const p = bs.potions && (bs.potions.potion_b || bs.potions.B);
          console.log(`  ${r.letter}) C2: ${p ? (p.template_name || 'Potion') : 'no potion'}`);
        }
      }
      console.log(`  ${hand === 'LH' ? 'r' : 'l'}) switch hand   q) quit`);
    }

    if (isJson()) {
      // non-interactive: pick the first attack of the selected hand (like cmdWait)
      const first = buildRows(hand).find(r => r.kind === 'attack');
      if (!first) { printError('menu: no attack on ' + hand); return; }
      return runCommit(run, hand, first.attack, []);
    }

    const pick = (await promptUser(`menu ${hand}> `)).toLowerCase();
    if (pick === 'q') { printAmber('menu closed'); return; }
    if (pick === 'l') { hand = 'LH'; continue; }
    if (pick === 'r') { hand = 'RH'; continue; }

    const row = buildRows(hand).find(r => r.letter === pick);
    if (!row) { printAmber(`unknown pick: ${pick}`); continue; }

    if (row.kind === 'attack') {
      // '>' timing markers on the queue for this attack (approved mockup semantics)
      const markers = computeTimingMarkers(bs.queue || [], row.attack);
      if (!isQuiet() && !isJson()) {
        console.log('queue:');
        printQueueWithMarkers(bs.queue || [], markers);
      }
      // target pick (letters) or auto
      let targets = [];
      if (monsters.length > 0) {
        const pickT = (await promptUser(`target ${hand} ${row.attack.name} (${monsters.map((m, i) => String.fromCharCode(97 + i)).join('')} or auto)> `)).toLowerCase();
        if (pickT === 'auto' || pickT === '') {
          targets = [];
        } else {
          const idx = pickT.charCodeAt(0) - 97;
          const m = monsters[idx];
          if (!m) { printAmber('unknown target'); continue; }
          targets = [m.id];
        }
      }
      const ok = (await promptUser(`commit ${hand} ${row.attack.name}${targets.length ? '' : ' (auto)'}? y/n> `)).toLowerCase();
      if (ok !== 'y') { printAmber('cancelled'); continue; }
      await runCommit(run, hand, row.attack, targets);
      return;
    }

    if (row.kind === 'bl') {
      const ok = (await promptUser(`swap ${hand} with belt? y/n> `)).toLowerCase();
      if (ok !== 'y') { printAmber('cancelled'); continue; }
      return cmdSwap([hand]);
    }

    // C1 / C2 potion rows
    const slot = row.kind === 'c1' ? 'A' : 'B';
    const potion = bs.potions && (row.kind === 'c1' ? (bs.potions.potion_a || bs.potions.A) : (bs.potions.potion_b || bs.potions.B));
    if (!potion) { printAmber('no potion in slot ' + slot); continue; }
    const ok = (await promptUser(`use potion ${slot}? y/n> `)).toLowerCase();
    if (ok !== 'y') { printAmber('cancelled'); continue; }
    try {
      const res = await apiCall('POST', `/runs/${currentRunId}/use-potion`, { slot });
      if (isJson()) { console.log(JSON.stringify(res)); return; }
      const feedSrc = res.state && res.state.feed ? res.state : res;
      if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
      if (res.potion_used) printGreen(formatPotionSummary(res.state || res, res));
      turnPromptFromState(res.state || res);
    } catch (e) {
      const cls = classifyPotionError(e.message);
      if (cls.level === 'amber') printAmber(cls.text); else printError('use: ' + cls.text);
    }
    return;
  }
}

async function runCommit(run, hand, attack, targets) {
  try {
    const payload = { hand, attack_id: attack.id, target_ids: targets };
    const data = await apiCall('POST', `/runs/${currentRunId}/commit`, payload);
    printGreen(`Attack ${hand} #${attack.id} → ${targets.length ? targets.join(',') : 'auto'}`);
    if (isJson()) { console.log(JSON.stringify(data)); return; }
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    turnPromptFromState(data.state || data);
  } catch (e) {
    printError('attack: ' + e.message);
  }
}

// PC-54: mid-battle belt swap. 'swap LH|RH' or 'bl LH|RH'.
export async function cmdSwap(args = []) {
  if (!currentRunId) { printError('no run'); return; }
  const hand = (args[0] || '').toUpperCase();
  if (!['LH', 'RH'].includes(hand)) { printError('usage: swap LH|RH'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/swap`, { hand });
    printGreen(`Belt swap (${hand}) — ${data.delay ?? '?'} tics cooldown`);
    if (isJson()) { console.log(JSON.stringify(data)); return; }
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    turnPromptFromState(data.state || data);
  } catch (e) {
    printError('swap: ' + e.message);
  }
}

export async function cmdUsePotion(args) {
  if (!currentRunId) { printError('no run'); return; }
  const parsed = parsePotionSlot(args);
  if (parsed.error) { printError(parsed.error); return; }
  const slot = parsed.slot;
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/use-potion`, { slot });
    if (isJson()) {
      console.log(JSON.stringify(data));
      return;
    }
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    if (data.potion_used) printGreen(formatPotionSummary(data.state || data, data));
    turnPromptFromState(data.state || data);
  } catch (e) {
    const cls = classifyPotionError(e.message);
    if (cls.level === 'amber') {
      printAmber(cls.text);
    } else {
      printError('use: ' + cls.text);
    }
  }
}

export async function cmdBattleEnd(args) {
  if (!currentRunId) { printError('no run'); return; }
  const choice = (args[0] || '').toLowerCase();
  if (!['continue', 'stop'].includes(choice)) { printError('usage: battle end continue|stop'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/battle/end`, { choice });
    if (!isQuiet() && !isJson()) {
      if (choice === 'continue') {
        printGreen('The next fight begins.');
        const bs = data.battle_state || {};
        const mons = bs.participants && bs.participants.monsters ? bs.participants.monsters : (bs.monsters || []);
        if (mons.length) {
          printDim(`battle-${data.current_battle || 1} monsters:`);
          mons.forEach(m => {
            // battle_state monsters are engine state: {label, hp_word, id} only
            const letter = letterOf(m.label);
            printGreen(`monster ${m.name || m.label}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Unknown'}`);
          });
        }
      } else if (choice === 'stop') {
        printGreen('You step back through the portal. The prize is yours — for now.');
      }
    }
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

export async function cmdDevInspect(args) {
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
    '/inspect': cmdDevInspect,
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


export async function cmdCancel() {
  // Exit the run-start gate without creating a run (Spahrep 2026-09-13).
  if (flowState !== 'preamble' && flowState !== 'confirm') {
    if (!isQuiet() && !isJson()) console.log('Nothing to cancel.');
    return;
  }
  flowState = null;
  pendingPicks = null;
  if (!isQuiet() && !isJson()) console.log('Run preparation cancelled.');
}


export async function cmdEquip(args) {
  if (flowState !== 'preamble' && flowState !== 'confirm') {
    if (!isQuiet() && !isJson()) console.log(buildPreambleDenied());
    return;
  }
  if (!args || args.length < 2) {
    if (!isQuiet() && !isJson()) console.log('usage: equip LH|RH <id>');
    return;
  }
  const hand = (args[0] || '' ).toUpperCase();
  const idStr = args[1];
  if (hand !== 'LH' && hand !== 'RH') {
    if (!isQuiet() && !isJson()) console.log('usage: equip LH|RH <id>');
    return;
  }
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    if (!isQuiet() && !isJson()) console.log('usage: equip LH|RH <id>');
    return;
  }
  try {
    const wData = await apiCall('GET', '/weapons');
    const weapons = wData.weapons || [];
    const w = weapons.find(ww => ww.id === id);
    if (!w) {
      if (!isQuiet() && !isJson()) console.log(`#${id} not found — type "inventory" to list your gear.`);
      return;
    }
    if (!pendingPicks) pendingPicks = { lh: null, rh: null, belt: null, ca: null, cb: null };
    if (hand === 'LH') pendingPicks.lh = id;
    else pendingPicks.rh = id;
    const slotName = hand === 'LH' ? 'Left Hand' : 'Right Hand';
    if (!isQuiet() && !isJson()) console.log(`${slotName}: #${w.id} ${w.name} (${w.damage} dmg)`);
  } catch (e) {
    printError('equip: ' + e.message);
  }
}
