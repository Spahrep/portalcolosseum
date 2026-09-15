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

(none yet)

## Approved & Promoted

(none yet)

## Rejected / Superseded

(none yet)
