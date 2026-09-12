# Native Ubuntu Node CLI for Portal Colosseum (PC-33)

## Purpose & Audience
A native Node.js CLI (runs on Ubuntu `node`) that drives the exact same live REST backend (`/api/combat/...`) as the web game and the existing browser harness (`public/test/cli/cli-app.js`). Primary audiences:
- Agent-driven interactive QA testing (headless playthroughs, scenario setup via dev commands).
- Human terminal play (retro CLI experience, no browser).

The CLI is a thin client only — zero game logic, zero local simulation, fully server-authoritative.

## Architecture
- **Thin client over live REST API**: Every action is a direct `fetch` (or `node-fetch`/`undici`) to `https://portalcolosseum.com/api/combat/...` (or configurable base URL) using a Bearer JWT obtained via Supabase.
- **Auth**: Uses `@supabase/supabase-js` (already in `package.json`) with `signInWithPassword`. Session persisted to `~/.config/portalcolosseum/session.json` (0600 perms, never in repo). Supports `PORTALCOLOSSEUM_BASE_URL` and `PORTALCOLOSSEUM_SUPABASE_*` env vars for flexibility.
- **State rendering**: After every mutation, `GET /runs/:id` + render using `hp_word` only for monsters (no `current_hp`/`max_hp` available on GET). Commit responses (`POST /commit`) may include `battle_over`/`player_dead`/`advanced`.
- **Commit-driven engine**: The tic clock only advances on `POST /commit`. A "busy hand" commit returns `{advanced: true}` internally (see `playthrough.mjs:123`). Human CLI needs explicit `wait` (or auto-advance on next input) to fast-forward.
- **No client-side monster liveness**: `GET /runs/:id` deliberately exposes only `hp_word`; the known `current_hp > 0` filter in `cli-app.js:400` **must not be copied**. Always send `target_ids: []` and let the engine auto-pick (as proven in `playthrough.mjs:210`).
- **Consumables**: Slots C1/C2 exist in `run new` payload but are on hold. CLI must still prompt (Enter = skip) for future-proofing.
- **No XP/levels**: None exist anywhere in the backend.
- **Interactive vs scriptable**: Supports both REPL-style interactive (readline + history) and one-shot `node cli.js run new --lh 12 ...`.

## Full Command Surface (Mirrors web CLI exactly)
All commands from `cli-app.js` (help text + implementation) + proven patterns from `playthrough.mjs`:

**Core player commands**
- `help` — list commands (shows dev commands only after `grant`)
- `state` / `status` — `GET /runs/:id` and pretty-print (player_hp, tic, dice, hands, monsters with `hp_word`, queue, feed)
- `run new` — interactive loadout prompt (LH/RH/Belt/C1/C2 ids or Enter-skip), `POST /runs`, saves run id
- `run` — summary of current run
- `battle start` — `POST /runs/:id/battle/start`
- `attack <LH|RH> <attack_id> [target_ids...]` — `POST /runs/:id/commit` (auto-targets if omitted; handles `advanced` response)
- `battle end <continue|stop>` — `POST /runs/:id/battle/end`
- `inventory` / `gear` — `GET /weapons` + `GET /consumables`
- `grant` — `POST /dev/grant` (unlocks dev mode for this session)
- `inspect [id]` — list templates or `GET /templates/monster/:id`
- `clear` — clear terminal

**Dev / slash commands** (require `grant` first)
- `/equip [LH|RH|belt] [#N]` — `POST /dev/equip` or `equip-instance`
- `/roll weapon <id> [LH|RH|belt]` — `POST /dev/roll-weapon`
- `/roll monster <id>` — `POST /dev/roll-monster`
- `/del monster <label|id>` — `POST /dev/del-monster`
- `/list weapons|monsters` — inventory or current battle monsters
- `/set hp <player|monster> <n>` — `POST /dev/set-hp`
- `/win battle` — `POST /dev/win-battle`
- `/kill player` — `POST /dev/kill-player`
- `/nuke` — `POST /dev/nuke-monsters`
- `/list templates` — `GET /dev/templates`
- `/abandon run` — `POST /dev/abandon-run` (clears local run id)
- `/inspect` — alias for inspect

Additional native conveniences (non-breaking):
- `login` / `logout` (Supabase email/password flow)
- `wait` (explicit busy-hand commit to advance clock)
- `--json` / `--quiet` flags for agent scripting
- Persistent run id in `~/.config/portalcolosseum/current-run`

## What Already Exists to Reuse
- `@supabase/supabase-js@^2.44.0` in `package.json` — auth works identically in Node.
- `scripts/playthrough.mjs` (281 LOC) — proven headless battle loop, `doAttack` "Hand not ready" handling, feed analysis, `allMonstersDead` avoided, JWT header pattern, `abandonAll`.
- `js/combat/hp-words.js` (18 LOC) — `getHpWord` + `HP_BANDS`; import for display only.
- `public/test/cli/cli-app.js` (1029 LOC) — complete behavioral spec for every command, error messages, state rendering, dev gating, prompt flow for `run new`.
- `api/combat/[...path].js` (1104 LOC) — every route the CLI must call is already implemented and documented in comments.
- No new backend work required.

## Phased Build Plan

### Phase A: Core (auth + command dispatch + run/battle loop)
- Node ESM CLI entry (`bin/portalcolosseum` or `cli.js`).
- Supabase sign-in, session persistence (0600), token refresh.
- Command parser (simple switch or `commander`).
- `run new` interactive prompts (readline, inventory list, Enter-skip for consumables).
- `state` renderer (hp_word only, dice, hands, queue, last-3 feed).
- `attack` + commit handling (`advanced` message, auto-advance option).
- `battle start/end`, basic error paths.
- `wait` command for human UX.
- LOC estimate: ~350-400 (auth+session ~80, parser+help ~60, run new+state ~120, attack/commit ~80, based on playthrough 281 + cli-app state/render sections).
- Grok agent time: 2.5–3.5 hours (reuse playthrough patterns heavily).
- Review/verification gate: run `node cli.js login`, `run new`, `battle start`, 3×`attack`, `state` — matches web CLI output shape.
- Wall-clock (with review): 1 day.

### Phase B: Dev Command Surface
- All `/` commands gated behind `grant`.
- Reuse exact payloads from cli-app.js dev functions (`cmdDevRoll`, `cmdDevSet`, etc.).
- `/abandon`, `/nuke`, template listing, inspect.
- LOC estimate: ~250-300 (each dev cmd is 10-25 lines in cli-app.js; 12 commands).
- Grok agent time: 1.5–2 hours.
- Gate: after `grant`, every dev command succeeds or gives correct 403/amber message.
- Wall-clock: 0.5 day.

### Phase C: Optional Shared API Client Library (future-proofing)
- Extract `lib/api-client.js` (thin wrapper around fetch + auth header) used by both this CLI and future harnesses/scripts.
- Move session management + typed route helpers here.
- LOC estimate: ~150 (extracted from Phase A + playthrough).
- Grok agent time: 1 hour (refactor only after A+B solid).
- Gate: both CLI and a one-off script import the lib and run a full battle.
- Wall-clock: 0.5 day (optional — can stay in CLI for v1).

**Total estimate**: 4–6 hours Grok build time + 1–1.5 days wall-clock including reviews. ~600–850 LOC total for A+B (C optional). Grounded directly in the 281-line playthrough (mechanics) + 1029-line cli-app (surface + error text) + 18-line hp-words.

## Risks & Mitigations
- **Token / session handling**: Never store JWT in git. Mitigate: 0600 `~/.config/portalcolosseum/session.json`, `chmod` on write, clear on logout, support env var `PORTALCOLOSSEUM_JWT` for CI/agents. Test with revoked tokens.
- **Commit-driven advance UX for humans**: Busy hand commits silently advance on server. Mitigate: `wait` command (commits a no-op busy hand), auto-advance flag, clear " (advanced)" message in output (copy from cli-app:408 and playthrough:123). Never block on client timer.
- **hp_word-only monster display**: GET /runs never returns numeric HP. Mitigate: render exactly as `hp_word` (Healthy/Injured/Battered/Critical) from `hp-words.js`; document that liveness is server-only. Never attempt client-side filter.
- **The known dead `current_hp` filter in cli-app.js:400**: Explicitly forbidden. Mitigate: code review checklist item, search for `current_hp` in new code, always use `target_ids:[]` (playthrough pattern).
- **Consumables on hold**: Still prompt C1/C2. Mitigate: Enter = null in payload (already supported by backend).
- **Interactive prompt complexity**: `run new` has nested inventory re-list. Mitigate: copy the exact `getId` + prompt loop from cli-app.js:286.

## Acceptance Criteria ("done")
- `node cli.js login` → stores session, `logout` clears it.
- Full human playthrough from terminal: `login` → `run new` (pick weapons, skip C1/C2) → `battle start` → repeated `attack LH 12` (with auto-advance on busy) → `state` shows correct `hp_word` monsters → `battle end continue/stop` → run completes or player dies.
- Dev path: `grant` → every `/` command works (including `/abandon`).
- Agent path: one-shot `node cli.js attack ... --json` + `wait` produces machine-readable output.
- No `current_hp` filter anywhere; all monster display uses `hp_word`.
- Matches web CLI help text and error messages exactly where commands overlap.
- Passes `npm test` / lint (if added) and runs on clean Ubuntu node >=18 with only the existing `package.json` deps.
- Documented in AGENTS.md / kanban as PC-33 complete.

---

*Written from direct source inspection of cli-app.js (command surface + dead filter), [...path].js (routes), playthrough.mjs (battle loop + advance handling), hp-words.js, and package.json. No code written, no API calls made.*