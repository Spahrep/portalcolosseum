# Action Visual Lifecycle (Master Clock Model)

**Purpose:** Complete specification of how the Master Clock drives the combat loop — one queue item at a time, with sub-actions that execute in sequence (or parallel where allowed). The combat system is a linked list of actions: you peek the front, process it (rolls, math, narration, visuals), then pop it off.

**Audience:** Developer implementing the Master Clock and UI animation pipeline.

---

## Core Rules

1. **Only one event is ever processed at a time.** The Master Clock peeks the front of the queue, processes that single item (all sub-actions, rolls, narration, visuals), pops it off, then moves to the next. No batching. No back-to-back processing before the first item is done.

2. **Every event HAS UX.** Typewriter text, screen shake, health bar sparkles, damage numbers — nothing happens silently. Even buff expiry writes "X buff expired" on the typewriter.

3. **An item must be 100% complete before removal.** All sub-actions (typewriter, visuals, animations) must finish before the item is popped and the next one surfaces.

4. **Tics are the insert-time ordering key, not a display-only label.** Each new row is spliced into its correct position ONCE at insert — a linked-list insert, not a sort (`addEvent` → `orderedInsertIndex`, `js/combat/tic-queue.js:34-52`). The array is never globally re-sorted after that, and it is not a sorted structure by tics — position is fixed at insert time and never reordered. Head is `queue[0]`; ready rows are not skipped (`tic-queue.js:56-59`). Same-tic ties: status/buff/expiry first, then other events, then `ready`; within a category, LH before RH before monsters (`tic-queue.js:14-31`).

   **Superseded (do not reapply):** "tics are display-only; insertion order drives; no global sort; no re-ordering." That wording (this rule, §7, §10, and the Glossary `Tic` entry) described FIFO append. It is superseded by the sorted-insert contract in `docs/workorder-2026-09-28-queue-sorted-insert.md`. The contradictory FIFO workorder `docs/workorder-2026-09-28-queue-insertion-order.md` does not match the shipped engine. A global re-sort on every peek/remove is also not what ships — order is fixed at insert.

---

## Pipeline Architecture

A single Master Clock drives everything. No batches. No internal engine loops.

```
MasterClock.start():
  loop:
    peekHead(queue)                  // look at top item, do NOT remove
    if (no item) break               // queue empty → battle over
    
    processItem(event, data)         // resolve rolls, math, state changes
    typewriter.print(narration)      // character by character
    animateItem(event)               // effects, health bar, shake, sparkles
    await BOTH finish                // typewriter + visuals both must complete
    
    removeHead()                     // silent pop the processed item — done
    
    if (player hand is Ready):       // player's turn
      showActionMenu()
      await playerChoice()           // master clock pauses here
      // commit inserts next items into queue (winding row, etc.)
      // when player acts, loop continues
    
    if (battle_over): stop
    // otherwise → loop, next item at front of queue surfaces
```

**Key rule:** peek → process (all sub-actions) → remove. Only then does the next item surface.

---

## Action Type Reference

| Event | Owner | Description | Sub-actions (in order) |
|---|---|---|---|
| `ready` | Player hand | Player's turn to act | Preview → Wait for commit → Narrate → Visuals → Insert winding → Remove |
| `winding` | Player hand | Attack preparation | Narrate → Visuals → Insert `impact` → Remove |
| `winding` | Monster | Preparation. Inserted when a cooldown fires, not at battle start. Tics = `mon.speed * prepare multiplier`, floored, min 1. Does not deal damage. | Log "prepares…" → Insert `impact` at 0, carrying the strike → Remove |
| `impact` | Player hand | Attack execution | Engine resolves → Narrate + Visuals (parallel) → Insert cooldown → Remove |
| `impact` | Monster | Damage lands. Hit/damage/crit roll once, from the strike carried off `winding`. | Engine resolves → Narrate + Visuals (parallel) → If still alive, insert `cooldown` at stored `cooldownTicks` → Remove |
| `cooldown` | Player hand | Recovery | Narrate → Visuals → Insert `ready` → Remove |
| `cooldown` | Monster | Opening row at battle start (tics = `mon.speed`), and again after an impact. | When it fires, pick the next attack and insert `winding` → Remove |
| `drinking` | Player hand | Potion consumption | Narrate → Visuals → Apply effect → Insert recovery → Remove |
| `recovery` | Player hand | Post-potion cooldown | Narrate → Visuals → Insert ready → Remove |
| Buff expiry | System | Buff wears off | Typewriter only → Remove |

Monster events are `winding` / `impact` / `cooldown` only (`js/combat/engine.js:305-318`). `queueNextMonsterAttack` inserts `winding` (`engine.js:165`); `handleMonsterFire` inserts `impact` at 0 (`engine.js:313`); `resolveMonsterImpact` inserts `cooldown` (`engine.js:301`). There is no monster `ready` row and no live `attack` event. A persisted pre-PC-97 `attack` row is resolved as `impact` so an in-flight strike still lands (`engine.js:315-318`) — new rows are not inserted as `attack`. Player attacks stay `winding` / `impact` / `cooldown` on the hand (`engine.js:179-232`); the word "attack" in player sections below means the player's chosen strike, not a queue event.

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

Trigger: `startBattle()` seeds one `approach` row per hand and one `cooldown` row per living monster (PC-DEC-060). It does not run the clock.

**Master Clock processes each approach row:**

1. Item sits at top of queue. Row shows: label "L. Hand", tic count.

2. **(If tic > 0)** Wind-up visual plays.

3. **Typewriter:** "LH Ready" — typed character by character.

4. **Visuals:** Approach animation.

5. **Engine inserts** `ready` placeholder.

6. **Remove** the `approach` item.

7. **Master Clock ticks** → the next row, whatever it is. If that row is a monster cooldown, it plays as a normal tick. There is no skip to the player.

When the **first** `ready` token surfaces → player's turn begins. The other hand's approach stays on the track.

---

## 2. Monster Attack Lifecycle

Monsters do not use a `ready` token or an `attack` event. Battle start seeds one `cooldown` at `mon.speed` (PC-DEC-060). After that cooldown fires, the cycle is `winding` → `impact` → `cooldown` → next `winding`.

### Phase 1: Opening cooldown — battle start

`startBattle` inserts one `cooldown` row per living monster at `mon.speed` (PC-DEC-060). It does not call `queueNextMonsterAttack` and does not write a "prepares" line. The timing track fills with that row plus the two hand approach rows. The clock is not run forward.

When that cooldown later fires on a normal tick, `queueNextMonsterAttack` picks the attack and inserts `winding`. That is the first "prepares" line, at the tic the cooldown fires — not at tic 0.

### Phase 1b: Next winding — when a cooldown fires

`queueNextMonsterAttack` runs when a monster `cooldown` row fires. Not at battle start.

**Sub-actions (sequential):**

1. `pickMonsterAttack` selects an attack (`engine.js:163`).
2. Engine inserts a `winding` row at `mon.speed + rollStat(prepare_time, prepare_time_range)` and stores `cooldownTicks = mon.speed + rollStat(cooldown_time, cooldown_time_range)` on that row (`engine.js:164-167`).
3. Feed: "<Monster> prepares a <attackName>..." (`engine.js:168`).
4. The `winding` card animates into the UI Action Queue at its sorted-insert position.
5. There is no monster `ready` row to remove.

### Phase 2: Winding fires, then impact, then cooldown

Option A (Spahrep 2026-09-28) still holds: `mon.speed` is added into both the prepare and the cooldown, same shape as `weapon.speed + attack.<prepare|cooldown>_time`. PC-97 split the old combined monster `attack` row into `winding` then `impact`. Winding does not deal damage (`js/combat/engine.js:306-307`).

- `winding` tics = `mon.speed + rollStat(prepare_time, prepare_time_range)` (`engine.js:165`)
- `cooldown` tics = stored `cooldownTicks` = `mon.speed + rollStat(cooldown_time, cooldown_time_range)` (`engine.js:167`, inserted at `engine.js:301`)

**When the `winding` row fires** (`engine.js:312-314`):

1. Insert an `impact` row at 0 tics and carry the strike (name, damage, accuracy, crit, `cooldownTicks`). No damage roll here.
2. **Remove** the `winding` item. The impact stays a same-key successor (`m:<label>`).

**When the `impact` row fires** (`resolveMonsterImpact`, `engine.js:266-302`):

1. **Engine resolves** (rolls once, from the carried strike — does not re-pick the attack):
   - Rolls damage
   - Checks accuracy
   - If hit: applies to player HP
   - If crit: multiplies damage
2. **(Parallel — both must finish):**
   - **Typewriter:** "<Monster> <attackName> hits you for N damage!" (or "misses" / "CRITICAL!")
   - **Visuals:** Damage numbers on player, health bar depletion, shake/hit feedback
3. If still alive: insert a `cooldown` successor at the stored `cooldownTicks` (`engine.js:296-301`). Label on the rail: "<Monster name> recovering", with the player-style timing bar.
4. **Remove** the `impact` item (silent pop — no exit slide). The cooldown stays a same-key successor (`m:<label>`), so the node stays in the DOM and `renderQueue` relabels it in place.
5. **Master Clock ticks** → next item.

**When the `cooldown` row fires** (`engine.js:310-311`):

1. `queueNextMonsterAttack` selects the next attack and inserts a new `winding` row (same formula as Phase 1).
2. Feed: "<Monster> prepares a <attackName>..."
3. **Remove** the cooldown item (silent pop — no exit slide). The next `winding` stays a same-key successor (`m:<label>`), so the node stays in the DOM and `renderQueue` relabels it in place.
4. **Master Clock ticks** → next item.

Last strike of a dead monster inserts no cooldown (`engine.js:296`). Death still cancels every queued row for that monster (PC-DEC-054).

### Phase 3: Monster Death

Trigger: An attack brings monster's HP to 0.

1. Damage narration + visuals execute as normal.
2. Additional: monster card fades/slides out.
3. No cooldown and no next `winding` are inserted (monster dead; `js/combat/engine.js:296`).
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

Every non-ready player row has a timing bar that visualizes countdown progress, except approach rows. Monster `winding` / `impact` rows (and a legacy persisted `attack` row) are name + tic only — no bar (`js/battle/queue-render.js:60-62`, `:345-346`). Monster `cooldown` ("recovering") uses the same player-style bar (`queue-render.js:350-351`).

| Event | Bar behavior |
|---|---|
| `winding` (player) | Starts empty, fills left→right. At fire: full. |
| `cooldown` (player) | Same — fills from empty to full. |
| `drinking` | Same — fills from empty to full. |
| `recovery` | Same — fills from empty to full. |
| `ready` | No bar — shows `—` instead of tic count. |
| `winding` / `impact` (monster) | No bar — tic count label only. Legacy `attack` rows are the same. |
| `cooldown` (monster) | Same player-style fill — "<Monster name> recovering". |

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
| `winding` / `impact` (monster) | "<Monster name>'s <Attack>" | tic count | None |
| `cooldown` (monster) | "Giant Rat recovering" | tic count | Timing bar |

**Ordering:** Each new row is spliced into tics-ascending position once at insert (`orderedInsertIndex`, `js/combat/tic-queue.js:32-50`). The array is never globally re-sorted after that. **Superseded:** "ordered at INSERTION time" / FIFO append — see Core Rule 4 and `docs/workorder-2026-09-28-queue-sorted-insert.md`. For items at the same tic:
1. Status effects / buffs / DOTs / expiries go first (inserted before anything else at that tic)
2. `ready` tokens go last among items at that tic (inserted after all status/effect items)

Player-first on ties within the same category (LH before RH before monsters at identical tic).

---

## 8. Master Clock Sequence Diagram

```
MasterClock.tick():
  │
  ├─ peekHead(queue) — look at front item WITHOUT removing
  │
  ├─ processItem(item) — resolve rolls, math, state changes:
  │   • For windup: insert impact row
  │   • For impact: roll accuracy/damage/crit, apply to target HP
  │   • For cooldown/recovery: insert ready token
  │   • For monster winding: insert impact (no damage)
  │   • For monster impact: roll accuracy/damage/crit, apply to player HP, insert cooldown
  │   • For monster cooldown: pick next attack, insert winding
  │   • For buff expiry: remove buff from state
  │   • For DOT: resolve damage tick, insert next DOT tick
  │
  ├─ typewriter.print(narration) — char by char + animateItem(effects)
  │   → Await BOTH to complete
  │
  ├─ removeHead() — silent pop the processed item — done
  │
  ├─ Check triggers:
  │   ├─ If player hand is Ready → show command menu, PAUSE
  │   │   → resume when player commits (inserts new items)
  │   │
  │   ├─ Monster ready → AI auto-picks, loop continues
  │   │
  │   └─ If battle_over → stop
  │
  └─ Loop — process next item at front of queue
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

## 10. Queue Order & Tic Display

**Each new row is placed by tics at insert, then the order is frozen.** `addEvent` splices the row at `orderedInsertIndex` (`js/combat/tic-queue.js:32-50`): tics ascending, then tie category, then LH / RH / monster. No global re-sort runs on peek, remove, or tick. The Master Clock processes the first non-ready row in that frozen array (`tic-queue.js:54-61`). Countdown subtracts the head's tics from the other rows (`js/combat/engine.js:123-127` and `:542-547`) and does not reorder them.

Tics are set when the item is inserted:
- Player `winding` = castTicks (from weapon params)
- Player `cooldown` = cooldownTicks (from weapon params)
- `ready` = 0
- Monster `winding` = `mon.speed + rollStat(prepare_time, prepare_time_range)` (`engine.js:165`)
- Monster `cooldown` = stored `cooldownTicks` = `mon.speed + rollStat(cooldown_time, cooldown_time_range)` (`engine.js:167`, inserted at `engine.js:301`)

**Superseded:** "Tics are display values only. They do NOT drive processing order — insertion order does." Tics are the ordering key at insert (sorted-insert workorder `docs/workorder-2026-09-28-queue-sorted-insert.md`). They are also the countdown readout. The timing bar formula uses `tics / initialTics` to show progress.

**Important:** Buff expiry, DOT ticks, and other status effects are their own queue items. They sit in the queue alongside attacks and ready tokens. When they reach the front, they process (typewriter "X buff expired", resolve DOT damage), pop off, and the next item surfaces. They do NOT fire "at the same time" as anything else — the queue forces a linear sequence.

---

## 11. Edge Cases

### Multiple ready hands surface simultaneously
If both LH and RH have `ready` rows at tic=0, LH (player-first sort) surfaces first. The Master Clock shows LH Ready, waits for player choice. After commit + sub-actions, the next Master Clock tick surfaces RH Ready.

### Monster and player rows at the same tic
Same-tic ties: status/buff/expiry first, then other events, then `ready`; within a category, LH before RH before monsters (`js/combat/tic-queue.js:14-29`, `:41-43`). There is no monster `ready` row.

### Monster attack is picked when winding is inserted
`queueNextMonsterAttack` picks the attack and inserts `winding` when a cooldown fires. Not at battle start. Not on a `ready` token.

### Cancel-into-cooldown (PC-68)
When a player hand's winding attack is cancelled because all targets died: the `winding` item processes as normal (narrate "RH attack cancelled — target already defeated"), but instead of inserting an `impact` row, engine inserts a `cooldown` row. That cooldown is the next item to surface.

### Speed preset INSTANT
If text speed is "instant" (charMs=0): typewriter prints instantly and its promise resolves immediately. Master Clock doesn't wait for text animation.

### Mid-battle page reload (resume)
On reload, `loadState()` restores queue + state. Master Clock starts fresh. No previous animations to replay. Current queue top determines what the player sees first.

---

## 12. Glossary

- **Master Clock:** The loop on the server that drives the combat sequence. One tick = one queue item processed end-to-end: peek → process (rolls, math, narration, visuals) → remove.
- **peekHead:** Look at the item at the front of the queue without removing it. This is how the Master Clock sees what needs to process next.
- **process:** Resolve the item's event type (roll accuracy, apply damage, pick monster attack, apply buff, etc.). Happens after peek, before removal.
- **removeHead:** Pop the processed item off the front of the queue. Only called AFTER all sub-actions (narration, visuals) are complete.
- **Sub-action:** A single step within an item's processing (e.g., "typewriter narrates", "AI picks attack", "remove item"). Some can run in parallel (typewriter + screen shake), some must be sequential.
- **UI Action Queue:** The visual rendering of the engine's queue on screen. The front item is "currently happening" — its sub-actions are executing.
- **Ready token:** A player-hand `ready` event row. Indicates that hand's turn. Surfaces when that hand's cooldown or recovery completes (`js/combat/engine.js:172-176`). Monsters do not get a `ready` row.
- **Tic:** Insert-time ordering key and countdown readout. Set when the row is inserted; `orderedInsertIndex` (`js/combat/tic-queue.js:32-50`) places the row by tics ascending. Does not re-sort the queue later. **Superseded:** "display-only, never drives processing order" (Core Rule 4; `docs/workorder-2026-09-28-queue-sorted-insert.md`).
- **Typewriter:** Character-by-character text reveal in the message box, paced by text speed preset.