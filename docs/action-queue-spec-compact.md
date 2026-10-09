# Action Queue — Compact Spec (AI-use)

Source of truth: `docs/action-visual-lifecycle.md` (canon), `docs/action-queue-animation.md`,
`docs/workorder-2026-09-28-queue-sorted-insert.md`, `docs/current-design-status.md`.
**Visual choreography (how rows move on screen): `docs/action-queue-visual-choreography.md` — authoritative.**
This file is a condensed reference for agents; the canon doc wins on conflict.

## Model
- Queue = linked-list insert, NEVER globally re-sorted. Each row spliced once at insert
  (`addEvent` → `orderedInsertIndex`, tic-queue.js:34-52) by tics ascending, then order frozen.
- Head = `queue[0]`. Ready rows are NOT skipped. A `ready` head = that actor's turn.
- **Tics are a visual, not the driver. Tics communicate timing only.** `advance()` loops calling
  `/tick` until the server returns a player decision. Each `/tick` processes ONE queue head
  (rolls/math/narration), then the next, and the next. Tic counts on rows decrement as events
  ahead fire (`applyTickCost`, engine.js:125-131) so the player can read the timeline; a box "N
  tics out" is not gated by tics — it just sits until the events ahead of it finish firing, at
  which point its tics have already counted down. The tics are a readout, not a scheduler.
- **Engine (server) array order — CANON, matches the UI (2026-10-09 refactor):** `tick()` does
  peek → process (fire the handler, which inserts the successor) → pop the processed head
  LAST → decrement remaining tics. The head stays in the array while the handler runs; the
  handlers insert their successor by tic-ordering (`addEvent`/`orderedInsertIndex`), so the
  old head's presence never affects where the successor lands. A `ready` head is never popped
  (returns `needsInput`, stays put). This matches `action-visual-lifecycle.md` and the decided
  model exactly — there is no divergence between engine and UI on the order.
- **UI (client) visual order — exit is the LAST action:** the processed head's box stays VISIBLE
  (pinned via `pinProcessedHead`) while the server processes and the clock runs; the new
  replacement box slides in FIRST (insert ceremony), THEN the old top box slides out
  (`releaseProcessedHead` → `runQueueRemoval`), THEN the remaining rows lift as one FLIP
  (battle-app.js:126-147, 630-660, 719-738). "Remove" in the UI means the box leaves the DOM —
  never when processing starts, only after the successor has landed.
- **The one transition that inserts no successor: buff expiry.** `buff_expiry` fires, drops the
  buff, and returns — no replacement box is inserted (engine.js:345-355). Its box simply exits
  when it fires. Every other transition inserts a successor.
- Remove + insert, every OTHER transition: the fired box is processed, a NEW box is inserted
  (new entry, fresh id, at its queue position), then the old box exits (UI). No morphing, no
  re-insertion, no shared node.
- "Whose turn" = queue head event, never hand state. `playerReady`/`needsInput` derive from head.
- Ties: status/buff/expiry first, then other events, then `ready`; within category LH→RH→monsters.
- Tic-0 seed (PC-DEC-060): one `approach` row per hand at weapon speed; one `cooldown` row per
  living monster at `mon.speed`. Clock does NOT run at start.

## Row lifecycle (player hand)
ready → (commit) → winding → impact → cooldown → ready
- Engine: `consumeReadyForHand` removes the ready head, `commitNewRow` inserts winding (one
  atomic engine mutation). UI: successor slides in, then the ready box exits LAST. Potion:
  drinking → recovery → ready.
- swap: remove ready + insert cooldown (delay = max speeds).
- winding→impact carries attack data; impact resolves damage; cooldown→ready via markHandReady.
- EVERY transition (except buff expiry) is remove + insert — the fired box is replaced by a NEW
  box; the old one exits last. New box in, old box out. No relabel.

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
- Exit: `.queue-row-exit` (slide right + fade, stays in flow), then the remaining rows slide up
  together as one group using FLIP (First-Last-Invert-Play). FLIP is the technique for a smooth
  upward GLIDE — the rows literally slide up as one unit; it is not a flip/turnover motion.
  Exit is the LAST action — the successor slides in FIRST.
- Insert ceremony (5 stages): prediction bar → clean gap grows → marker wipes → flashes → row settles.
  Event-gated via waitForEvent (animationend/transitionend), NOT setTimeout. No dotted box.
- Order: successor lands FIRST (enter), then processed row slides out, then siblings slide up.
- Group-lift: the rows slide upward together in ONE continuous motion — no jump, no teleport,
  no double-animation.

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
