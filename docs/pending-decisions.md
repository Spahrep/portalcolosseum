# Pending Design Decisions

This file is the CAPTURE SURFACE for design decisions stated by Spahrep or DarkJester
(mainly in Discord threads). Nothing here is authoritative until approved.

## The gate (read this before touching anything)

1. **Capture is verbatim.** An entry is a direct quote of what the deciding person said.
   No paraphrase, no summary, no interpretation, no inference. If the bot cannot quote
   it verbatim, it does not capture it.
2. **Promotion is human-only.** An entry moves into the permanent design docs
   (current-design-status.md, weapon-generation.md, consumables.md, etc.) ONLY when
   Spahrep (Discord 108179732821970944) or DarkJester (1501167172842684506) explicitly
   approves it — a reply "pin it" or `/pin <id>` in the thread, or a direct instruction
   here. The bot checks the author ID server-side; it can never self-approve.
3. **Never edit permanent docs from a capture.** Pending entries stay pending until a
   human approves. Ambiguous statements are captured anyway — filtering happens at
   approval, not capture (pending entries are cheap to delete, expensive to miss).
4. **Conflict checks are advisory.** The weekly sweep (docs/reviews/) flags
   contradictions; it never resolves them.

## Entry format

    - ID: PC-DEC-<NNN>
      Date: YYYY-MM-DD
      Source: Discord thread "<name>" / kanban <id> / link
      Speaker: Spahrep | DarkJester
      Verbatim: "..."
      Status: PENDING | APPROVED | REJECTED | SUPERSEDED (by PC-DEC-<id>)
      Notes: (optional — only clarifications asked & answered, never inference)

## Pending

- ID: PC-DEC-001
  Date: 2026-09-15
  Source: CLI session (C1 triage of docs/reviews/2026-09-15.md)
  Speaker: Spahrep
  Verbatim: "We can still do the monster instnace, it's just saved in a JSON for the portal instnace. I was informed this was a faster/lighter way to do it instead of a DB heavy way to do it. Do you dissagree?"
  Status: APPROVED (pinned 2026-09-15 — "ok, so let's fix that up")
  Notes: Resolves sweep conflict C1. Implemented as generate_monster() returning jsonb (no row persisted); instance lives in portal_run.battle_state jsonb. Also relevant: HP roll uses uniform_int (even distribution, Spahrep 2026-09-08), not Box-Muller — docs describe both the table and the distribution wrongly.

## Approved & Promoted

- ID: PC-DEC-001 — Monster instances live in JSON (battle_state), not a table. Promoted to current-design-status.md (§ Monster Stats), combat-engine-plan.md, admin-gui-brief.md. Decided by Spahrep, 2026-09-15.

## Rejected / Superseded

(none yet)
