# Workorder — Monster Cooldown Lifecycle (option A: strict player-mirror)

**Date:** 2026-09-28
**Author:** Hermes (foreman)
**Builder:** Grok (via delegate_task)
**Branch:** `wt/monster-cooldown`
**Baseline:** main @ `253ce19` (173/173 tests pass)

## Status
DESIGN LOCKED by Spahrep 2026-09-28: **Option A** — monsters mirror the player attack lifecycle
(windup → impact/common → cooldown → next windup), with `mon.speed` added into BOTH phases,
exactly like the player formula `weapon.speed + attack.<prepare|cooldown>_time`.

## The problem (what the client showed)
A monster's `attack` row currently counts down from `mon.speed`; on fire the engine immediately
re-seeds the NEXT `attack` row at `mon.speed` again — no cooldown phase. Reads as a machine-gun that
never rests. Players get a visible cooldown beat ("L. Hand Ready" counting down); monsters don't.
The asymmetry is the bug, not the raw rate.

## Locked design (option A — strict mirror, monsters SLOWER)
Player formula (locked, mirror it exactly):
- `castTicks    = weaponSpeed + rollStat(prepare_time,    prepare_time_range)`
- `cooldownTicks = weaponSpeed + rollStat(cooldown_time,   cooldown_time_range)`

Monster analog — `mon.speed` plays the `weaponSpeed` role:
- Monster `attack` row tics      = `mon.speed + rollStat(pickedAttack.prepare_time,  prepare_time_range)`
- Monster `cooldown` row tics    = `mon.speed + rollStat(pickedAttack.cooldown_time, cooldown_time_range)`
- Lifecycle: `attack` (windup) → fires (damage resolves, same as today) → `cooldown` row
  (THE ATTACK THAT JUST FIRED's cooldown — mirror the player: impact is followed by that attack's own cooldown)
  → fires → `pickMonsterAttack` selects the NEXT attack → new `attack` row at its prepare → repeat.
  Last monster attack of a battle → still just dead (death-cancels-everything, PC-DEC-054, unchanged).

**Consequence (intended):** monsters are meaningfully slower — `mon.speed` is now added twice
(once per phase) plus the attack's own prepare+cooldown. Spahrep accepts this and may retune
`base_speed` on templates later. Do NOT "correct" the pacing to be balance-neutral.

## Files to change

### 1. `js/combat/engine.js` — `handleFire()` MONSTER else-branch (currently lines ~169–205)
Today the monster else-branch only handles direct-fire `attack` (resolve damage, then immediately
re-seed next `attack` at `mon.speed`). Restructure it to a two-phase lifecycle:

- On monster `attack` fire: resolve damage exactly as today (hit/miss/crit, feed lines unchanged).
  THEN insert a `cooldown` successor row instead of re-seeding the next attack.
  - tics = `row.cooldownTicks` if already stored on the row (persisted), else
    `mon.speed + rollStat(<this attack's cooldown_time>, cooldown_time_range)`.
  - `addEvent(state.queue, mon.label, 'cooldown', <tics>)`, `sortQueue`.
- On monster `cooldown` fire (NEW branch): this is the "recover then pick next" beat.
  - `pickMonsterAttack(mon, rng)` → next attack.
  - `create attack row`: `commitNewRow(state.queue, mon.label, 'attack', mon.speed + rollStat(nextAtk.prepare_time, prepare_time_range))`.
  - Store on the new attack row: `row.monsterAttackName = nextAtk?.name || null` AND
    `row.cooldownTicks = mon.speed + rollStat(nextAtk.cooldown_time, cooldown_time_range)`
    (so the cooldown value survives DB serialization and RNG ordering is deterministic/seeded).
  - Feed line, keep your existing style: `<Monster> <label> prepares a <attackName>...`.
- The monster else-branch must switch on `row.event` (`attack` vs `cooldown`) — currently it
  assumes attack. Do not let a monster `cooldown` row fall through into attack resolution.
- Player hand branch (`LH`/`RH`) is UNTOUCHED — `cooldown` there means hand Ready; no collision
  because the player branch is label-gated and the monster branch is the else.

### 2. `js/combat/engine.js` — `startBattle()` monster seeding (~line 467)
Seed the first monster attack row with:
- `newRow.cooldownTicks = mon.speed + rollStat(atk.cooldown_time, cooldown_time_range)` (stored)
- attack row tics = `mon.speed + rollStat(atk.prepare_time, prepare_time_range)`
Keep `pickMonsterAttack` + prepare feed-line as today. First-cooldown of the battle now flows naturally.

### 3. `js/combat/engine.js` — `stepQueue()` `captureFires` `after` (~line 357–361)
The intro replay (`playIntroCountdown`) uses `after` to mirror the monster's next state on the rail.
Update the monster branch so a fired `attack` yields `after = { event: 'cooldown', tics: <its cooldown tics> }`
and a fired `cooldown` yields `after = { event: 'attack', tics: <next prepare> }` — matching the new
two-phase cycle so the intro countdown replays it correctly. Preserve determinism/seeded RNG ordering.

### 4. `js/battle-app.js` + `run.html` — render + diff the new `cooldown` monster row
- `run.html` §6/§7 of the visual lifecycle: a monster `cooldown` row is a NON-monster clear row —
  give it the player-style timing bar (fill formula unchanged) and a readable label. Suggested
  label `<Monster name> recovering`. Keep monster canonical `attack` rows as today (name + tic,
  no bar) — do not re-scope into restyling attack rows.
- `buildQueueRow` / `updateQueueRowInPlace` / `queueEventName`: handle the monster `cooldown` event
  (label + timing bar + stable key). Monsters key on `i:<id>` per cycle — the cooldown row is a
  new row in the monster's cycle; ensure it doesn't get an erroneous exit animation on the
  attack→cooldown transition (it's a successor, not a removal; check `silentPopHead`/diff paths —
  the processed head should silent-pop / successor-replace, NOT slide out — consistent with the
  head-pinning from the master-clock visual-fidelity work already shipped).
- Client diff (`diffQueueForAnimation` / `queueRowKey`): attack→cooldown and cooldown→attack
  transitions for a monster are SUCCESSOR events, not genuine removals. Make sure a monster's
  fired attack row pop is silent (it WAS the processed head) and the cooldown row lands in place,
  matching how hand successor rows render. This is the client half of the same fix.

### 5. Tests — `tests/combat-engine.test.js` (+ any monster-cycle assertions elsewhere)
Update assertions that assumed direct-fire re-seed at `mon.speed` (e.g. "monster attack at monster
speed 3", the captureFires `after = {event:'attack', tics: mon.speed}` expectations) to the new
two-phase contract. ADD regression tests:
- a monster `attack` fires → resolves damage AND inserts a `cooldown` row (not a next attack row);
- the monster `cooldown` fires → inserts the next `attack` row with correct `mon.speed + prepare` tics;
- `startBattle` seeds the first attack at `mon.speed + prepare` and stores the cooldown;
- determinism: seeded RNG produces identical feed/queue across two runs.
Keep existing player tests untouched (they must still pass unchanged). `npm test` must be fully green.

### 6. Docs — update to reflect the new monster lifecycle (Spahrep explicitly asked)
- `docs/battle-status-ui.md` §230 "Monster attacks land and are done. No cooldown phase" →
  monsters now mirror the player cooldown lifecycle. Option A formula. Update the "Monster Rows
  (Per-Cycle Successor)" section (a monster now has two rows per cycle: attack then cooldown).
- `docs/action-visual-lifecycle.md` §Phase 2 monster branch + §6/§7 row tables (add monster
  `cooldown` row: bar yes, label "<Monster> recovering").
- `docs/combat-engine-plan.md` monster lifecycle line (attack row = per-cycle; now attack+cooldown
  per cycle, cooldown tics = mon.speed + rollStat(attack.cooldown_time)).
- `docs/pending-decisions.md`: add a locked decision entry recording option A (Spahrep 2026-09-28).
- Update `docs/attack-queue-animation-testing.md` if it describes single-row monster cycles.
Do not rewrite unrelated doc sections; flag-only is not enough — make the monster lifecycle
statements accurate, with the option-A formula in each place it was wrong.

## Definition of Done (all must hold)
1. `js/combat/engine.js`: monster `attack` → `cooldown` → next `attack` two-phase lifecycle
   (`mon.speed` added into both phases + per-attack prepare/cooldown). Player hand branch untouched
   (diff shows player lines unchanged).
2. `startBattle` seeds first attack at `mon.speed + prepare` with stored cooldown.
3. `captureFires` intro mirror handles both monster events (attack→cooldown, cooldown→attack).
4. Client renders the monster cooldown row with timing bar + readable label; attack→cooldown and
   cooldown→attack are silent successor transitions (no spurious exit slide).
5. Tests updated + new regression tests; `npm test` FULLY GREEN.
6. Docs accurate in all six places above, option-A formula stated.
7. Commit ONLY on branch `wt/monster-cooldown`. Report real commit SHA + real test counts
   (baseline 173 pass / 0 fail). NEVER push to main — Hermes verifies then merges.

## Verification (Hermes will do after you finish)
Run `npm test` for real counts; `git diff` vs the file list above; confirm no player-branch engine
change and no `main` push; live-verify the monster cooldown row on portalcolosseum.com after merge.
