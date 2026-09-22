# Action Visual Lifecycle (Master Clock Model)

**Purpose:** Complete specification of how the Master Clock drives the combat loop — one queue item at a time, with sub-actions that execute in sequence (or parallel where allowed).

**Audience:** Developer implementing the Master Clock and UI animation pipeline.

---

## Pipeline Architecture

A single Master Clock drives everything. No batches. No internal engine loops.

```
MasterClock.start():
  loop:
    result = engine.stepOnce()       // peek head, process it, return narrate
    if (!result) break               // queue empty → battle over
    
    displayItem(result.item)          // pin item at top of UI Action Queue
    
    // Parallel (both must finish):
    typewriter.print(result.narrate)  // character by character
    animateItem(result.item)          // effects, health bar, shake, etc.
    await both
    
    engine.removeHead()              // remove item from queue — done
    
    if (result.triggersDecision):    // player turn → show buttons, pause
      showUI()
      await playerChoice()           // master clock waits here
      // choice inserts next items into queue
    // otherwise → loop continues, next item surfaces
```

**Rule:** One item per iteration. No `advanceToNextDecision` loop. Engine never batches. 
Each `stepOnce()` call processes exactly one queue item and returns.

---

## Action Type Reference

| Event | Owner | Description | Sub-actions (in order) |
|---|---|---|---|
| `ready` | Player hand | Player's turn to act | Preview → Wait for commit → Narrate → Visuals → Insert winding → Remove |
| `ready` | Monster | Monster's turn to act | AI picks attack → Narrate → Visuals → Insert winding → Remove |
| `winding` | Any | Attack preparation | Narrate → Visuals → Insert impact → Remove |
| `impact` | Any | Attack execution | Engine resolves → Narrate + Visuals (parallel) → Insert cooldown → Remove |
| `cooldown` | Any | Recovery | Narrate → Visuals → Insert ready → Remove |
| `drinking` | Player hand | Potion consumption | Narrate → Visuals → Apply effect → Insert recovery → Remove |
| `recovery` | Player hand | Post-potion cooldown | Narrate → Visuals → Insert ready → Remove |
| `attack` | Monster | Monster attack (immediate fire — no winding) | Engine resolves → Narrate + Visuals (parallel) → Insert next attack → Remove |
| Buff expiry | System | Buff wears off | Typewriter only → Remove |

---

## 1. Player Attack Lifecycle

### Phase 1: Player Turn — "LH Ready" at top of queue

Item sits at top of UI Action Queue. Master Clock pauses — waiting for player decision.

**Sub-actions (sequential):**

1. **Action bar preview:** Player sees weapon options. `computeTimingMarkers()` shows prediction bar on the queue — the tic range where the attack will land. Action readout shows damage, windup, cooldown ranges. No engine state change yet.

2. **Player commits:** Player selects attack + target → clicks Attack.

3. **Engine:** `commitAttack(hand, attackId, targets)` — validates hand is Ready, removes the `ready` placeholder row, inserts a `winding` row with attack data (castTicks, cooldownTicks, damage, accuracy, crit, targetIds). Returns immediately — NO advanceToNextDecision.

4. **Typewriter:** "LH prepares a Fire Bow..." (character by character)

5. **Visuals:** The `winding` action card animates into the UI Action Queue at its sorted position. New row enters with fade-in / push-down animation.

6. **Sub-actions complete → Remove** the `ready` item from the queue.

7. **Master Clock ticks again** → next item surfaces (likely the `winding` row, which may be at tic=0 or higher).

### Phase 2: Winding — "LH: Winding (Fire Bow)" at top

Item pinned at top. Row shows: label "L. Hand Fire Bow", tic count (counting down), timing bar filling left→right.

**Sub-actions:**

1. **(If tic > 0)** Visual wind-up animation plays — timing bar fills as progress approaches 0. The item stays at top during this. If tic=0, this step is instant.

2. **(Parallel — both must finish):**
   - **Typewriter:** "LH winds their bow..."
   - **Visuals:** Wind-up animation completes, timing bar reaches full

3. **Engine inserts** `impact` row into queue with carried-over attack data.

4. **Remove** the `winding` item from queue.

5. **Master Clock ticks** → next item surfaces (the `impact` row).

### Phase 3: Impact — "LH: Fire Bow" at top

**Sub-actions (1 is engine-only, 2-3 parallel):**

1. **Engine resolves attack:**
   - Rolls accuracy check
   - If miss: narrate "misses", no damage
   - If hit: rolls damage, applies to target
   - Rolls crit if applicable
   - If target dies: cancels other queued attacks on dead targets (PC-68)

2. **Typewriter:** "LH Fire Bow hits Giant Rat for 12 damage!" (or "misses", "CRITICAL!")

3. **Visuals:** Damage numbers, health bar depletion, screen shake/hit feedback. Both 2+3 run in parallel — typing can start while screen shakes, but neither is done until BOTH finish.

4. **Engine inserts** `cooldown` row into queue.

5. **Remove** the `impact` item from queue.

6. **Master Clock ticks** → next item surfaces (the `cooldown` row).

### Phase 4: Cooldown — "LH: Cooldown" at top

Row shows: label "L. Hand Ready", tic count, timing bar filling.

**Sub-actions:**

1. **(If tic > 0)** Visual recovery animation plays, timing bar fills.

2. **(Parallel — both must finish):**
   - **Typewriter:** "LH recovers"
   - **Visuals:** Recovery animation completes

3. **Engine inserts** `ready` placeholder row into queue.

4. **Remove** the `cooldown` item.

5. **Master Clock ticks** → next item surfaces. If it's `ready` → player's turn again.

### Phase 5: Approach (Battle Start)

Trigger: `startBattle()` seeds initial `approach` rows for each hand + initial monster attacks.

**Master Clock processes each approach row:**

1. Item sits at top of queue. Row shows: label "L. Hand", tic count.

2. **(If tic > 0)** Wind-up visual plays.

3. **Typewriter:** "LH Ready" — typed character by character.

4. **Visuals:** Approach animation.

5. **Engine inserts** `ready` placeholder.

6. **Remove** the `approach` item.

7. **Master Clock ticks** → next approach row, then monster attacks, etc.

When the first `ready` token surfaces → player's turn begins.

---

## 2. Monster Attack Lifecycle

### Phase 1: Monster Turn — "Giant Rat Ready" at top

**Sub-actions (sequential):**

1. **Monster AI** picks an attack by weighted random from the monster's template attacks (e.g., Bite 40%, Power Attack 30%, Toxic Fang 20%, Run Away 10%). Rolls.

2. **Typewriter:** "Giant Rat prepares a Power Attack..." (character by character)

3. **Visuals:** The `winding` attack card animates into the UI Action Queue at its sorted position.

4. **Engine inserts** `winding` (or `attack`) row with selected attack's data.

5. **Remove** the `ready` item.

6. **Master Clock ticks** → next item.

### Phase 2: Monster Attack Fires — "Giant Rat: Power Attack" at top

If the monster uses a winding-delay model, same lifecycle as player phases 2-4 above (winding → impact → cooldown → ready).

If the monster uses a direct-fire model (attack row with mon.speed delay):

**Sub-actions:**

1. **Engine resolves:**
   - Rolls damage (±3)
   - Checks accuracy
   - If hit: applies to player HP
   - If crit: doubles damage

2. **(Parallel — both must finish):**
   - **Typewriter:** "Giant Rat Power Attack hits player for 12 damage!" (or "misses" / "CRITICAL!")
   - **Visuals:** Damage numbers on player, health bar depletion, shake/hit feedback

3. If still alive: monster AI picks next attack and inserts it.

4. **Remove** the current `attack` item.

5. **Master Clock ticks** → next item.

### Phase 3: Monster Death

Trigger: An attack brings monster's HP to 0.

1. Damage narration + visuals execute as normal.
2. Additional: monster card fades/slides out.
3. No new attack row is inserted (monster dead).
4. `cancelQueuedAttacksOnDeadTargets()`: player hands winding attacks on this monster → cancelled to cooldown.
5. If all monsters dead → battle_over = true, Master Clock stops.

---

## 3. Potion Lifecycle

### Phase 1: Player Chooses Potion

"LH Ready" at top → player chooses "Use Potion" → inserts `drinking` row → Master Clock processes it.

### Phase 2: Drinking — "LH: Drinking (Health Potion)" at top

**Sub-actions:**

1. **(If tic > 0)** Visual potion-drinking animation plays.

2. **(Parallel — both must finish):**
   - **Typewriter:** "LH drinks Health Potion..."
   - **Visuals:** Drinking animation completes

3. **Engine:** Applies potion effect (heal / buff). If crit: " CRITICAL!".

4. **Engine inserts** `recovery` row.

5. **Remove** the `drinking` item.

### Phase 3: Recovery → Ready

Same as cooldown phase. Row shows label "L. Hand Ready" with recovery countdown.

---

## 4. Weapon Swap Lifecycle

### Phase 1: Player Swaps

"LH Ready" at top → player swaps weapon → inserts `cooldown` row (delay = max(old speed, new speed)).

**Typewriter:** "Belt swap (LH) — cooldown 5 tics" (system message, instant)

### Phase 2: Cooldown

Standard cooldown lifecycle. When done → ready token surfaces.

---

## 5. Buff Expiry

Trigger: A buff's `endTic` reaches current tic.

- **Typewriter:** "Vigor buff expired"
- No queue visual change. Buff removed from state.
- Next render updates any affected stats UI.

---

## 6. Timing Bar Visual Specification

Every non-ready, non-monster row has a timing bar that visualizes countdown progress.

| Event | Bar behavior |
|---|---|
| `winding` | Starts empty, fills left→right. At fire: full. |
| `cooldown` | Same — fills from empty to full. |
| `drinking` | Same — fills from empty to full. |
| `recovery` | Same — fills from empty to full. |
| `ready` | No bar — shows `—` instead of tic count. |
| `attack` (monster) | No bar — tic count label only. |

**Bar formula:** `width% = (1 - tics / initialTics) × 100`

**Bar visual:** Player rows: blue/cyan bar. Bar only updates on Master Clock ticks (when item is processed or when a new item surfaces and tics are recalculated).

---

## 7. Queue Row Display Rules

| Event | Label format | Tic display | Bar |
|---|---|---|---|
| `winding` | "L. Hand Fire Bow" | tic count | Timing bar |
| `impact` | "L. Hand Fire Bow" | — | None (brief display) |
| `cooldown` | "L. Hand Ready" | tic count | Timing bar |
| `drinking` | "L. Hand Health Potion" | tic count | Timing bar |
| `recovery` | "L. Hand Ready" | tic count | Timing bar |
| `ready` | "L. Hand Ready" | — | None |
| `attack` (monster) | "Giant Rat's Power Attack" | tic count | None |

**Sort order:** Ascending by tics, player-first on ties (LH → RH → monsters).

---

## 8. Master Clock Sequence Diagram

```
MasterClock.tick():
  │
  ├─ engine.stepOnce()
  │   • peekHead(queue) — look at top item WITHOUT removing
  │   • handleFire(row) — process one item, return { narrate, changes }
  │   • Returns null if queue empty → battle over
  │
  ├─ displayItem(item) — pin it at top of UI Action Queue
  │
  ├─ Parallel (Promise.all):
  │   ├─ typewriter.print(narrate) — char by char, wait for finish
  │   └─ animateItem(item) — effects, damage numbers, health bar, shake
  │   → Await BOTH
  │
  ├─ engine.removeHead() — remove the processed head from queue
  │
  ├─ Check triggers:
  │   ├─ If hand is Ready → show command menu, PAUSE master clock
  │   │   → resume when player commits (or monster AI runs for monster ready)
  │   │   → commit inserts new queue items
  │   │
  │   └─ If battle_over → stop
  │
  └─ Loop — tick() again
```

---

## 9. Parallel Sub-Action Rules

Certain sub-actions can overlap. The Master Clock treats them as a group that all must complete before proceeding:

| Group | Actions | Allowed to overlap? |
|---|---|---|
| Engine processing | Always sequential (blocking) | No |
| Typewriter + Impact visuals | Typewriter + damage numbers, shake, health bar | YES — both run, item stays pinned until last one finishes |
| Typewriter + Insert visuals | Typewriter + row-entry animation | YES |
| Item removal | Always the last step | No |

**Visual style (Spahrep, 2026-09-22):** Typewriter text can start typing while screen shake / damage numbers play. Neither is "done" until both finish. The Master Clock waits for both promises to resolve.

---

## 10. Tic Handling

**Tics are display values, not a timing mechanism.** Items in the queue are sorted by tic ascending. The Master Clock always processes the smallest-tic item. Tics are set when the item is inserted:
- `winding` = castTicks (from weapon params)
- `cooldown` = cooldownTicks (from weapon params)
- `ready` = 0 (always surfaces immediately)
- Monster `attack` = mon.speed

**No global tic advancement.** No tic subtraction on remaining rows. Each item keeps its original tic. When it reaches the top of the queue (smallest remaining tic), it processes. Items with tic=0 always go to front.

The timing bar formula uses `tics / initialTics` to show progress. Since tics don't decrement between processing, the bar reflects the item's position in the queue order.

---

## 11. Edge Cases

### Multiple ready hands surface simultaneously
If both LH and RH have `ready` rows at tic=0, LH (player-first sort) surfaces first. The Master Clock shows LH Ready, waits for player choice. After commit + sub-actions, the next Master Clock tick surfaces RH Ready.

### Monster and player ready at same tic
Player-first sort: player hand ready surfaces first. Monster ready waits.

### Monster AI rolls when ready token surfaces
The master clock, when it sees a monster's `ready` token at top, calls the AI sub-action (pick weighted random). This is a blocking sub-step before the typewriter/visuals.

### Cancel-into-cooldown (PC-68)
When a player hand's winding attack is cancelled because all targets died: the `winding` item processes as normal (narrate "RH attack cancelled — target already defeated"), but instead of inserting an `impact` row, engine inserts a `cooldown` row. That cooldown is the next item to surface.

### Speed preset INSTANT
If text speed is "instant" (charMs=0): typewriter prints instantly and its promise resolves immediately. Master Clock doesn't wait for text animation.

### Mid-battle page reload (resume)
On reload, `loadState()` restores queue + state. Master Clock starts fresh. No previous animations to replay. Current queue top determines what the player sees first.

---

## 12. Glossary

- **Master Clock:** The loop in battle-app.js that drives the combat sequence. One tick = one queue item processed end-to-end.
- **stepOnce():** Engine method that peeks the queue head, processes it, returns narrate text + state changes. Does NOT remove the head.
- **removeHead():** Engine method that removes the processed item from queue after all sub-actions complete.
- **Sub-action:** A single step within an item's processing (e.g., "typewriter narrates", "AI picks attack", "remove item"). Some can run in parallel.
- **UI Action Queue:** The visual rendering of the engine's queue. Player sees items sorted by tic, with the top item as "currently happening" or "currently whose turn."
- **Ready token:** A `ready` event row at tic=0. Indicates the hand/monster's turn. Surfaces when all lifecycle phases for the previous action complete.
- **Tic:** Display-only countdown value. Determines queue sort order. Set at insertion time, never decremented.
- **Typewriter:** Character-by-character text reveal in the message box, paced by text speed preset.