# Attack Queue Animation Testing

**Purpose:** Define exactly what to check when visually testing the Action Queue rendering and animations during combat. Not a smoke test — this is the dedicated checklist for queue-specific behavior, run after any queue rendering, animation, or timing bar changes.

**Based on:** `docs/action-visual-lifecycle.md` (Master Clock Model)

---

## 1. Queue Load & Initial Render

### 1.1 Battle Start Queue Shape

Navigate to a fresh battle. The queue should contain:

- **Approach rows**: One per hand, ordered by weapon speed (fastest first). Shows label ("L. Hand", "R. Hand") and tic count. No timing bar on approach rows.
- **Monster attacks**: One per monster, ordered by monster speed. Shows monster name + tic count. No timing bar.
- **Total entries**: Number of hands + number of monsters. Example: 2 hands + 1 Glimmerling = 3 entries.

**Pass criteria:**
- [ ] Queue has N entries matching hands + monsters
- [ ] All entries visible and within the queue panel
- [ ] Entries show correct label text per `action-visual-lifecycle.md §7` (label format table)
- [ ] Tic counts display as numbers (not "—" or blank)
- [ ] Approach rows show no timing bar (per §6: no bar for non-ready-non-monster rows — approach is excluded from bar display)
- [ ] Monster attack rows show no timing bar, only tic count (per §6)

### 1.2 Queue Sort Order

The queue is ordered at INSERTION time — no global re-sort ever runs.

- [ ] First entry (top of queue) is the item with the lowest tic count
- [ ] Player hands sort before monsters at the same tic (player-first rule per §7 point 3)
- [ ] LH sorts before RH at the same tic (per §7)

### 1.3 Queue Panel Layout

- [ ] Panel title displays "Action Queue"
- [ ] Entries are stacked vertically (one per row)
- [ ] Each row shows: label + tic count + optional timing bar
- [ ] No scroll bar visible if entries fit (scroll only if >5 entries)
- [ ] Font size matches configured preset (`queue-size-S`, `queue-size-M`, `queue-size-L` class on `.queue-panel`)

---

## 2. Queue Item States & Labels

For each queue entry, verify label format per `action-visual-lifecycle.md §7`:

### 2.1 Ready State

When a hand reaches "Ready" (surfaces to top):

- [ ] Label shows: "L. Hand Ready" (or "R. Hand Ready")
- [ ] Tic field shows "—" (dash, not a number)
- [ ] No timing bar
- [ ] Row sits at top of queue, player can act

### 2.2 Winding State

After player commits an attack:

- [ ] Label shows: "L. Hand [Attack Name]" (e.g. "L. Hand Fire Bow")
- [ ] Tic count shows the winding duration (e.g. 15 tics)
- [ ] Timing bar is visible and starts at 0% width
- [ ] Row is positioned at the correct sort position in the queue
- [ ] Tic count decrements as the attack approaches fire

### 2.3 Impact State

When winding finishes and attack fires:

- [ ] Item is pinned at top briefly
- [ ] Label shows same attack name
- [ ] Tic field shows "—" (brief display only)
- [ ] No timing bar (per §7)
- [ ] Monster HP bar depletes simultaneously (visual parallel per §9)

### 2.4 Cooldown State

After impact resolves:

- [ ] Label shows: "L. Hand Ready" (the cooldown row pre-labels as "Ready")
- [ ] Tic count shows cooldown duration
- [ ] Timing bar visible, starts at 0% and fills
- [ ] Row is positioned at correct sort position

### 2.5 Monster Attack States

- [ ] Monster "ready" token shows monster name + "Ready"
- [ ] Monster "attack" row shows "Monster X's [Attack Name]" with tic count
- [ ] No timing bar on monster rows (per §6)
- [ ] After monster attack fires, damage narration appears in message log and player HP bar depletes

---

## 3. Timing Bar Rendering

Per `action-visual-lifecycle.md §6`:

### 3.1 Bar Formula

- [ ] At 0% progress: bar width is 0 (just started winding/cooldown)
- [ ] At 50% progress: bar width is 50% (halfway through)
- [ ] At 100% progress: bar width is 100% (attack fires / cooldown finishes)

### 3.2 Bar Color

- [ ] Player winding/cooldown bars are blue/cyan (per §6)
- [ ] No timing bar on ready rows, monster attack rows, or approach rows

### 3.3 Bar Updates

- [ ] Bar width updates only on Master Clock ticks (when item is processed or a new item surfaces and tics are recalculated)
- [ ] Bar never updates mid-tick (no smooth CSS transitions? — verify: is the bar using CSS transition or instant jump?)

**Note on smoothness:** If the bar uses CSS `transition: width Xms linear`, it animates between ticks. If no transition, it jumps. This is a design decision — document what we see.

---

## 4. Queue Animation Entry/Exit (Human-Eye Required)

These require visual verification by a human:

### 4.1 New Item Entry

- [ ] When a new item is inserted (winding after commit, cooldown after impact, etc.), does it animate into the queue?
- [ ] Does the row fade in / slide in / push down from the top?
- [ ] Does existing content shift to accommodate the new row?

### 4.2 Item Removal

- [ ] When an item is removed (processed and popped), does the remaining content reflow smoothly?
- [ ] Is there any blank gap, flash, or layout shift?

### 4.3 Ready Token Surfacing

- [ ] When all sub-actions for an item are done and the ready token surfaces, does it appear smoothly?
- [ ] Is there a visual cue that the player's turn has started?

### 4.4 No-Animation Cases

- [ ] On page reload (resume), no animations replay — state is restored instantly
- [ ] Text speed "instant" skips typewriter animation but queue items still appear

---

## 5. Typewriter & Queue Sync

Per `action-visual-lifecycle.md §3-4` (peek → process → both parallel (typewriter + visuals) → remove → next):

### 5.1 Narration Timing

- [ ] Typewriter prints character by character at the configured speed (normal/slow/instant)
- [ ] The current queue item stays at top while its narration is typing
- [ ] The item is NOT removed from the queue until both the typewriter and visuals finish

### 5.2 Narration-to-Next-Item Gap

- [ ] After typewriter finishes and the current item is removed, the next item surfaces immediately (no blank pause)
- [ ] The next item's narration starts right away (no dead time)

### 5.3 Speed Preset Behavior

- [ ] "normal" — text types at configured chars/sec
- [ ] "slow" — text types more slowly
- [ ] "instant" — text appears immediately, item removes immediately, next item surfaces immediately

---

## 6. Queue State After Player Actions

### 6.1 After Single Attack Commit

- [ ] The ready token (top of queue) is removed
- [ ] A winding row appears at the correct position
- [ ] All other queue entries (other hand's ready, monster attacks) remain unchanged
- [ ] Total queue count increases or stays the same (removed ready + inserted winding = net 0, or +1 if winding is new)

### 6.2 After Cancel (PC-68 — all targets dead)

- [ ] Winding item becomes cooldown (no impact row inserted)
- [ ] Cooldown label shows "L. Hand Ready" with cooldown tics
- [ ] Narration says attack was cancelled

### 6.3 After Potion Use

- [ ] Ready token removed
- [ ] Drinking row appears at correct position
- [ ] Recovery row follows after drinking resolves
- [ ] Ready token surfaces after recovery

### 6.4 After Weapon Swap

- [ ] Ready token removed
- [ ] Cooldown row appears (delay = max speeds)
- [ ] After cooldown, ready token surfaces

---

## 7. Queue State After End Run

- [ ] End Run confirmation dialog appears
- [ ] Typing "End Run" and confirming returns to town
- [ ] No queue artifacts remain in the DOM

---

## 8. Checklist Summary

### Quick Pre-Release Checklist (Human-Eye Required)

- [ ] Queue loads with correct number of entries on battle start
- [ ] Entries are sorted correctly (player-first on ties)
- [ ] Timing bars render and fill correctly
- [ ] Ready tokens show "—" and no bar
- [ ] Attack labels display correctly per lifecycle doc §7
- [ ] Winding → Impact → Cooldown → Ready cycles through cleanly
- [ ] Monster attacks display and cycle
- [ ] Queue reflows smoothly on item entry/exit
- [ ] Typewriter narration syncs with queue position
- [ ] Multiple attack cycles maintain state integrity

### Programmatic Checks (Hermes-Runnable)

- [ ] `document.querySelectorAll('#queue > *').length` matches expected queue length
- [ ] Each entry has label text, tic text, and conditionally a timing bar
- [ ] `getComputedStyle(barEl).width` reflects expected fill percentage
- [ ] No entry shows "undefined" or "null" in its text
- [ ] CSS class changes on entry/exit (`.queue-enter`, `.queue-exit`) — if these exist, verify they're applied
- [ ] Queue entries have `data-event-type` or similar attribute matching the event type (ready/winding/impact/cooldown)