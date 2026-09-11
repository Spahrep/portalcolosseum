/**
 * cli-app.js — CLI dev/test harness for live combat API
 * Terminal UI matching gui2 aesthetics (near-black, Pixeloid Mono, green/amber, thin amber border)
 * Auth: /api/env.js + Supabase PKCE localStorage pattern from game.html
 * Commands: help/state/run new/run/battle start/attack/battle end/gear/grant/clear
 * Always prints compact current state after state-changing commands
 */

const outputEl = document.getElementById('output');
const inputEl = document.getElementById('input');
const authStatusEl = document.getElementById('auth-status');

let supabase = null;
let currentUser = null;
let currentRunId = localStorage.getItem('cli_current_run_id') || null;
let accessToken = null;

// Command history for ArrowUp/ArrowDown (terminal-style recall), capped at 5.
const HISTORY_KEY = 'cli_command_history';
const HISTORY_MAX = 5;
let history = [];
try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { history = []; }
let historyIdx = -1;      // -1 = not browsing history (fresh line)
let historyDraft = '';    // preserves the in-progress line while browsing

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
  const lines = [
    `RUN #${run.id} status=${run.status} battle ${run.current_battle}/${run.total_battles}`,
    `player_hp: ${run.player_hp}  tic: ${bs.tic || 0}`,
    `hands: LH=${run.hand_l_weapon_id || '—'} RH=${run.hand_r_weapon_id || '—'}`,
    `monsters: ${(bs.monsters || []).map(m => `${m.label}(#${m.id} ${m.hp_word})`).join(' ') || 'none'}`,
    `queue: ${(bs.queue || []).slice(0,4).map(q => `${q.hand||''}@${q.tic||0}`).join(' ') || 'empty'}`,
    `feed: ${(bs.feed || []).slice(-3).join(' | ') || '—'}`
  ];
  appendLines(lines, 'green');
}

async function cmdHelp() {
  appendLines([
    'Available commands:',
    '  help                 — this list',
    '  state                — show current run state (from API)',
    '  run new              — create new portal_run (default template 1)',
    '  run                  — show current run summary',
    '  battle start         — start next battle on current run',
    '  attack <LH|RH> <attack_id> [target_id ...]  — commit attack (targets default to first live monster)',
    '  battle end <continue|stop> — end current battle',
    '  gear                 — list owned weapons + attacks (via /weapons)',
    '  grant                — admin dev: grant starter weapon_instance (403 if not admin)',
    '  clear                — clear terminal output',
    '',
    'Notes: run id auto-saved to localStorage. Unknown cmd shows error. State printed after mutations.'
  ], 'dim');
}

async function cmdState() {
  if (!currentRunId) {
    appendLine('No current run id. Use "run new" first.', 'amber');
    return;
  }
  try {
    const data = await apiCall('GET', `/runs/${currentRunId}`);
    printStateFromRun(data.run);
  } catch (e) {
    printError('state fetch: ' + e.message);
  }
}

async function cmdRunNew() {
  try {
    // sane default portal_template_id (Portal 1 exists in seed)
    const data = await apiCall('POST', '/runs', { portal_template_id: 1 });
    currentRunId = data.run.id;
    localStorage.setItem('cli_current_run_id', currentRunId);
    printGreen(`Created run #${currentRunId}`);
    printStateFromRun(data.run);
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
    printError('battle start: ' + e.message);
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

async function cmdGear() {
  try {
    const data = await apiCall('GET', '/weapons');
    if (!data.weapons || data.weapons.length === 0) {
      appendLine('No weapons owned. Use "grant" (admin) to get starter.', 'amber');
      return;
    }
    data.weapons.forEach(w => {
      const atkList = w.attacks.map(a => `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`).join(' ');
      appendLine(`#${w.id} ${w.name} dmg=${w.damage}  attacks: ${atkList || 'none'}`, 'green');
    });
  } catch (e) {
    printError('gear: ' + e.message);
  }
}

async function cmdGrant() {
  try {
    const data = await apiCall('POST', '/dev/grant', {});
    printGreen(`Granted weapon_instance #${data.weapon_instance_id} (${data.template_name} dmg=${data.damage})`);
    await cmdGear();
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

  switch (cmd) {
    case 'help': cmdHelp(); break;
    case 'state': cmdState(); break;
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
    case 'gear': cmdGear(); break;
    case 'grant': cmdGrant(); break;
    case 'clear': cmdClear(); break;
    default:
      appendLine('unknown command — type help', 'amber');
  }
}

async function main() {
  const ok = await initAuth();
  if (!ok) return;

  appendLine('CLI harness ready. Type "help" for commands. State auto-prints after mutations.', 'dim');
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
      if (!val) return;
      appendLine('> ' + val, 'dim');
      inputEl.value = '';
      historyIdx = -1;
      historyDraft = '';
      pushHistory(val);
      handleCommand(val);
    }
  });

  // focus input
  setTimeout(() => inputEl.focus(), 100);
}

main().catch(e => {
  console.error(e);
  printError('Fatal: ' + e.message);
});
