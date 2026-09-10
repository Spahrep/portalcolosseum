# Battle Status UI — Action Queue Column

**Status:** Decided (2026-09-08) — mechanics locked, visual polish TBD
**Supersedes:** The gui1 tic-track bar. This replaces the horizontal timeline.

## Core Model

The battle status is a **single vertical column** (right side of the GUI) listing every
pending event in the fight, **ordered top-to-bottom by tics until it happens**.
The next event is always at the top.

Each row is: **`Label | EventName | TicsUntil`**

```
B  | HeavyAttack  | 3
RH | Slash        | 4
C  | AcidShot     | 6
```

- **Labels**: `A`/`B`/`C` = monsters (matching the arena sprite markers), `LH`/`RH` = player hands
- **Every row is a countdown to a state change.** Nothing else. An attack landing is a state
  change; a hand freeing is a state change; a buff expiring is a state change.
- All rows are the same semantic thing: `{label, event, tics}`, decremented every tic.
  At 0, fire the change, re-sort, re-render.

## Browse → Commit Flow (Two Phases)

Timing information is shown as a **range exactly once — during browse** — then as
**permanent numbers after commit**. The HUD never shows a range twice.

### Phase 1 — Browse (free, instant)

Arrow-keying across commands (never inside the confirm flow) shows a **preview band** in a
lane just left of the queue column. The band is one continuous vertical strip = your hand's
commitment window, with uncertainty built in:

```
  PREV  |  QUEUE
  ┌───┐ |
  │3-4│ | B | HeavyAttack | 3
  │═╪═│ | RH| Slash       | 4     ← gold: inside landing window
  │   │ | C | AcidShot    | 6     ← dim gold: inside hand-free window
  │5-7│ | A | Bite        | 9
  └───┘ |
```

- **Top label `3-4`** = cast range (when it hits). **Bottom label `5-7`** = hand-free range
  (cast + cooldown deltas, both real). The `╪` seam marks the hit moment.
- **Any queue row falling inside the band gets tinted** — strong gold if inside the landing
  window (potential same-tic trade), dim gold if inside the hand-free window (something lands
  right as your hand comes back). Rows between the seams = clean air.
- **"Fits neatly" vs "overlaps" is a glanceable binary:** empty band = clean commit.
  Gold inside = you might be trading. Height = crowding = risk, for free.
- The band is stable while browsing: queue rows all decrement equally per tic, so relative
  order never changes — the band doesn't crawl.
- The band is not a promise of damage — it's a promise of **when your hand is busy**.
  Browse a potion and the same mechanism shows drink-speed + hand-free
  (consumable `pre = f(weapon, potion)` timing rides the same rail).
- Roll happens at commit, not during windup.

### Phase 2 — Commit

Confirming the attack **rolls the cast and cooldown values**. The row enters the queue as
permanent, fixed numbers — never a range on a committed row. The band lane clears.

## Row Morph (Player Hands)

A hand's attack is one row through both phases — the row identity is the hand, never duplicated:

```
commit Slash (cast 4, cd 1)
  RH | Slash  | 4      ← windup counting down
  (lands at 0: damage applies, footer stamps, command box flashes)
  RH | Ready  | 1      ← SAME row relabeled to cooldown, re-sorted
  (hits 0: row disappears, command box lights gold — hand free)
```

- The row swaps content (attack name → `Ready`) and the sort repositions it.
- Pre/cooldown profiles can be anything: short pre + long cd, long pre + short cd, balanced.
  The mechanism handles all of them — sorting does the work, not assumptions about typical values.
- A long cooldown row sits near the bottom of the column for its duration. That IS the
  information: the hand is committed, leave it alone.
- When a `Ready` row hits 0 and disappears, the hand's command box lights up (gold) +
  footer stamp. This beat is the player's only notice signal after a dormant row — it matters
  more the longer the cooldown was.

### Monster Rows (No Morph)

Monster attacks land and are done. No cooldown phase on the mob's row:
damage applies, and the monster's next attack in its cycle spawns as a **new row**.
A monster with a 30-tic attack cycle appears multiple times in the column at once —
that's correct and intended (the old tic-track couldn't show repetition; the queue can).

## Tie Resolution

If two events land on the same tic: **player always resolves first.** Locked.
No "I killed it on the same tic it killed me" salt.

**PMVP — Cancel on death:** whether a participant who dies this tic still resolves an
in-flight attack (death-cancels vs attack-resolves-anyway). Parked; the current rule is
draw-to-player on ties only. Revisit post-MVP.

## Monster HP — Words Only

Players **never** see exact monster HP numbers. They know the level words defined for the
game. Locked 2026-09-08 — four levels, percentage bands of the monster's (rolled) max HP:

| Word | Band | Read |
|---|---|---|
| Healthy | 100% – 76% | untouched-ish; damage doesn't always show |
| Injured | 75% – 51% | hurting, but far from done |
| Battered | 50% – 26% | under half — kill window open |
| Critical | 25% – 0% | near death — at or below a quarter of its max |

- Max HP is **rolled per monster**: each monster has a base MaxHP **and a maxHP delta**
  (e.g. blue slime base 100 ± 10 → this one has 90, 100, or 110). The player knows the
  species *base* at best — never the rolled instance value. (Spahrep 2026-09-08)
- **Delta distribution = EVEN (uniform)**, not bell curve (Spahrep 2026-09-08): every
  value in the delta range is equally likely, so the secret max doesn't become
  statistically predictable with play. (Contrast: gold/loot use Box-Muller bell curve —
  see `loot-prize-pool.md`.)
- Bands are % of that secret rolled max, so the words show relative position, never
  absolute HP. "Battered" = under half of *its* max, whatever that is.
- **Word flips are decision events** — a flip to Battered means "under half," a flip to
  Critical means "at or below a quarter." Readable at a glance in the queue column.
- Damage feedback is the footer feed (`Slash hits B for 18`); the word only flips at
  quarter crossings.
- `Full` removed — zero extra value over Healthy. A monster at 99% vs 100% never changes
  a decision. (Spahrep 2026-09-08)

## Density & Readability

- 5 monsters with repeating cycles ≈ up to ~12 rows. Relative order never changes, so it's
  calm — but long. **Cap visible rows at ~10** with a dimmed `+3 more`.
- Make the **top 3 rows visually dominant**; the eye needs the top of the column to feel stable.
- Keep monster attack cycles long enough that the top row doesn't churn every 1-2 tics.

## Footer Feed

One line, tic-stamped, last event only ("what just happened"):
`tic 214 — RH Slash hits B for 18`. The feed is where the text medium shines;
keep it one line to avoid competing with the column.

## Division of Labor

- **Right column** = what will happen (all timing information lives here)
- **Preview lane** = what-if (appears only while browsing)
- **Bottom command boxes** = what I can do right now (attack name + damage only; no bars,
  no timers — pure choices)
- **Top stat block** = who I am (HP, buffs as chips with end-tic numbers)
- **Arena** = who's there (sprites, letters, HP state words)
- **Footer** = what just happened

## PMVP — Kill Telegraph Idea ("Glowing Sword of Death")

**Far-future PMVP idea, not in planning.** Parked as a one-liner for later; nothing in
the core UI depends on it. (Spahrep 2026-09-08)

- When selecting an attack + target, if the attack can kill on max roll the weapon glows
  **blue pulse**; guaranteed kill glows **steady blue**. Pulse = maybe, steady = certain.
- **No HP-band restriction** — applies at any word level if the kill condition is met.
- Revisit when enchantment/potion-impact work begins.

## Open / Visual Nits

- Column header: `CurrentAction` is a placeholder; the top row is technically the *next*
  action. Rename TBD (e.g. `NEXT`).
- Row tinting: mob rows red-ish, hand ready rows gold-ish, events neutral — exact colors TBD.
- Buffs: chips on the stat block with end-tic (MVP). Buff expiry *could* be a column row
  (it IS a state change) — revisit if buffs become load-bearing.
- Sound: subtle chime when a hand frees (PMVP — the visual beat carries MVP).
- Whether attacks are player-chosen (gui1 style) or proc on slot chance (weapon-generation
  `slot_N_chance`) is unresolved and affects whether command boxes show multiple attacks
  per hand. Current GUI = chosen. See combat-system.md / weapon-generation.md.
- Three-zone read (guaranteed-prior / potential-trade / safe-after) is a later refinement;
  MVP renders one tint.

## Implementation Note

The column is a sorted array of `{label, event, tics}`. Every tic: decrement all, fire
events at 0, re-sort. Because every row decrements by exactly 1 per tic, **relative order
never changes between events** — the list only reorders when a new event is committed.
No flicker, no animation needed for correctness; the countdown is calm by construction.
