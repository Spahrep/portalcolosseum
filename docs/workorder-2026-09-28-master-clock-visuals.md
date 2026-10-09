# Workorder — Master Clock Visual Fidelity (A–H)

**Date:** 2026-09-28
**Author:** Hermes (foreman)
**Builder:** Grok (via delegate_task)
**Branch:** `wt/master-clock-visuals`
**Baseline:** HEAD `9a2879c`, `npm test` = 166 pass / 0 fail.

---

## Locked Design Decisions (in effect — do not re-litigate)

1. **Dotted box is dead.** Spahrep confirmed he *never asked* for a dotted/dashed
   insert-preview box. The dashed-yellow `.queue-insert-preview` box with the
   colored border/fill is unrequested design creep and must be **removed**. Space
   creation becomes a clean, empty animated gap — rows push down into an open slot,
   no visible bordered marker.
2. **Insert ceremony per Spahrep's 5-panel wireframe must actually play on player
   commits.** The hand-ready commit is currently a remove+insert in ONE tick, which
   suppresses the ceremony on the primary action. **Split the beat**: the ready row
   leaves, THEN the attack row lands through the full ceremony (space grows → insert
   marker wipes left-to-right → flashes → row settles). Matches the Master Clock
   "one item, peek→process→remove" model.
3. **Order per `action-visual-lifecycle.md` §8 / Core Rules / §9 (locked):**
   `peek → process → (typewriter + visuals IN PARALLEL) → await BOTH → removeHead
   LAST → next surfaces`. The current top item is **pinned at top while its narration
   types** and gets **NO exit animation**.
4. **Event-gated timing, not sleeps.** Removal slide-out/lift is already event-gated
   via `waitForEvent`. Insert space-creation and entry cleanup currently use
   `setTimeout(300)` / `setTimeout(1200)` magic numbers. Convert to event-gated
   barriers (`waitForEvent(animationend/transitionend)`), matching reduced-motion
   short-circuits.

---

## Issues To Fix (all in scope)

### A. Master-clock order reversed on autonomous ticks (top priority)
`tickLoop()` POSTs `/runs/{id}/tick`; the engine already `remove()`d the head, then the
client renders the queue WITHOUT that row, plays its exit slide, and only THEN types the
damage line. A player reads "Glimmerling hits you for 12" and the row is already gone —
the narration references an action the queue dropped.
**Fix:** the processed head stays pinned during its narration+visuals; it is removed only
after both complete. Complete the eat-the-head barrier end-to-end.

### B. Current top row must NOT get an exit animation
`action-visual-lifecycle.md` §4: "No animation for the current top item — it stays pinned
while processing." Current `tickLoop` diffs the removed head as a `resolved` row and runs
`runQueueRemoval` (slide-out + group-lift) on it. The pinned-while-processing invariant
must hold on the master-clock path, not just the commit path.
**Fix:** distinguish head-removal (silent pop after narration) from genuine non-head removal
(exists → slide-out + lift).

### C. Narration must be awaited on the master clock
No barrier between "line typed" and the next `/tick` POST → lines overlap, next event
starts mid-narration. Per §9, both typewriter + visuals must complete before proceeding.
**Fix:** await the narration render (the `typeFeedLines`/`appendFeedLine` path) before the
next tick fetches.

### D. Insert timing must be event-gated, not sleep-based
Replace `setTimeout(300)` (space-creation preview) and `setTimeout(1200)` (entry cleanup)
with `waitForEvent` barriers tied to the real CSS animation/transition durations. Remove
magic-number drift under reduced-motion / longer keyframes.

### E. Remove the unrequested dotted box (locked decision 1)
The dashed-yellow `.queue-insert-preview` bordered/filled box is gone. Space creation =
clean open gap (rows pushed down), no visible bordered marker.

### F. Stages 3 & 4 (insert marker grows left→right + flashes) built as storyboarded
Per the wireframe, after the space opens a yellow insert marker must: wipe in from left to right
(≈250ms ease-in-out) → flash once (brighten-dim ≈150ms) → then be replaced by the real row.

### G. Space-creation must fire on player commits (locked decision 2)
Split the hand-ready commit's remove+insert into two beats so the full ceremony plays on the
main action. Rows below push down cleanly on the attack landing.

### H. Docs drift corrected
Update `docs/action-queue-animation.md`:
- Status table no longer says Stages 2/3/4 "Not implemented."
- Stage 3 spec `.queue-insert-bar` width 0→100% must match what is actually built.
- Record the two locked decisions above (no dotted box; commit ceremony split).
Keep it consistent with what ships so the next agent isn't steered wrong.

---

## Constraints

- Edit ONLY: `js/battle-app.js`, `js/combat/engine.js`, `run.html`, `docs/action-queue-animation.md`, and test files under `tests/`.
- Do NOT touch Vercel config, auth, Supabase schema, or DB migrations.
- Do NOT introduce a new animation framework/dependency. Stay in existing CSS keyframes + `waitForEvent`.
- **Commit ONLY on branch `wt/master-clock-visuals`. NEVER push to main.**
- Run `npm test` before declaring done; report the REAL pass/fail counts (baseline 166).
- Preserve existing reduced-motion and INSTANT-speed-preset behavior (both skip animations).

---

## Definition of Done (all verifiable)

1. No `setTimeout` sleep-based barrier remains in `tickLoop`/BattleClock for preview or
   entry timing (all event-gated via `waitForEvent`).
2. `.queue-insert-preview` (dashed bordered box) removed from JS + CSS and replaced by a
   clean gap / updated class name that reflects empty space.
3. Autonomous-tick head stays pinned during narration: head removal is a silent pop after
   narration+visuals, NOT an exit slide. Non-head removals still slide out + group-lift.
4. Narration completed (`typeFeedLines` promise or event) before the next `/tick` POST.
5. Insert marker wipe + flash stages present as a DISTINCT element, wired
   to `waitForEvent`.
6. Hand-ready commit plays the full ceremony (space grows → wipe → flash → row settles).
7. `js/combat/engine.js` still returns the processed head; `removeHead`/remove fires ONLY
   after process — the Master Clock "remove LAST" ordering is intact server-side.
8. `docs/action-queue-animation.md` updated to match shipped behavior + locked decisions.
9. Real commit on `wt/master-clock-visuals`. `git log -1 --format='%H %s'` provided.
10. `npm test` passes (aim ≥166), true counts reported.
