# Battle Engine Refactor Brief — enforce Peek → Process → Cleanup → Remove

Status: **Draft for Grok** — companion to `docs/battle-engine-item-processing.md` (the official spec).
Author: Hermes (Foreman), 2026-09-25. Every claim below is grounded in the current code; nothing invented.

## 1. The contract to enforce

The official spec (`docs/battle-engine-item-processing.md`) defines a strictly serial master loop:

```
Peek → Process → Cleanup → Remove
```

- **Peek** — read the head of the queue to know what to process. Variant-free read.
- **Process** — dispatch by action type (6 types: Ready Player, Ready Monster, Attack Happens, Potion Effect Happens, Weapon Swap Happens, Buff Expires). Each has a/b/c substeps.
- **Cleanup** — death / defeat / victory gate (see §4).
- **Remove** — uniform for all types: pop → slide-out → shift-up.

Visual discipline: visuals may run **in parallel inside a step**, but a step does not advance until **all** its visuals complete (`Promise.all`), and visuals never overlap across a step boundary. Completion is **event-driven** (Option A: resolve on `animationend`/`transitionend`), never fixed-duration guesses.

## 2. Current code — what actually exists (verified)

### Server: `/tick` endpoint
`api/combat/[...path].js:748-786` — `POST /api/combat/runs/:id/tick`:
- resumes the engine from `run.battle_state` (line 761)
- calls `engine.tick()` (line 766)
- persists `engine.state` + `player_hp` (lines 770-772)
- returns `{ result, state }` (lines 774-785)

### Engine: `engine.tick()` — `js/combat/engine.js:232-264`
Current order (NOT the spec order):
1. `removeHead(state.queue)` — **data detach FIRST** (line 237)
2. advance remaining rows' tics by the consumed row's value (lines 248-253)
3. `handleFire(head)` — the polymorphic dispatch (line 255)
4. `sortQueue` (line 256)
5. compute flags: `needsInput`, `playerReady`, `battleOver` (lines 259-263)
6. return `{ narrate, row, feed, needsInput, playerReady, battleOver }`

### Engine: `handleFire(row)` — `js/combat/engine.js:61-206`
This is the de-facto **Process** step — a big `if/else` dispatch on `row.event`:
- `buff_expiry` (62-71) — remove buff, log
- `winding` → `impact` (73-84) — carry attack data, add impact row
- `impact` (85-122) — resolve hit/miss/crit, apply damage, cancel queued attacks on dead targets, add cooldown row
- `cooldown` → `ready` (123-129)
- `approach` → `ready` (130-136)
- `drinking` → `recovery` (137-160) — apply potion, add buff_expiry if buff, add recovery row
- `recovery` → `ready` (161-167)
- monster `attack` (169-205) — roll damage, hit/miss, apply to player, schedule next attack

### Engine: compat paths
- `stepQueue` — `engine.js:290-335`: `peekHead` (295) → tic offset (300-304) → `removeProcessedHead` (307) → `stepOnce` (312). Used by tests and old call sites.
- `advanceToNextDecision` — `engine.js:343-358`: loops `stepQueue` until a decision point. Compat wrapper.
- `stepOnce` — `engine.js:208-226`: fires one row, expires buffs, returns `{row, narrate}`.

### Queue primitives — `js/combat/tic-queue.js`
- `peekHead` (33-41) — read head, skip `ready` placeholders
- `removeHead` (43-53) — pop head, skip `ready` placeholders
- `popNext` (17-31) — pop + tic-offset (legacy)
- `sortQueue` (55-63) — player-first on ties
- `commitNewRow` (65-69), `addEvent` (10-15)

### Client: `tickLoop` — `js/battle-app.js:2541-2674`
- loops: pacing delay (2547-2550) → `POST /tick` + `GET /runs/:id` in parallel (2554-2557) → render HP/monsters/loadout (2574-2576) → label-keyed queue diff (2581-2587) → `runQueueRemoval` on resolved rows (2585) → space-creation preview (2594-2628) → `renderQueue` (2630) → entry animations (2633-2649) → typewriter `appendFeedLine` (2654-2662) → break on `playerReady`/`needsInput`/`done`/`battleOver` (2664-2672).

### Client: visual choreography — `js/battle-app.js`
- `runQueueRemoval` (169-176): `markQueueRowExiting` → `sleep(QUEUE_EXIT_MS=280)` → `sleep(QUEUE_REMOVE_GAP_MS=100)` → `groupLiftRemaining`.
- `groupLiftRemaining` (180-212): FLIP slide-up, `sleep(QUEUE_EXIT_MS=280)`.
- `BattleClock` (40-143): state machine `SCHEDULED → ANIMATING → IDLE`; `onNarrateDone` (58-62) gates on feed narration completion. Partial barrier — narration only, not all visuals.
- Constants: `QUEUE_EXIT_MS = 280` (150), `QUEUE_REMOVE_GAP_MS = 100` (153). Entry anims: 1200ms (117), 400ms (114/2641), monster 400ms.

## 3. The gaps (verified)

1. **No distinct Peek/Process/Cleanup/Remove phases.** `engine.tick()` is remove-first + process; Cleanup is not a step — death/victory are folded into `battleOver`/`player_dead` flags returned by tick and handled client-side by `showAdvanceUI`.
2. **Remove-first data detach MUST be preserved.** `engine.js:305-306` documents why: `handleFire`'s `addEvent`/`commitNewRow` schedule follow-up rows for the same hand; leaving the parent in the array would momentarily create two rows per hand (the ghost/duplicate bug). The spec's conceptual Remove (visual, last) is already decoupled client-side via the label-keyed diff. **Reconciliation: "detach" (early, data) and "animate-out" (last, visual, uniform) are the two halves of Remove — keep the early data detach, make the visual remove uniform and last.**
3. **No Cleanup step.** Spec requires: player HP ≤ 0 → death screen (short-circuit, no Remove of current item); monsters dead → let Cleanup fully process (player sees last monster removed) then Victory/loot, no Remove beyond Cleanup.
4. **Visual completion is fixed-duration, not event-driven.** `QUEUE_EXIT_MS=280`, gap=100, entry 1200/400 — all `sleep()` guesses. This is exactly the "system doesn't know when visuals are done" gap. Spec requires Option A: each visual resolves a Promise on `animationend`/`transitionend`; the step `await`s all (`Promise.all`) before handing off.
5. **No barrier semantics.** Steps don't await all visuals. `BattleClock.onNarrateDone` gates on narration only; queue removal is sleep-based; HP-adjustment FX and typewriter are not `Promise.all`'d.

## 4. Target design (what Grok must build)

### Engine (`js/combat/engine.js`) — expose explicit phases
Refactor `tick()` (or add a new master-loop entry) so the four phases are explicit functions with clear inputs/outputs:

- **`peek()`** → returns the head row (variant-free read; skip `ready` placeholders). No mutation.
- **`process(row)`** → the polymorphic dispatch (extract from `handleFire`). Returns the processed result + any follow-up rows scheduled. **Preserve the early data-detach** (remove the head from the array before `process` runs its `addEvent`/`commitNewRow` follow-ups) — do NOT move Remove to the end of the data path.
- **`cleanup()`** → the death/defeat/victory gate:
  - player HP ≤ 0 → return `{ terminal: 'death' }` (short-circuit; no Remove of current item)
  - monsters with HP ≤ 0 → remove their associated actions from the queue, flag for removal visuals
  - no monsters left → return `{ terminal: 'victory' }` (let cleanup fully process; no Remove beyond)
- **`remove()`** → uniform: pop the completed action (data already detached), signal the visual remove (slide-out → shift-up). Type-agnostic.

The `/tick` endpoint (`api/combat/[...path].js:748-786`) must call the new master loop and return enough info for the client to drive the visual barrier (which phase ran, what visuals to fire, terminal state).

### Client (`js/battle-app.js`) — event-driven visual barrier
- Replace `sleep(QUEUE_EXIT_MS)`-style guesses with event-driven completion: each visual resolves a Promise on `animationend`/`transitionend` (with a timeout fallback so a missing event can't deadlock).
- Each step fires its visuals in parallel and `await Promise.all(...)` before handing off to the next step.
- `tickLoop` must not advance to the next tick until the current step's visuals (typewriter + HP FX + queue removal) are all done.

## 5. Constraints

- **Do NOT** move the data-detach to the end of the data path — that reintroduces the ghost/duplicate-row bug (`engine.js:305-306`).
- **Do NOT** add batching or process more than one queue item per tick. Strictly serial, one item at a time.
- **Do NOT** change the 6 action types or their a/b/c substeps — they are locked in the spec.
- **Do NOT** touch `js/combat/tic-queue.js` primitives unless a phase genuinely needs a new one (prefer composing existing `peekHead`/`removeHead`/`addEvent`/`commitNewRow`).
- Keep `stepQueue`/`advanceToNextDecision`/`stepOnce` working (tests and old call sites depend on them) or migrate their callers in the same change.
- No new stack. No DB migrations. No secrets.
- Run `npm test` (package.json: `node --test tests/*.test.js`) and `node --check` on every touched file.

## 6. Definition of done

- `engine.js` exposes explicit `peek` / `process` / `cleanup` / `remove` phases (or an equivalent master-loop structure) with the Cleanup death/victory gate.
- `/tick` returns phase + terminal info the client needs for the visual barrier.
- `battle-app.js` visual completion is event-driven (Option A) with a timeout fallback; steps `await Promise.all` before advancing.
- The ghost/duplicate-row bug does not regress (early data-detach preserved).
- All existing tests pass; new tests cover the Cleanup death/victory gate and the serial one-item-at-a-time invariant.
- Work committed to the ticket branch with a real commit SHA in the final report.

## 7. Out of scope (follow-up tickets)

- The visual-barrier client work is listed here as part of DoD, but if it must be split, the engine phase refactor is the first slice (disjoint file: `js/combat/engine.js` + `api/combat/[...path].js`); the client barrier is the second slice (`js/battle-app.js`). Do not run two workers on the same file.
