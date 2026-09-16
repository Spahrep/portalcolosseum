# Decision Briefs — Game-Designer Review Follow-up (2026-09-16)

Companion to docs/reviews/2026-09-16-gamedesign-review.md. One brief per kanban card
(PC-56 .. PC-61). Purpose: give Spahrep + DarkJester everything needed to decide each
item in a single sitting, without re-reading the review. Cards are BLOCKED until decided;
flip them per the decision, then Hermes captures the outcome per the decision pipeline.

Each brief: what's being decided, the options, the designer's lean (quoted), and the
open questions the two of you should settle. Hermes advises when asked; decisions are
yours.

---

## Rulings received 2026-09-16 (Spahrep) — thread 1549746327032963083

Verbatim rulings answering the sweep conflicts (docs/reviews/2026-09-16.md C1–C5) and
PC-56. Captured as PC-DEC-006..010 (PENDING) — pending-decisions.md is the capture
surface; these stay PENDING until pinned.

- **C1 — Slot layout** (PC-DEC-006): "C1) You have a Belt loop (BL) and 2 consumeable
  slots (C1 & C2)." → loadout row is BL + C1 + C2. Belt-content (weapon-only vs
  weapon-or-consumable) and BL-as-third-drinkable-hand remain open.
- **C2 — Anti-softlock** (PC-DEC-007): "With 'You cant sell your last weapon'
  'Everyone gets the start weapon on account creation' then you can never get stuck
  w/o a weapon." → confirms the shipped PC-52 chain (no-sell-last + starter grant).
- **C3 — Accuracy** (PC-DEC-008): "Players use accuracy." → confirms shipped 7ef335d.
- **C4 — AP/gold HUD** (PC-DEC-009): "we do wean the ap/gold transparent bar at the
  bottom" ("wean" read as "want") → confirms shipped 5c6286e bottom dock HUD.
- **C5 / PC-56 — Combat menu** (PC-DEC-010): "DW style combat menu is in fact the
  goal." → the Dragon-Warrior per-hand menu IS the mechanism. Card flipped done.

### Future design decisions (parked — NOT conflicts; Spahrep 2026-09-16: "this is a conflict in documentation sweep right, not a design decision meeting")

1. **PC-57 remainder** — pre/post split + one-sample rule at the post window; whether
   BL is drinkable. (Core formula already ruled, PC-DEC-013.)
2. **PC-58** — multi-enemy per-target reduction + 5th-monster absorption numbers.
   Declared a future design decision by Spahrep, not a conflict. Card stays parked.
3. **PC-59** — AP-refund-on-completion. On hold, not a conflict. Card stays parked.
4. **PC-60** — Player Journey section. Spahrep: "ok great, not a conflict though" —
   a future doc task, nothing to do now.
5. **PC-56 carry-overs** — ">"-markers vs preview band; web-vs-CLI surface-first.
6. **PC-61 remainder** — RULED (PC-DEC-014/015): monster HP hidden behind words
   always, never numbers; validation = harness full runs first, then invites to
   friends when ready. PC-61 fully closed.

### Remaining true doc conflicts (verified in committed docs — await pin to fix)

The five sweep conflicts are all ruled (PC-DEC-006..015); these are the still-live
contradictions in the COMMITTED permanent docs, all waiting on the pin before edits:

- **run-ux-flow.md L14 (HEAD)** — "Empty loadout is allowed (anti-soft-lock)" vs
  PC-DEC-007. Corrected text (≥1 hand weapon + Fist) is already in the working tree,
  uncommitted.
- **inventory-slots.md L17 vs L87** — "Belt Loop holds a second weapon (not a utility
  item)" vs "Dedicated swap / utility slot": internal contradiction. No Fist rule in
  the doc (PC-DEC-011). L19 swap formula stale ("possibly the same timing formula as
  potions") vs shipped cost = max(base speeds).
- **combat-system.md** — zero mentions of accuracy vs PC-DEC-008 (grep verified).
- **ap-economy.md** — no HUD dock mention vs PC-DEC-009 (grep verified).
- **current-design-status.md** — header still "as of 2026-09-08"; Open Q #4 (belt
  swap timing) still open though DJ gave the formula and PC-54 shipped it.
- **battle-status-ui.md** — "FRONT-RUNNER" banner now stale: mechanism is chosen
  (PC-DEC-010).
- Minor: naming-convention.md obsolete anticipated tables (`inventory_item`, `match`).

---

## PC-56 — Lock the combat command menu mechanism (keystone)

Card: PC-56 (t_aafb1a55) · Resolves: PC-DEC-003, PC-DEC-004 · Priority: #1

What's being decided:
Which mechanism players use to commit an attack and see when their hand is free. This
is the primary player decision interface — the designer calls it "the heart of player
agency" and the reason "the tick engine's promise cannot be felt" yet.

The options:
1. Dragon-Warrior per-hand menu — your 2026-09-15 spec: LH/RH prompt, that hand's
   attacks only, Attack1..n:C1:C2:BL, no numbered rows, attack → target → confirm,
   consumable confirm prompt, ">" markers on the timing menu showing where the attack
   slots (pair for a range, single ">" if fully contained).
2. The browse → commit preview band from battle-status-ui.md — detailed design, but
   confirmed NOT implemented (PC-DEC-004), marked under revision.

Designer's lean (verbatim from review, section 2):
"I vote Dragon-Warrior menu + simple `>` markers for MVP; the full preview band can be
PMVP. Implement it in the CLI first (fastest feedback), then port. Do not ship any more
battle engine work until a player can actually commit an attack with visible timing
consequence."

Open questions:
- Confirm Dragon-Warrior menu + ">" markers for MVP, band deferred to PMVP?
- Do the ">" markers replace the band entirely, or does the band return later as the
  rich trade/risk read (gold tinting, hand-free seams)?
- Which surface ships first: web GUI or native CLI? (Designer says CLI first for
  feedback speed — but the web GUI is what Jester tests in Firefox. Your call.)

---

## PC-57 — Consumable pre/post timing formula + hand-free requirement

Card: PC-57 (t_d74ae22f) · Priority: #2

What's being decided:
The exact timing formula for drinking a potion: pre/post amounts, durations, and the
hand-free requirement (drink speed tied to the weapon in hand, cooldown on hands not
items). Consumables design is LOCKED (floor/window +only, "X+, up to Y",
EV = floor+window/2, one-sample rule) but the formula is TBD and implementation is on hold.

Designer's lean (verbatim, section 3):
"The floor + window `+`-only model with 'X+, up to Y' labeling is one of the cleanest
consumable systems I've seen... Tying drink speed to the weapon in hand and putting
cooldowns on hands, not items is clever."
"Prototype the hand-free requirement in the CLI immediately. If the formula feels
fiddly in play, simplify to 'potion speed only' for MVP — the hand-tie is nice but not
worth delaying the emotional payoff of using a potion mid-fight."

Open questions:
- Keep hand-free + hand-tied speed, or MVP-simplify to potion-speed-only?
- What's the pre/post split for an MVP potion (e.g., pre = half the window, post = the
  rest)? Does the one-sample rule survive at the post window too?
- Belt slot (BL) counts as the third drinkable hand — confirm?

---

## PC-58 — Multi-enemy damage reduction + 5th-monster absorption rule

Card: PC-58 (t_5939142d) · Priority: #3 (needed before PC-34 / Slice 3 encounter work)

What's being decided:
The exact per-target damage reduction when cleave/whirlwind hits multiple monsters, and
how the 5th monster (or overflow) is absorbed. Open today; the designer warns this can
turn multi-monster from "small area-control problem" into "the game cheated me."

Designer's lean (verbatim, section 5):
"Define the exact per-target reduction (e.g., 60% per additional target) and absorption
rule (closest-cost vs upgrade) in a one-page balance spec before Slice 3 encounter work."

Open questions:
- Per-target reduction number: ~60% per additional target as a starting point, or
  different curve (flat cap vs diminishing)?
- Absorption rule: closest-cost, upgrade, or something else?
- Should this live as a new one-page balance spec doc (designer's suggestion) or a
  section in combat-engine-plan.md?

---

## PC-59 — AP-refund-on-completion: kill it or make proportional

Card: PC-59 (t_f37c7eb0)

What's being decided:
Whether stopping a run early refunds AP, and if so how much. The current idea risks
making "stop early" feel like a double punishment (lost loot + lost AP).

Designer's lean (verbatim, section 4):
"Kill the refund idea or make it proportional to depth stopped. A player who stops after
fight 3 should not feel they 'wasted' the AP entry cost more than a death would have."

Open questions:
- Kill the refund entirely (stop early = loot taken but AP spent), or proportional
  (e.g., refund (5 - fights completed)/5 of entry cost)?
- Does leaving early with the banked pool change this answer?

---

## PC-60 — Player Journey section in core-philosophy.md

Card: PC-60 (t_48015d18) · Hermes's doc task once approved

What's being decided:
Whether to add a short "Player Journey" section to core-philosophy.md mapping the
emotional beats: town → preamble → dice reveal → first commit → stop/continue choice.

Designer's lean (verbatim, section 6):
"Core philosophy doc is light on 'what the player actually feels' language compared to
the strength of the mechanics. Add a short 'Player Journey' section mapping the exact
emotional beats from town → preamble → dice reveal → first commit → stop/continue choice."

Open questions:
- Approve the addition? (Docs discipline: Hermes records what you say — you'd review
  the section before it's treated as design truth.)
- Section length target: one paragraph per beat or a short table?

---

## PC-61 — Validate stop/continue digitally (NO paper prototype)

Card: PC-61 (t_7fcf0c1d) · DECIDED 2026-09-16 by Spahrep: "i dont want paper, we will
be doing this fully digital" — the 10-player paper prototype is declined.

What's being decided (remaining):
Validating the stop/continue choice + face-value visibility (colors-only vs full
numbers) in the LIVE game instead of paper — via the existing /roll /nuke harness or a
real run. The engine already lets you fake-run a battle chain, so the live GUI is the
prototype.

Designer's lean (verbatim, sections 1 + Final — the part Spahrep declined):
"Lock face-value visibility decision via rapid paper prototype (colors-only vs full
numbers) before any more code."
"Run a 10-player paper prototype on the stop/continue decision with visible remaining dice."

Open questions:
- Colors-only vs full numbers: which reads better in the web GUI you're already seeing?
- Who plays: you + Jester, or a wider invite list (Discord #the-forge) once a run is
  actually playable end-to-end?

---

Source: docs/reviews/2026-09-16-gamedesign-review.md (full review, committed 8036ad3).
