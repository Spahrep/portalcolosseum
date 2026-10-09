# Workorder — Queue becomes a true insertion-ordered linked list (no sort, tics display-only)

> **⚠️ NOTE (2026-10-09):** The "stable-key renderer" and "one row per hand via `h:LH`/`h:RH`"
> mechanisms described in these workorders are **superseded**. The locked model is remove + insert
> on every transition (new box in, old box out) — no shared DOM node. See
> `docs/action-queue-visual-choreography.md`. These workorders are kept for their
> tics-sort/ordering content, which is unchanged.
>
> **SUPERSEDED — do not implement.** The shipped engine splices each new row into tics-ascending position once at insert (`orderedInsertIndex`, `js/combat/tic-queue.js:32-50`). This FIFO contract contradicts that code and `docs/workorder-2026-09-28-queue-sorted-insert.md`. Kept as the rejected spec. PC-103.

**Author:** Hermes (overseer)
**Builder:** Grok (via delegate_task)
**Branch:** `wt/queue-insertion-order`
**Baseline:** `main` == `83cff35` (as tracked by `origin/main`)
**Spec authority:** `docs/action-visual-lifecycle.md` §4 and §17; `docs/action-queue-animation.md`

---

## The problem

The queue is being treated as a **tics-sorted timeline**, but the design spec says it is a
**linked list ordered at INSERTION time**, where tics are **display values only** and never
drive order.

Current code **contradicts the spec** in two places:

1. **Engine (`js/combat/tic-queue.js` + `js/combat/engine.js`):** `sortQueue(queue)` sorts the
   array by tics ascending (player-first on ties), and it runs on **every** queue operation:
   - `tic-queue.js`: `popNext` (line 18), `peekHead` (line 34), `removeHead` (line 44),
     `commitNewRow` (line 67).
   - `engine.js`: ~19 call sites (`stepOnce` ~252, `process` ~287, `tick` ~305+, and the
     `sortQueue(state.queue)` calls throughout weapon/potion/attack handling).
   Because tics recompute every tick, a tics-sort **reorders the array on every operation**,
   which is what makes the queue visually churn.

2. **Client (`js/battle-app.js`):** `sortQueueRows` re-sorts by tics and is called in the
   render path — `playInsertCeremony` (line 472) and `renderQueue` (lines 1206, 1373).
   The client mirrors the re-sort on screen, so rows visibly jump/slide past each other on a
   normal countdown tick. This is the "weird stuff" the user sees, and the deeper cause of the
   earlier countdown re-slide.

## The spec (what the user wants — do EXACTLY this, do not re-litigate)

From `docs/action-visual-lifecycle.md`:

> §4: Tics are display values, not a timing mechanism. The queue is a linked list ordered at
> INSERTION time — no global sort, no re-ordering. Tics help the player read timing but do
> NOT drive processing.

> §17: The queue is a linked list ordered at INSERTION time — no global sort, no re-ordering.

**Target behavior:**

- The queue array order **is the order rows were inserted** (`addEvent` appends — that is
  already correct). That order is **frozen**: nothing ever re-sorts it.
- The **head** is the **first non-`ready` row in array order** (the oldest inserted actionable
  item). Leading `ready` rows (player's Ready hands waiting for input) are skipped the same way
  they are today, but **without sorting first**.
- Tics are still **decremented** (current `popNext` subtracts the head's tics from all rows) —
  that is the countdown **readout**. Decrementing must keep working, but it must NOT change
  array order and therefore must not move rows on screen.
- Rows keep a **stable on-screen position** once placed. A countdown tick updates only the tic
  numbers in place — no slide, no re-order, no re-slide of the bottom rows.

## Required changes

### 1. Engine — remove all tics-sorting (`js/combat/tic-queue.js`, `js/combat/engine.js`)

- **Delete** the `sortQueue(queue)` calls from `popNext`, `peekHead`, `removeHead`,
  `commitNewRow`, and **every** `sortQueue(state.queue)` call site in `engine.js`.
- Head selection becomes: scan the array **in its existing order** and return the first row
  whose `event !== 'ready'` (skip leading `ready` rows only). `popNext`/`peekHead`/`removeHead`
  must no longer sort.
- **Remove** the `sortQueue` export (or reduce it to a documented no-op if any test imports it —
  prefer full removal if nothing depends on it). Do not leave a sorting function on the hot path.
- **Preserve** all combat math, tic decrement logic, target resolution, damage, cooldown
  lifecycles, feed/narration — ONLY the ordering mechanism changes.

### 2. Client — render in engine order, never re-sort (`js/battle-app.js`)

- Remove `sortQueueRows(...)` from `renderQueue` (~1206, ~1373) and from `playInsertCeremony`
  (~472). Render the rows **in the engine-provided order** (which is now insertion order).
- If `sortQueueRows` becomes unused, remove it (or keep only if used for the timing-bar math —
  see note below; prefer removal if unused).
- `updateQueueRowInPlace` already mutates tics in place — verify it no longer re-orders.
- The bottom monster `recovering` cooldown row must keep its position and just show the tic
  count decrement in place.

### 3. Timing-bar / prediction-bar math (`computeTimingMarkers` in `tic-queue.js`, ~79)

- This does a **local** `[...queue].sort()` on a copy purely to compute `[minT,maxT]` bar
  boundary rows for the PC-56 prediction bar. This does **not** mutate the queue order, so it is
  NOT a violation. Keep it, but rename/comment so it is clearly a read-only copy-sort for the
  bar, not the queue order. Do not remove it (the prediction bar depends on it).

### 4. Tests

- Any test that asserts tics-sorted queue order must be updated to assert **insertion order**
  (oldest actionable first). Search `tests/` for `sortQueue`, `tics` ordering assumptions, and
  head-selection tests, and update them to the new contract.
- Full suite must stay green with `pass >= 178` (current baseline). Add a focused test that
  proves: inserting A (60) then B (52) keeps order [A,B] even though B has lower tics, and the
  head is A, and a countdown tick does not reorder.

## Constraints (non-negotiable)

- Work on branch `wt/queue-insertion-order` ONLY. Never push to main, never open a PR, never
  touch `origin/main`. Commit only on the branch, based on `origin/main` = `83cff35`.
- Do NOT touch the master-clock item order (peek → process → cleanup → remove), the intro
  countdown path (`playIntroCountdown`/`finishIntroSnap`), or the input/gate logic.
- This is a real gameplay-mechanics change (head is now insertion order, not lowest-tics). The
  user has explicitly, repeatedly confirmed this is the intended design. Do NOT "improve" it back
  to a tics-timeline, and do NOT add a hybrid. Follow the spec exactly.
- Tics decrement readout must be preserved — removing the sort must not stop the countdown
  numbers from ticking down in place.

## Definition of Done (verify each)

1. No `sortQueue` runs on any queue operation; head = first non-`ready` in insertion order.
2. `js/battle-app.js` renders in engine order; `sortQueueRows` gone from the render path.
3. A countdown tick updates tic numbers in place and never re-slides/re-orders rows.
4. `computeTimingMarkers` prediction-bar math intact (read-only copy-sort ok).
5. Tests updated to insertion-order contract; `npm test` green, pass >= 178.
6. New focused test: insertion order A(60),B(52) stays [A,B], head=A, no reorder on tick.
7. Report the real commit SHA, the full diff of both files, and the exact test counts.
8. Branch is `wt/queue-insertion-order`, based on origin/main `83cff35`, nothing pushed.
