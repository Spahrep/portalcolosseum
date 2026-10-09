# Action Queue — Code Audit Against the Visual Choreography Rules

> **⚠️ SUPERSEDED MODEL (2026-10-09).** This audit was run against the OLD invariants,
> which included "R4: boxes are never regenerated (nodes reused)" and stable-key
> in-place relabeling as the correct behavior. **Spahrep has since locked the opposite:
> every transition is remove + insert — no shared DOM node, no in-place relabel except
> the two text-only cases (tic countdown, monster recovering→preparing-to-attack).**
> The current authoritative spec is `docs/action-queue-visual-choreography.md`. This
> document is kept as a historical record of the audit; do NOT use its R3/R4 framing
> as the design contract.

**Date:** 2026-10-09
**Audited against:** `docs/action-queue-visual-choreography.md` (pre-2026-10-09 version) — the four invariants:
1. **R1** One event at a time (no batch visuals).
2. **R2** Rows that didn't change slot never move.
3. **R3** No box ever appears/disappears/holds-still — every entrance slides in, every exit slides out.
4. **R4** Boxes are never regenerated (nodes reused, not destroyed+rebuilt).

**Scope:** client-side queue DOM manipulation only (`js/battle-app.js`, `js/battle/queue-render.js`.
Engine logic in `js/combat/` mutates the data queue, not the DOM — out of scope for visual rules but
checked for the "never re-sort"/invariant rules separately).

---

## Manipulation sites — verdict per site

### `js/battle/queue-render.js`

| Site | Operation | R1 | R2 | R3 | R4 | Verdict |
|---|---|---|---|---|---|---|
| `renderQueue` fast path (:215-228) | equal stable keys in equal order → `updateQueueRowInPlace` only, never moves | ✅ | ✅ | ✅ | ✅ | PASS |
| `renderQueue` stable-key successor path (:234-276) | relabel/move in place if slot changed | ✅ | ✅ | ⚠️ | ✅ | PASS with note |
| `renderQueue` full-rebuild (:277-297) | `clearQueueDom()` then rebuild all rows | ✅ | ⚠️ | ❌ | ❌ | **RISK — see F1** |
| `clearQueueDom` (:327-343) | `.remove()` non-exiting rows instantly | ✅ | — | ❌ | ❌ | **RISK — see F1** |
| `buildQueueRow` (:404) | builder; no enter class (callers add) | ✅ | ✅ | ✅ | ✅ | PASS |
| `updateQueueRowInPlace` (:473) | relabel; arms ENTER on phase change only | ✅ | ✅ | ⚠️ | ✅ | **Note — see F2** |
| `markQueueRowExiting` (:345) | adds `queue-row-exit` (slide out) | ✅ | ✅ | ✅ | ✅ | PASS |
| `diffQueueForAnimation` (:308) | read-only diff of old/new keys | ✅ | ✅ | ✅ | ✅ | PASS |

**F2 scope note:** `updateQueueRowInPlace` arms a slide-IN on a phase change but never slides the old
phase OUT. It is therefore only R3-correct when the **caller** slid the node out first. It is
reached by several callers (see below) — correct for the head, NOT for mid-queue phase changes.

### `js/battle-app.js`

| Site | Operation | R1 | R2 | R3 | R4 | Verdict |
|---|---|---|---|---|---|---|
| `runQueueRemoval` (:224) | mark exit → wait → group-lift | ✅ | ✅ | ✅ | ✅ | PASS |
| `groupLiftRemaining` (:241) | FLIP uplift of siblings | ✅ | ✅ | ✅ | ✅ | PASS |
| `silentPopHead` (:399) | name is legacy; ANIMATED path slides out (markQueueRowExiting); `row.remove()` only under `animationsSkipped` | ✅ | ✅ | ✅ | ✅ | PASS (misleading name only) |
| `reseatSameKeySuccessor` (:421) | builds successor + `armQueueRowEnter` | ✅ | ✅ | ✅ | ✅ | PASS |
| `releaseProcessedHead` — same-key successor (:476-508) | slide out (mark exit, wait) → relabel → slide in | ✅ | ✅ | ✅ | ✅ | PASS |
| `releaseProcessedHead` — genuine removal (:510-518) | successor lands First, then slide out + lift | ✅ | ✅ | ✅ | ✅ | PASS |
| `releaseProcessedHead` — **`landsOnReady`** (:463-473) | relabel + arm ENTER, **no exit slide** | ✅ | ✅ | ❌ | ✅ | **VIOLATION — V1** |
| `playRowArrival` (:601) | gap → wipe → flash → enter | ✅ | ✅ | ✅ | ✅ | PASS |
| `playQueueTransition` (:639) | row-arrival first, then ready-commit removal, then reconcile | ✅ | ✅ | ✅ | ✅ | PASS |
| `playCommitArrival` (:698) | relabeled commit: slide out → relabel → slide in | ✅ | ✅ | ✅ | ✅ | PASS |
| `advance` nonHead removal (:2276-2291) | `runQueueRemoval` on `nonHead.slice(0,1)` only | ✅ | ✅ | ⚠️ | ✅ | **RISK — see F1** |
| `finishBattleIntro` (:824-874) | wipe + rebuild, rows staged with slide-in | ✅ | ✅ | ✅ | ✅ | PASS (first build only) |
| `paintIntroRail`/`applyIntroFire`/`introFireLines` (:988-1025) | full rail rebuild each step | — | — | — | — | **DEAD CODE — see F3** |
| `loadBattle` enter-stagger (:2039-2055) | adds enter class to each row after `renderQueue` | ✅ | ✅ | ✅ | ✅ | PASS |

---

## Findings

### V1 — CONFIRMED VIOLATION: cooldown→ready at the head holds still (R3)
`releaseProcessedHead` → `landsOnReady` (battle-app.js:463-473) relabels the node in place and arms
only a slide-IN. The old cooldown box never slides out. **This is the most common head transition of
all — every single hand recovery ends here.** The test `hand landing on READY at the queue head holds
still` enshrines the old behavior and now contradicts the codified rule.

**Fix:** slide the node out (mark exit, wait like the same-key path :493-508), then relabel + slide in.
Update the test to assert the slide, not the hold.

### F1 — RISK: `renderQueue` full-rebuild and multi-removal ticks break R3/R4
`advance` only animates the FIRST non-head removal (`nonHead.slice(0,1)`). If one tick removes **two or
more** non-head rows (a multi-target impact killing 2+ monsters, or a death combined with a kill-cancel),
the extra removed rows are not slid out. The subsequent `renderQueue(bs)` then finds the orphan rows (not
in `newQueue`), fails all in-place guards, and falls to `clearQueueDom()` + rebuild — which `.remove()`s the
orphans **instantly** and rebuilds without enter classes. Boxes disappear without a slide (R3) and all nodes
are regenerated (R4).

**Fix options:** (a) make `advance` apply `runQueueRemoval` to every non-head loss, not `slice(0,1)`; or
(b) make `renderQueue`'s fallback mark non-exiting orphans as exiting and slide them out + lift before
rebuilding, instead of `.remove()`ing them.

### F2 — RISK: mid-queue same-key phase change slides in but not out (R3)
A hand winding cancelled into cooldown by a kill-cancel (PC-68), when it is **not** the processed head,
keeps its key (`h:LH`) in both old and new queue. It is excluded from `nonHead` (key still present), from
`added` (same key), and from `readyCommits`. It reaches `updateQueueRowInPlace` (stable-key path), which
arms slide-IN only — the winding box never slides out. Same class of violation as V1, but mid-queue.

**Fix options:** detect same-key phase changes in `advance`/`playQueueTransition` and slide them out+in
like the head path, or extend the rule to animate mid-queue successor transitions.

### F3 — DEAD CODE: intro-theater rail rebuilds (`R4` risk if re-enabled)
`paintIntroRail`, `applyIntroFire`, `introFireLines` (battle-app.js:988-1025) wipe and rebuild the entire
rail on every step. They are **never called** — the intro countdown (`playIntroCountdown`) was retired to a
hard-false gate. Not a live violation, but if the 3-2-1 theater is ever re-enabled it would violate R3/R4.
Recommend deleting or clearly marking them as retired.

### Noted (not violations)
- `silentPopHead` name is legacy/misleading — its animated path does slide out (R3-correct). Rename for clarity.
- `updateQueueRowInPlace` is only R3-correct when the caller pre-slides the exit; this coupling is fragile
  and is the root of V1 and F2.

---

## Summary

**The animation layer fully and correctly slides head transitions and single removals.** The two
invariants that matter most (R2 stable-slot, R4 no-regeneration via reuse) are solid — the stable-key
fast path and successor handling are exactly right and heavily tested.

**But R3 ("no box ever holds still; every box slides out and in") is only enforced at the head and for
single removals.** Three concrete gaps of the same root class — the render reconcile + mid-queue phase
changes don't slide:
- **V1** (confirmed, common): cooldown→ready at head holds still.
- **F1** (risk): >1 non-head removal in a tick → orphans wiped instantly by the full-rebuild.
- **F2** (risk): mid-queue kill-cancel winding→cooldown slides in but not out.

All three trace to one design fact: a **node-reuse slide is guaranteed only where `releaseProcessedHead`
runs; every other path defers to `renderQueue`, whose fallback rebuild pops instead of slides.** To fully
honor the rule, every queue change must route through an explicit slide choreography rather than any
`.remove()`/rebuild fallback.

---

## Resolution (2026-10-09) — all findings fixed

| Finding | Status | Fix |
|---|---|---|
| V1 — cooldown→ready at head holds still | **FIXED** | `releaseProcessedHead` `landsOnReady` now slides out then in on the animated path (markQueueRowExiting → waitForEvent → strip exit → updateQueueRowInPlace → armQueueRowEnter). Skip path preserved. Test updated. |
| F1 — multi-removal ticks wipe orphans | **FIXED** | `advance` slides every non-head loss (no `.slice(0,1)`); `renderQueue` full-rebuild + `clearQueueDom` mark orphan rows `queue-row-exit` (slide out, stay in flow) via a `rebuildReconciled` set instead of instant `.remove()`. |
| F2 — mid-queue kill-cancel phase change | **FIXED** | `advance` detects same-key phase changes (key in both queues, event changed, not processed head / not ready-commit) and slides old out → new in on the same node. |
| F3 — dead intro-theater rail rebuilds | **FIXED** | `introFireLines` / `applyIntroFire` / `paintIntroRail` deleted (were unreferenced). |

**Verification:** full suite `npm test` → 283 pass / 0 fail; `node --check` clean on both changed files;
focused engine-drive of the V1/F1/F2 transitions → 6/6 pass.

**Residual (accepted, not a blocker):** `renderQueue` cannot call `groupLiftRemaining` itself (circular
import — it lives in battle-app.js). Known non-head losses are lifted by `runQueueRemoval` before the
rebuild. A straggler that only the rebuild marks exiting stays in flow (ghost space) until the next
`groupLiftRemaining` runs — a defensive backstop, not the live path.

