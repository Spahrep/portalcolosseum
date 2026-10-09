# Portal Colosseum

Working rules for AI agents in this repo (Hermes, Grok workers, Claude Code, and any other tool pointed at this project).

## Model allocation — hand off to Grok
- All non-trivial coding and implementation work runs through Grok via
  `delegate_task` (delegation is pinned to xai-oauth / grok-4.3 — the
  SuperGrok subscription is PAID with a WEEKLY RESET quota; it is NOT free,
  every delegation burns that weekly budget, so batch Grok work deliberately).
- Do NOT implement multi-file, logic-heavy, or debugging tasks directly.
  Delegate them.
- Hermes edits directly ONLY for mechanical patches (small insertions,
  pattern-following edits, sed-style replacements, config tweaks).
- Claude Sonnet is reserved for security reviews ONLY when Spahrep explicitly
  requests one (Claude credits are precious — batch into one big review later,
  no per-delta passes).

## Kanban workflow (video-style development)
- Hermes = producer/overseer: creates the kanban of tasks, oversees progress,
  verifies results. Hermes writes no code/schema EXCEPT mechanical UI/CRUD
  edits, which Hermes does directly (Spahrep 2026-09-10).
- Grok (via delegate_task) = the builder: implements logic-heavy code and schema.
- Claude Sonnet = security reviewer ON REQUEST ONLY (Spahrep 2026-09-10):
  no automatic per-delta review passes — batch code up and run one big review
  when Spahrep asks for it.
- Spahrep = the director: sets goals, decides direction.
- Approval policy (Spahrep 2026-09-10): on-script work — anything Spahrep asked
  for — commits and applies WITHOUT approval; ship it and report. Approval is
  required ONLY for off-script actions: anything beyond the explicit ask
  (scope expansion, extra features, design changes, unrequested DB/content
  changes). When unsure whether an action is on-script, ask first.

## Ground rules
- Code lives in this repo. Run it. Post preview/live URLs when humans need to see.
- Production stays on Vercel + Supabase; no secrets in git.
- Migrations ship WITH the code they support and are applied as part of the work — no "do not apply / PM applies after review" gate (Spahrep 2026-10-01). Migrations are on-script: applied without approval once the supporting code is committed. Do not add gating headers to migration files. Keep generated functions/ddl idempotent (CREATE OR REPLACE / IF NOT EXISTS / IF EXISTS) so re-running is safe.
- Follow the portal-colosseum-agent-team skill for the full workflow.

## Context budget & working protocol (Spahrep 2026-10-08)
This repo's source is ~343k tokens (~2.6× the 130k window) and only grows.
How work fits without spilling context — applies to Hermes, Grok, Claude, ALL agents:

1. **NEVER load a whole file.** Read only the function/region you're touching:
   grep for the symbol, then read a tight range. Also learn from `wc -c file ÷ 4`
   to know a file's token cost before touching it. Rule of thumb: a file over
   ~800 lines is NEVER read whole — read ranges. One full read of
   `api/combat/[...path].js` or `js/battle-app.js` is ~19k / ~23k tokens that sit in
   the window all session; a task's work dies of that long before 130k.
2. **Track the source budget.** Stay under ~50k tokens of source in-window at
   any time — that leaves room for history + tool output, which are the rest.
3. **Eject finished work — the window does not reclaim itself.** A slice that
   served its edit is SPENT: don't re-read it for the next task, `/new` a fresh
   session between tasks, or keep only a 2-line summary of what a completed
   file does. One task per session is the cleanest "removal" there is.
4. **Delegate the heavy read+fix as ONE self-contained subagent**, NOT
   investigate-then-fix. The subagent reads and edits the big files in a
   throwaway window; only its small summary crosses back. Two chained
   subagents force you to relay findings into your own window — worse.
5. **Delegate only mechanical, spec-able work.** NEVER delegate open-ended
   design discussions — subagents cannot ask questions or talk to humans.
   Master-clock / enemy-AI design stays in-window.
6. **Verify subagent claims** — summaries are self-reports. Re-run the one
   specific test for that thing; believe the test, not the summary.
7. Splitting the three monster files (combat API 1,544 lines / battle-app
   2,364 / cli-app 967) into cohesive modules remains the long-term win,
   but the protocol above is the immediate fix — do it first, split later.
   Before grepping source for a symbol, check CODEMAP.md (repo root) —
   the generated file:line index (regenerate with `npm run codemap`).

Full brief template + worked example: `portal-colosseum-agent-team` skill →
`references/context-budget-discipline.md`.

## Authoring rules (write side)
How files get WRITTEN or SPLIT (as opposed to the read-side protocol above):
`pc-coding-standards` skill — byte budgets (`wc -c file ÷ 4` ≈ tokens; ≤15KB free,
≤30KB comfortable, >60KB a context bomb), task-scoped cascade ≤3 files / ≤40k
tokens, no import-back-up into app roots (`bind*()` hooks instead), data tables
and tests exempt, split at seams not line counts. Auto-loaded in Hermes sessions
(`skills.auto_load`) and force-available to dispatched kanban workers via
`pc-coding-standards`. The README "Authoring rules" section is the human-facing
copy of the same rules.

## Verification & scope (Spahrep 2026-09-16)
- Vercel preview/branch deployment URLs are SSO-walled: they 302 to
  vercel.com/sso-api. NEVER verify, curl, or browse against them, and never try
  to work around the SSO gate. It is platform auth, not app code, and not the
  task.
- Verify UI work ONLY on the live domain (https://portalcolosseum.com).
  NEVER test against local/working-tree files when asked to test (Spahrep
  2026-09-22). Local files can contain un-committed fixes that are NOT deployed
  or in CI — a "local browser pass" does NOT prove the shipped game works and
  has repeatedly produced false "it works" reports. When asked to test, the
  only valid result is a pass against the LIVE site (commit + push first, then
  verify live). Hitting an auth wall during verification is a STOP signal:
  switch to the known-good path or ask — don't chase the wall.
- A UI/feature task does not include Vercel, deployment, SSO, or auth work.
  If you don't know the verification path, ask Spahrep instead of improvising
  one.
