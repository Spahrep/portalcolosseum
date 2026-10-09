# Action Queue — Visual Choreography (Definitive Spec)

**Status:** Authoritative. This is the single source of truth for HOW the Action Queue
looks and moves on screen. It is the visual companion to `action-visual-lifecycle.md`
(which defines the *logic* — what each event does) and `action-queue-animation.md`
(which defines the *keyframes*). If any doc disagrees with this one, this one wins.

**Audience:** Any agent or human implementing, testing, or reviewing queue visuals.

**Scope:** The on-screen Action Queue column only — how rows enter, move, and leave.
Not the engine, not the API, not damage/balance.

---

## The invariants that never break

1. **One event at a time.** The queue processes one row per Master Clock tick. The
   visuals never batch — a tick animates exactly one transition, then the next.
2. **Rows that didn't change slot never move.** A plain countdown tick only updates the
   tic number in place. Rows are never re-sorted, never re-slid, never rebuilt.
3. **No box ever appears or disappears — boxes always slide.** A box that enters the
   queue always slides in; a box that leaves always slides out. A box never jumps into
   existence, never vanishes, and never has its contents swapped in place with no motion
   (no "hold still / relabel silently"). This includes the same logical row changing phase
   (winding→impact→cooldown→ready): the old phase slides out, the new phase slides in.
4. **Boxes are never regenerated.** The DOM node is reused and its contents relabeled,
   then animated — never destroyed and rebuilt. This is what prevents flicker while still
   sliding. "Slide in/out" is the *visible* motion; "reuse the node" is the *implementation*
   that makes that motion smooth.

Everything below is a consequence of these rules.

---

## Scenario 1 — Battle Start (approaches)

**Trigger:** `startBattle` seeds the queue. The clock does NOT run yet.

### What the engine does (in order)
1. One `approach` row per hand is computed at that hand's weapon speed (LH, then RH).
2. One `cooldown` row per living monster is computed at that monster's `speed`.
3. The queue is frozen in tics-ascending order. Nothing fires yet.

### What the player sees (in order)
1. The queue panel is empty.
2. Rows are inserted **one at a time, top to bottom**, each sliding in from the right
   (`queue-row-slide-in`), with a short stagger between them (~200ms).
3. The first row to appear is the soonest-to-fire (lowest tics). The last is the slowest.
4. Once every row is in, the action menu may appear (only if a hand is already Ready —
   which it is not at battle start, so the clock just starts ticking).

### Consistency rules
- Approaches are **computed all at once** (engine), but **revealed one at a time** (visual).
- The reveal order is the engine array order (tics ascending) — never a re-sort.
- No row is animated twice. Each approach slides in exactly once.

---

## Scenario 2 — Player Attack Commit (the full ceremony)

**Trigger:** A `ready` row is at the head (player's turn). The player picks an attack +
target and commits.

### A. The ready head is at the top
- The top row is the player's ready hand: `L. Hand Ready` (or `R. Hand Ready`), tic `—`,
  no bar. It is highlighted as the actionable head (`queue-row-ready-head`).
- The clock is paused, waiting for the player.

### B. The next ready hand surfaces
- If the other hand is also Ready, it sits below in the queue. When the current hand
  commits and its cycle completes, the other hand's `ready` row surfaces as the new head.
- One hand at a time, always. LH before RH on ties.

### C. Selecting an action shows the insertion band
- While the player browses attacks, a **prediction band** appears on the right edge of the
  queue (`prediction-bar`), spanning the tic range where the selected attack will land.
- The band is a preview only — it does not change the queue. It clears when the selection
  is cancelled or committed.
- (The `>` timing markers are the simpler preview; the full band is the richer one. Both
  are preview-only.)

### D. Commit → windup computed → space grows → new action slides in
On commit, in this exact order:
1. **Windup is computed** (engine): the `winding` row's tics = weapon speed − speed buffs.
2. **A space grows** at the winding row's correct sorted position (`queue-insert-gap` opens,
   rows below push down). The gap is clean — no border, no fill.
3. **An insert marker wipes** left→right across the gap (`queue-insert-bar.wipe`), then
   **flashes** once (`queue-insert-bar.flash`).
4. **The real row slides in** (`queue-row-enter`), replacing the gap. The new `winding` row
   is now in the queue at its permanent position.

### E. The top element slides out
- After the new row has fully settled in, the processed `ready` head **slides out to the
   right** (`queue-row-exit`). It stays in flow while sliding (space not yet released).

### F. The rest of the queue slides up
- Once the ready head has fully exited, the rows below **glide up together** as one unit
   (FLIP group-lift) to fill the vacated slot. No per-row stagger, no jump.

### The exact order (memorize this)
```
1. windup computed (engine)
2. space grows at the new row's position
3. insert marker wipes → flashes
4. new winding row slides in
5. ready head slides out
6. remaining rows slide up together
```

**This order is locked.** The new row lands FIRST, then the processed head leaves. Never
the reverse. A same-tick removal must never suppress the insert ceremony.

---

## Scenario 3 — Autonomous tick (winding → impact → cooldown)

**Trigger:** A non-ready head fires on its own (a hand's winding→impact→cooldown, a hand's
cooldown→ready, or a monster's cooldown→winding→impact→cooldown).

### What happens
1. The head is **pinned** at top while its narration types and its visuals play
   (`queue-row-current` — golden glow). It does NOT move during narration — the pin
   is a pause, not a "stays forever."
2. When narration + visuals finish, the head **slides out** (`queue-row-exit`).
3. Its **successor slides in** at the same position (`queue-row-enter` / `queue-row-monster-enter`).
   Because it's the same logical row (`h:LH` / `m:<label>`), the same DOM node is reused —
   slid out, relabeled, slid back in. This satisfies "always slide" AND "never regenerate."
4. If the successor is a hand **ready** row (cooldown→ready): the cooldown box still slides
   out and the ready box slides in — it does NOT hold still or silently relabel. Landing on
   the player's turn is visually just another slide-out → slide-in; the pause is the clock
   waiting, not the row frozen.

### Consistency rules
- Every phase change slides: old phase out, new phase in. There is no "silent successor"
  and no "holds still" exception.
- The pin-during-narration is a wait, not a freeze — the box always slides out after.
- A genuine non-head removal (e.g. a cancelled row) slides out + the rest group-lifts.

---

## Scenario 4 — Monster attack

Monsters have no `ready` row. Their cycle is `cooldown → winding → impact → cooldown`.

### What the player sees
1. A monster `cooldown` row ("<Name> recovering") fires → the next `winding` row
   ("<Name>'s <Attack>") is inserted at its sorted position. It slides in via the same
   insert ceremony (Scenario 2 D), or — as a same-key successor — slides out and the
   winding box slides in.
2. `winding` fires → `impact` row lands at tic 0 (same-key successor: slide out, slide in).
3. `impact` fires → damage narration + visuals, then `cooldown` row inserted.

### Consistency rules
- Monster rows are name + tic only — no bar, no fill.
- Monster phase changes are same-key successors (in-place), not slide-out + slide-in.

---

## Scenario 5 — Potion / Weapon swap

Both follow the commit ceremony (Scenario 2):
1. Ready head at top.
2. Player picks potion (or Equip).
3. Windup computed → space grows → marker wipes/flashes → new row (`drinking` or
   `cooldown`) slides in.
4. Ready head slides out.
5. Rest slides up.

---

## Timing values (single source)

| Beat | Duration | CSS var / JS key |
|---|---|---|
| Row slide-in (enter) | 250ms | `--ux-queue-enter` / `dur('queueEnter')` |
| Row slide-out (exit) | 280ms | `--ux-queue-exit` / `dur('queueExit')` |
| Group-lift | 280ms | `dur('queueExit')` |
| Space-gap grow | 300ms | `--ux-queue-gap` / `dur('queueGap')` |
| Insert marker wipe | 250ms | `--ux-queue-wipe` / `dur('queueWipe')` |
| Insert marker flash | 150ms | `--ux-queue-flash` / `dur('queueFlash')` |
| Battle-start stagger | 200ms/row | `finishBattleIntro` |

All animation waits are **event-gated** (`waitForEvent` on `animationend`/`transitionend`),
never `setTimeout` magic numbers. The CSS vars and the JS `dur()` values are paired so the
animation and the wait fallback are the same length.

---

## The skip path (instant preset / reduced motion)

When text speed is "instant" (`charMs = 0`) or reduced-motion is on, `animationsSkipped`
returns true. Every animation short-circuits:
- No space-grow, no marker, no slide-in — the new row lands directly.
- No slide-out, no group-lift — the ready head is removed instantly.
- The **logic is identical**; only the presentation is skipped.

This is locked. The silent path is correct and must remain.

---

## What NEVER happens (anti-spec)

- ❌ A box never appears instantly — every box that enters the queue slides in.
- ❌ A box never disappears instantly — every box that leaves slides out.
- ❌ A box never sits still while its contents change phase (no "hold still / silently
  relabel"). The old phase slides out, the new phase slides in.
- ❌ A box is never regenerated (destroyed + rebuilt) — nodes are reused and animated.
- ❌ The queue is never globally re-sorted on screen.
- ❌ Rows that didn't change slot never move, re-slide, or rebuild.
- ❌ The processed head never slides out BEFORE its successor slides in.
- ❌ A plain countdown tick never animates (only the tic number updates in place).
- ❌ The insert ceremony is never suppressed by a same-tick removal.
- ❌ No timing bar / fill bar / %-complete bar on any row. The countdown is the tic number.
