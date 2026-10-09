# Portal Colosseum — Docs Read-Order

**Read this file first.** It is the map to the other docs. It exists because
the full `docs/` tree is ~140k tokens (~73 files) — loading it whole blows the
context window before a single line of code is read. You do not read the docs;
you read the ONE doc for the task at hand.

## Read in order (smallest, highest-value first)

1. **AGENTS.md** (repo root) — the standing working protocol: who writes code
   (Grok via delegate_task), what Hermes touches directly (mechanical only),
   verification rules, and the Context Budget protocol. Load this in every
   session. This is the **workflow source of truth**.
2. **docs/core-philosophy.md** — the design principles (north star). The one
   page that explains WHY the game works how it does. This is the **design-principles source of truth**.
3. **The ONE mechanic doc for your task** — never the whole tree. Pick just:
   - Combat clock / turn order / queue → **docs/action-visual-lifecycle.md** (the **combat-clock source of truth**)
   - Stats, damage, weapons → **docs/weapon-generation.md** or **docs/combat-system.md**
   - Loot / stop-share / prize pool → **docs/loot-prize-pool.md**
   - Consumables / potions → **docs/consumables.md** (contract: docs/potion-contract.md)
   - Run flow / UX → **docs/run-ux-flow.md** or **docs/battle-status-ui.md**
   - Economy / AP / gold → **docs/ap-economy.md**
   - Enemy encounter generation → **docs/encounter-system.md**
   - Inventory slots / loadout → **docs/inventory-slots.md**
4. **docs/pending-decisions.md** — grep by decision ID (PC-DEC-###) ONLY.
   Do NOT read it whole (~15k tokens of mostly-decided history).

## What to SKIP (dated history, not living spec)

- `docs/current-design-status.md` — do NOT trust its line anchors (historically
  wrong); use it only as a broad index, verify any file:line against real code.
- `docs/reviews/*` and `docs/workorder-*.md` — dated logs, intentional history.
- `docs/migration-plan-*.md`, `docs/*-brief.md`, `docs/*-refactor-brief.md` — one-off plans.
- `docs/coding-agent-playbook.md` — OUTDATED, contradicts AGENTS.md; ignore.
- `SUPABASE_SETUP.md` — historical, superseded by docs/setup-environment-variables.md.
- `*.hermes/plans`, `.hermesplans/`, `.hermes/briefs/` — dated scratch, not specs.
- `/home/spahrep/portal-colosseum-design-notes` — does not exist; don't look for it.

## If a decision or rule isn't in the one doc you read

Grep `pending-decisions.md` for the topic (e.g. `grep -n "stop-share\|PC-DEC-056" docs/pending-decisions.md`). If it's not there and you're about to implement something, ask — do not improvise a ruling.

## Rule of thumb

One task = AGENTS.md + core-philosophy.md + **one** mechanic doc. That's ~11k tokens, fits comfortably. Anything more is context you don't need.

## Test-suite baseline (record it, don't invent it)

Current full-suite baseline (updated 2026-10-08): **273 tests / 64 suites / 273 pass / 0 fail** in ~185ms. Run `npm test` (= `node --test tests/*.test.js`). When you change code, re-run ONE test file first (`node --test tests/<file>.test.js`) for the verify loop, then the full suite at the end. Several docs cite stale baselines (84/166/173/178) — ignore those; 273 is current. If the count changes, update this line and the fix-workorder that moved it.
