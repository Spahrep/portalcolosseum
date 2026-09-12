// scripts/cli/render.mjs
// Output helpers: help text (exact match to cli-app where overlap), state render (hp_word ONLY), json/quiet support
// Never references numeric_hp

let quiet = false;
let jsonMode = false;

export function setFlags(q, j) {
  quiet = !!q;
  jsonMode = !!j;
}

export function isQuiet() { return quiet; }
export function isJson() { return jsonMode; }

export function printError(msg) {
  if (jsonMode) {
    console.log(JSON.stringify({ error: msg }));
  } else if (!quiet) {
    console.error('ERROR: ' + msg);
  }
}

export function printGreen(msg) {
  if (!quiet && !jsonMode) console.log(msg);
}

export function printAmber(msg) {
  if (!quiet && !jsonMode) console.log(msg);
}

export function printDim(msg) {
  if (!quiet && !jsonMode) console.log(msg);
}

export function printJson(obj) {
  if (jsonMode) {
    console.log(JSON.stringify(obj, null, quiet ? 0 : 2));
  }
}

export function printState(run) {
  if (!run) {
    printAmber('No active run.');
    return;
  }
  if (jsonMode) {
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  if (quiet) return;

  const bs = run.battle_state || {};
  const weapons = bs.weapons || {};
  const fmtAttacks = (list) => (list || []).map(a =>
    `#${a.id} ${a.name}${a.is_multi_target ? ' (multi)' : ''} p${a.prepare_time}/c${a.cooldown_time}`
  ).join(' | ') || 'none';
  const letterOf = (label) => (label && /[A-Z]$/.test(label)) ? label.slice(-1) : '';

  console.log(`RUN #${run.id} status=${run.status} battle ${run.current_battle}/${run.total_battles}`);
  console.log(`player_hp: ${run.player_hp}  tic: ${bs.tic || 0}`);

  const d = bs.dice;
  if (d) {
    const fmtC = (o) => `G${o.green ?? 0} Y${o.yellow ?? 0} R${o.red ?? 0}`;
    const cur = d.current
      ? `current: ${d.current.color} die face=${d.current.face} budget=${d.current.rolled_value}`
      : 'current: — (no die drawn this battle yet)';
    console.log(`dice remaining: ${fmtC(d.remaining || {})}  used: ${fmtC(d.used || {})}  ${cur}`);
  } else {
    console.log('dice: none');
  }

  const lh = weapons.hand_l;
  const rh = weapons.hand_r;
  const bl = weapons.belt;
  console.log(`LH: ${lh ? `#${lh.id} ${lh.name} dmg=${lh.damage}` : '—'}`);
  console.log(`RH: ${rh ? `#${rh.id} ${rh.name} dmg=${rh.damage}` : '—'}`);
  console.log(`BL: ${bl ? `#${bl.id} ${bl.name} dmg=${bl.damage}` : '—'}`);

  const mons = bs.monsters || [];
  if (mons.length) {
    console.log('monsters:');
    mons.forEach(m => {
      let hpw = m.hp_word || 'Unknown';
      if (m.dead) hpw = 'Dead';
      console.log(`  ${m.label || m.name} hp_word=${hpw} dmg=${m.damage} spd=${m.speed} acc=${m.accuracy}`);
    });
  } else {
    console.log('monsters: none');
  }

  if (bs.feed && bs.feed.length) {
    console.log('feed (last 3):');
    bs.feed.slice(-3).forEach(f => console.log('  ' + f));
  }
}

export function cmdHelp(devMode = false) {
  const lines = [
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
    '  login                — sign in with Supabase (stores session)',
    '  logout               — clear local session',
    '  wait                 — explicit commit to advance busy hand / clock',
    '  grant                — admin dev: unlock dev tools (403 if not admin)',
    '  inspect [id]         — monster template info (bare lists ids)',
    '  clear                — clear terminal output',
    '',
    'Notes: run id auto-saved to ~/.config/portalcolosseum/current-run. Unknown cmd shows error. State printed after mutations.',
  ];
  if (!jsonMode && !quiet) {
    lines.forEach(l => console.log(l));
  }
  if (devMode && !jsonMode && !quiet) {
    console.log('');
    console.log('Dev tools (slash commands):');
    console.log('  /equip [LH|RH|belt] [#N]       — equip instance #N (from inventory) or random into slot');
    console.log('  /roll weapon <id> [LH|RH|belt] — spawn a specific weapon template');
    console.log('  /roll monster <id>             — spawn a specific monster template (adds to battle)');
    console.log('  /list weapons|monsters         — list owned weapons / battle monsters');
    console.log('  /set hp <player|monster> <n>   — set hit points');
    console.log('  /nuke                          — clear all monsters from battle_state');
    console.log('  /list templates                — show all weapon + monster template ids');
    console.log('  /abandon run                   — abandon current active run');
    console.log('  /inspect                       — alias for inspect');
  }
}
