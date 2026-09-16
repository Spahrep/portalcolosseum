# Decision Briefs — Game-Designer Review Follow-up (2026-09-16)

Companion to docs/reviews/2026-09-16-gamedesign-review.md. One brief per kanban card
(PC-56 .. PC-61). Purpose: give Spahrep + DarkJester everything needed to decide each
item in a single sitting, without re-reading the review. Cards are BLOCKED until decided;
flip them per the decision, then Hermes captures the outcome per the decision pipeline.

Each brief: what's being decided, the options, the designer's lean (quoted), and the
open questions the two of you should settle. Hermes advises when asked; decisions are
yours.

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

## PC-61 — Paper prototype the stop/continue decision

Card: PC-61 (t_7fcf0c1d)

What's being decided:
Running a small paper prototype (designer says ~10 players) of the stop/continue choice
with visible remaining dice, to validate push-your-luck tension and face-value
visibility (colors-only vs full numbers) before more code.

Designer's lean (verbatim, sections 1 + Final):
"Lock face-value visibility decision via rapid paper prototype (colors-only vs full
numbers) before any more code."
"Run a 10-player paper prototype on the stop/continue decision with visible remaining dice."

Open questions:
- Worth doing at 10 players, or is a 2-player (you + Jester) sanity check enough for
  now? The engine already lets you /roll and /nuke your way through a fake run — the
  live game may be a better prototype than paper at this stage.
- Colors-only vs full numbers: which reads better in the web GUI you're already seeing?

---

Source: docs/reviews/2026-09-16-gamedesign-review.md (full review, committed 8036ad3).
