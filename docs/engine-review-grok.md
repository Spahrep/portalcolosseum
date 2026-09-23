# Portal Colosseum Combat Engine Architectural Review

**Reviewer:** Grok-4.3 (subagent)  
**Date:** 2026-09-22  
**Files Reviewed:**  
- `/home/spahrep/portalcolosseum/js/combat/engine.js` (516 lines)  
- `/home/spahrep/portalcolosseum/js/combat/tic-queue.js` (84 lines)  
- `/home/spahrep/portalcolosseum/tests/combat-engine.test.js` (763 lines, 57+ tests)  
- `/home/spahrep/portalcolosseum/tests/potion-use.test.js` (393 lines, 27 tests)  
- `/home/spahrep/portalcolosseum/docs/action-visual-lifecycle.md` (design doc)  
**Test Status:** All 84 tests passing.

## 1. ARCHITECTURE

The pop-and-process model is implemented as a sorted **array** (not a true linked-list) in `tic-queue.js`. `popNext` (lines 17-31) sorts, skips all leading `ready` placeholders (while loop lines 20-22), pops the head non-ready row, subtracts `ticOffset` from **all** remaining rows with `Math.max(0, ...)`, then splices.

- **Clean hold-together:** Yes. `commitNewRow` / `addEvent` + `sortQueue` on every commit; `handleFire` in engine.js (lines 61-187) morphs phases by adding successor rows (winding→impact at 0 tics, impact→cooldown, etc.). No batching artifacts.
- **Hidden time-skip remnants:** None. Old per-tic loop replaced; `advanceToNextDecision` (engine.js:261) is a pure event-driven loop calling `stepQueue`. `tic` only increments on real pops (line 224). No dead `tick()` or legacy counters.
- **Dead code:** Minimal. `morphHandRow` exported but unused in engine (legacy from rewrite). `loadState` and `resumeEngine` are exercised in tests. No obvious orphans.

## 2. BREAK CONDITION

`advanceToNextDecision` (engine.js:261-282):

```js
const wasReadyBefore = ...;
while (true) {
  if (isBattleOver()) break;
  stepQueue(fires);
  const anyReady = checkPlayerReady();
  const allReady = ['LH','RH'].every(h => ... === 'Ready');
  const handBecameReady = ['LH','RH'].some(h => !wasReadyBefore[h] && ... === 'Ready');
  if (allReady || (anyReady && !handBecameReady)) break;
  ...
}
```

**Covers most cases cleanly.** Stops when:
- All hands Ready (full decision point), or
- At least one Ready but **no new hand became Ready in this step** (prevents over-advancing past a partial decision).

**Edge cases where it could fail (none observed in current code/tests):**
- **Approach phase vs lifecycle:** `startBattle` seeds `approach` rows + sets `Approach` state, then calls `advanceToNextDecision`. The break correctly fires the two approach rows and stops at first `Ready` (tests PC-64 confirm).
- **Both hands in lifecycle simultaneously:** Covered (tests "single commit resolves the full cycle to Ready", "other hand keeps attacking while drinking"). `handBecameReady` only triggers on transition from !Ready→Ready; simultaneous windups resolve independently.
- **Leftover approach rows during commit:** `commitAttack`/`commitPotion` explicitly remove any `ready` placeholder (lines 298-301, 467-470) before inserting winding/drinking. No stale approach rows survive.
- **popNext skipping ready rows causing no-op steps:** Explicitly handled (tic-queue:20-22); `ready` rows are never popped, only placeholders for UI. No no-op loops observed (safety cap at 500 iterations).

**Verdict:** Robust. The `!handBecameReady` guard prevents the exact "advance past the first Ready hand" bug the old time-skip model had.

## 3. DATA FLOW

`handleFire` (engine.js:61-187) correctly carries properties through the full lifecycle:

- **winding → impact** (lines 63-74): Explicitly copies `targetIds, damage, isMultiTarget, cooldownTicks, accuracy, critChance, critMultiplier, attackName` onto the new impact row.
- **impact → cooldown** (lines 75-112): Uses carried values for `resolveAttack`, then adds cooldown row with `row.cooldownTicks`.
- **cooldown → ready** (lines 113-119): Sets hand state `Ready`, adds `ready` row.
- **approach / recovery / drinking** paths also set `Ready` state.

**No dropped properties.** All attack metadata survives (verified in data-driven tests and F16 lifecycle tests). Monster rows carry `monsterAttackName` separately.

## 4. QUEUE INTEGRITY

- `popNext`: Always `Math.max(0, tics - ticOffset)` (tic-queue:27) → no negatives.
- Sorted insertion: `commitNewRow` calls `sortQueue` (player-first on ties).
- Cleanup: `splice` on pop; explicit removal of `ready` placeholders before commit; `cancelQueuedAttacksOnDeadTargets` removes winding rows on kill.
- **Risks:** None observed. Stale rows prevented by removal logic. `ready` rows are intentionally left as 0-tic placeholders and skipped by pop.

## 5. STATE CONSISTENCY

Hand state (`Ready` / `winding` / `impact` / `cooldown` / `drinking` / `Approach`) is **tightly synced** with queue events:
- `commitAttack` sets `winding` + removes ready row.
- `handleFire` for each terminal event sets `Ready`.
- `startBattle` seeds `Approach` then resolves via advance.
- Potion paths set `drinking`/`recovery`.

No divergence in any test path (including loadState round-trips). `getState()` exposes both `hands` and `queue` for UI verification.

## 6. TEST COVERAGE

**Strong coverage (84 tests, all passing):**
- Approach/initial turn order (PC-64)
- Full attack lifecycle (winding→impact→cooldown→Ready)
- Both hands committed simultaneously
- Potion action cost + concurrent attacks
- Kill-cancel (PC-68)
- Multi-target, accuracy, crit, buffs, monster AI names
- Timing markers, belt swap, resume/loadState, edge HP carry

**Minor gaps (not critical, but untested explicit scenarios):**
- Both hands winding simultaneously **from potion action cost** (one hand drinking while other winds; tests cover potion + other-hand attack, but not symmetric potion cost locking both).
- Pure monster-only turns with both hands already winding (long cooldowns, no player input possible mid-turn).
- Very long simultaneous windups (38+ tics) with interleaved monster attacks (one test exists for 38-tic gap but not both hands + monsters).

These are low-risk because the break condition + popNext logic is exercised broadly.

## 7. RECOMMENDATIONS

1. **Minor cleanup (low priority):** Remove unused `morphHandRow` export from tic-queue.js (or document if planned for future UI morphing).
2. **Add 2-3 targeted tests** for the noted gaps (both-hands potion wind + monster interleaving) to reach 100% edge-case confidence.
3. **Consider** exposing a `debugQueue()` helper that asserts no `ready` rows have `tics > 0` and no negative tics — useful for future regression guards.
4. **No structural changes needed.** The pop-and-process model is solid, deterministic, and free of the old time-skip pathologies.

**Overall Assessment:** Production-ready. The rewrite successfully eliminated time-skip artifacts while preserving exact determinism and feed output. Break condition, data flow, and queue integrity are all sound. Minor test additions recommended for completeness.