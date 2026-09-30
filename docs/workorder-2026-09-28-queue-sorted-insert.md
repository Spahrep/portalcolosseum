# Workorder — Queue insert-at-correct-position (linked list), no global re-sort, no re-slide

> **This is the contract that ships (PC-103).** `orderedInsertIndex` (`js/combat/tic-queue.js:32-50`) splices each new row into tics-ascending position once; the array is not globally re-sorted. `docs/action-visual-lifecycle.md` now agrees. Do not treat every line below as a line-accurate map of today's files: `popNext` no longer decrements siblings (`tic-queue.js:64-70`); the engine subtracts the head's tics (`js/combat/engine.js:123-127` and `:542-547`).

**Author:** Hermes (overseer)
**Builder:** Grok (via delegate_task)
**Branch:** `wt/queue-sorted-insert`
**Baseline:** `main` == `d396582` (origin/main)
**Spec authority:** `docs/action-visual-lifecycle.md` §4/§17; `docs/action-queue-animation.md`

---

## The problem (user-visible, live)

The queue currently displays **out of order**: e.g. a Glimmerling "Quack Attack" row with tic
`54` sits ABOVE ready L.Hand/R.Hand rows at tic `0`. Rows also still re-slide on tick refresh.

**Cause:** a prior change made rows **append to the end** (FIFO) instead of being placed at
their correct position. Order is no longer by tics, so the head is not the next-to-fire row.

## The correct design (user's spec, stated plainly — do EXACTLY this)

"Inserted in order, and stay in order" means: **each new row is inserted into the queue at its
correct sorted position (by tics, soonest-to-fire on top) ONCE, at insert time, and then the
array is NEVER re-sorted again.** Because `popNext` decrements every row by the SAME `ticOffset`,
relative order is preserved automatically — so a row correctly placed at insert time stays
correctly placed for the rest of the battle, with zero re-sorting.

THIS IS THE CRITICAL CONCEPT. Do not confuse it with the two failed attempts that came before:

- ❌ **Old code (before any fix):** globally re-sorted the whole array on EVERY operation
  (peek/remove/commit). Constant reordering + re-animating = rows jump/slide. WRONG.
- ❌ **My last change (current, broken):** never sorts/places at all, just appends (FIFO).
  Order stops being by tics → head isn't next-to-fire → "out of order". ALSO WRONG.
- ✅ **TARGET (your spec):** place each new row at its correct tics position ONCE at insert
  (an ordered linked-list insert), then freeze the array order. Uniform decrement keeps the
  order correct forever. Head = first row in array order (which is the soonest-to-fire).
  No global re-sort. No re-animating of existing rows.

## Required change (small — this is the core fix)

### `js/combat/tic-queue.js`

Change `addEvent` (or `commitNewRow`, whichever is the insert entry point) so that instead of
`queue.push(entry)`, it **splices the new row into the correct ordered position**:

- Order key: `tics` ascending (smallest tics = fires soonest = top of queue).
- Tie-break when tics are equal: player rows first (`label === 'LH' || label === 'RH'`),
  then stable (maintain existing internal relative order).
- This is a ONE-TIME placement. Do NOT call any global sort afterward.

Keep `popNext` / `peekHead` / `removeHead` as they are (they already take the first non-ready
row in array order — no sorting, correct for a frozen ordered array). Keep the uniform tic
decrement in `popNext` (`for r of queue: r.tics = Math.max(0, r.tics - ticOffset)`) — this is
what preserves order between inserts.

### `js/battle-app.js`

- `renderQueue` and `playInsertCeremony` must render rows **in the engine array order**
  (which is now the correct tics-placed order). Current code already iterates `queue.forEach`
  without `sortQueueRows` — VERIFY this is still true and keep it that way. Do NOT re-introduce
  a render-time sort.
- Existing rows must NEVER be re-animated / re-slid on a tick. A tick only updates the tic
  readout in place (`updateQueueRowInPlace`). The full-rebuild fallback
  (`buildQueueRow(..., true, ...)`) must NOT fire on a plain countdown tick. Verify the
  no-flicker + stable-key guards in `renderQueue` correctly catch the unchanged rows so a tick
  never triggers re-slide.
- `sortQueueRows` (battle-app.js ~1667) — CURRENTLY still used by the intro countdown
  (`playIntroCountdown`). That is a tic-0 theater replay over a *copy*, NOT the live queue, so
  it is acceptable to keep it there. But confirm it is NOT called from the live render path.

### Tests

- Update/adjust the test added last round that asserted FIFO ("A(60) then B(52) stays [A,B],
  head=A"). Under the CORRECT sorted-insert design the expected result is the OPPOSITE:
  B(52) fires before A(60), so inserting A(60) then B(52) yields array order **[A,B] placed by
  tics** → actually B(52) sorts BEFORE A(60), so array = [B, A], head = B. Rewrite this test to
  assert **sorted-insert placement**: inserting rows in any order keeps the array ordered by
  tics ascending (player-first on ties), and the head is the lowest-tics non-ready row.
- ADD a test proving order stability without re-sort: insert A(60), B(52), C(80); popNext the
  head (B=52); the remaining array [A,C] is decremented uniformly (A=8, C=28) and order is
  preserved (A before C, since 8 < 28 — relative order intact), no re-sort called.
- Keep a test proving a countdown tick does not re-animate/re-slide rows in the client render
  (if feasible) — at minimum, no re-sort in the live render path.
- Full suite must stay green, pass >= 179 (current).

## Constraints (non-negotiable)

- Work on branch `wt/queue-sorted-insert` ONLY. Never push to main, never open a PR.
- Never globally re-sort the queue. One-time ordered insert only.
- Do NOT touch master-clock item order (peek→process→cleanup→remove), the intro countdown
  theater (`playIntroCountdown`/`finishIntroSnap` can keep its copy-sort), or input/gate logic.
- Do NOT re-introduce FIFO append. The queue MUST be ordered by tics (soonest-to-act on top).
- This reflects the user's explicitly stated and repeated design. Follow it exactly; do not
  "improve" or second-guess.

## Definition of Done (verify each)

1. New rows are spliced into correct tics-ascending position at insert; no global re-sort.
2. Head = first row in array order = soonest-to-fire (lowest tics, player-first on ties).
3. Client renders in engine array order; no sort in the live render path; existing rows never
   re-slide on a plain tick.
4. Uniform decrement in `popNext` preserved (this is what keeps order stable).
5. Tests updated to sorted-insert contract (B(52) before A(60); stability test added); `npm
   test` green, pass >= 179.
6. Report the real commit SHA, the full diff of `js/combat/tic-queue.js` + `js/battle-app.js`,
   and the exact test counts.
7. Branch `wt/queue-sorted-insert`, based on origin/main `d396582`, nothing pushed.
