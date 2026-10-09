# Action Queue — Compact Spec (AI-use)

Source of truth: `docs/action-visual-lifecycle.md` (canon), `docs/action-queue-animation.md`,
`docs/workorder-2026-09-28-queue-sorted-insert.md`, `docs/current-design-status.md`.
**Visual choreography (how rows move on screen): `docs/action-queue-visual-choreography.md` — authoritative.**
This file is a condensed reference for agents; the canon doc wins on conflict.

## Model
- Queue = linked-list insert, NEVER globally re-sorted. Each row spliced once at insert
  (`addEvent` → `orderedInsertIndex`, tic-queue.js:34-52) by tics ascending, then order frozen.
- Head = `queue[0]`. Ready rows are NOT skipped. A `ready` head = that actor's turn.
- Master Clock: peek → process (rolls/math/narration) → remove. One event at a time. No batches.
- **Remove + insert, every transition** (Spahrep, 2026-10-09): a box gets to the top, it is
  processed, a NEW box is inserted (new entry, fresh id, at its queue position), the old box
  is removed. Exit is the LAST action. No morphing, no re-insertion, no shared node.
- "Whose turn" = queue head event, never hand state. `playerReady`/`needsInput` derive from head.
- Ties: status/buff/expiry first, then other events, then `ready`; within category LH→RH→monsters.
- Tic-0 seed (PC-DEC-060): one `approach` row per hand at weapon speed; one `cooldown` row per
  living monster at `mon.speed`. Clock does NOT run at start.

## Row lifecycle (player hand)
ready → (commit) → winding → impact → cooldown → ready
- commit: remove ready head + insert winding (one atomic mutation). Potion: drinking → recovery → ready.
- swap: remove ready + insert cooldown (delay = max speeds).
- winding→impact carries attack data; impact resolves damage; cooldown→ready via markHandReady.
- EVERY transition is remove + insert. New box in, old box out. No relabel.

## Row lifecycle (monster)
cooldown → winding → impact → cooldown (no ready, no live `attack`; legacy `attack` resolves as impact)
- cooldown fires → pick attack, insert winding at `mon.speed * prepare_multiplier` (floor 1).
- winding fires → insert impact at 0 (no damage), carry strike.
- impact fires → roll once, apply to player, insert cooldown at stored `cooldownTicks`.
- death: no cooldown inserted; cancel queued rows for that monster (PC-DEC-054).
- Every transition is remove + insert. The ONLY monster relabel: cooldown row at the top
  swaps text "recovering" → "preparing to attack" in place, matching the typewriter narration.

## The only two relabel cases (everything else is remove + insert)
1. **Tic countdown updates** — box holds position, only the number changes (33 → 23).
2. **Monster recovering → preparing to attack** — when the cooldown row reaches the top,
   box holds position, text swaps (optional fade). No other text change is a relabel.

## Animation contract
- Enter: `.queue-row-enter` (player, slide) / `.queue-row-monster-enter` (monster, pulse). Armed on
  phase change, not just first build. Class removed on animationend.
- Exit: `.queue-row-exit` (slide right + fade, stays in flow), then group-lift of siblings (FLIP).
  Exit is the LAST action — the successor slides in FIRST.
- Insert ceremony (5 stages): prediction bar → clean gap grows → marker wipes → flashes → row settles.
  Event-gated via waitForEvent (animationend/transitionend), NOT setTimeout. No dotted box.
- Order: successor lands FIRST (enter), then processed row slides out, then siblings lift.
- `animationsSkipped` (instant preset / reduced-motion): silent, no animation, direct DOM mutation.
- Group-lift is ONE continuous FLIP motion — no jump, no teleport, no double-animation.

## Display labels (§7)
- winding: "L. Hand <Attack>" + tic
- impact: "L. Hand <Attack>" + "—"
- cooldown/recovery: "L. Hand Ready" + tic
- ready: "L. Hand Ready" + "—"
- monster winding/impact: "<Name> (A)'s <Attack>" + tic
- monster cooldown: "<Name> recovering" + tic (relabels to "<Name> preparing to attack" at the top)
- approach: "L. Hand Ready" + tic
- Player attack rows with committed target: indented sub-line "└─ <Name> (A)".

## Client flow (battle-app.js)
- `advance()` = single ceremony owner after commit. One /tick → one presentation → stop on
  playerReady/needsInput/done/battleOver.
- Menu opens ONLY when head is a ready row (`readyHeadOf`).
- `renderQueue` fast path compares (label, event) — not raw ids — so a tic-only update never moves or re-slides the row. An event change is remove + insert.
- No shared DOM node pretending to be the same hand across entries — each entry is its own box.
