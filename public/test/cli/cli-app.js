/**
 * cli-app.js — CLI dev/test harness for live combat API
 * Terminal UI matching gui2 aesthetics (near-black, Pixeloid Mono, green/amber, thin amber border)
 * Auth: /api/env.js + Supabase PKCE localStorage pattern from game.html
 * Commands: help/state/run new/run/battle start/attack/battle end/inventory/grant/clear
 * Always prints compact current state after state-changing commands
 */

const outputEl = document.getElementById('output');
const inputEl = document.getElementById('input');
const authStatusEl = document.getElementById('auth-status');

// Side panel elements (retro 3-col layout)
const playerStatsContent = document.getElementById('player-stats-content');
const monsterRosterContent = document.getElementById('monster-roster-content');
const runLootContent = document.getElementById('run-loot-content');
const actionQueueContent = document.getElementById('action-queue-content');
const diceLeftContent = document.getElementById('dice-left-content');
const diceRolledContent = document.getElementById('dice-rolled-content');

let supabase = null;
let currentUser = null;
let currentRunId = localStorage.getItem('cli_current_run_id') || null;
let accessToken = null;
let devMode = false;
let pendingInputResolver = null;

// Command history for ArrowUp/ArrowDown (terminal-style recall), capped at 5.
const HISTORY_KEY = 'cli_command_history';
const HISTORY_MAX = 5;
let history = [];
try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { history = []; }
let historyIdx = -1;      // -1 = not browsing history (fresh line)
let historyDraft = '';    // preserves the in-progress line while browsing

// Panel navigation (PC-20)
const PANEL_IDS = [
  'player-stats-panel',
  'monster-roster-panel',
  'run-loot-panel',
  'action-queue-panel',
  'dice-left-panel',
  'dice-rolled-panel'
];
let focusedPanelIdx = -1;
let infoPopEl = null;

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

// Record a completed command into history (most recent first), capped at HISTORY_MAX.
function pushHistory(cmd) {
  history = [cmd, ...history.filter(h => h !== cmd)].slice(0, HISTORY_MAX);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
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

function printStateFromRun(run) {
  if (!run) {
    appendLine('No active run.', 'amber');
    return;
  }
  const bs = run.battle_state || {};
  const weapons = bs.weapons || {};
  const fmtAttacks = (list) => (list || []).map(a =>
    `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`
  ).join(' | ') || 'none';
  const letterOf = (label) => (label && /[A-Z]$/.test(label)) ? label.slice(-1) : '';

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
      lines.push(`${hand} #${w.id} ${w.name} dmg=${w.damage} spd=${w.speed} acc=${w.accuracy}`);
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
      lines.push(`  ${m.name}${letter ? ' ' + letter : ''}  (#${m.id} ${m.hp_word}) dmg=${m.damage} spd=${m.speed} acc=${m.accuracy}`);
      lines.push(`      attacks: ${fmtAttacks(m.attacks)}`);
    }
  } else {
    lines.push('monsters: none');
  }
  lines.push(`queue: ${(bs.queue || []).slice(0, 4).map(q => `${q.label || ''}@${q.tics ?? 0}${q.event ? ':' + q.event : ''}`).join(' ') || 'empty'}`);
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
    '  battle end <continue|stop> — end current battle',
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
      '  /abandon run                   — abandon current active run'
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
  try {
    // fetch current inventory for loadout choice
    let wData = { weapons: [] };
    let cData = { consumables: [] };
    try { wData = await apiCall('GET', '/weapons'); } catch (_) {}
    try { cData = await apiCall('GET', '/consumables'); } catch (_) {}

    appendLine('=== Loadout for new run (weapons + consumables) ===', 'dim');
    appendLine('weapons:', 'dim');
    (wData.weapons || []).forEach(w => {
      const atkList = w.attacks.map(a => `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`).join(' ');
      appendLine(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`, 'green');
    });
    appendLine('consumables:', 'dim');
    if (!cData.consumables || cData.consumables.length === 0) {
      appendLine('  (consumables on hold)', 'dim');
    } else {
      cData.consumables.forEach(c => {
        appendLine(`#${c.id} ${c.name} qty=${c.quantity ?? 1}`, 'green');
      });
    }

    const getId = async (label, allowEmpty = true) => {
      while (true) {
        const ans = (await promptUser(`${label} (id${allowEmpty ? ' or empty to skip' : ''}, 'inventory' to re-list):`)).trim();
        if (ans.toLowerCase() === 'inventory') {
          // re-list
          appendLine('weapons:', 'dim');
          (wData.weapons || []).forEach(w => {
            const atkList = w.attacks.map(a => `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`).join(' ');
            appendLine(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`, 'green');
          });
          appendLine('consumables:', 'dim');
          (cData.consumables || []).forEach(c => appendLine(`#${c.id} ${c.name} qty=${c.quantity ?? 1}`, 'green'));
          continue;
        }
        if (!ans && allowEmpty) return null;
        const m = ans.match(/(\d+)\s*$/);
        if (m) {
          const id = parseInt(m[1], 10);
          if (Number.isFinite(id)) return id;
        }
        printAmber('invalid id, try again');
      }
    };

    const lh = await getId('LH');
    const rh = await getId('RH');
    const belt = await getId('Belt');
    const ca = await getId('Consume A', true);
    const cb = await getId('Consume B', true);

    const payload = { portal_template_id: 1 };
    if (lh != null) payload.hand_l_weapon_id = lh;
    if (rh != null) payload.hand_r_weapon_id = rh;
    if (belt != null) payload.belt_weapon_id = belt;
    if (ca != null) payload.consume_a = ca;
    if (cb != null) payload.consume_b = cb;

    const data = await apiCall('POST', '/runs', payload);
    currentRunId = data.run.id;
    localStorage.setItem('cli_current_run_id', currentRunId);
    printGreen(`Created run #${currentRunId}`);

    // render dice + budget + battle-1 monsters (from response or run)
    const run = data.run;
    const bs = run.battle_state || {};
    const d = bs.dice || {};
    if (d.remaining || d.current) {
      const fmtC = (o) => `G${o.green ?? 0} Y${o.yellow ?? 0} R${o.red ?? 0}`;
      const cur = d.current
        ? `current: ${d.current.color} die face=${d.current.face} budget=${d.current.rolled_value}`
        : 'current: —';
      appendLine(`dice remaining: ${fmtC(d.remaining || {})}  used: ${fmtC(d.used || {})}  ${cur}`, 'green');
    }
    // monsters: prefer participants if returned by POST, else battle_state
    const mons = (data.participants || bs.monsters || []);
    if (mons.length) {
      appendLine('battle-1 monsters:', 'dim');
      mons.forEach(m => {
        printGreen(`monster ${m.label} hp ${m.current_hp ?? m.max_hp}/${m.max_hp} dmg ${m.damage} spd ${m.speed} acc ${m.accuracy}`);
      });
    } else {
      appendLine('battle-1 monsters: (none or see state)', 'dim');
    }
    await refreshRunPanels();
  } catch (e) {
    printError('run new: ' + e.message);
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
    appendLine(JSON.stringify(data, null, 2), 'dim');
    await cmdState();
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
    if (data.advanced) printAmber(' (hand was busy — advanced)');
    appendLine('response: ' + JSON.stringify(data.state || data, null, 0), 'dim');
    await cmdState();
  } catch (e) {
    printError('attack: ' + e.message);
  }
}

async function cmdBattleEnd(args) {
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
        const atkList = w.attacks.map(a => `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`).join(' ');
        appendLine(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`, 'green');
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

async function cmdGrant() {
  try {
    const data = await apiCall('POST', '/dev/grant', {});
    if (data.dev_mode === true) {
      devMode = true;
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

function cmdClear() {
  outputEl.innerHTML = '';
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
    case 'inventory':
    case 'gear': cmdInventory(); break;
    case 'grant': cmdGrant(); break;
    case 'inspect': cmdInspect(args); break;
    case 'clear': cmdClear(); break;
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
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIdx === -1) historyDraft = inputEl.value;   // save the line being edited
      historyIdx = Math.min(historyIdx + 1, history.length - 1);
      inputEl.value = history[historyIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      historyIdx -= 1;
      inputEl.value = historyIdx >= 0 ? history[historyIdx] : historyDraft;
      if (historyIdx === -1) historyDraft = '';
    } else if (e.key === 'Enter') {
      const val = inputEl.value.trim();
      if (pendingInputResolver) {
        const resolve = pendingInputResolver;
        pendingInputResolver = null;
        if (val) {
          appendLine('> ' + val, 'dim');
          inputEl.value = '';
          historyIdx = -1;
          historyDraft = '';
          pushHistory(val);
        } else {
          inputEl.value = '';
        }
        resolve(val);
        return;
      }
      if (!val) return;
      appendLine('> ' + val, 'dim');
      inputEl.value = '';
      historyIdx = -1;
      historyDraft = '';
      pushHistory(val);
      handleCommand(val);
    }
  });

  setupPanelNavigation();
  // focus input
  setTimeout(() => inputEl.focus(), 100);
}

main().catch(e => {
  console.error(e);
  printError('Fatal: ' + e.message);
});

async function cmdDevEquip(args) {
  if (!currentRunId) { printError('no run — use run new first'); return; }
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
  if (!currentRunId) { printError('no run — use run new first'); return; }
  const sub = args[0];
  if (sub === 'weapon') {
    const template_id = parseInt(args[1], 10);
    if (!Number.isFinite(template_id)) { printError('usage: /roll weapon <id> [LH|RH|belt] | /roll monster <id>'); return; }
    let slot = args[2] ? args[2].toUpperCase() : 'LH';
    if (!['LH','RH','belt'].includes(slot)) slot = 'LH';
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
  if (!currentRunId) { printError('no run — use run new first'); return; }
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
  if (!currentRunId) { printError('no run — use run new first'); return; }
  if (args[0] !== 'hp') { printError('usage: /set hp <player|monster> <n>'); return; }
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
  if (!currentRunId) { printError('no run — use run new first'); return; }
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
  if (!currentRunId) { printError('no run — use run new first'); return; }
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
    try {
      const data = await apiCall('GET', '/weapons');
      if (!data.weapons || data.weapons.length === 0) {
        appendLine('No weapons owned.', 'amber');
        return;
      }
      data.weapons.forEach(w => {
        const atkList = w.attacks.map(a => `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`).join(' ');
        appendLine(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`, 'green');
      });
    } catch (e) {
      printError('list: ' + e.message);
    }
  } else if (sub === 'monsters') {
    if (!currentRunId) { appendLine('no active run', 'amber'); return; }
    try {
      const data = await apiCall('GET', `/runs/${currentRunId}`);
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
  } else {
    printError('usage: /list weapons|monsters');
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
  currentRunId = null;
  localStorage.removeItem('cli_current_run_id');
  printGreen(`run #${res.run_id} abandoned — use run new to start fresh`);
  await refreshRunPanels();
}

const DEV_COMMANDS = {
  '/equip': cmdDevEquip,
  '/roll': cmdDevRoll,
  '/del': cmdDevDel,
  '/list': cmdDevList,
  '/set': cmdDevSet,
  '/win': cmdDevWin,
  '/kill': cmdDevKill,
  '/nuke': cmdDevNuke,
  '/inspect': cmdInspect,
  '/abandon': cmdDevAbandonRun
};

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

function updateSidePanelsFromRun(run) {
  if (!run) return;
  const bs = run.battle_state || {};
  const weapons = bs.weapons || {};
  const mons = bs.monsters || [];
  const d = bs.dice || {};
  const queue = bs.queue || [];

  // LEFT: Player stats (HP + hands + placeholders for BL/C1/C2)
  if (playerStatsContent) {
    let html = `<div class="stat-line">HP: ${run.player_hp ?? '—'}</div>`;
    const lh = weapons.hand_l;
    html += `<div class="stat-line">LH: ${lh ? `#${lh.id} ${lh.name}` : '—'}</div>`;
    const rh = weapons.hand_r;
    html += `<div class="stat-line">RH: ${rh ? `#${rh.id} ${rh.name}` : '—'}</div>`;
    const bl = weapons.belt;
    html += `<div class="stat-line">BL: ${bl ? `#${bl.id} ${bl.name}` : '—'}</div>`;
    html += `<div class="stat-line">C1: —</div>`;
    html += `<div class="stat-line">C2: —</div>`;
    playerStatsContent.innerHTML = html;
  }

  // LEFT: Monster roster
  if (monsterRosterContent) {
    if (mons.length === 0) {
      monsterRosterContent.innerHTML = '<div class="dim">No monsters</div>';
    } else {
      let html = '';
      mons.forEach(m => {
        const letter = (m.label && /[A-Z]$/.test(m.label)) ? m.label.slice(-1) : '';
        const hp = m.current_hp ?? m.max_hp ?? '?';
        html += `<div class="monster">${m.name}${letter ? ' ' + letter : ''} #${m.id} hp ${hp}/${m.max_hp || '?'} dmg=${m.damage}</div>`;
      });
      monsterRosterContent.innerHTML = html;
    }
  }

  // LEFT: Run Loot (display only — no loot field in current state shape)
  if (runLootContent) {
    runLootContent.innerHTML = '<div class="dim">— (no loot data)</div>';
  }

  // RIGHT: Action/tic queue
  if (actionQueueContent) {
    if (queue.length === 0) {
      actionQueueContent.innerHTML = '<div class="dim">empty</div>';
    } else {
      let html = '';
      queue.slice(0, 8).forEach(q => {
        const label = q.label || '?';
        const tics = q.tics ?? 0;
        const ev = q.event ? ':' + q.event : '';
        html += `<div>${label}@${tics}${ev}</div>`;
      });
      actionQueueContent.innerHTML = html;
    }
  }

  // RIGHT: Dice Left (from battle_state.dice.remaining)
  if (diceLeftContent) {
    const fmt = (o) => `G${o?.green ?? 0} Y${o?.yellow ?? 0} R${o?.red ?? 0}`;
    const rem = d.remaining ? fmt(d.remaining) : 'G0 Y0 R0';
    diceLeftContent.innerHTML = `<div class="stat-line">${rem}</div>`;
    if (d.used) {
      diceLeftContent.innerHTML += `<div class="dim">used: ${fmt(d.used)}</div>`;
    }
  }

  // RIGHT: Dice rolled results (current + any feed info)
  if (diceRolledContent) {
    let html = '';
    if (d.current) {
      html += `<div>current: ${d.current.color} face=${d.current.face} val=${d.current.rolled_value}</div>`;
    } else {
      html += `<div class="dim">no die drawn yet</div>`;
    }
    if (bs.feed && bs.feed.length) {
      html += `<div class="amber">feed: ${bs.feed.slice(-2).join(' | ')}</div>`;
    }
    diceRolledContent.innerHTML = html || '<div class="dim">—</div>';
  }
}

// PC-20 panel navigation helpers
function getPanelElements() {
  return PANEL_IDS.map(id => document.getElementById(id)).filter(Boolean);
}

function clearPanelFocus() {
  getPanelElements().forEach(p => p.classList.remove('focused'));
  dismissInfoPop();
  focusedPanelIdx = -1;
}

function dismissInfoPop() {
  if (infoPopEl && infoPopEl.parentNode) {
    infoPopEl.parentNode.removeChild(infoPopEl);
  }
  infoPopEl = null;
}

function showInfoPop(panel) {
  dismissInfoPop();
  const titleEl = panel.querySelector('.panel-title, h3, .title') || panel.firstElementChild;
  const contentContainer = panel.querySelector('[id$="-content"]') || panel;
  const titleText = titleEl ? titleEl.textContent.trim() : panel.id.replace(/-/g, ' ').toUpperCase();
  const contentHTML = contentContainer ? contentContainer.innerHTML : '';

  infoPopEl = document.createElement('div');
  infoPopEl.id = 'info-pop';
  infoPopEl.innerHTML = `
    <div class="pop-title">${titleText}</div>
    <div class="pop-content">${contentHTML}</div>
  `;
  document.body.appendChild(infoPopEl);

  const rect = panel.getBoundingClientRect();
  let left = rect.right + 10;
  let top = rect.top - 4;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popW = 320;
  if (left + popW > vw) left = Math.max(8, rect.left - popW - 10);
  if (top + 220 > vh) top = Math.max(8, vh - 230);
  if (top < 8) top = 8;
  if (left < 8) left = 8;

  infoPopEl.style.left = `${left}px`;
  infoPopEl.style.top = `${top}px`;
}

function setFocusedPanel(idx) {
  const panels = getPanelElements();
  if (idx < 0 || idx >= panels.length) return;
  clearPanelFocus();
  const panel = panels[idx];
  panel.classList.add('focused');
  focusedPanelIdx = idx;
  showInfoPop(panel);
}

function setupPanelNavigation() {
  const input = inputEl;

  document.addEventListener('keydown', (e) => {
    if (document.activeElement === input) return; // history recall handled in input listener

    const panels = getPanelElements();
    if (panels.length === 0) return;

    if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }

    let idx = focusedPanelIdx;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (idx === -1) idx = 0;
      const col = Math.floor(idx / 3);
      const row = idx % 3;
      const newCol = (e.key === 'ArrowRight') ? 1 : 0;
      idx = newCol * 3 + row;
      if (idx >= panels.length) idx = panels.length - 1;
      setFocusedPanel(idx);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (idx === -1) idx = 0;
      const col = Math.floor(idx / 3);
      const row = idx % 3;
      let newRow = row + (e.key === 'ArrowDown' ? 1 : -1);
      if (newRow < 0) newRow = 2;
      if (newRow > 2) newRow = 0;
      idx = col * 3 + newRow;
      setFocusedPanel(idx);
    } else if (e.key === 'Enter' && focusedPanelIdx !== -1) {
      e.preventDefault();
      input.focus();
      clearPanelFocus();
    } else if (e.key === 'Escape' && focusedPanelIdx !== -1) {
      e.preventDefault();
      input.focus();
      clearPanelFocus();
    }
  });

  input.addEventListener('focus', () => {
    if (focusedPanelIdx !== -1) clearPanelFocus();
  });
}
