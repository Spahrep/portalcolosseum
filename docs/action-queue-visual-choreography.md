# Action Queue — Visual Choreography (Definitive Spec)

**Status:** Authoritative. This is the single source of truth for HOW the Action Queue
looks and moves on screen. It is the visual companion to `action-visual-lifecycle.md`
(which defines the *logic* — what each event does) and `action-queue-animation.md`
(which defines the *keyframes*). If any doc disagrees with this one, this one wins.

**Audience:** Any agent or human implementing, testing, or reviewing queue visuals.

**Scope:** The on-screen Action Queue column only — how rows enter, move, and leave.
Not the engine, not the API, not damage/balance.

---

## The core rule (Spahrep, 2026-10-09, as refined 2026-10-11)

> When something gets to the top it should never get removed and re-inserted at
> the top. The only time something at the top should get removed is after it has
> been processed and its successor has been inserted. (Spahrep, 2026-10-11)

Reaching the top is NOT a transition and NOT a removal. A box that reaches the head
becomes the actionable element and **holds** — if its text changes as it arrives it
relabels in place (e.g. a hand's cooldown row reaching 0 becomes "Ready"; a monster's
cooldown row reaching the top swaps "recovering" → "preparing to attack"). The box is
**never** removed-and-re-inserted just for reaching the top.

A box is removed from the top ONLY after it has been **processed** (the clock fires it,
or the player commits it), and its successor is inserted first:

```
head sits at the top (relabeled in place if its text changed)
  → it is processed (rolls, narration, state changes / player commit)
  → a NEW box is inserted (its successor, fresh id, at its queue position)
  → the processed head is removed (its exit is the LAST action)
```

A box is never morphed into another box. A box is never re-inserted. A box that was
processed is gone — if a successor exists it is a new box. Remove + insert happens
for **processed** heads only. Ever.

### The text-only relabel cases (box holds position, text swaps, no entry change)

Exactly these cases change a box's text without any entry change. These are the ONLY
relabel cases — nothing else relabels:

1. **Tic countdown updates.** The box holds its position; only the number changes
   (33 → 23). No slide, no re-position.
2. **A row reaching the top.** When a row ticks to 0 and becomes the head, it relabels
   in place — no slide, no re-insert. Two sub-cases:
   - A hand's `approach`/`cooldown` row reaching 0 relabels to **Ready** (the countdown
     number → the "—" actionable signal).
   - A monster's `cooldown` row reaching the top relabels "recovering" → "preparing to
     attack" as the clock types the narration.


Any other text change is NOT a relabel — it is a new entry (new box) replacing an
old one.

---

## The invariants that never break

1. **One event at a time.** The queue processes one row per Master Clock tick. The
   visuals never batch — a tick animates exactly one transition, then the next.
2. **Remove + insert, every transition.** A processed box's exit is the last action
   of its processing. The new box (its successor, or a genuinely new entry) is
   inserted BEFORE the old box is removed, so the successor claims its space first.
3. **New box lands first, old box leaves last.** On any tick that both inserts and
   removes: the insert completes (space grows, new box slides in), THEN the processed
   box slides out, THEN the remaining boxes slide up as one continuous FLIP motion.
   No jumping, no teleporting, no double-animation.
4. **A box only moves when entries come and go.** A box whose text changed but whose
   position didn't (the two relabel cases) never slides. A box that is genuinely
   leaving or arriving always slides.
5. **No box is ever popped silently** on the animated path (instant preset and
   reduced-motion are the only silent paths, and they are correct by design).

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

## Scenario 2 — Player Attack Commit (the full arrival sequence)

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
  right** (`queue-row-exit`). Its exit is the last action of its processing.

### F. The rest of the queue slides up
- Once the ready head has fully exited, the rows below **glide up together** as one unit
  (FLIP group-lift) to fill the vacated slot. No per-row stagger, no jump — one continuous
  motion.

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
the reverse. A same-tick removal must never suppress the row-arrival.

---

## Scenario 3 — Autonomous tick (winding → impact → cooldown → ready)

**Trigger:** A ready head commits, or a non-ready head fires on its own (a hand's
winding→impact→cooldown→ready, a hand's cooldown→ready, or a monster's
cooldown→winding→impact→cooldown).

### What happens
1. The head is **pinned** at top while its narration types and its visuals play
   (`queue-row-current` — golden glow). It does NOT move during narration — the pin
   is a pause, not a "stays forever."
2. When the head fires (is processed), its successor is inserted first (fresh id,
   at its queue position). The successor **slides in** at its position.
3. Then the processed box **slides out** — its exit is the last action of its
   processing. The remaining boxes group-lift as one FLIP motion.
4. When the successor is a hand **ready** row (cooldown→ready), the ready row is
   the hand reaching the top. This is a **relabel in place** — the cooldown box
   becoming the actionable Ready head does NOT slide out and a new box does NOT
   slide in. The box holds, swaps its countdown for the "—" actionable signal, and
   the clock pauses waiting for the player. It is only removed when the player
   commits it (Scenario 2), after which its successor is inserted.

### Consistency rules
- Reaching the top is never a remove + insert. A box that becomes the head relabels
  in place (Ready, or a monster "preparing to attack") and holds.
- A box is removed only after it is **processed**. Every processed head is remove +
  insert: old box out (last action), successor box in (first action).
- The pin-during-narration is a wait, not a freeze — the box always slides out after
  it is processed.
- A genuine non-head removal (e.g. a cancelled row) slides out + the rest group-lifts.

---

## Scenario 4 — Monster attack

Monsters have no `ready` row. Their cycle is `cooldown → winding → impact → cooldown`.

### What the player sees
1. A monster `cooldown` row ("<Name> recovering") fires → the next `winding` row
   ("<Name>'s <Attack>") is inserted at its sorted position. It slides in via the same
   row-arrival (Scenario 2 D).
2. `winding` fires → `impact` row lands at tic 0 (new entry, slides in).
3. `impact` fires → damage narration + visuals, then `cooldown` row inserted.

### The one monster relabel
When a monster's `cooldown` row reaches the top, the box holds its position and
relabels "recovering" → "preparing to attack" as the typewriter types the
"prepares a <attack>..." narration. Optional fade on the text swap. The box never
moves for this relabel. (This is relabel case #2 above.)

### Consistency rules
- Monster rows are name + tic only — no bar, no fill.
- Every monster phase change is remove + insert. The cooldown→winding relabel is the
  ONLY monster case where the box holds still and swaps text.

---

## Scenario 5 — Potion / Weapon swap

Both follow the commit arrival (Scenario 2):
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
- ❌ A box is never morphed into another box. A processed head is remove + insert.
- ❌ A box never holds still while its contents change, EXCEPT the relabel cases
  (tic countdown; a row reaching the top — hand cooldown→Ready, monster
  recovering→preparing-to-attack). Those are text-only.
- ❌ A box never gets a new identity without being removed. A new entry is a new box.
- ❌ The processed head never slides out BEFORE its successor slides in.
- ❌ A plain countdown tick never animates (only the tic number updates in place).
- ❌ The row-arrival is never suppressed by a same-tick removal.
- ❌ No timing bar / fill bar / %-complete bar on any row. The countdown is the tic number.
- ❌ No shared DOM node pretending to be the same hand across two different entries.

---

Decided by Spahrep, 2026-10-09 and refined 2026-10-11. (PC-DEC-070, refined by
PC-DEC-071; supersedes the earlier node-reuse/relabel framing in action-queue-audit.md
and attack-queue-animation-testing.md, now marked superseded. PC-DEC-071 restores the
"reaching the top is a relabel, never a remove + insert" rule.)
