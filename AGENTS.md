# Portal Colosseum

Working rules for AI agents in this repo (Hermes, Grok workers, Claude Code, and any other tool pointed at this project).

## Model allocation — hand off to Grok
- All non-trivial coding and implementation work runs through Grok via
  `delegate_task` (delegation is pinned to xai-oauth / grok-4.3 — the
  SuperGrok subscription is already paid, so this costs $0 marginal).
- Do NOT implement multi-file, logic-heavy, or debugging tasks directly.
  Delegate them.
- Hermes edits directly ONLY for mechanical patches (small insertions,
  pattern-following edits, sed-style replacements, config tweaks).
- Claude Sonnet stays reserved for security reviews only (one pass per trigger).

## Kanban workflow (video-style development)
- Hermes = producer/overseer: creates the kanban of tasks, oversees progress,
  verifies results. Hermes writes no code/schema EXCEPT mechanical UI/CRUD
  edits, which Hermes does directly (Spahrep 2026-09-10).
- Grok (via delegate_task) = the builder: implements logic-heavy code and schema.
- Claude Sonnet = security reviewer: any code touching auth/RLS/secrets/security
  gets one Claude security-review pass before merge (one pass per trigger).
- Spahrep = the director: sets goals, decides direction.
- Approval policy (Spahrep 2026-09-10): on-script work — anything Spahrep asked
  for — commits and applies WITHOUT approval; ship it and report. Approval is
  required ONLY for off-script actions: anything beyond the explicit ask
  (scope expansion, extra features, design changes, unrequested DB/content
  changes). When unsure whether an action is on-script, ask first.

## Ground rules
- Code lives in this repo. Run it. Post preview/live URLs when humans need to see.
- Production stays on Vercel + Supabase; no secrets in git.
- Follow the portal-colosseum-agent-team skill for the full workflow.
