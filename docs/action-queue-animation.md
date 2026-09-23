# Action Queue Animation Specification

**Purpose:** Define the visual animation sequence for the Action Queue — how rows enter, exit, and how the prediction bar previews placement. Based on Spahrep's 5-stage wireframe mockup (2026-09-21, message 1551586264245870632).

**Design persona:** Spahrep — wireframe mockup of queue insert animation stages.

**Audience:** Developer implementing queue DOM animation in `battle-app.js`.

---

## 1. Insert Animation — 5-Stage Sequence

Trigger: Player confirms an attack (or monster AI picks one). A new queue row needs to appear at its sorted position.

The animation has exactly 5 stages, each completing before the next starts:

### Stage 1: Prediction Bar (Preview)

The prediction bar (`#prediction-bar`) is already visible on the queue while the player browses attacks. It shows the range of possible landing positions.

**State:** Prediction bar stays visible. No DOM changes.

---

### Stage 2: Space Creation

After the action is confirmed, the space where the new row will land needs to grow. All boxes below that position get pushed down with animated empty space created.

**Mechanism:**
1. Determine the target insertion index in the queue DOM.
2. Insert a temporary `queue-row-spacer` element at that position with `height: 0` and `overflow: hidden`.
3. Animate the spacer's height from `0` to the row height (e.g. `40px`), pushing subsequent rows down.
4. Duration: `200ms`, easing: `ease-out`.

**CSS:**
```css
.queue-row-spacer {
  height: 0;
  overflow: hidden;
  transition: height 200ms ease-out;
}
.queue-row-spacer.open {
  height: 40px; /* match .queue-row height */
}
```

---

### Stage 3: Bar Grows In

After the space is grown, the bar (yellow/orange insert marker) grows in from left to right within the spacer area.

**Mechanism:**
1. Inside the spacer, a child `.queue-insert-bar` appears at `width: 0`, positioned at the left edge.
2. Animate `width` from `0` to `100%` (full width of the spacer row).
3. Duration: `250ms`, easing: `ease-in-out`.

**CSS:**
```css
.queue-insert-bar {
  height: 100%;
  background: linear-gradient(90deg, #ffcc66, #ffaa33);
  width: 0;
  transition: width 250ms ease-in-out;
}
.queue-insert-bar.full {
  width: 100%;
}
```

---

### Stage 4: Flash

The bar finishes growing all the way in, then flashes once — a brief brighten-and-dim to signal the insert point is locked.

**Mechanism:**
1. After the bar reaches full width, add `.queue-insert-bar.flash` class.
2. The flash keyframe: `opacity` 1.0 → 0.3 → 1.0 over `150ms`.
3. After the flash completes, the spacer and bar are removed and the real queue row is inserted.

**CSS:**
```css
@keyframes insert-flash {
  0%   { opacity: 1; }
  50%  { opacity: 0.3; background: #ffee88; }
  100% { opacity: 1; }
}
.queue-insert-bar.flash {
  animation: insert-flash 150ms ease-out;
}
```

---

### Stage 5: Resolve — Row Appears

The preview bar and spacer disappear. The real queue row (`.queue-row` with `.queue-row-enter` for player or `.queue-row-monster-enter` for monster) slides in at the now-permanent position.

**Mechanism:**
1. Remove the spacer element (instant).
2. Insert the real `.queue-row` at that DOM position with the `.queue-row-enter` class.
3. The enter animation runs: translate + fade in over `200ms`.
4. After `animationend`, remove `.queue-row-enter` so the row settles.

**CSS (existing):**
```css
.queue-row-enter {
  animation: queue-row-enter 200ms ease-out;
}
@keyframes queue-row-enter {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.queue-row-monster-enter {
  animation: queue-row-monster-enter 200ms ease-out;
}
@keyframes queue-row-monster-enter {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 2. Exit Animation — Slide Out

Trigger: A queue row finishes processing (e.g. an attack resolves or a row is cancelled).

**Mechanism:**
1. Add `.queue-row-exit` to the row being removed.
2. The row animates: fades out + shrinks height to 0.
3. Remaining rows below slide up to fill the gap (via the shrinking row collapsing).
4. After `animationend`, remove the row from DOM.

**CSS (existing):**
```css
.queue-row-exit {
  animation: queue-row-exit 200ms ease-in forwards;
}
@keyframes queue-row-exit {
  from { opacity: 1; max-height: 40px; }
  to   { opacity: 0; max-height: 0; padding: 0 10px; margin: 0; }
}
```

**JS hook (existing):**
```javascript
function markQueueRowExiting(rowId) {
  // Adds .queue-row-exit, sets exitingQueueRows, attaches animationend
}
```

---

## 3. Staggered Entry on Battle Load / Reload

Trigger: Returning to a battle mid-fight (page reload or resume). All existing queue rows appear with a staggered cascade instead of popping in instantly.

**Mechanism:**
1. After `renderQueue()` builds the fresh DOM, iterate all `.queue-row` children.
2. Add `.queue-row-enter` to each with a cascading `animation-delay`: `0ms`, `100ms`, `200ms`, etc.
3. On `animationend`, remove the enter class.

**CSS:**
```css
.queue-row-enter {
  animation: queue-row-enter 200ms ease-out both;
}
.queue-row-enter:nth-child(1) { animation-delay: 0ms; }
.queue-row-enter:nth-child(2) { animation-delay: 100ms; }
.queue-row-enter:nth-child(3) { animation-delay: 200ms; }
```

**Note:** On resume (not first load), skip the stagger — instant render with no animation per PC-DEC-046 (Spahrep 2026-09-18).

---

## 4. Edge Cases

### Row at top of queue (current item)
No animation for the current top item — it stays pinned while processing. Insert and exit animations only apply to non-current rows.

### Multiple rows inserted simultaneously
Each row follows the 5-stage sequence independently. The spacer grows for each row sequentially. Avoid batching — the queue processes one item at a time per the Master Clock model (`action-visual-lifecycle.md §1`).

### Row removed mid-insert-animation
If a row is cancelled (PC-68 kill-cancel) while the insert animation is still running, abort the insert animation immediately and run the exit animation for that row.

### Speed preset INSTANT
When charMs=0 and lineDelayMs=0 (Instant preset), skip all 5 insert stages. Insert the row directly with no animation. Similarly, skip the exit animation — remove instantly.

---

## 5. Implementation Status

| Stage | Status | Location |
|---|---|---|
| Stage 1: Prediction bar | ✅ Done | `computeTimingMarkers()` + `#prediction-bar` |
| Stage 2: Space creation | ❌ Not implemented | — |
| Stage 3: Bar grows in | ❌ Not implemented | — |
| Stage 4: Flash | ❌ Not implemented | — |
| Stage 5: Row appears | ✅ Partial | `.queue-row-enter` + stagger on load |
| Exit animation | ✅ Done | `markQueueRowExiting()` + `.queue-row-exit` |
| Staggered entry (resume) | ⚠️ Partial | Only on fresh battle load, skip on resume |