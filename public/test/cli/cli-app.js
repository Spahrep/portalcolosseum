/**
 * cli-app.js — CLI dev/test harness for live combat API
 * Terminal UI matching gui2 aesthetics (near-black, Pixeloid Mono, green/amber, thin amber border)
 * Auth: /api/env.js + Supabase PKCE localStorage pattern from game.html
 * Commands: help/state/run new/run/battle start/attack/menu/swap/battle end/inventory/grant/clear
 * Always prints compact current state after state-changing commands
 * Seams: text-builders, queue-labels, feed-narration, command-history,
 * panel-nav, commands-inventory, commands-dev, side-panels.
 * This file keeps the dispatcher, the input loop, and the session.
 */

import { potionPrePostTicks } from '../../js/combat/potion-contract.js';
import {
  buildPreambleText,
  buildRecapText,
  buildAfterBattleOffer,
  buildPreambleDenied,
  buildConfirmDenied,
} from './text-builders.js';
import { QUEUE_ACTION_LABELS, monsterQueueLabel, letterOf } from './queue-labels.js';
import { createFeedNarrator } from './feed-narration.js';
import { createCommandHistory } from './command-history.js';
import { setupPanelNavigation } from './panel-nav.js';
import { createInventoryCommands } from './commands-inventory.js';
import { createDevCommands } from './commands-dev.js';
import {
  initSidePanels,
  updateSidePanelsFromRun,
  blankActionQueue,
  setMenuAttack,
  isSelectMode,
  enterSelectMode,
  exitSelectMode,
  nudgeSelect,
  showItemDetailForCurrent,
} from './side-panels.js';

const outputEl = document.getElementById('output');
const inputEl = document.getElementById('input');
const authStatusEl = document.getElementById('auth-status');


let supabase = null;
let currentUser = null;
let currentRunId = localStorage.getItem('cli_current_run_id') || null;
let accessToken = null;
let devMode = localStorage.getItem('cli_dev_mode') === '1';
let pendingInputResolver = null;
let flowState = null; // 'preamble' | 'confirm' | null — run-start gate
let pendingPicks = null; // {lh, rh, belt, ca, cb} captured at the ready step
let offeredBattleNum = null; // last battle the after-battle offer was shown for

function clearRunId() {
  currentRunId = null;
  localStorage.removeItem('cli_current_run_id');
}

function unlockDevMode() {
  devMode = true;
  localStorage.setItem('cli_dev_mode', '1');
}

const narrateFeed = createFeedNarrator({ appendLine, printDim });
const commandHistory = createCommandHistory();
initSidePanels({
  apiCall,
  blurInput: () => { if (inputEl) inputEl.blur(); },
  focusInput: () => { if (inputEl) inputEl.focus(); },
});
const { cmdInventory } = createInventoryCommands({ apiCall, appendLine, printError });
const { commands: DEV_COMMANDS, cmdInspect, cmdGrant } = createDevCommands({
  apiCall,
  appendLine,
  printError,
  printGreen,
  printAmber,
  refreshRunPanels,
  getRunId: () => currentRunId,
  clearRunId,
  getFlowState: () => flowState,
  unlockDevMode,
});


// After-battle offer: once per completed battle, keyed on the run's current_battle
// (the engine state exposes no battle counter, so we fetch the run row).
async function showAfterBattleOffer(s) {
  if (!currentRunId) return;
  try {
    const runData = await apiCall('GET', `/runs/${currentRunId}`);
    const r = runData.run || {};
    const curB = r.current_battle || 0;
    if (offeredBattleNum === curB) return;
    offeredBattleNum = curB;
    const totB = r.total_battles;
    const hpCur = (s.player && s.player.hp) || r.player_hp || 0;
    // PC-39: hint which potion is still drinkable (A before B), if any
    let hint = null;
    if (r.consume_a_id && !r.consume_a_used) hint = 'A';
    else if (r.consume_b_id && !r.consume_b_used) hint = 'B';
    appendLine(buildAfterBattleOffer(curB, totB, hpCur, null, curB === 1, hint));
  } catch (_) {
    // silent — the offer is cosmetic; a later commit will retry
  }
}



function appendLine(text, cls = '') {
  const div = document.createElement('div');
  div.className = 'line' + (cls ? ' ' + cls : '');
  div.textContent = text;
  outputEl.appendChild(div);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function appendLines(lines, cls = '') {
  lines.forEach(l => appendLine(l, cls));
}

function printError(msg) {
  appendLine('ERROR: ' + msg, 'error');
}

function printAmber(msg) {
  appendLine(msg, 'amber');
}

function printGreen(msg) {
  appendLine(msg, 'green');
}

function printDim(msg) {
  appendLine(msg, 'dim');
}


async function initAuth() {
  authStatusEl.textContent = 'checking auth…';
  try {
    // env.js sets window.ENV
    const env = window.ENV || {};
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase env');
    }

    // dynamic import Supabase (esm.sh — matches the rest of the codebase and the CSP allowlist)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.112.4');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        // Match the app-wide auth config (game-app.js / utils.js): default
        // storage key (sb-<ref>-auth-token) so the session written by
        // /login.html is found. A custom storageKey here made the CLI read
        // from a key nobody writes to — permanent "no active session".
        storage: {
          getItem: (key) => localStorage.getItem(key),
          setItem: (key, value) => localStorage.setItem(key, value),
          removeItem: (key) => localStorage.removeItem(key)
        }
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      authStatusEl.textContent = 'no session — redirecting';
      appendLine('No active session. Redirecting to login...', 'amber');
      setTimeout(() => { window.location.href = '/login.html'; }, 800);
      return false;
    }

    currentUser = session.user;
    accessToken = session.access_token;
    authStatusEl.textContent = `user: ${currentUser.email || currentUser.id.slice(0,8)}`;
    printGreen(`Authenticated as ${currentUser.email || currentUser.id}`);
    if (currentRunId) {
      printDim(`Loaded run #${currentRunId} from storage`);
    }
    return true;
  } catch (e) {
    console.error('auth init error', e);
    printError('Auth initialization failed: ' + e.message);
    authStatusEl.textContent = 'auth error';
    return false;
  }
}

async function apiCall(method, path, body = null) {
  if (!accessToken) throw new Error('No access token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };
  const res = await fetch(`/api/combat${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}



function turnPromptFromState(stateObj) {
  const s = stateObj && stateObj.state ? stateObj.state : stateObj;
  if (!s) {
    printAmber('Ready — what do you do?');
    return;
  }
  if (s.player_dead) {
    printAmber('You have been defeated.');
    return;
  }
  if (s.battle_over) {
    printGreen('The battle is over. The crowd roars.');
    showAfterBattleOffer(s);
    return;
  }
  const parts = s.participants || {};
  const player = parts.player || {};
  const hands = player.hands || {};
  // PC-52r: empty hands still act — Fist (unarmed) attack is always available
  const lhEmpty = !hands.LH || hands.LH.weaponId == null;
  const rhEmpty = !hands.RH || hands.RH.weaponId == null;
  if (lhEmpty && rhEmpty) {
    printAmber('Fist (unarmed) ready — PC-52r'); // commit via: attack LH 1 (backend applies Fist profile on empty hand)
    return;
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


function printStateFromRun(run) {
  if (!run) {
    appendLine('No active run.', 'amber');
    return;
  }
  const bs = run.battle_state || {};
  const weapons = bs.weapons || {};
  const fmtAttacks = (list) => (list || []).map(a =>
    `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}${ (a.prepare_time_range||0) > 0 ? '-' + (a.prepare_time + (a.prepare_time_range||0)) : '' }/c${a.cooldown_time}${ (a.cooldown_time_range||0) > 0 ? '-' + (a.cooldown_time + (a.cooldown_time_range||0)) : '' }`
  ).join(' | ') || 'none';

  const lines = [
    `RUN #${run.id} status=${run.status} battle ${run.current_battle}/${run.total_battles}`,
    `player_hp: ${run.player_hp}  tic: ${bs.tic || 0}`
  ];
  const d = bs.dice;
  if (d) {
    const fmtC = (o) => `G${o.green ?? 0} Y${o.yellow ?? 0} R${o.red ?? 0}`;
    const cur = d.current
      ? `current: ${d.current.color} die face=${d.current.face} budget=${d.current.rolled_value}`
      : 'current: — (no die drawn this battle yet)';
    lines.push(`dice remaining: ${fmtC(d.remaining)}  used: ${fmtC(d.used)}  ${cur}`);
  } else {
    lines.push('dice: none');
  }
  for (const [hand, key] of [['LH', 'hand_l'], ['RH', 'hand_r'], ['BL', 'belt']]) {
    const w = weapons[key];
    if (w) {
      lines.push(`${hand} #${w.id} ${w.name} dmg=${w.damage} spd=${w.speed} acc=${w.accuracy} crit=${w.crit_chance ?? 5}`);
      lines.push(`    attacks: ${fmtAttacks(w.attacks)}`);
    } else {
      lines.push(`${hand} — no weapon`);
    }
  }
  const mons = bs.monsters || [];
  if (mons.length) {
    lines.push('monsters:');
    for (const m of mons) {
      const letter = letterOf(m.label);
      const deadMark = m.dead ? ' (dead)' : '';
      lines.push(`  ${m.name || m.label}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Healthy'}${deadMark}`);
      lines.push(`      attacks: ${fmtAttacks(m.attacks)}`);
    }
  } else {
    lines.push('monsters: none');
  }
  const queueLine = (bs.queue || []).slice(0, 4).map(q => {
    const monLabel = monsterQueueLabel(q, bs.monsters);
    if (monLabel) return `${q.tics ?? 0} - ${monLabel}`;
    return `${q.tics ?? 0} - ${q.label || '?'}: ${QUEUE_ACTION_LABELS[q.event] || (q.event ? q.event[0].toUpperCase() + q.event.slice(1) : '?')}`;
  }).join(' | ');
  lines.push(`queue: ${queueLine || 'empty'}`);
  lines.push(`feed: ${(bs.feed || []).slice(-3).join(' | ') || '—'}`);
  appendLines(lines, 'green');
  // Update side panels with real battle_state data (right column uses dice/queue, left uses monsters/player)
  updateSidePanelsFromRun(run);
}

async function cmdHelp() {
  appendLines([
    'Available commands:',
    '  help                 — this list',
    '  state                — show current run state (from API)',
    '  status               — alias for state',
    '  run new              — create new portal_run (default template 1)',
    '  run                  — show current run summary',
    '  battle start         — start next battle on current run',
    '  attack <LH|RH> <attack_id> [target_id ...]  — commit attack (targets default to first live monster)',
    '  menu [LH|RH]         — Dragon-Warrior combat menu: attack→target→confirm, \'>\' timing markers, potions, belt swap',
    '  swap <LH|RH>         — mid-battle belt swap (alias: bl)',
    '  battle end <continue|stop> — end current battle',
    '  use A|B              — drink potion in slot A or B (alias: drink)',
    '  inventory            — everything assigned to you (weapons; consumables when they exist)',
    '  grant                — admin dev: unlock dev tools (403 if not admin)',
    '  inspect [id]         — monster template info (bare lists ids)',
    '  clear                — clear terminal output',
    '',
    'Notes: run id auto-saved to localStorage. Unknown cmd shows error. State printed after mutations.'
  ], 'dim');
  if (devMode) {
    appendLines([
      '',
      'Dev tools (slash commands):',
      '  /equip [LH|RH|belt] [#N]       — equip instance #N (from inventory) or random into slot',
      '  /roll weapon <id> [LH|RH|belt] — spawn a specific weapon template',
      '  /roll monster <id>             — spawn a specific monster template (adds to battle)',
      '  /del monster <label|id>        — remove a monster from the battle',
      '  /list weapons|monsters         — list owned weapons / battle monsters',
      '  /set hp <player|monster> <n>   — set hit points',
      '  /win battle                    — force-win the current battle',
      '  /kill player                   — kill the player',
      '  /nuke                          — clear all monsters from battle_state',
      '  /list templates                — show all weapon + monster template ids',
      '  /abandon run                   — abandon current active run',
      '  /give weapon <user> <template_id> [count] — roll+grant weapons to a player',
      '  /give sss <user>                    — grant starter SSS (idempotent)',
      '  /list users                         — list accounts for targeting',
      '  /set weapon <id> [dmg N] [spd N] [acc N] [crit N] — overwrite any weapon instance stats (grade recomputed)',
      '  /set potion <id> [floor N] [window N] [spd N] [crit N] — overwrite any potion instance stats (grade recomputed)',
      '  /list weapons|potions [username]  — list instances (admin: any user, or all)'
    ], 'dim');
  }
}

async function cmdState() {
  if (!currentRunId) {
    appendLine('No current run id. Use \"run new\" first.', 'amber');
    return;
  }
  try {
    const data = await apiCall('GET', `/runs/${currentRunId}`);
    printStateFromRun(data.run);
  } catch (e) {
    printError('state fetch: ' + e.message);
  }
}

async function promptUser(question) {
  appendLine(question, 'amber');
  return new Promise(resolve => {
    pendingInputResolver = resolve;
  });
}

async function cmdRunNew() {
  // Re-entry from any gate phase always lands back at the preamble, so
  // 'ready' works no matter when 'run new' is typed.
  flowState = 'preamble';
  pendingPicks = { lh: null, rh: null, belt: null, ca: null, cb: null };
  blankActionQueue();
  appendLine(buildPreambleText());
}

async function cmdReady() {
  if (flowState !== 'preamble') {
    appendLine(buildPreambleDenied());
    return;
  }
  // NEW: ready shows current pendingPicks recap (no interactive picks loop); belt/consume stay empty
  try {
    let wData = { weapons: [] };
    let cData = { consumables: [] };
    try { wData = await apiCall('GET', '/weapons'); } catch (_) {}
    try { cData = await apiCall('GET', '/consumables'); } catch (_) {}
    if (!pendingPicks) pendingPicks = { lh: null, rh: null, belt: null, ca: null, cb: null };
    appendLine(buildRecapText(wData.weapons || [], cData.consumables || [], pendingPicks));
    flowState = 'confirm';
  } catch (e) {
    printError('ready: ' + e.message);
  }
}

async function cmdConfirm() {
  if (flowState !== 'confirm' || !pendingPicks) {
    if (!flowState) {
      appendLine('Type "run new" to begin.');
    } else {
      appendLine(buildConfirmDenied());
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
    currentRunId = data.run.id;
    localStorage.setItem('cli_current_run_id', currentRunId);
    appendLine('The portal pulls you through.');
    printGreen(`Created run #${currentRunId}`);

    // render dice + budget + battle-1 monsters (from response or run)
    // fetch full state — POST response is thin (participants only, no dice/hp_word)
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
      const cur = d.current
        ? `current: ${d.current.color} die face=${d.current.face} budget=${d.current.rolled_value}`
        : 'current: —';
      appendLine(`dice remaining: ${fmtC(d.remaining || {})}  used: ${fmtC(d.used || {})}  ${cur}`, 'green');
    }
    const mons = bs.monsters || [];
    if (mons.length) {
      appendLine('battle-1 monsters:', 'dim');
      mons.forEach(m => {
        const deadMark = m.dead ? ' (dead)' : '';
        const letter = letterOf(m.label);
        printGreen(`monster ${m.name || m.label}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Healthy'}${deadMark}`);
      });
    } else {
      appendLine('battle-1 monsters: (none — see state)', 'dim');
    }
    appendLine('Type "battle start" to begin.');
    flowState = null;
    pendingPicks = null;
    offeredBattleNum = null;
    await refreshRunPanels();
  } catch (e) {
    if (e.message && e.message.includes('You already have an active run')) {
      appendLine('You already have an active run. End it before starting a new one.', 'amber');
    } else {
      printError('confirm: ' + e.message);
    }
  }
}

async function cmdRun() {
  if (!currentRunId) {
    appendLine('No current run.', 'amber');
    return;
  }
  try {
    const data = await apiCall('GET', `/runs/${currentRunId}`);
    const r = data.run;
    appendLine(`run #${r.id} status=${r.status} battle ${r.current_battle}/${r.total_battles} hp=${r.player_hp}`, 'green');
  } catch (e) {
    printError('run: ' + e.message);
  }
}

async function cmdBattleStart() {
  if (!currentRunId) { printError('no run'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/battle/start`, {});
    printGreen('Battle started');
    if (data.feed) {
      narrateFeed(data.feed, data.participants);
    }
    turnPromptFromState(data);
  } catch (e) {
    if (e.message.includes('Battle already in progress')) {
      printAmber('Battle already in progress — printing current state');
      await cmdState();
    } else {
      printError('battle start: ' + e.message);
    }
  }
}

async function cmdAttack(args) {
  if (!currentRunId) { printError('no run'); return; }
  if (args.length < 2) { printError('usage: attack LH|RH attack_id [target_ids...]'); return; }
  const hand = args[0].toUpperCase();
  const attackId = parseInt(args[1], 10);
  let targets = args.slice(2).map(Number).filter(n => !isNaN(n));
  if (!['LH', 'RH'].includes(hand) || isNaN(attackId)) {
    printError('invalid hand or attack_id');
    return;
  }
  // if no targets, state fetch to pick first live monster (best effort)
  if (targets.length === 0) {
    try {
      const st = await apiCall('GET', `/runs/${currentRunId}`);
      const mons = (st.run.battle_state?.monsters || []).filter(m => (m.current_hp || 0) > 0);
      if (mons.length) targets = [mons[0].id];
    } catch (_) {}
  }
  try {
    const payload = { hand, attack_id: attackId, target_ids: targets };
    const data = await apiCall('POST', `/runs/${currentRunId}/commit`, payload);
    printGreen(`Attack ${hand} #${attackId} → ${targets.length ? targets.join(',') : 'auto'}`);
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    turnPromptFromState(data.state || data);
  } catch (e) {
    printError('attack: ' + e.message);
  }
}

// PC-56: Dragon-Warrior-style interactive combat menu (per-hand rows, letter
// labels, '>' timing markers, attack→target→confirm, potion + BL rows).
async function cmdMenu(args = []) {
  if (!currentRunId) { printError('no run'); return; }
  let hand = String(args[0] || 'LH').toUpperCase();
  if (hand !== 'LH' && hand !== 'RH') { printError('usage: menu [LH|RH]'); return; }

  const data = await apiCall('GET', `/runs/${currentRunId}`);
  const run = data.run || data;
  const bs = run.battle_state || {};
  const weapons = bs.weapons || {};
  const monsters = (bs.monsters || []).filter(m => !m.dead && (m.current_hp || m.hp || 0) > 0);

  appendLine(`RUN #${run.id} battle ${run.current_battle}/${run.total_battles}  tic ${bs.tic || 0}`, 'dim');
  appendLine(`player_hp: ${run.player_hp}`, 'dim');

  const buildRows = (h) => {
    const wKey = h === 'LH' ? 'hand_l' : 'hand_r';
    const w = weapons[wKey];
    const rows = [];
    let letter = 97;
    if (w && w.id) {
      for (const a of (w && w.attacks) || []) rows.push({ kind: 'attack', attack: a, letter: String.fromCharCode(letter++) });
    } else {
      // PC-52r parity with the GUI cascade: an empty hand always acts via the
      // Fist profile the API attaches to battle_state.weapons.fist; degrade to
      // the GUI's hardcoded fallback (attack id 1, engine default timings) if
      // the server omitted it.
      const fistW = weapons.fist;
      const fist = (fistW && fistW.attacks && fistW.attacks[0]) ||
        { id: 1, name: 'Fist (unarmed)', is_multi_target: false, prepare_time: 3, cooldown_time: 2, description: '' };
      rows.push({ kind: 'attack', attack: fist, letter: String.fromCharCode(letter++) });
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
    appendLine('');
    appendLine(`${hand} — ${w ? `${w.name} (spd ${w.speed})` : 'no weapon'}`, 'green');
    for (const r of buildRows(hand)) {
      if (r.kind === 'attack') {
        const p = `${r.attack.prepare_time}${r.attack.prepare_time_range ? '-' + (r.attack.prepare_time + r.attack.prepare_time_range) : ''}`;
        const c = `${r.attack.cooldown_time}${r.attack.cooldown_time_range ? '-' + (r.attack.cooldown_time + r.attack.cooldown_time_range) : ''}`;
        appendLine(`  ${r.letter}) ${r.attack.name} (p${p}/c${c})`);
      } else if (r.kind === 'bl') {
        const belt = weapons.belt;
        appendLine(`  ${r.letter}) BL: ${belt ? `${belt.name} (spd ${belt.speed})` : 'no belt weapon'}`);
      } else if (r.kind === 'c1') {
        const p = bs.potions && (bs.potions.potion_a || bs.potions.A);
        appendLine(`  ${r.letter}) C1: ${p ? (p.template_name || 'Potion') : 'no potion'}`);
      } else {
        const p = bs.potions && (bs.potions.potion_b || bs.potions.B);
        appendLine(`  ${r.letter}) C2: ${p ? (p.template_name || 'Potion') : 'no potion'}`);
      }
    }
    appendLine(`  ${hand === 'LH' ? 'r' : 'l'}) switch hand   q) quit`, 'dim');

    const pick = (await promptUser(`menu ${hand}> `)).toLowerCase();
    if (pick === 'q') { appendLine('menu closed', 'amber'); return; }
    if (pick === 'l') { hand = 'LH'; continue; }
    if (pick === 'r') { hand = 'RH'; continue; }

    const row = buildRows(hand).find(r => r.letter === pick);
    if (!row) { appendLine(`unknown pick: ${pick}`, 'amber'); continue; }

    if (row.kind === 'attack') {
      // '>' timing markers on the queue panel for this attack (approved mockup semantics)
      setMenuAttack({ attack: row.attack, queue: bs.queue || [], weaponSpeed: (weapons[hand === 'LH' ? 'hand_l' : 'hand_r']?.speed) || 0 });
      try { await refreshRunPanels(); } catch (_) {}
      let targets = [];
      if (row.attack && row.attack.is_multi_target) {
        // multi-target attacks hit ALL live monsters (engine: pass every live id, damage splits)
        targets = monsters.filter(m => (m.current_hp ?? 1) > 0).map(m => m.id);
      } else if (monsters.length > 0) {
        const pickT = (await promptUser(`target ${hand} ${row.attack.name} (${monsters.map((m, i) => String.fromCharCode(97 + i)).join('')} or auto)> `)).toLowerCase();
        if (pickT === 'auto' || pickT === '') {
          targets = [];
        } else {
          const m = monsters[pickT.charCodeAt(0) - 97];
          if (!m) { appendLine('unknown target', 'amber'); continue; }
          targets = [m.id];
        }
      }
      const ok = (await promptUser(`commit ${hand} ${row.attack.name}${targets.length ? '' : ' (auto)'}? y/n> `)).toLowerCase();
      if (ok !== 'y') { appendLine('cancelled', 'amber'); continue; }
      setMenuAttack(null);
      try { await refreshRunPanels(); } catch (_) {}
      return runCommit(run, hand, row.attack, targets);
    }

    if (row.kind === 'bl') {
      const ok = (await promptUser(`swap ${hand} with belt? y/n> `)).toLowerCase();
      if (ok !== 'y') { appendLine('cancelled', 'amber'); continue; }
      return cmdSwap([hand]);
    }

    const slot = row.kind === 'c1' ? 'A' : 'B';
    const potion = bs.potions && (row.kind === 'c1' ? (bs.potions.potion_a || bs.potions.A) : (bs.potions.potion_b || bs.potions.B));
    if (!potion) { appendLine('no potion in slot ' + slot, 'amber'); continue; }
    // PC-56: prediction bar markers for potion timing
    const ws = (weapons[hand === 'LH' ? 'hand_l' : 'hand_r']?.speed) || 0;
    setMenuAttack({ attack: { prepare_time: potionPrePostTicks(ws, potion.rolled_speed || 0), prepare_time_range: 0 }, queue: bs.queue || [], weaponSpeed: 0 });
    try { await refreshRunPanels(); } catch (_) {}
    const ok = (await promptUser(`use potion ${slot}? y/n> `)).toLowerCase();
    if (ok !== 'y') { appendLine('cancelled', 'amber'); continue; }
    try {
      const res = await apiCall('POST', `/runs/${currentRunId}/use-potion`, { slot });
      const feedSrc = res.state && res.state.feed ? res.state : res;
      if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
      if (res.potion_used) {
        const hp = res.state && res.state.participants && res.state.participants.player ? res.state.participants.player.hp : null;
        appendLine(hp ? `Potion ${slot} used — HP ${hp}` : `Potion ${slot} used`, 'green');
      }
      turnPromptFromState(res.state || res);
    } catch (e) {
      printError('use: ' + e.message);
    }
    return;
  }
}

async function runCommit(run, hand, attack, targets) {
  try {
    const payload = { hand, attack_id: attack.id, target_ids: targets };
    const data = await apiCall('POST', `/runs/${currentRunId}/commit`, payload);
    printGreen(`Attack ${hand} #${attack.id} → ${targets.length ? targets.join(',') : 'auto'}`);
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    turnPromptFromState(data.state || data);
  } catch (e) {
    printError('attack: ' + e.message);
  }
}

// PC-54: mid-battle belt swap. 'swap LH|RH' or 'bl LH|RH'.
async function cmdSwap(args = []) {
  if (!currentRunId) { printError('no run'); return; }
  const hand = String(args[0] || '').toUpperCase();
  if (hand !== 'LH' && hand !== 'RH') { printError('usage: swap LH|RH'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/swap`, { hand });
    printGreen(`Belt swap (${hand}) — ${data.delay ?? '?'} tics cooldown`);
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    turnPromptFromState(data.state || data);
  } catch (e) {
    printError('swap: ' + e.message);
  }
}

async function cmdUsePotion(args) {
  if (!currentRunId) { printError('no run'); return; }
  let slot = String(args[0] || '').trim();
  if (slot.toLowerCase() === 'potion') slot = String(args[1] || '').trim();
  slot = slot.toUpperCase();
  if (slot !== 'A' && slot !== 'B') { printError('usage: use A|B  (alias: drink A|B)'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/use-potion`, { slot });
    const feedSrc = data.state && data.state.feed ? data.state : data;
    if (feedSrc.feed) narrateFeed(feedSrc.feed, feedSrc.participants);
    if (data.potion_used) {
      const hp = data.state && data.state.participants && data.state.participants.player
        ? data.state.participants.player.hp : null;
      const hpPart = hp != null ? `HP: ${hp}` : '';
      appendLine(`Potion ${slot} used (${data.phase === 'in-battle' ? 'in battle' : 'between fights'}). ${hpPart}`.trim(), 'green');
    }
    turnPromptFromState(data.state || data);
  } catch (e) {
    printError('use: ' + e.message);
  }
}

async function cmdBattleEnd(args) {
  if (!currentRunId) { printError('no run'); return; }
  const choice = (args[0] || '').toLowerCase();
  if (!['continue', 'stop'].includes(choice)) { printError('usage: battle end continue|stop'); return; }
  try {
    const data = await apiCall('POST', `/runs/${currentRunId}/battle/end`, { choice });
    if (choice === 'continue') {
      appendLine('The next fight begins.');
      const mons = (data.battle_state && (data.battle_state.participants || {}).monsters) || (data.battle_state && data.battle_state.monsters) || [];
      if (mons.length) appendLine(`battle-${data.current_battle || 1} monsters:`, 'dim');
      mons.forEach(m => {
        const letter = letterOf(m.label);
        printGreen(`monster ${m.name || m.label}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Healthy'}`);
      });
      if (data.prize_pool) {
        const pp = data.prize_pool;
        appendLine(`Loot this fight: ${pp.weapon_ids?.length || 0} items, ${pp.gold || 0}g (LP ${pp.lp_earned || 0})`, 'dim');
      }
    } else if (choice === 'stop') {
      appendLine('You step back through the portal. The prize is yours — for now.');
      if (data.awarded_pool) {
        const ap = data.awarded_pool;
        appendLine(`Awarded: ${ap.weapon_ids?.length || 0} weapons, ${ap.gold || 0}g (LP ${ap.lp_earned || 0})`, 'dim');
      }
      if (data.prize_pool) {
        const pp = data.prize_pool;
        const forfeited = (pp.weapon_ids || []).length - ((data.awarded_pool && data.awarded_pool.weapon_ids) || []).length;
        appendLine(`Forfeited: ~${Math.max(0, forfeited)} weapons`, 'dim');
      }
    }
    printGreen(`Battle ended: ${data.status} battle ${data.current_battle}`);
    await cmdState();
  } catch (e) {
    printError('battle end: ' + e.message);
  }
}



function cmdClear() {
  outputEl.innerHTML = '';
  localStorage.removeItem('cli_dev_mode');
}

function handleCommand(line) {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (!cmd) return;

  // Slash commands = dev tools (verb-first, git-style); gated on grant
  if (line.trim().startsWith('/')) {
    // /inventory is a player command, not a dev tool — tolerated ungated as a convenience alias
    if (cmd === '/inventory') { cmdInventory(); return; }
    if (!devMode) { appendLine('Dev tools locked — type grant', 'amber'); return; }
    const fn = DEV_COMMANDS[cmd];
    if (!fn) { appendLine('unknown dev command — type help', 'amber'); return; }
    fn(args);
    return;
  }

  // PC-36 run-start gate: only the preamble's listed commands work (plus the
  // gate's own confirm/ready transitions — handlers validate their phase);
  // 'run new' re-prints the preamble, everything else gets the neutral denial.
  if (flowState === 'preamble' || flowState === 'confirm') {
    const gateAllowed = ['inventory', 'gear', 'inspect', 'ready', 'help', 'confirm', 'equip', 'cancel'];
    if (cmd === 'run' && args[0] === 'new') { cmdRunNew(); return; }
    if (!gateAllowed.includes(cmd)) { appendLine(buildPreambleDenied()); return; }
  }

  switch (cmd) {
    case 'help': cmdHelp(); break;
    case 'state': cmdState(); break;
    case 'status': cmdState(); break;  // alias — users expect 'status'
    case 'run':
      if (args[0] === 'new') cmdRunNew();
      else cmdRun();
      break;
    case 'battle':
      if (args[0] === 'start') cmdBattleStart();
      else if (args[0] === 'end') cmdBattleEnd(args.slice(1));
      else printError('unknown battle subcommand');
      break;
    case 'attack': cmdAttack(args); break;
    case 'menu': cmdMenu(args); break;
    case 'swap':
    case 'bl': cmdSwap(args); break;
    case 'use':
    case 'drink': cmdUsePotion(args); break;
    case 'inventory':
    case 'gear': cmdInventory(); break;
    case 'grant': cmdGrant(); break;
    case 'inspect': cmdInspect(args); break;
    case 'clear': cmdClear(); break;
    case 'ready': cmdReady(); break;
    case 'confirm': cmdConfirm(); break;
    case 'equip': cmdEquip(args); break;
    case 'cancel': cmdCancel(); break;
    case 'continue':
    case 'stop':
      cmdBattleEnd([cmd]);
      break;
    default:
      appendLine('unknown command — type help', 'amber');
  }
}

async function main() {
  const ok = await initAuth();
  if (!ok) return;

  appendLine('CLI harness ready. Type \"help\" for commands. State auto-prints after mutations.', 'dim');
  if (currentRunId) {
    await cmdState();
  }

  inputEl.addEventListener('keydown', async (e) => {
    // TASK2: Escape toggles UX select mode on player stats slots (only when not in pending resolver)
    if (e.key === 'Escape' && !pendingInputResolver) {
      e.preventDefault();
      if (!isSelectMode()) {
        enterSelectMode();
      } else {
        exitSelectMode();
      }
      return;
    }
    if (isSelectMode()) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        nudgeSelect(dir);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        showItemDetailForCurrent();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        return;
      }
      // other keys exit select mode and let normal handling (but only escape is special per spec)
      exitSelectMode();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      commandHistory.onArrowUp(inputEl);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      commandHistory.onArrowDown(inputEl);
    } else if (e.key === 'Enter') {
      const val = inputEl.value.trim();
      if (pendingInputResolver) {
        const resolve = pendingInputResolver;
        pendingInputResolver = null;
        if (val) {
          appendLine('> ' + val, 'dim');
          inputEl.value = '';
          commandHistory.resetBrowse();
          commandHistory.push(val);
        } else {
          inputEl.value = '';
        }
        resolve(val);
        return;
      }
      if (!val) return;
      appendLine('> ' + val, 'dim');
      inputEl.value = '';
      commandHistory.resetBrowse();
      commandHistory.push(val);
      handleCommand(val);
    }
  });

  setupPanelNavigation(inputEl);
  // focus input
  setTimeout(() => inputEl.focus(), 100);
}

main().catch(e => {
  console.error(e);
  printError('Fatal: ' + e.message);
});


/**
 * Re-fetch the current run and refresh all 6 side panels from authoritative API state.
 * Safe no-op if no currentRunId. On error: dim warning only, never throw.
 */
async function refreshRunPanels() {
  if (!currentRunId) return;
  try {
    const data = await apiCall('GET', `/runs/${currentRunId}`);
    updateSidePanelsFromRun(data.run);
  } catch (e) {
    printDim('panel refresh warning: ' + e.message);
  }
}




async function cmdEquip(args) {
  if (flowState !== 'preamble' && flowState !== 'confirm') {
    appendLine(buildPreambleDenied());
    return;
  }
  if (!args || args.length < 2) {
    appendLine('usage: equip LH|RH <id>');
    return;
  }
  const hand = (args[0] || '').toUpperCase();
  const idStr = args[1];
  if (hand !== 'LH' && hand !== 'RH') {
    appendLine('usage: equip LH|RH <id>');
    return;
  }
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    appendLine('usage: equip LH|RH <id>');
    return;
  }
  try {
    const wData = await apiCall('GET', '/weapons');
    const weapons = wData.weapons || [];
    const w = weapons.find(ww => ww.id === id);
    if (!w) {
      appendLine(`#${id} not found — type "inventory" to list your gear.`);
      return;
    }
    if (!pendingPicks) pendingPicks = { lh: null, rh: null, belt: null, ca: null, cb: null };
    if (hand === 'LH') pendingPicks.lh = id;
    else pendingPicks.rh = id;
    const slotName = hand === 'LH' ? 'Left Hand' : 'Right Hand';
    appendLine(`${slotName}: #${w.id} ${w.name} (${w.damage} dmg)`);
  } catch (e) {
    printError('equip: ' + e.message);
  }
}


function cmdCancel() {
  // Exit the run-start gate without creating a run (Spahrep 2026-09-13).
  // Restores the run panels so a mid-run player lands back where they were.
  if (flowState !== 'preamble' && flowState !== 'confirm') {
    appendLine('Nothing to cancel.');
    return;
  }
  flowState = null;
  pendingPicks = null;
  appendLine('Run preparation cancelled.');
  if (currentRunId) refreshRunPanels();
}

