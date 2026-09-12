#!/usr/bin/env node
// scripts/cli/cli.js — Phase A core shell for Portal Colosseum native CLI
// ESM, Node >=18, no new deps. Supports REPL + one-shot, --json --quiet
// Exactly per docs/native-cli.md + cli-app.js surface + playthrough patterns

import readline from 'readline';
import { cmdHelp, setFlags, printError, isJson, isQuiet } from './render.mjs';
import {
  cmdLogin, cmdLogout, cmdRunNew, cmdRun, cmdState, cmdBattleStart,
  cmdAttack, cmdBattleEnd, cmdInventory, cmdWait, cmdClear, cmdGrant, handleSlashCommand, getCurrentRun, setCurrentRun, getDevMode, setDevMode
} from './commands.mjs';
import { loadSession, getAccessToken } from './auth.mjs';

const args = process.argv.slice(2);
let jsonMode = args.includes('--json');
let quiet = args.includes('--quiet');
setFlags(quiet, jsonMode);

// filter flags out of command args
const cmdArgs = args.filter(a => !a.startsWith('--'));

async function dispatch(cmd, subArgs) {
  if (await handleSlashCommand(cmd, subArgs)) return;
  switch (cmd) {
    case 'help': cmdHelp(getDevMode()); break;
    case 'state':
    case 'status': await cmdState(subArgs); break;
    case 'run':
      if (subArgs[0] === 'new') await cmdRunNew(subArgs.slice(1), parseFlags([...args, ...subArgs]));
      else await cmdRun();
      break;
    case 'battle':
      if (subArgs[0] === 'start') await cmdBattleStart();
      else if (subArgs[0] === 'end') await cmdBattleEnd(subArgs.slice(1));
      else printError('unknown battle subcommand');
      break;
    case 'attack': await cmdAttack(subArgs); break;
    case 'inventory':
    case 'gear': await cmdInventory(); break;
    case 'login': await cmdLogin(subArgs); break;
    case 'logout': await cmdLogout(); break;
    case 'wait': await cmdWait(); break;
    case 'grant': await cmdGrant(); break;
    case 'clear': cmdClear(); break;
    default:
      if (!isQuiet() && !isJson()) printError('unknown command — type help');
  }
}

function parseFlags(rawArgs) {
  const flags = {};
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--lh') flags.lh = rawArgs[i + 1];
    if (a === '--rh') flags.rh = rawArgs[i + 1];
    if (a === '--belt') flags.belt = rawArgs[i + 1];
    if (a === '--ca' || a === '--c1') flags.ca = rawArgs[i + 1];
    if (a === '--cb' || a === '--c2') flags.cb = rawArgs[i + 1];
  }
  return flags;
}

async function main() {
  // one-shot mode if args present
  if (cmdArgs.length > 0) {
    // split the first arg on whitespace so quoted multi-word commands work like the REPL
    const words = cmdArgs[0].split(/\s+/).filter(Boolean);
    const cmd = words[0];
    const sub = [...words.slice(1), ...cmdArgs.slice(1)];
    await dispatch(cmd, sub);
    return;
  }

  // REPL mode
  const hasSession = !!(await getAccessToken());
  if (!hasSession) {
    console.log('No session — run \"login\" first (or set PORTALCOLOSSEUM_JWT)');
  } else {
    console.log('CLI ready. Type \"help\" for commands. (session loaded)');
    const rid = getCurrentRun();
    if (rid) console.log(`current run: #${rid}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    historySize: 50,
  });

  rl.prompt();

  // serialize line processing so piped/fast input can't interleave async handlers
  let queue = Promise.resolve();
  const enqueue = (fn) => {
    queue = queue.then(fn).catch((err) => {
      console.error(`cli error: ${err.message || err}`);
    });
  };
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      enqueue(() => {
        if (!rl.closed) rl.prompt();
      });
      return;
    }
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const subArgs = parts.slice(1);
    if (cmd === 'exit' || cmd === 'quit') {
      enqueue(() => rl.close());
      return;
    }
    enqueue(() => dispatch(cmd, subArgs).then(() => {
      if (!rl.closed) rl.prompt();
    }));
  });

  rl.on('close', () => {
    // piped stdin EOF fires 'close' while async dispatches may still be in flight —
    // drain the queue before exiting so piped input is fully processed
    queue.then(() => {
      console.log('bye');
      process.exit(0);
    });
  });
}

main().catch(e => {
  printError('fatal: ' + e.message);
  process.exit(1);
});
