# Action Visual Lifecycle

**Purpose:** Complete specification of what must happen visually when each type of action is processed by the engine. Covers every action type in the queue, from engine event through animation completion.

**Audience:** Developer implementing the UI animation pipeline. This is the bridge between engine events and what the player sees.

---

## Pipeline Architecture

The engine and UI are decoupled. The engine resolves actions eagerly (fires everything up to the next decision point), produces structured data, and returns state. The UI plays it back visually, one action at a time, gating between them.

```
Player clicks → POST /commit → engine fires everything → returns state
                                                              ↓
                                UI receives state, diffs against previous
                                ↓
                                BattleClock sequence (per batch):
                                  1. Highlight "current" row (queue-row-current)
                                  2. Typewriter narrates new feed lines
                                  3. On narrate-done:
                                     a. Resolved rows: flash → shrink
                                     b. Insert preview: push-down animation
                                     c. renderQueue with new state
                                     d. New rows: entry-enter animations
                                  4. Release busy gate → player can act again
```

**Rule:** The engine processes ALL actions up to the next decision point in one batch. The UI plays them as a sequence of resolved + added rows. The typewriter narrates what happened. The queue visually updates to show the new state.

---

## Action Type Reference

| Event | Owner | Description | Engine fires | UI action |
|---|---|---|---|---|
| `approach` | Player hand | Hand entering battle (initial) | morph → `ready` | Resolves (no flash — initial setup) |
| `winding` | Player hand | Attack windup completes | morph → `impact` (0 tics) | Resolves (flash) |
| `impact` | Player hand | Attack lands / deals damage | morph → `cooldown` | Resolves (flash + shrink) |
| `cooldown` | Player hand | Recovery after attack | morph → `ready` | Resolves (flash + shrink) |
| `drinking` | Player hand | Consuming potion | morph → `recovery` | Resolves (flash) |
| `recovery` | Player hand | Post-potion recovery | morph → `ready` | Resolves (flash + shrink) |
| `ready` | Player hand | Hand available (placeholder) | never fires — placeholder | No animation |
| `attack` | Monster | Monster windup → hit | pop row + commit new | Resolves (flash + shrink) |
| Buff expiry | System | Buff wears off | feed line only | Typewriter narrates |

---

## 1. Player Attack Lifecycle

The full visual sequence from when the player commits an attack to when the hand is Ready again.

### Phase 1: Player Selects (Preview — before commit)

Trigger: Player hovers/clicks an attack in the command menu.

Queue onhover behavior (no engine state change):
1. `computeTimingMarkers()` calculates the prediction bar range: `[weaponSpeed + prepare_time, weaponSpeed + prepare_time + prepare_time_range]`
2. A prediction bar overlay appears on the queue spanning that tic range (continuous bar, not row-bound)
3. Attack info (damage, windup, cooldown ranges) appears in the action readout
4. Hovering another attack → prediction bar moves, info updates
5. Hovering off → prediction bar disappears, info clears

### Phase 2: Player Commits

Trigger: Player confirms the attack (selects target + confirms, or the attack auto-targets).

Engine does:
1. Removes the hand's `ready` placeholder row from the queue
2. Calculates buffed damage, castTicks, cooldownTicks, accuracy, crit
3. Commits a new `winding` row at the calculated castTicks position
4. Sets hand state → `winding`
5. Advances engine to next decision point (may fire zero or more actions)
6. Returns new state with feed, queue, HP

UI does (via BattleClock sequence):
1. **Highlight:** The `ready` row (about to resolve) gets `queue-row-current` class — stays at the top while the typewriter narrates the commit line
2. **Typewriter:** New feed line appears: `"LH prepares a Slash..."` — typed character by character at the configured text speed
3. **Narrate-done triggers BattleClock Phase 1:**
   - The old `ready` row (now resolved — disappeared from new queue since commit removed it) gets `queue-row-flash` class (400ms)
   - Then `queue-row-shink` class shrinks it (350ms)
4. **Phase 2 — Insert:** A dashed `queue-insert-preview` bar animates from height 0→24px (250ms), pushing remaining old rows down to make room for the new `winding` row
5. **Phase 3 — Render + Enter:** `renderQueue(newState)` redraws the full queue. The newly committed `winding` row gets `queue-row-enter` class (1200ms fade-in). If it's a monster's attack row entering during this same batch, it gets `queue-row-monster-enter` (400ms). The queue panel flashes `queue-arrived` (350ms).
6. Busy gate releases, player can act on the next ready hand when it arrives

### Phase 3: Winding Countdown

The `winding` row sits in the queue with its tic counter ticking down. The row shows:
- Label: `"L. Hand Slash"`
- Tic count: counting down to 0
- A timing bar that fills left-to-right as tics approach 0
- Bar fill = (1 - tics / initialTics) × 100%

The queue is re-rendered on every commit batch. Between commits, the row's tics decrease incrementally per engine tick (visible only on the next render). The bar grows proportionally.

### Phase 4: Winding → Impact (Attack Lands)

Trigger: Winding countdown hits 0.

Engine does:
1. `morphHandRow(queue, 'LH', 'impact', 0)` — same row, same ID, event changes to `impact`, tics set to 0
2. On the NEXT tick (still same advanceToNextDecision), `impact` fires:
   - Resolves damage to target(s)
   - Rolls accuracy, damage, crit independently per target
   - Logs hit/miss/crit/defeat lines to the feed
   - Cancels queued attacks on now-dead targets (PC-68)
   - Morphs to `cooldown` with the calculated cooldown ticks
3. Continues advancing until the next decision point

UI sees: the `winding` row resolves (removed — no `impact` row exists in the returned state, it was morphed to `cooldown` in the same engine pass). The `cooldown` row appears (same row ID, new event+tics).

Visual sequence (same BattleClock flow):
1. **Highlight:** The `winding` row gets `queue-row-current` — "this is what's happening now"
2. **Typewriter:** Damage/defeat lines type out: `"LH Slash hits Imp A for 24"` (or `"misses"` or `"CRITICAL!"`)
3. If a monster dies: `"Imp A is defeated"` typed after
4. **Narrate-done:**
   - The old `winding` row (resolved) flashes + shrinks
   - Insert preview pushes down (or not — `cooldown` may land at a different position)
   - `renderQueue` redraws; the `cooldown` row appears with a fresh timing bar (growing for the cooldown countdown)
5. Busy releases

### Phase 5: Cooldown

The `cooldown` row counts down. Row shows:
- Label: `"L. Hand Ready"`
- Tic count: counting down
- Timing bar: fills as cooldown progresses

### Phase 6: Cooldown → Ready

Trigger: Cooldown countdown hits 0.

Engine does:
1. `morphHandRow(queue, 'LH', 'ready', 0)` — row becomes a placeholder
2. Sets hand state → `Ready`
3. Logs `"LH Ready"`
4. advanceToNextDecision stops (a hand is Ready → decision point)

UI sees: the `cooldown` row resolves. A new `ready` placeholder row appears (or the engine stopped at this point, and the hand becomes actionable).

Visual:
1. `cooldown` row highlighted as current
2. Typewriter: `"LH Ready"` 
3. Row flashes, shrinks, `ready` placeholder appears (shown as `"L. Hand Ready"` with `—` instead of a tic count)
4. Busy releases
5. Command menu opens for the ready hand

### Phase 7: Hand Approach (Battle Start)

Trigger: `startBattle()` — initial hand entries at battle start.

Engine does:
1. Commits LH and RH `approach` rows at weapon speed
2. Sets hand state → `Approach`
3. advanceToNextDecision → `approach` fires → sets hand to Ready → morphs to `ready` placeholder
4. Logs `"LH Ready"` and `"RH Ready"`

UI sees (via playIntroCountdown):
1. Queue rows appear at their tic positions via intro fill animation (one row at a time, top to bottom)
2. Each tic decrements visually on the mirrored intro DOM
3. When approach tics hit 0: the row's label updates to `"LH Ready"`, tic shows `—`
4. After all fires play, `finishIntroSnap` renders the real state and opens the command window

---

## 2. Monster Attack Lifecycle

### Phase 1: Attack Committed (by engine)

Trigger: `startBattle()` or a monster's previous attack resolved and the monster is still alive.

Engine does:
1. Picks a random attack from the monster's granted attack set
2. Commits a new `attack` row at `mon.speed` tics
3. Logs: `"Blue Slime A prepares a Tackle..."`

UI sees (if committed during the same batch as a pending render):
- On the next loadBattle, the row appears with `queue-row-monster-enter` class (400ms fade-in)
- Lightweight — monster rows have NO timing bar (no cooldown phase), just name + tic countdown
- Row shows: `"Blue Slime's Tackle"` + tic count

### Phase 2: Attack Fires

Trigger: Monster's `attack` row tics hit 0.

Engine does:
1. Rolls damage (mon.damage ± 3, uniform), accuracy check
2. On hit: applies damage to player, logs `"Blue Slime A Tackle hits player for 12"` (or `"CRITICAL!"`)
3. On miss: logs `"Blue Slime A Tackle misses"`
4. If still alive: commits a NEW attack row at `mon.speed`, picks next attack, logs the windup
5. Removes the spent row from the queue (popped)

UI sees (via BattleClock):
1. **Highlight:** The fire row gets `queue-row-current`
2. **Typewriter:** Hit/miss line types out
3. If it was a hit: the HP bar updates (red fill shrinks), shake/hit feedback triggers
4. **Narrate-done:**
   - The old `attack` row (resolved) flashes + shrinks
   - Insert preview if the new attack row lands at a higher position
   - `renderQueue` redraws: old row gone, new attack row appears
   - New row: `queue-row-monster-enter` (400ms)

### Phase 3: Monster Death

Trigger: An attack brings the monster's HP to 0 or below.

Additional visuals (interleaved with the attack's impact animation):
1. Monster's HP word transitions from current → defeated state
2. Monster card: fade/slide/dim visual
3. Any queued attacks from other monsters targeting this now-dead monster are NOT cancelled (PC-DEC-054 — the dead monster disappears, its remaining attacks evaporate as the engine removes them)
4. Any player hands winding attacks whose TARGET_IDs are ALL now dead: cancel into cooldown with typewriter line: `"RH attack cancelled — target already defeated"` (PC-68)

---

## 3. Potion Lifecycle

### Phase 1: Player Commits Potion

Trigger: Player selects a potion from the command menu and confirms.

Engine does:
1. Finds the first Ready hand (or specified hand)
2. Removes the hand's `ready` placeholder row
3. Commits a `drinking` row at `pre` tics (weaponSpeed + potion.rolled_speed)
4. Sets hand state → `drinking`
5. Advances engine to next decision point
6. Returns state

UI sees: Same BattleClock flow as attack commit — `ready` row resolves, `drinking` row enters with timing bar.

Row shows: `"L. Hand Health Potion"` + tic count + timing bar

### Phase 2: Drinking → Recovery

Trigger: `drinking` tics hit 0.

Engine does:
1. Applies potion effect (heal or buff), marks potion as used
2. Logs heal/buff with effect description: `"LH healed 30"` (or `"damage +5 until tic 14"`)
3. On crit: appends `" CRITICAL!"` 
4. Morphs to `recovery` at `post` tics

UI sees: BatteClock flow — drinking row resolves (flash + shrink), recovery row enters. Typewriter narrates the effect.

Row shows: `"L. Hand Ready"` (recovery countdown) + tic + timing bar

### Phase 3: Recovery → Ready

Trigger: `recovery` tics hit 0.

Engine does:
1. Sets hand → `Ready`
2. Morphs to `ready` placeholder
3. Logs `"LH Ready"`

UI sees: recovery row resolves, ready placeholder appears, hand available.

---

## 4. Weapon Swap Lifecycle

### Phase 1: Player Swaps

Trigger: Player selects Belt Loop from command menu and confirms.

Engine does:
1. Validates hand is Ready, swaps weapon instance in hand with belt weapon
2. Calculates delay = max(old speed, new speed)
3. Commits a `cooldown` row at `delay` tics (or morphs existing row)
4. Hand state stays non-Ready during cooldown

UI sees:
1. Typewriter: `"Belt swap (LH) — cooldown 5 tics"` (system message, instant)
2. Loadout display: RH weapon name updates
3. `cooldown` row appears with timing bar
4. On cooldown fire: morphs to Ready as usual

Row shows: `"L. Hand Ready"` + tic count + timing bar

---

## 5. Buff Expiry

Trigger: A buff's `endTic` reaches the current tic during advanceToNextDecision.

Engine does:
1. Logs `"Vigor buff expired"`
2. Removes the buff from state

UI sees:
- Typewriter types the expiry line
- No queue visual change (buffs have no rows in the queue)
- If the buff was affecting player stats, the relevant UI element updates on next render

---

## 6. Timing Bar Visual Specification

Every non-monster row (LH, RH — winding, cooldown, drinking, recovery, approach) has a timing bar. The bar visualizes countdown progress.

**Bar behavior by row event:**

| Event | Bar start | Bar fill direction | At fire | After fire |
|---|---|---|---|---|
| `winding` | empty (0%) | fills left→right to 100% | bar full | row morphs → bar resets |
| `cooldown` | empty (0%) | fills left→right to 100% | bar full | row morphs → bar resets |
| `drinking` | empty (0%) | fills left→right to 100% | bar full | row morphs → bar resets |
| `recovery` | empty (0%) | fills left→right to 100% | bar full | row morphs → bar resets |
| `approach` | empty (0%) | fills left→right to 100% | bar full | row morphs → ready |

**Bar formula:** `width% = (1 - tics / initialTics) × 100`

Where `initialTics` is the row's tics when it was first committed. On re-render, the bar width interpolates from the current tics.

**Bar visual:**
- Player hand rows: blue/cyan bar, filled proportionally
- `ready` placeholder rows: no bar (show `—` instead of tic count)
- Monster rows: no bar (no timing bar type — just a tic countdown label)

---

## 7. Queue Row Display Rules

| Event | Label format | Tic display | Bar |
|---|---|---|---|
| `approach` | `"L. Hand"` | tic count | Timing bar |
| `winding` | `"L. Hand Slash"` | tic count | Timing bar |
| `impact` | N/A — morphs same tick, not visible to UI | — | — |
| `cooldown` | `"L. Hand Ready"` | tic count | Timing bar |
| `drinking` | `"L. Hand Health Potion"` | tic count | Timing bar |
| `recovery` | `"L. Hand Ready"` | tic count | Timing bar |
| `ready` | `"L. Hand Ready"` | `—` (no countdown) | None |
| `attack` (monster) | `"Blue Slime's Tackle"` | tic count | None |

**Sort order:** Ascending by tics, player-first on ties (LH → RH → monsters A/B/C...).

---

## 8. BattleClock Sequence Diagram

For each commit batch:

```
loadBattle called with prevBs (previous state) and bs (new state)
  │
  ├─ diff = diffQueueForAnimation(prevBs, bs)
  │   • resolved: rows in prevBs but not in bs (IDs)
  │   • added: rows in bs but not in prevBs (IDs + isMonster flag)
  │
  ├─ Highlight first resolved row with queue-row-current
  │
  ├─ renderFeed(bs.feed, onComplete=() => battleClock.onNarrateDone())
  │   • Types NEW feed lines (slice from renderedFeedLines)
  │   • onComplete fires after LAST line finishes typing
  │
  ├─ battleClock.onNarrateDone():
  │   │
  │   ├─ Phase 1 (Resolve):
  │   │   • Flash: resolved rows → queue-row-flash (400ms)
  │   │   • Shrink: resolved rows → queue-row-shrink (350ms)
  │   │   • Wait 750ms total
  │   │
  │   ├─ Phase 2 (Insert):
  │   │   • If added.length > 0:
  │   │     Create queue-insert-preview div at insertion point
  │   │     CSS transition: height 0→24px (250ms)
  │   │     Wait 300ms
  │   │     Remove preview
  │   │
  │   ├─ Phase 3 (Render + Enter):
  │   │   • renderQueue(bs): full redraw
  │   │   • Added rows animate:
  │   │     - Monster rows: queue-row-monster-enter (400ms)
  │   │     - Player rows: queue-row-enter (1200ms)
  │   │   • Queue panel: queue-arrived (350ms flash)
  │   │
  │   └─ _finish():
  │       • state → IDLE
  │       • setBusy(false)
  │       • onComplete callback
  │
  └─ Player can act (command menu shown, busy gate released)
```

---

## 9. Edge Cases

### Multiple rows resolve in one batch
When the engine fires multiple actions in one advanceToNextDecision, the BattleClock treats ALL resolved rows as a single batch:
- All resolved rows flash simultaneously
- All shrink simultaneously
- All added rows enter with their respective animations (staggered by renderQueue sorting order)

### No changes (empty diff)
If `diff.resolved.length === 0 && diff.added.length === 0`, the BattleClock skips directly to `_finish()` — no animations play, busy gate releases immediately. This happens on engagements where the engine didn't advance (e.g. error response).

### Dead monster — attacks evaporate
When a monster dies mid-batch:
- Its resolved attack row gets normal flash+shrink
- Any separate "defeated" feed line types after the damage line
- New attack row for that monster does NOT appear (monster dead → engine doesn't recommit)
- Other monsters' attacks targeting the dead one: still fire at the player (auto-target to first living — engine handles this, visual is identical)

### Cancel-into-cooldown (PC-68)
When a player hand's winding attack is cancelled because all targets died (e.g. other hand killed them):
- The winding row resolves and its flash plays
- Typewriter: `"RH attack cancelled — target already defeated"`
- A new `cooldown` row enters (same hand label, same phase as if the attack landed — hand recovers)

### Speed preset INSTANT
Text speed preset "instant" (`charMs === 0`):
- renderFeed appends all new lines at once (no typewriter)
- onComplete fires immediately
- BattleClock proceeds to resolve phase without waiting

### Mid-battle page reload (resume)
- prevBs is null → no BattleClock sequence, no diff animation
- populateFeedInstantly shows all past feed at once with hit feedback suppressed
- renderQueue renders the current queue state immediately
- Command menu opens on existing ready hands

---

## 10. Glossary

- **Row:** A single entry in the action queue array. Has {id, label, event, tics}. Player hand rows keep the same id across morphs. Monster rows get a new id each cycle.
- **Resolved:** A row that existed in the previous state but not in the new state (popped or morphed to a different id). Triggers flash+shrink animation.
- **Added:** A row that exists in the new state but not in the previous state. Triggers entry-enter animation.
- **Morphing:** Changing a row's `event` and `tics` in place, keeping the same id. Engine does this for hand rows. The UI sees the row resolve (old event gone) and a new row appear (new event) at the same id — the diff treats it as resolved-then-added.
- **BattleClock:** Singleton class in battle-app.js that orchestrates the post-commit animation sequence: narrate → resolve → insert → render → enter → idle.
- **Typewriter:** Character-by-character text reveal in the message box, paced by the text speed preset. Gated by `typingInProgress` flag.
- **Busy gate (`setBusy`):** Prevents duplicate commits and hides the command menu during animation playback. Released by BattleClock._finish().