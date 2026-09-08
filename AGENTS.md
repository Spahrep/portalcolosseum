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

## Ground rules
- Code lives in this repo. Run it. Post preview/live URLs when humans need to see.
- Production stays on Vercel + Supabase; no secrets in git.
- Follow the portal-colosseum-agent-team skill for the full workflow.
