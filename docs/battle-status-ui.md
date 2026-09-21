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

> **STATUS 2026-09-16: Dragon-Warrior per-hand menu is CONFIRMED as the combat command
> mechanism** ("DW style combat menu is in fact the goal." — Spahrep 2026-09-16). The
> preview-band mechanics in this section are NOT the shipped direction. Still open
> (PC-56 carry-over, parked): whether the ">" timing markers replace the band or
> coexist, and the exact menu visuals. This section stays as the band design-of-record.
>
> **IMPLEMENTATION REALITY (Spahrep 2026-09-16): the preview marker system does not
> exist in code, and the timing column is not working as intended either — the whole
> area needs to be revisited.** Current code: `js/battle-app.js renderQueue()` renders
> the next-up events column (`Label EventName | tics`, sorted ascending); there is NO
> preview band, no ">" markers, no browse-phase range display anywhere in the client.
>
> **ANNOTATION 2026-09-17 (sweep):** part of the above is superseded. The
> '>'-markers-vs-band fork is RULED (PC-DEC-020: simple '>' timing markers now, full
> band preview PMVP) and the markers SHIPPED with PC-56 (CLI + web GUI,
> `computeTimingMarkers`; see TIMING MARKERS RULED below) — "no '>' markers anywhere in
> the client" is outdated as of PC-56. Still standing: no full preview band exists, and
> the timing-column design remains an open revisit (PC-DEC-004 OPEN).

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

## Dragon-Warrior Menu (CONFIRMED — 2026-09-16)

Specified by Spahrep 2026-09-15 (19:49 / 20:00); confirmed as the combat command
mechanism 2026-09-16 ("DW style combat menu is in fact the goal."). The ">"-markers-vs-band
fork is ruled (PC-DEC-020); the exact visuals are ruled 2026-09-16 (PC-DEC-021..027,
image `shared/CommandSelection.png`) — see the Cascading Window Spec below.

- Per-hand turn menu: when it is your turn ("LH" or "RH"), you get a menu with the
  attacks for **that hand only**. Both hands available on the same tick = resolve one
  hand, then the next — always one hand at a time. **Order (PC-DEC-028): the hand with
  the faster base attack (lowest equipped-weapon speed) goes first; equal speed →
  left hand first.** Deterministic — the web GUI's hand-switch chip was never asked for
  and is removed in PC-63 (Spahrep 2026-09-16); there is no override UI.
- Menu options: `Attack1...Attackn:C1:C2:BL` — **no numbered rows**.
- Flow: pick an attack type → pick the monster (target) → confirm.
- When you select an attack, it should show on the timing menu of upcoming events where
  it will slot in: a **simple pair of ">"** to show a range, or if it is fully contained
  between 2 other timings, **just one ">"**.
- **TIMING MARKERS RULED (Spahrep 2026-09-16): simple ">" markers NOW, full preview
  band later** — "For now lets do the simple markers, we can add in full band preview
  later." Shipped with PC-56 (CLI + web GUI, `computeTimingMarkers`); the band is PMVP.

### Cascading Window Spec (decided 2026-09-16 — PC-DEC-022..027)

Three cascading windows, one command at a time, all in one screen area (PC-DEC-026).
Each new window overlaps the previous down-right; it always fully covers its own
content and may clip the parent (authentic DW) — the ACTIVE window's text never clips.
Cascade geometry (PC-DEC-043, shared/CascadeIssue.png): all windows render at one
uniform box — the tallest window's natural height, capped to the panel — stepped a
fixed 96px right / 26px down, so each window overlaps the parent by the same
amount and the stack reads as one even staircase. Steps are deliberately small:
a parent's rows are obsolete once you advance, so they may be covered — only the
parent's hand tab stays visible (Spahrep 2026-09-17).

1. **Action window (root)** — black window, orange border, orange pixel-mono text;
   a blue tab straddling the top border shows the owner hand ("Left Hand" / "Right
   Hand"). Rows top to bottom: the hand weapon's attacks (real rows: Attack, Power
   Attack, Quick Strike …), blank, C1 potion, C2 potion, blank, `Belt Loop: <belt
   weapon>` (PC-DEC-023 — wording not locked). **The root window cannot be closed**
   (PC-DEC-022): Esc at root is a no-op; the hand stays in the menu until a command
   resolves. Delay / Defend commands = PMVP.
2. **Target window** — cascades over the action window. Attack: enemy list
   `A: Glimmerling – Healthy` / `B: Giant Rat – Critical` — letters match the arena
   markers, HP word color-coded (green Healthy → red Critical). Multi-target attacks:
   a single ALL MONSTERS line, no pick. Potions (PC-DEC-024): hand-target list
   (LH / RH). Offensive consumables (PMVP): enemy-selection window instead.
3. **Confirm window** — line = `Confirm <AttackName>: <letter> <monster name>`
   (PC-DEC-025; "Confirm Quick Strike: B Giant Rat"; basic attack "Confirm Attack: B
   Giant Rat"), then **Yes / No**. Potion confirm: `Use <potion> on <hand>?` —
   Yes / No.

Input (PC-DEC-026): ↑/↓ move the green hand cursor, Enter advances, **Esc backs one
level** (confirm → target → action). Mouse works throughout — clicking a row selects
it (same as Enter). Palette not locked; per-player window theming = PMVP (PC-DEC-027).

Both hands ready = resolve one hand then the next (rule above). No hand-switch chip —
prefHand removed in PC-63; the order is deterministic per PC-DEC-028.

### Initiative — initial turn order (PC-DEC-032, implemented as PC-64)

At combat start each hand gets one **approach** row on the timing rail at its weapon's
instance speed (PC-DEC-032; supersedes PC-DEC-021's rolled 1..speed initiative —
placement is now deterministic, no roll). Unarmed hands use `game_config.fist_speed`.
Monsters need no initiative of their own: they are already on the rail at their
instance speed (PC-DEC-030).

When an approach row hits 0 the hand becomes **Ready** and the player picks their
action then. The battle is **presented from Tic 0 and progresses until the first
entity has an action** (PC-DEC-039, Decided by Spahrep, 2026-09-17) — a tic-0
countdown intro shows the approach rows advancing; there is no jump straight to
the first decision point. `startBattle` still advances the engine clock to that
point, so a monster faster than both hands genuinely acts first (its attack lands
during the advance and it re-seeds at its instance speed as usual). Ties → player
first (LH/RH before monsters on the same tic, PC-DEC-030).

The approach row is **initial placement only**: the attack timing formula
(weapon speed + rolled prepare/cooldown) is unchanged, and after an attack's
cooldown fires the hand is actionable immediately, as before. Confirmed
engine-enforced 2026-09-17 (PC-DEC-034, Decided by Spahrep, 2026-09-17):
windup = weapon base speed + rolled prepare, cooldown = weapon base speed +
rolled cooldown — the weapon's base speed is added into every attack timing
computation. Both-hands-ready hand order is PC-DEC-028 (above).

### Battle Intro Sequence — dice ceremony (PC-DEC-038, Decided by Spahrep, 2026-09-17)

Before the die is finished rolling: **no command window, no monsters, no timing
track** — none of the battle is shown. After the die lands:

1. Monsters **fade in one at a time** — pronounced fade with a pause between
   each element (longer fade + pause per the 11:51 refinement).
2. Once all monsters are in, the **timing table fills up from First (next) to
   last** — each item on the tracker fades in one at a time.
3. Only after the track is filled does the **command window** appear — the
   action menu must never come in before the time track is filled.

Shipped: f76ea21 (command window + timing track hidden until the dice ceremony
completes), e7d32f5 (pronounced one-at-a-time reveals), cec8a60 (command window
waits for the timing track).

### Die Roll Presentation — per-roll face rotation (PC-DEC-036/037, Decided by Spahrep, 2026-09-17)

A rolling die gives a **visual notification on every roll tick**: the face
**rotates** (spins) to the new value rather than just flashing. Natural repeats
are allowed and expected — the die may land on the same face several times in a
row (dice can have the same value on multiple faces); do NOT filter consecutive
repeats, the rotation per tick is what shows it is still rolling. Shipped as
PC-70: 7b388a5 (flash on every roll tick) → 56be7e0 (keep natural repeats) →
1303299 (spin the die face per roll tick instead of flashing).

### UNDECIDED (mechanism + visuals locked; band open — PC-56 carry-over, parked)

- The full **preview band** (Phase 1 above) is deferred to PMVP; its eventual
  coexistence with the ">" markers is not yet designed.

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

**Kill-cancel — RULED (PC-DEC-046, DarkJester 2026-09-17, shipped 48ddd58):** when an
attack impact kills a monster, any other hand still winding an attack whose targets
are ALL dead is cancelled straight into its own move's cooldown at the kill tic — no
finishing the cast, no corpse whiff, no redirect for explicit targets (feed: "RH
attack cancelled — target already defeated"). Multi-target attacks survive partial
kills (cancel only when every queued target is dead); auto-target attacks (no explicit
target) still redirect to the first living monster.

**Death-cancels-everything (PC-DEC-054, Spahrep 2026-09-21):** when a monster is killed, ALL of its queued attacks are removed from the queue immediately — no ticking down, no no-op at fire, no in-flight resolution. A dead monster never attacks again, even on the tic it died. Player-side kill-cancel unchanged: explicit-target hand attacks whose targets are all dead cancel into cooldown; auto-target attacks redirect to the first living monster. Decided by Spahrep, 2026-09-21.

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
- **Hit feedback shipped (PC-DEC-048, 2026-09-18, main 986cd97)**: monster→player hit
  = the run-window contents jolt (`.container` — page background and status dock stay
  put); player→monster hit = that monster's card shakes + its sprite box white-flashes.
  Misses get none. **TODO — sprite change on hit:** swap the monster sprite to a
  hit/damaged variant at impact once sprites exist. The white-flash already occupies
  the sprite box (`.sprite-flash` on `.monster-sprite`), so the swap slot is reserved;
  `js/combat/hit-feedback.js` already delivers the exact target letter + damage per hit.
- RESOLVED (2026-09-17): attacks are **player-chosen** from the hand weapon's real attack
  list — the DW action window lists the weapon's attacks as selectable rows
  (PC-DEC-021..027; confirm-line format PC-DEC-025) and command boxes show that hand's
  attacks. `slot_N_chance` governs GENERATION only (which attacks a rolled weapon gets —
  weapon-generation.md), never in-combat selection.
- Three-zone read (guaranteed-prior / potential-trade / safe-after) is a later refinement;
  MVP renders one tint.

## Implementation Note

The column is a sorted array of `{label, event, tics}`. Every tic: decrement all, fire
events at 0, re-sort. Because every row decrements by exactly 1 per tic, **relative order
never changes between events** — the list only reorders when a new event is committed.
No flicker, no animation needed for correctness; the countdown is calm by construction.
