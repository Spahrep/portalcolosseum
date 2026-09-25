# Battle Engine — Item Processing (Official Spec)

Status: **Official** — confirmed by Spahrep (2026-09-25)
Source: design session, #the-forge thread "Battle engine item processing steps"
Scope: the per-item processing contract of the battle engine, end to end.

## Highest level

Every item in the action queue is processed through a strict master loop:

```
Peek → Process → Cleanup → Remove
```

The loop is **strictly serial** — one item at a time, one item at the top of the queue at any moment. It is impossible to have two.

Each step can have substeps.

## Visual discipline

- Visuals may run **in parallel inside a step** (e.g. the typewriter and the HP-adjustment FX run concurrently within Process).
- A step does **not** advance until every visual it fired has completed.
- Visuals never overlap **across** a step boundary. Cleanup's visuals cannot start until Process is finished — and "Process is finished" includes its visuals finishing, not just its back-end state changes. Remove's visuals cannot start until Cleanup's visuals are done.
- **Option A (event-driven completion):** every process/cleanup/remove visual resolves a Promise on its completion event (`animationend` / `transitionend`); the loop `await`s all of them for the step (`Promise.all`) before handing off to the next step. No hard-coded timing guesses. The system knows when visuals are done.

Each step is therefore a barrier: do the work → fire all its visuals in parallel → wait for all → proceed.

## Process — the 6 action types

`Process` dispatches by action type. Each type has its own a/b/c substeps.

(`Process` is the only step that varies by type. `Remove` is identical for all types.)

### 1. Ready Player
- a) Give the player the action menu.
- b) As they select options, update the vertical estimation bar.
- c) On commit, two things happen:
  - i) Back end: the item is rolled as required, then inserted into the queue at the correct location based on tics-out.
  - ii) Animation inserts it into the Visual Action Queue (existing visuals).

### 2. Ready Monster
Same as Ready Player, except:
- a) No player menu — the monster uses the pre-defined selection method.
- b) No vertical estimation bar.
- c) Same: the item is rolled/selected and inserted into the queue at tics-out; animation inserts it into the Visual Action Queue.

### 3. Attack Happens
Two branches. `c)` is identical in both cases.

**If HIT:**
- a) HP is reduced on the target in the back end.
- b) HP is reduced in the UI + HP-adjustment visual triggers.
- c) Cooldown is inserted:
  - i) Done in the back end.
  - ii) Done in the GUI with proper animation.
  - iii) If cooldown == 0 it is inserted AFTER the current action being processed. (Cooldown > 0 is a normal tics-based insert.)

**If MISS:**
- a) HP is NOT reduced (back end reports a miss).
- b) No HP visual — instead Miss UX triggers (visuals / sounds).
- c) Cooldown is inserted — identical to the hit branch (i / ii / iii).

### 4. Potion Effect Happens
Same as the hit branch of Attack Happens: potion effects apply in the back end (a), shown in UI with the appropriate effect/HUD visual (b), cooldown inserted (c i/ii/iii). Potions cannot miss at this time, so there is no miss branch — always full-potency.

### 5. Weapon Swap Happens
- a) Weapon is swapped in the back end.
- b) Swap in GUI / visuals / sounds.
- c) Cooldown is inserted (i back end, ii GUI animation, iii cooldown==0 goes after the current action).

### 6. Buff Expires
- a) Stats adjusted in the back end.
- b) Visuals / FX.
- c) No cooldown — nothing is inserted.

Note: Buff Expires is the only action type that does not add a cooldown. Attack, Potion, and Weapon Swap all insert one.

## Cleanup (between Process and Remove)

Checks, in order:

1. **Is the player HP > 0?**
   - Yes → do nothing.
   - No → **short-circuit**: go straight to the Death screen. Cleanup aborts before the other checks, no Remove runs for the current item.
2. **Are there monsters with HP ≤ 0?**
   - Yes (for each) → remove all associated actions for them from the queue, fire visuals for this removal, update the UI to remove defeated monsters.
3. **Are there any monsters left?**
   - No → **Victory / loot screen.**

Difference in the two terminal cases:
- **Player dead** → Cleanup short-circuits → straight to death screen.
- **All monsters dead** → let Cleanup fully process — the player sees the last monster slide out and get removed (better UX / payoff). Then stop at the end of Cleanup; no Remove step beyond it. Victory / loot screen.

## Remove (identical for every action type)

- a) Pop the top of the queue — this action has been completed.
- b) Visually remove (slide out) the action.
- c) Visually shift up all the other items in the action queue.
