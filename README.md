# Portal Colosseum — Documentation Index

> Web arena battler built with HTML5 canvas + Supabase + Vercel. Developed by Spahrep with his son DarkJester. Live at [portalcolosseum.com](https://portalcolosseum.com).

> **🗺️ READ THIS FIRST: [`DOCS.md`](DOCS.md)** — the read-order map to the docs, one source of truth per role, and what to skip. The full `docs/` tree is ~140k tokens; load the one doc you need, never the tree.

---

## Project Overview

Portal Colosseum is a text-based browser arena battler being co-developed by father and son. The stack is HTML5 canvas (game rendering), Supabase (auth + database), and Vercel (hosting). Development happens on SladeMini (Ubuntu) with a multi-agent AI team: **Hermes** orchestrates, **Grok** handles heavy coding lifts, **Claude** does security reviews. Git author: `slademini@theslades.ca`.

## Agent Team & Workflow

**The workflow source of truth is [`AGENTS.md`](AGENTS.md)** — this README is the human-facing index and may drift. The current model allocation (updated 2026-10-08):
- **Hermes** — Foreman/orchestrator: plans, git, deploys, explains, mechanical-only direct edits.
- **Grok (via `delegate_task`, pinned xai-oauth)** — the **default Builder** for all non-mechanical code, per AGENTS.md. Grok is PAID (SuperGrok weekly-reset quota, not free); batch deliberately.
- **Claude (Claude Code CLI)** — Security Reviewer, ON REQUEST ONLY (Spahrep), one pass, batched.
- Approval: on-script work (anything Spahrep asked for) commits + ships WITHOUT approval. Approval required ONLY for off-script scope expansion.

See AGENTS.md for the full protocol, including the Context Budget discipline (never read a whole file over ~800 lines; one self-contained subagent per change).

---

## Authoring rules (keeping files context-cheap)

How files get written so a task stays cheap to load. Human-facing companion to the consumption rules in [`AGENTS.md`](AGENTS.md): read a range, never a whole file, and learn the cost with `wc -c ÷ 4` before touching it. The ~800-line cap there is when to stop reading a file whole; it is not a split target. Figures measured 2026-10-09.

1. **Budget is bytes, not lines.** `wc -c ÷ 4` ≈ tokens. Line count is not the budget.
   - ≤15KB — free to load.
   - ≤30KB — comfortable.
   - **>60KB — a context bomb**, regardless of cohesion.
   Measured contrast: `js/battle-app.js` is 2,339 lines / 92KB / ~23k tokens (a bomb). `js/cli-app.js` is 967 lines / 37KB (over comfortable only).
2. **Locality is the real metric.** Any single change touches ≤3 files, and the import cascade those files drag in stays under ~40k tokens. An individual file may bend the size rule; a cascade may not. Count the cascade, not the file you opened.
   A `js/combat/` engine edit costs ~11k tokens. A queue-render edit costs ~45k (~181KB) because `js/battle-app.js` imports the battle UI — cascade listed under that file below.
3. **No import-back-up.** Render and leaf modules never import an app root (`js/battle-app.js`, `js/cli-app.js`, `js/admin-app.js`). A leaf that imports the root pulls the cascade the split was meant to kill.
   State flows down through `bind*()` hooks — the PC-78 pattern (`bindFeedRender`, `bindDiceRender`, `bindUxController`). The root calls the leaf and passes hooks in; the leaf does not reach back up.
4. **Data tables are exempt.** Combat stats, seed data, and route configs live in data directories. Grep them; do not read them. A large table is not a context bomb. Size rules do not apply.
5. **Tests and generated files are exempt.** Do not split a test or a generated artifact to chase the byte budget. The suite is the check when a real seam split lands — 283 tests, 0 fail, when these figures were measured.
6. **Split at seams, not at line counts.** Split only where a boundary already exists, pass state explicitly, change no behavior.
   Cutting an entangled block to hit a line count is not a split.
   - Web CLI, command/panel seams (`9da2e51`): builders, panels, and dev commands left `cli-app.js`; the dispatcher and session stayed.
   - Combat API, dev-route seam (`dc69f50`): `/dev/*` admin routes left the player catch-all. The catch-all is still a bomb; the seam was the right cut.

### Files over budget today

- **`js/battle-app.js`** — 2,339 lines / 92KB / ~23k tokens. Imports 10 modules. A queue-render edit drags ~181KB ≈ 45k tokens: `battle-app` + `queue-render` + `feed-render` + `monster-render` + `dice-render` + `ux-controller` + `tic-queue` + `potion-target` + `action-menu-rows` + `combat-api`.
- **`api/combat/[...path].js`** — 1,544 lines / 75KB / ~19k tokens. Still a bomb after the `/dev/*` route split (`dc69f50`).
- **`js/admin-app.js`** — 1,314 lines / 60KB. At the bomb threshold.
- **`js/cli-app.js`** — 967 lines / 37KB. Over comfortable. Command/panel split already done (`9da2e51`).
- **`js/run-equip-app.js`** — 968 lines / 36KB. Over comfortable.

`js/battle/` and `js/combat/` are healthy — every file there is under 30KB.
Do not split those trees to chase a budget they already meet.

---

## docs/ Directory

### Design & Architecture
- **`core-philosophy.md`** — The foundational design principles: father-son learning project, clean/minimal setups, open-source tools, iterative over over-engineered, KISS/YAGNI/DRY. Emphasizes procedurally generated content with realistic statistical distributions and honest admission of mistakes.
- **`ap-economy.md`** — The Action Point (AP) economy system: 3× cap (no FOMO), deepest-run leaderboard, AP sinks (runs, shop resets), gold as secondary meter, wizard tent healing (TBD).
- **`combat-system.md`** — Arena combat mechanics: turn-based actions, weapon damage, hit chance calculations, and the core battle loop.
- **`consumables.md`** — Consumable design: template rolls (effect + drink speed), hand-based pre/post timing, buffs apply to the player, loadout Potion A/B slots, prize-pool loot rules. Weapons + consumables are the only MVP item types.
- **`inventory-slots.md`** — Player inventory structure: 20-slot backpack, 5-item run loadout (Hand L/R, Belt Loop, Potion A/B), loadout locked at entry, belt-loop weapon swap.
- **`loot-prize-pool.md`** — Loot drops (LP budget + gold) and prize pool rules: finish = all, stop = reduced share, die = forfeit pool (brought items safe). Consumables are equipment-class loot.
- **`portal-runs.md`** — The portal run gameplay loop: 5 fights, push-your-luck prize pool, portal tiers as item power tiers, entry costs, anti-soft-lock rule (old portals stay farmable).
- **`progression-gating.md`** — How player progression is gated: portal unlocks, the 3-active-portals limit, and the "magical aura" shop tiering.
- **`shops-and-economy.md`** — Shops & item economy: output-based pricing (shop by roll, drops by template), per-category price curves, portal-gated shop tiers, exponential rerolls with AP reset, three gates against grinding.

- `docs/main` — see `DOCS.md` for the read-order. Notable: `naming-convention.md` (singular snake_case DB conventions), `setup-environment-variables.md` (Supabase/OAuth config — replaces SUPABASE_SETUP.md, which is historical), `weapon-generation.md` (template system, stat randomization, grade). **`current-design-status.md` is an INDEX only — its file:line anchors are historically unreliable; verify any pointer against real code.**

### Agent Workflow
- **`coding-agent-playbook.md`** — OUTDATED and contradicts AGENTS.md (it names OpenCode as the default coder; AGENTS.md pins Grok). Ignore it; **AGENTS.md is the workflow source of truth.**

---

## Root-Level Documents

- **`SUPABASE_SETUP.md`** — **HISTORICAL.** Superseded by `docs/setup-environment-variables.md` and the live `/api/env.js` auth path. Ignore for setup.


## Shared Documents (/home/spahrep/shared/)

- **`portal-colosseum-team-setup.md`** — The live team setup document: 3 standing hats, model allocation ladder, testing strategy ("tests when bugs would be silent/expensive"), security gate process, and the handoff protocol. This is the active charter.
- **`portal-colosseum-team-setup-for-grok.md`** — Background context file for Grok collaboration. Outlines the 5 questions about ideal team setup and the resources/skills available.

---

## Hermes Skill References (~/.hermes/skills/.../)

The active Hermes skill `portal-colosseum-agent-team` has these reference docs:
- **`references/model-allocation-policy.md`** — The T0→T2b ladder: Laguna (free) → Grok (paid) → Claude (security only). Budget guardrails: Claude $20 pot, Grok weekly pool.
- **`references/csp-inline-js-fix.md`** — How CSP violations were resolved: moved inline JS to external ES modules, removed onclick handlers, removed localStorage. Includes curl reproduction recipes.
- **`references/town-navigation-ui.md`** — The town map UI pattern: panorama panning via CSS transforms on `#game-container`, checkbox-style location markers with `[ ]`/`[x]`, arrow-key navigation, and the critical design decision to pan the container (not the background image) so markers stay attached to buildings.
- **`references/claude-code-auth.md`** — How to authenticate Claude Code CLI on SladeMini (headless machine): API key in `~/.anthropic-api-key` and `~/.claude/settings.json`, troubleshooting identity-linked keys.
- **`references/supabase-email-deliverability.md`** — Documents that Supabase's free email provider (`noreply@mail.app.supabase.co`) has poor deliverability (emails land in spam, 2+ hour delays). Recommends configuring SMTP with SendGrid/Resend/Postmark.

---

## Credential Reference

- **`/home/spahrep/important.txt`** — Local credential store (NOT in git). Contains: Slack tokens, Discord bot token, Google OAuth credentials, Claude API key, Supabase secret key, and Gmail SMTP credentials. This file is the source of truth for all service credentials used in local development and deployment.