#!/usr/bin/env node
// scripts/generate-codemap.mjs — regenerate CODEMAP.md from JS symbol definitions.
// ESM, Node stdlib only. Re-run to overwrite CODEMAP.md with fresh line numbers.
//
// Paths like api/combat/[...path].js are literal filenames. Walk with
// fs.readdir — never a shell glob. Brackets are character classes to the
// shell and to glob libraries, so a glob walk silently drops those files.

import { readdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const ROOTS = ['js', 'api', 'lib', 'public/test/cli'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.worktrees', '.vercel', 'tests']);
const BRACKET_SENTINELS = [
  'api/admin/[...path].js',
  'api/combat/[...path].js',
  'api/combat/dev/[...path].js',
];

const FN_RE = /(?:^|[^\w$])(export\s+(?:default\s+)?)?(async\s+)?function(?:\s*\*\s*|\s+)([A-Za-z_$][\w$]*)\s*\(/g;
const CLASS_RE = /(?:^|[^\w$])(export\s+(?:default\s+)?)?class\s+([A-Za-z_$][\w$]*)\b/g;
const CONST_RE = /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/;

function peelComments(line, inBlock) {
  let out = '';
  let i = 0;
  if (inBlock) {
    const end = line.indexOf('*/');
    if (end === -1) return { code: '', inBlock: true };
    i = end + 2;
    inBlock = false;
  }
  let quote = null;
  while (i < line.length) {
    const c = line[i];
    const n = line[i + 1];
    if (quote) {
      out += c;
      if (c === '\\' && n !== undefined) {
        out += n;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && n === '/') break;
    if (c === '/' && n === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end === -1) return { code: out, inBlock: true };
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return { code: out, inBlock: false };
}

function classifyArrow(compact) {
  let s = compact.trim();
  let isAsync = false;
  if (s.startsWith('async ') || s.startsWith('async(')) {
    isAsync = true;
    s = (s.startsWith('async ') ? s.slice(6) : s.slice(5)).trimStart();
  }
  if (s.startsWith('(')) {
    let depth = 0;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          if (s.slice(i + 1).trimStart().startsWith('=>')) {
            return isAsync ? 'async function' : 'function';
          }
          return null;
        }
      }
    }
    return null;
  }
  if (/^[A-Za-z_$][\w$]*\s*=>/.test(s)) return isAsync ? 'async function' : 'function';
  return null;
}

function classifyCompact(compact) {
  if (!compact) return null;
  if (/^(?:'|"|`)/.test(compact)) return null;
  if (/^[+-]?(?:\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)/i.test(compact)) return null;
  if (/^(?:true|false|null|undefined)\b/.test(compact)) return null;
  if (/^async\s+function\b/.test(compact)) return 'async function';
  if (/^function\b/.test(compact)) return 'function';
  if (/^class\b/.test(compact)) return 'class';
  const arrow = classifyArrow(compact);
  if (arrow) return arrow;
  let probe = compact;
  const wrap = /^Object\.(?:freeze|seal)\s*\(/.exec(probe);
  if (wrap) probe = probe.slice(wrap[0].length).trimStart();
  if (probe.startsWith('{') || probe.startsWith('[')) return 'const';
  return null;
}

function classifyExportedValue(rest, codeLines, idx) {
  const parts = [rest];
  const end = Math.min(codeLines.length, idx + 8);
  for (let j = idx + 1; j < end; j += 1) parts.push(codeLines[j]);
  return classifyCompact(parts.join(' ').replace(/\s+/g, ' ').trim());
}

function kindFromFunctionMatch(match) {
  const isAsync = Boolean(match[2]);
  const starred = /\bfunction\s*\*/.test(match[0]);
  let kind = isAsync ? 'async function' : 'function';
  if (starred) kind += '*';
  return kind;
}

function extractSymbols(text) {
  const rawLines = String(text).split('\n');
  const codeLines = [];
  let inBlock = false;
  for (const raw of rawLines) {
    const peeled = peelComments(raw.replace(/\r$/, ''), inBlock);
    inBlock = peeled.inBlock;
    codeLines.push(peeled.code);
  }

  const symbols = [];
  for (let i = 0; i < codeLines.length; i += 1) {
    const line = codeLines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    let constName = null;
    const constMatch = CONST_RE.exec(trimmed);
    if (constMatch) {
      const kind = classifyExportedValue(constMatch[2], codeLines, i);
      if (kind) {
        symbols.push({ line: i + 1, visibility: 'export', kind, name: constMatch[1] });
        constName = constMatch[1];
      }
    }

    for (const match of line.matchAll(new RegExp(CLASS_RE.source, 'g'))) {
      symbols.push({
        line: i + 1,
        visibility: match[1] ? 'export' : 'local',
        kind: 'class',
        name: match[2],
      });
    }

    for (const match of line.matchAll(new RegExp(FN_RE.source, 'g'))) {
      const name = match[3];
      if (name === constName) continue;
      symbols.push({
        line: i + 1,
        visibility: match[1] ? 'export' : 'local',
        kind: kindFromFunctionMatch(match),
        name,
      });
    }
  }

  const seen = new Set();
  const out = [];
  for (const sym of symbols) {
    const key = `${sym.line}\0${sym.visibility}\0${sym.kind}\0${sym.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sym);
  }
  return out;
}

function toPosix(root, full) {
  return relative(root, full).split(sep).join('/');
}

function collectJsFiles(repo) {
  const found = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const ent of entries) {
      if (ent.isDirectory()) {
        if (ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
        walk(join(dir, ent.name));
        continue;
      }
      if (ent.isFile() && ent.name.endsWith('.js')) found.push(join(dir, ent.name));
    }
  }
  for (const root of ROOTS) walk(join(repo, root));
  found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return found;
}

function assertSentinelsIndexed(repo, relPaths) {
  const indexed = new Set(relPaths);
  for (const rel of BRACKET_SENTINELS) {
    const abs = join(repo, rel);
    let exists = false;
    try {
      exists = statSync(abs).isFile();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    if (exists && !indexed.has(rel)) {
      throw new Error(`${rel} exists on disk but was not indexed — bracket path mishandled`);
    }
  }
}

function render(files) {
  const symbols = [];
  for (const file of files) {
    for (const sym of file.symbols) symbols.push({ file: file.path, ...sym });
  }
  const exports = symbols.filter((s) => s.visibility === 'export').length;
  const lines = [];
  lines.push('# CODEMAP');
  lines.push('');
  lines.push('Symbol index for Portal Colosseum JavaScript. Grep a name; do not read this file whole.');
  lines.push('');
  lines.push('Do not edit line numbers by hand. Regenerate (overwrites this file):');
  lines.push('');
  lines.push('```bash');
  lines.push('node scripts/generate-codemap.mjs');
  lines.push('```');
  lines.push('');
  lines.push('Scanned `.js` files under `js/`, `api/`, `lib/`, and `public/test/cli/`.');
  lines.push('Skipped directories: `node_modules`, `.git`, `.worktrees`, `.vercel`, `tests/`.');
  lines.push('Bracket filenames (`api/combat/[...path].js`) are literal paths, not globs.');
  lines.push('');
  lines.push(`- Files: ${files.length}`);
  lines.push(`- Symbols: ${symbols.length} (${exports} export, ${symbols.length - exports} local)`);
  lines.push('');
  lines.push('`visibility` is `export` or `local`. Kinds: `function`, `async function`, `class`, `const` (a `*` suffix marks a generator).');
  lines.push('Included: function declarations at any indent (including named function expressions), classes (exported or not), and exported consts whose value is a function, arrow, object, or array (including `Object.freeze` / `Object.seal` of those).');
  lines.push('Omitted: scalar constants (strings, numbers, booleans), re-exports (`export { … }` / `export default name`), and class methods — open the class line.');
  lines.push('');
  lines.push('## Files');
  lines.push('');
  lines.push('| file | symbols | exports |');
  lines.push('|---|---:|---:|');
  for (const file of files) {
    const exp = file.symbols.filter((s) => s.visibility === 'export').length;
    lines.push(`| \`${file.path}\` | ${file.symbols.length} | ${exp} |`);
  }
  lines.push('');
  lines.push('## Symbols');
  lines.push('');
  lines.push('| file | line | visibility | kind | name |');
  lines.push('|---|---:|---|---|---|');
  for (const sym of symbols) {
    lines.push(`| \`${sym.file}\` | ${sym.line} | ${sym.visibility} | ${sym.kind} | \`${sym.name}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

function selfTest() {
  function sigs(src) {
    return extractSymbols(src).map((s) => `${s.line}:${s.visibility}:${s.kind}:${s.name}`);
  }
  function eq(actual, expected, label) {
    const a = actual.join(',');
    const e = expected.join(',');
    if (a !== e) throw new Error(`${label}\n  got:  ${a}\n  want: ${e}`);
  }

  eq(sigs('export function rollMultiplier(base) {}'), ['1:export:function:rollMultiplier'], 'export function');
  eq(sigs('export async function chargeRunEntry(admin) {}'), ['1:export:async function:chargeRunEntry'], 'export async');
  eq(sigs('  async function generateOneMonster(id) {}'), ['1:local:async function:generateOneMonster'], 'indented async');
  eq(sigs('    return function attacksOf(inst) {}'), ['1:local:function:attacksOf'], 'named expression');
  eq(sigs('class BattleClock {\n  step() {}\n}'), ['1:local:class:BattleClock'], 'local class, methods omitted');
  eq(sigs('export class Foo {}'), ['1:export:class:Foo'], 'export class');
  eq(sigs('export const TIMING = Object.freeze({\n  hitPause: 320,\n});'), ['1:export:const:TIMING'], 'frozen object');
  eq(sigs('export const UX_SPEEDS = Object.freeze([0.5, 1]);'), ['1:export:const:UX_SPEEDS'], 'frozen array');
  eq(sigs('export const TEXT_SPEEDS =\n{\n  normal: 1,\n};'), ['1:export:const:TEXT_SPEEDS'], 'multiline object');
  eq(sigs("export const letterOf = (label) => (label && /[A-Z]$/.test(label)) ? label.slice(-1) : '';"), ['1:export:function:letterOf'], 'arrow');
  eq(sigs('export const PLAYER_MAX_HP = 1000;'), [], 'scalar number omitted');
  eq(sigs("export const HAND_FREE_STATE = 'Ready';"), [], 'scalar string omitted');
  eq(sigs('export { potionUsedFlags };'), [], 're-export omitted');
  eq(sigs('// export function skipped() {}\nexport function shown() {}'), ['2:export:function:shown'], 'line comment');
  eq(sigs('/*\nexport function hidden() {}\n*/\nexport function shown() {}'), ['4:export:function:shown'], 'block comment');
  eq(sigs('export function shown() {} // export function other() {}'), ['1:export:function:shown'], 'trailing comment');
  eq(sigs('export const foo = function foo() {}'), ['1:export:function:foo'], 'const function deduped');
  eq(sigs('export const foo = function bar() {}'), ['1:export:function:foo', '1:local:function:bar'], 'const and inner name');
  eq(sigs('function* gen() {}'), ['1:local:function*:gen'], 'generator');
}

function main() {
  selfTest();
  const absFiles = collectJsFiles(REPO);
  const relPaths = absFiles.map((abs) => toPosix(REPO, abs));
  if (relPaths.length === 0) {
    console.error('ERROR: scanned 0 files — refusing to overwrite CODEMAP.md');
    process.exit(1);
  }
  assertSentinelsIndexed(REPO, relPaths);

  const files = absFiles.map((abs, i) => ({
    path: relPaths[i],
    symbols: extractSymbols(readFileSync(abs, 'utf8')),
  }));
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const md = render(files);
  const out = join(REPO, 'CODEMAP.md');
  const tmp = `${out}.tmp`;
  writeFileSync(tmp, md, 'utf8');
  renameSync(tmp, out);

  const symbols = files.reduce((n, f) => n + f.symbols.length, 0);
  const exports = files.reduce((n, f) => n + f.symbols.filter((s) => s.visibility === 'export').length, 0);
  const bracket = files.find((f) => f.path === 'api/combat/[...path].js');
  console.log(`CODEMAP.md  files=${files.length}  symbols=${symbols}  exports=${exports}  local=${symbols - exports}  combat-catch-all=${bracket ? bracket.symbols.length : 0}`);
}

main();
