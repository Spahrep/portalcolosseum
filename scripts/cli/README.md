# Portal Colosseum Native CLI (scripts/cli/)

Native terminal playtester for Portal Colosseum. Hits the exact same live REST backend (`/api/combat/*`) as the web game and `public/test/cli/cli-app.js`.

## Prerequisites
- Node >= 18 (no `npm install` needed — zero runtime deps beyond `@supabase/supabase-js` already in repo `package.json`).

## Setup
```bash
export PORTALCOLOSSEUM_BASE_URL=https://portalcolosseum.com
export PORTALCOLOSSEUM_SUPABASE_URL=...
export PORTALCOLOSSEUM_SUPABASE_ANON_KEY=...
# or use PORTALCOLOSSEUM_JWT for direct token
node scripts/cli/cli.js login you@example.com yourpass
```

Session persisted to `~/.config/portalcolosseum/session.json` (0600, never committed). `current-run` file holds active run id.

## Usage
### REPL (interactive)
```bash
node scripts/cli/cli.js
> help
> run new --lh 12 --rh 13   # or interactive prompts
> battle start
> attack LH 42
> state
> wait
> grant
> /equip LH #5
> /roll weapon 7 RH
> /roll monster 3
> /nuke
> /abandon run
> /inspect 5
> /list templates
> /set hp player 100
> logout
```

### One-shot (scriptable)
```bash
node scripts/cli/cli.js run new --lh 12 --rh 13 --json
node scripts/cli/cli.js attack LH 42 --quiet
node scripts/cli/cli.js wait --json
```

### Flags
- `--json` : machine-readable output
- `--quiet` : suppress human output (for agents)

## Command Reference (matches cli-app.js exactly)
- `help`, `state`/`status`, `run new` (interactive + flags), `run`, `battle start|end <continue|stop>`, `attack <LH|RH> <attack_id>`, `inventory`/`gear`, `login`/`logout`, `wait`, `clear`, `grant`
- After `grant`: `/equip`, `/roll weapon|monster`, `/nuke`, `/abandon`, `/inspect`, `/list templates`, `/set hp ...`

`--json`/`--quiet` work for every command. State always printed after mutations unless flags.

## Key Behaviors
- **hp_word only**: Monster display uses `hp_word` (from GET /runs). No `current_hp` anywhere (backend does not expose numeric HP on run state).
- **Auto-target**: Always `target_ids: []` on commit/attack (engine picks).
- **Commit-driven engine**: No client timers. `wait` (or next attack) advances on busy hand. Prints `(advanced)` note on success path.
- Session/run state in `~/.config/portalcolosseum/` (0600).

## Full Playtest Loop Example
```bash
node scripts/cli/cli.js login
node scripts/cli/cli.js run new
node scripts/cli/cli.js battle start
node scripts/cli/cli.js attack LH 12
node scripts/cli/cli.js attack RH 15
node scripts/cli/cli.js wait
node scripts/cli/cli.js state
node scripts/cli/cli.js battle end continue
node scripts/cli/cli.js logout
```

## Known Issues
- `node scripts/cli/cli.js` emits harmless `MODULE_TYPELESS_PACKAGE_JSON` warning (repo `package.json` has no `"type":"module"` — unmodifiable; ESM execution is correct).

## For Agents (Hermes/Grok)
- All dev commands gated by local `devMode` flag flipped by `grant` (no live `/dev/grant` required for static help verification).
- Exact error strings and help text copied from `cli-app.js`.
- `wait` uses real weapon attack from state (no fake 999999, real errors surface).
- REPL flags now parsed from typed line (fixes `run new --lh` in interactive mode).
- Zero `current_hp` occurrences; `target_ids:[]` enforced.

See `docs/native-cli.md` (PC-33) for full spec.