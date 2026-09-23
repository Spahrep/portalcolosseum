# Master Controller — Combat Engine Refactor

**Goal:** Replace the batch-loop engine (advanceToNextDecision) with a single-steppable engine driven by a Master Clock. One item at a time, items stay at top of queue until all sub-actions complete, then are removed.

**Architecture:** Three layers:
- **Master Clock** (battle-app.js) — drives the battle loop. Calls engine.stepOnce(), waits for typewriter/visuals, repeats.
- **Engine** (engine.js) — pure data logic. No loops. stepOnce() peeks head of queue, processes it, returns the result + narrate text, then removes the head. That's it.
- **Queue** (tic-queue.js) — sorted array. peek/remove instead of popNext's splice+tic-subtraction.

## New Flow

```
MasterClock.tick():
  1. engine.stepOnce()
     → peeks head of queue (does NOT pop)
     → handleFire processes it (sub-step 1)
     → returns { narrate, ... }
  2. Typewriter prints narrate text (character by character)
  3. Visual effects run (overlapping with typewriter, but BOTH must finish)
  4. All sub-actions done → remove the item from queue
  5. If queue empty → battle over
  6. If next item is a Ready token (player turn) → show buttons, PAUSE clock
  7. Otherwise → tick again
```

## Item Types and Their Sub-Actions

Each queue item has a set of sub-actions that execute in order. Some can overlap (typewriter + visuals). The item stays pinned at top of UI Action Queue until ALL sub-actions complete.

### `ready` (Player turn token)
1. Show action bar with weapon options + dynamic range calculation (real-time UI, not a queue item)
2. Wait for player to commit an attack or potion
3. Player commits → typewriter narrates "LH prepares a Fire Bow..."
4. Visual animation of the action card entering the UI Action Queue
5. Insert winding row into queue
6. Remove the ready item from queue

### `ready` (Monster turn token — "Giant Rat Ready")
1. Monster AI picks attack by weighted random from template
2. Typewriter narrates "Giant Rat prepares a Power Attack..."
3. Visual animation of the action card entering the UI Action Queue
4. Insert winding row with attack data into queue
5. Remove the ready item from queue

### `winding` (Prepare phase)
1. (If tic > 0) Visual wind-up animation / countdown bar — wait for it
2. Typewriter narrates (e.g., "LH winds their bow...")
3. Insert impact row into queue
4. Remove winding item from queue

### `impact` (Execute phase)
1. Engine resolves attack (roll accuracy, crit, damage, apply to target)
2. Typewriter narrates result (e.g., "LH Fire Bow hits Giant Rat for 12 damage!")
3. Visual effects (damage numbers, health bar, screen shake — can overlap with narration)
4. Check for death → cancel queued attacks on dead targets
5. Insert cooldown row into queue
6. Remove impact item from queue

### `cooldown` (Recovery phase)
1. Typewriter narrates (e.g., "LH recovers")
2. Visual recovery animation
3. Insert ready token for the hand/monster
4. Remove cooldown item from queue

### `drinking` (Potion use)
1. Typewriter narrates (e.g., "LH drinks Health Potion...")
2. Visual animation
3. Apply potion effect
4. Insert recovery row
5. Remove drinking item

### `recovery` (Potion cooldown)
1. Typewriter narrates
2. Insert ready token
3. Remove recovery item

## Files That Change

### tic-queue.js
- Remove `popNext` (too aggressive — splices and subtracts tics)
- Add `peekHead(queue)` — returns the head item without removing it (sort, skip ready rows)
- Add `removeHead(queue)` — removes head after processing is fully done
- Keep `addEvent`, `sortQueue`, `commitNewRow`, `computeTimingMarkers`
- Remove `morphHandRow` if unused
- **No tic subtraction** — items keep their original tics. Tic is for visual position/timing, not for batch advancement.

### engine.js
- **Remove** `advanceToNextDecision` — entire function. No more internal loop.
- **Remove** `stepQueue` — replaces with `stepOnce`
- **Add** `stepOnce()` — peeks queue head, calls handleFire on it, returns { narrateText, stateChanges }
  - Does NOT remove the head (that's the Master Clock's job after typewriter+visuals complete)
  - Does NOT increment state.tic
  - Does NOT expire buffs (or defer to Master Clock if needed)
- **Simplify** `startBattle` — seeds initial queue (approach rows, monster attacks), does NOT call advanceToNextDecision. Returns initial state. Master Clock processes items one by one.
- **Simplify** `commitAttack` — validates hand is Ready, removes ready placeholder, inserts winding row, returns. Does NOT call advanceToNextDecision.
- **Simplify** `commitPotion` — same pattern.
- `handleFire` stays mostly the same but is called once per stepOnce, not in a loop
- `getState`, `loadState`, `createEngine` stay the same
- Exported API changes: remove stepQueue/advanceToNextDecision, add stepOnce

### battle-app.js
- **Add MasterClock class** (or rename BattleClock to MasterClock)
- MasterClock runs the battle loop:
  ```
  async start():
    while (!battleOver):
      result = engine.stepOnce()
      if (!result) break  // queue empty
      
      // Display the item (pin it at top of UI Action Queue)
      displayItem(result.item)
      
      // Typewriter + visuals (parallel, wait for both)
      const promises = []
      promises.push(typewriter.print(result.narrate))
      promises.push(animateItem(result.item))
      await Promise.all(promises)
      
      // Remove item from queue
      engine.removeHead()
      
      // Check if player needs to decide
      if (result.triggersDecision):
        showButtons()
        await waitForCommit()  // pause clock
  ```
- **Remove** batch diff logic (rowChanges, catchResolvedRows, BattleClock batch phases)
- **Remove** `setBusy` gate — clock naturally waits for each step
- `renderQueue` updates at each step instead of batch replays

## What Goes Away
- `advanceToNextDecision` — the batch loop
- `captureFires` array — no batch to capture
- `rowChanges` / `catchResolvedRows` batch diff
- BattleClock's batch-unpacking phases (resolve→insert→enter→idle)
- `popNext` tic subtraction logic
- `stepQueue` as a looping function
- `setBusy` busy gate (replaced by natural clock pacing)

## What Stays
- `handleFire` — but called once per stepOnce call
- All lifecycle transitions (winding→impact→cooldown→ready)
- Winding→impact carryover (targetIds, damage, accuracy, etc.)
- `addEvent`, `sortQueue`, `commitNewRow`
- `commitAttack`, `commitPotion` (simplified — just insert + return)
- Monster AI (`pickMonsterAttack` by weight)
- `getState`, `loadState`, `resumeEngine`

## Open Questions for Implementation
1. **Tic handling** — In the new model, do tics still matter? Items in the queue are sorted by tic. The Master Clock processes the smallest-tic item. When done, next item surfaces. No global tic advancement, no per-row tic subtraction. Does `computeTimingMarkers` still work the same way?
2. **Buff expiry** — Currently happens in stepQueue after handleFire. With stepOnce, do buffs expire on each step? Or at some other trigger?
3. **startBattle intro** — Currently returns a batch `intro` (queue snapshot + fires array). In the new model, the intro is just the initial queue state; the Master Clock processes approach rows as its first steps.
4. **Monster attack insertion timing** — Currently monsters auto-insert their next attack at cooldown end. In the new model, is the monster's next attack computed when its impact row processes? Or when its ready token is at top? (User said: AI picks when the monster's ready token is at top, inserts winding/attack row, then the lifecycle proceeds.)
5. **Potion readiness state** — Currently potion use goes through drinking→recovery→ready. Confirm this matches the user's intended model.

## Task Breakdown for Grok

### Task 1: Rewrite tic-queue.js
- Remove `popNext`, add `peekHead(queue)` and `removeHead(queue)`
- No tic subtraction on remove
- Keep sort, addEvent, commitNewRow, computeTimingMarkers

### Task 2: Rewrite engine.js
- Remove `advanceToNextDecision` and `stepQueue`
- Add `stepOnce()` — peeks head, calls handleFire, returns { item, narrateText }
- Add `removeHead()` — removes the processed head from queue
- Simplify `startBattle` — seed queue only, no advanceToNextDecision call
- Simplify `commitAttack` — validate, insert winding row, return
- Simplify `commitPotion` — same pattern
- `handleFire` unchanged except it returns a narrateText string instead of using log()

### Task 3: Write MasterClock class
- In battle-app.js (or new file js/combat/master-clock.js)
- Async loop: stepOnce → typewriter + visuals → removeHead → repeat
- Pauses when player needs a decision (hand Ready or monster turn)
- Drives the entire battle

### Task 4: Rewrite battle-app.js commit/response wiring
- Remove batch BattleClock phases
- Wire MasterClock into the commit flow
- Player 'Attack' button calls engine.commitAttack() then MasterClock.tick()
- Remove setBusy, rowChanges, catchResolvedRows

### Task 5: Update tests
- Remove tests that test advanceToNextDecision batch behavior
- Update tests to run stepOnce-driven sequences
- Write tests for MasterClock flow
- 84 tests must all pass

## Verification
1. All engine unit tests pass (tests/combat-engine.test.js, tests/potion-use.test.js)
2. MasterClock runs a battle end-to-end: approach → player commit → lifecycle → monster attacks → conclusion
3. UI renders correctly: reders each item at top of Action Queue, narrates, animates, removes
4. Timing bars show correct range info for player weapon selection
5. Battle ends when monsters dead or player dead