# Portal Colosseum — Documentation Index

> Web arena battler built with HTML5 canvas + Supabase + Vercel. Developed by Spahrep with his son DarkJester. Live at [portalcolosseum.com](https://portalcolosseum.com).

---

## Project Overview

Portal Colosseum is a text-based browser arena battler being co-developed by father and son. The stack is HTML5 canvas (game rendering), Supabase (auth + database), and Vercel (hosting). Development happens on SladeMini (Ubuntu) with a multi-agent AI team: **Hermes** orchestrates, **Grok** handles heavy coding lifts, **Claude** does security reviews. Git author: `slademini@theslades.ca`.

## Agent Team & Workflow

The project uses a 3-hat model (not 6 separate bots):
- **Foreman** (Hermes, Laguna S 2.1) — plans, git, deploys, explains
- **Builder** (Laguna via `delegate_task`) — writes code, escalates to Grok after 2 failures
- **Security Reviewer** (Claude, one pass) — only when auth/RLS/secrets are touched

Model allocation: **Laguna is the default** (free). Grok (paid) is for hard problems. Claude ($20 pot) is for security ONLY. See the decision flow: plan → delegate (Laguna) → escalate to Grok if 2 failures → Claude review only if security triggers fire → preview deploy → commit.

---

## docs/ Directory

### Design & Architecture
- **`core-philosophy.md`** — The foundational design principles: father-son learning project, clean/minimal setups, open-source tools, iterative over over-engineered, KISS/YAGNI/DRY. Emphasizes procedurally generated content with realistic statistical distributions and honest admission of mistakes.
- **`ap-economy.md`** — The Action Point (AP) economy system. Covers daily AP generation, AP as a resource for player actions, and how AP scarcity drives meaningful decisions.
- **`combat-system.md`** — Arena combat mechanics: turn-based actions, weapon damage, hit chance calculations, and the core battle loop.
- **`inventory-slots.md`** — Player inventory structure: slot types, equipment slots (left hand, right hand, belt, etc.), and how items map to combat stats.
- **`loot-prize-pool.md`** — Weapon loot generation with procedural distributions: 60% C-grade, 30% B-grade, 10% A-grade. Covers weapon grade probabilities and stat ranges.
- **`portal-runs.md`** — The portal run gameplay loop: what happens when a player enters the portal, dungeon-like progression, and rewards.
- **`progression-gating.md`** — How player progression is gated: combat tier requirements, AP thresholds, and what unlocks at each stage.

### Technical Docs
- **`aws-future-stack.md`** — Future deployment architecture on AWS (S3 + CloudFront + Route 53), including cost estimates and migration from Vercel. Documents the roadmap for moving to AWS.
- **`naming-convention.md`** — Database naming conventions: singular snake_case table names (e.g., `weapon_template`, `attack_pool`, `user`), column naming rules, and SQL schema patterns.
- **`setup-environment-variables.md`** — Complete guide to configuring Supabase, Google OAuth, GitHub OAuth, and Vercel environment variables. Includes .env.local setup, OAuth redirect URIs, and troubleshooting.
- **`current-design-status.md`** — The authoritative snapshot of what's implemented vs. planned. Covers completed work (auth refactoring, PKCE migration), current bugs, and the next 5 milestones.
- **`weapon-generation.md`** — How weapons are procedurally generated: template system, stat randomization, grade assignment, and the attack pool mechanism.

### Agent Workflow
- **`coding-agent-playbook.md`** — How the Hermes/Grok/Claude team collaborates: delegation patterns, constraint rules (no new stack, no SladeMini production), definition of done, and the commit/push/preview cycle.

---

## Root-Level Documents

- **`SUPABASE_SETUP.md`** — Step-by-step Supabase project creation, OAuth provider configuration (Google, GitHub), site URL setup, and code integration. Includes troubleshooting for "Invalid API key" and redirect loops. Replaces the old "code 1234" login with real accounts.


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