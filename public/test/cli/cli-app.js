/**
 * cli-app.js — CLI dev/test harness for live combat API
 * Terminal UI matching gui2 aesthetics (near-black, Pixeloid Mono, green/amber, thin amber border)
 * Auth: /api/env.js + Supabase PKCE localStorage pattern from game.html
 * Commands: help/state/run new/run/battle start/attack/menu/swap/battle end/inventory/grant/clear
 * Always prints compact current state after state-changing commands
 */

import { computeTimingMarkers } from '../../js/combat/tic-queue.js';

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
let devMode = localStorage.getItem('cli_dev_mode') === '1';
let pendingInputResolver = null;
let flowState = null; // 'preamble' | 'confirm' | null — run-start gate
let pendingPicks = null; // {lh, rh, belt, ca, cb} captured at the ready step
let selectMode = false; // UX select mode for player stats slots
let selectIndex = 0; // 0=LH,1=RH,2=BL,3=C1,4=C2
let offeredBattleNum = null; // last battle the after-battle offer was shown for
// PC-56: DW menu selection state — active attack shows '>' markers on the queue panel
let menuAttack = null; // {attack, queue} while a menu attack pick is pending

// --- PC-36 pure text builders (tested in isolation) ---

function buildPreambleText() {
  // PC-36 short placeholder per spec (replaces atmospheric text; leading \n preserved for output parity)
  return '\nPrepare to start your run.\n\nCommands: inventory | inspect # | equip LH|RH <id> | ready | cancel\nType "ready" when ready.\n';
}

function buildRecapText(weapons, consumables, picks) {
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

function buildAfterBattleOffer(currentBattle, totalBattles, hpCur, hpMax, isFirstWin, potionHint = null) {
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
    lines.push('Type "continue" to risk the next fight, or "stop" to claim your current share and end the run.');
  }
  return lines.join('\n');
}

function buildItemInspectText(weapons, consumables, id) {
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

function buildPreambleDenied() {
  return 'Type "inventory", "inspect #", "ready", or "help".';
}

function buildConfirmDenied() {
  return 'Type "confirm" to enter, or "inventory" to adjust.';
}

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

const seenFeed = new Set();
function narrateFeed(feedLines, participants = null) {
  if (!feedLines || !Array.isArray(feedLines) || feedLines.length === 0) return;

  // extract monster labels for possessive matching (exact labels like "Glimmerling A")
  const monsterLabels = [];
  const p = participants || {};
  if (p.monsters && Array.isArray(p.monsters)) {
    p.monsters.forEach(m => { if (m && m.label) monsterLabels.push(m.label); });
  }
  const getMonsterLabel = (text) => {
    for (const lbl of monsterLabels) {
      if (text.includes(lbl)) return lbl;
    }
    // first-two-words fallback for monster names
    const m = text.match(/tic \d+ — ([A-Za-z]+(?:\s+[A-Z])?)/);
    return m ? m[1] : null;
  };

  // filter only NEW lines (rolling feed dedupe)
  const newLines = feedLines.filter(l => !seenFeed.has(l));
  newLines.forEach(l => seenFeed.add(l));

  const outputEntries = []; // {text, matched}

  for (const raw of newLines) {
    let mapped = null;

    // Rule: tic N — Monster quick attack hits player for NUM → "Monster's quick attack hits you for NUM."
    // DEFECT 1 FIX: use getMonsterLabel + exact strip + greedy fallback
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
    // greedy fallback when no known labels
    m = raw.match(/^tic \d+ — ([A-Za-z]+(?: [A-Z])?)(?: (.+?))? hits player for (\d+)$/);
    if (m) {
      const mon = m[1];
      mapped = m[2] && m[2].trim() ? `${mon}'s ${m[2].trim()} hits you for ${m[3]}.` : `${mon} hits you for ${m[3]}.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // Rule: misses — same fix
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

    // Rule: tic N — Monster is defeated → "Monster is defeated!"
    m = raw.match(/^tic \d+ — (.+?) is defeated$/);
    if (m) {
      mapped = `${m[1]} is defeated!`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // Rule: tic N — LH commits AttackName (cast N) → "Your left hand begins casting AttackName…"
    m = raw.match(/^tic \d+ — LH commits (.+?) \(cast \d+\)$/);
    if (m) {
      mapped = `Your left hand begins casting ${m[1]}…`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // Rule: tic N — RH commits ...
    m = raw.match(/^tic \d+ — RH commits (.+?) \(cast \d+\)$/);
    if (m) {
      mapped = `Your right hand begins casting ${m[1]}…`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // Rule: tic N — LH AttackName hits Monster for NUM → "Your left hand's AttackName hits Monster for NUM."
    m = raw.match(/^tic \d+ — LH (.+?) hits (.+?) for (\d+)$/);
    if (m) {
      mapped = `Your left hand's ${m[1]} hits ${m[2]} for ${m[3]}.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // Rule: tic N — RH AttackName hits ...
    m = raw.match(/^tic \d+ — RH (.+?) hits (.+?) for (\d+)$/);
    if (m) {
      mapped = `Your right hand's ${m[1]} hits ${m[2]} for ${m[3]}.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // PC-39 potion rules (mirror scripts/cli/potion-format.mjs mapPotionFeedLine)
    m = raw.match(/^tic \d+ — (LH|RH) drinks (.+?) \((\d+) tics\)$/);
    if (m) {
      mapped = `Your ${m[1] === 'LH' ? 'left' : 'right'} hand drinks ${m[2]} (${m[3]} tics)…`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }
    m = raw.match(/^tic \d+ — (LH|RH) healed (\d+)$/);
    if (m) {
      mapped = `Your ${m[1] === 'LH' ? 'left' : 'right'} hand's potion restores ${m[2]} HP.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }
    m = raw.match(/^tic \d+ — (LH|RH) (damage|speed|accuracy) \+(\d+) until tic (\d+)$/);
    if (m) {
      mapped = `Your ${m[1] === 'LH' ? 'left' : 'right'} hand's potion grants ${m[2]} +${m[3]} until tic ${m[4]}.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }
    m = raw.match(/^tic \d+ — Potion ([AB]) used — (.+)$/);
    if (m) {
      mapped = `You drink potion ${m[1].toLowerCase()} — ${m[2]}.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }
    m = raw.match(/^tic \d+ — (.+?) buff expired$/);
    if (m) {
      mapped = `The ${m[1]} buff fades.`;
      outputEntries.push({ text: mapped, matched: true });
      continue;
    }

    // unmatched
    outputEntries.push({ text: raw, matched: false });
  }

  // emit with colors: matched = green, unmatched = dim
  outputEntries.forEach(entry => {
    if (!entry.matched) {
      printDim(entry.text);
    } else {
      appendLine(entry.text, 'green');
    }
  });
}

// Queue events shown in the state dump, humanized (engine sends raw event names).
const QUEUE_ACTION_LABELS = { cooldown: 'Ready', winding: 'Casting', impact: 'Attack', attack: 'Attack' };

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
  // defect 2: empty hands print NOTHING
  const lhEmpty = !hands.LH || hands.LH.weaponId == null;
  const rhEmpty = !hands.RH || hands.RH.weaponId == null;
  if (lhEmpty && rhEmpty) {
    return; // empty hands: print nothing
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
      const deadMark = m.dead ? ' (dead)' : '';
      lines.push(`  ${m.name || m.label}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Healthy'}${deadMark}`);
      lines.push(`      attacks: ${fmtAttacks(m.attacks)}`);
    }
  } else {
    lines.push('monsters: none');
  }
  const queueLine = (bs.queue || []).slice(0, 4).map(q => `${q.tics ?? 0} - ${q.label || '?'}: ${QUEUE_ACTION_LABELS[q.event] || (q.event ? q.event[0].toUpperCase() + q.event.slice(1) : '?')}`).join(' | ');
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
  // Re-entry from any gate phase always lands back at the preamble, so
  // 'ready' works no matter when 'run new' is typed.
  flowState = 'preamble';
  pendingPicks = { lh: null, rh: null, belt: null, ca: null, cb: null };
  if (actionQueueContent) actionQueueContent.innerHTML = '<div class="dim">—</div>';
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
// Mirrors the native CLI commands.mjs cmdMenu exactly (parity port).
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
    for (const a of (w && w.attacks) || []) rows.push({ kind: 'attack', attack: a, letter: String.fromCharCode(letter++) });
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
      menuAttack = { attack: row.attack, queue: bs.queue || [] };
      try { await refreshRunPanels(); } catch (_) {}
      let targets = [];
      if (monsters.length > 0) {
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
      menuAttack = null;
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

// PC-54: mid-battle belt swap. 'swap LH|RH' or 'bl LH|RH' (parity with native CLI).
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
    } else if (choice === 'stop') {
      appendLine('You step back through the portal. The prize is yours — for now.');
    }
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
        const atkList = w.attacks.map(a => {
          const pVar = a.prepare_time_range || 0;
          const cVar = a.cooldown_time_range || 0;
          const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
          const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
          return `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} ${pPart}/${cPart}`;
        }).join(' ');
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
      localStorage.setItem('cli_dev_mode', '1');
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
      if (!selectMode) {
        enterSelectMode();
      } else {
        exitSelectMode();
      }
      return;
    }
    if (selectMode) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        selectIndex = (selectIndex + dir + 5) % 5;
        updateSelectHighlight();
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
        const atkList = w.attacks.map(a => {
          const pVar = a.prepare_time_range || 0;
          const cVar = a.cooldown_time_range || 0;
          const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
          const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
          return `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} ${pPart}/${cPart}`;
        }).join(' ');
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
    let html = `<div class="stat-line" data-slot="hp">HP: ${run.player_hp ?? '—'}</div>`;
    const lh = weapons.hand_l;
    html += `<div class="stat-line selectable" data-slot="lh">LH: ${lh ? `#${lh.id} ${lh.name}` : '—'}</div>`;
    const rh = weapons.hand_r;
    html += `<div class="stat-line selectable" data-slot="rh">RH: ${rh ? `#${rh.id} ${rh.name}` : '—'}</div>`;
    const bl = weapons.belt;
    html += `<div class="stat-line selectable" data-slot="bl">BL: ${bl ? `#${bl.id} ${bl.name}` : '—'}</div>`;
    const pots = bs.potions || {};
    const potA = pots.potion_a || pots.A || null;
    const potB = pots.potion_b || pots.B || null;
    const fmtPot = (p) => p
      ? `${p.template_name || 'Potion'}${p.used ? ' (used)' : ''}`
      : '—';
    html += `<div class="stat-line selectable" data-slot="c1">C1: ${fmtPot(potA)}</div>`;
    html += `<div class="stat-line selectable" data-slot="c2">C2: ${fmtPot(potB)}</div>`;
    html += `<div id="player-detail" class="player-detail" style="display:none;"></div>`;
    playerStatsContent.innerHTML = html;
    // attach click handlers for selectable rows (TASK2)
    const detailEl = playerStatsContent.querySelector('#player-detail');
    playerStatsContent.querySelectorAll('.stat-line.selectable').forEach((el, idx) => {
      el.addEventListener('click', () => {
        if (selectMode) {
          selectIndex = idx;
          updateSelectHighlight();
        }
        showItemDetailForSlot(el.dataset.slot, detailEl, weapons);
      });
    });
  }

  // LEFT: Monster roster
  if (monsterRosterContent) {
    if (mons.length === 0) {
      monsterRosterContent.innerHTML = '<div class="dim">No monsters</div>';
    } else {
      let html = '';
      mons.forEach(m => {
        const letter = (m.label && /[A-Z]$/.test(m.label)) ? m.label.slice(-1) : '';
        const deadMark = m.dead ? ' (dead)' : '';
        html += `<div class="monster">${m.name}${letter ? ' ' + letter : ''} - ${m.hp_word || 'Healthy'}${deadMark}</div>`;
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
    const inFight = bs.tic > 0 || (bs.feed && bs.feed.length > 0);
    if (!inFight || queue.length === 0) {
      // Blank until the first fight starts (Spahrep 2026-09-13)
      actionQueueContent.innerHTML = '<div class="dim">—</div>';
    } else {
      let html = '';
      queue.slice(0, 8).forEach(q => {
        const label = q.label || '?';
        const tics = q.tics ?? 0;
        const ev = QUEUE_ACTION_LABELS[q.event] || (q.event ? q.event[0].toUpperCase() + q.event.slice(1) : '?');
        // PC-56: '>' timing marker on rows inside the selected attack's window
        let marker = '';
        if (menuAttack && menuAttack.queue === queue) {
          const marked = computeTimingMarkers(menuAttack.queue, menuAttack.attack);
          if (marked.some(m => m.id === q.id)) marker = ' >';
        }
        html += `<div>${tics} - ${label}: ${ev}${marker}</div>`;
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


// TASK2 UX select mode helpers (small functions, plain JS, yellow border aesthetic)
function enterSelectMode() {
  selectMode = true;
  selectIndex = 0;
  if (inputEl) inputEl.blur();
  updateSelectHighlight();
}

function exitSelectMode() {
  selectMode = false;
  if (playerStatsContent) {
    playerStatsContent.querySelectorAll('.stat-line.selectable').forEach(el => el.classList.remove('highlight'));
    const d = playerStatsContent.querySelector('#player-detail');
    if (d) d.style.display = 'none';
  }
  if (inputEl) inputEl.focus();
}

function updateSelectHighlight() {
  if (!playerStatsContent || !selectMode) return;
  const rows = playerStatsContent.querySelectorAll('.stat-line.selectable');
  rows.forEach((el, i) => {
    if (i === selectIndex) el.classList.add('highlight');
    else el.classList.remove('highlight');
  });
}

async function showItemDetailForCurrent() {
  if (!playerStatsContent) return;
  const rows = playerStatsContent.querySelectorAll('.stat-line.selectable');
  const row = rows[selectIndex];
  if (!row) return;
  const detailEl = playerStatsContent.querySelector('#player-detail');
  if (detailEl) {
    await showItemDetailForSlot(row.dataset.slot, detailEl, null);
  }
}

async function showItemDetailForSlot(slot, detailEl, preloadedWeapons) {
  if (!detailEl) return;
  detailEl.style.display = 'block';
  if (slot === 'hp' || !['lh','rh','bl','c1','c2'].includes(slot)) {
    detailEl.innerHTML = 'No item';
    return;
  }
  if (slot === 'c1' || slot === 'c2') {
    detailEl.innerHTML = 'No item';
    return;
  }
  // parse id from the row text e.g. "LH: #12 Sword"
  const rowText = document.querySelector(`.stat-line.selectable[data-slot="${slot}"]`)?.textContent || '';
  const m = rowText.match(/#(\d+)/);
  if (!m) {
    detailEl.innerHTML = 'No item';
    return;
  }
  const id = parseInt(m[1], 10);
  try {
    let wData = preloadedWeapons ? {weapons: Object.values(preloadedWeapons || {})} : null; // rough, but use fetch
    if (!wData || !wData.weapons) {
      wData = await apiCall('GET', '/weapons');
    }
    const weapons = wData.weapons || [];
    const w = weapons.find(ww => ww.id === id);
    if (!w) {
      detailEl.innerHTML = `#${id} not found`;
      return;
    }
    let html = `<div><strong>${w.name}</strong></div>`;
    const delta = w.damage_delta != null ? ` (+${w.damage_delta})` : '';
    html += `<div>Damage: ${w.damage}${delta}</div>`;
    if (w.attacks && w.attacks.length) {
      w.attacks.forEach(a => {
        const pVar = a.prepare_time_range || 0;
        const cVar = a.cooldown_time_range || 0;
        const pPart = pVar > 0 ? `p${a.prepare_time}-${a.prepare_time + pVar}` : `p${a.prepare_time}`;
        const cPart = cVar > 0 ? `c${a.cooldown_time}-${a.cooldown_time + cVar}` : `c${a.cooldown_time}`;
        html += `<div>#${a.id} ${a.name} (${pPart}/${cPart})</div>`;
      });
    }
    detailEl.innerHTML = html;
  } catch (e) {
    detailEl.innerHTML = 'Error loading detail';
  }
}
