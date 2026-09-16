# Pending Design Decisions

This file is the CAPTURE SURFACE for design decisions stated by Spahrep or DarkJester
(mainly in Discord threads). Nothing here is authoritative until approved.

## The gate (read this before touching anything)

1. **Capture is verbatim.** An entry is a direct quote of what the deciding person said.
   No paraphrase, no summary, no interpretation, no inference. If the bot cannot quote
   it verbatim, it does not capture it.
2. **Promotion is human-only.** An entry moves into the permanent design docs
   (current-design-status.md, weapon-generation.md, consumables.md, etc.) ONLY when
   Spahrep (Discord 108179732821970944) or DarkJester (1501167172842684506) explicitly
   approves it — a reply "pin it" or `/pin <id>` in the thread, or a direct instruction
   here. The bot checks the author ID server-side; it can never self-approve.
3. **Never edit permanent docs from a capture.** Pending entries stay pending until a
   human approves. Ambiguous statements are captured anyway — filtering happens at
   approval, not capture (pending entries are cheap to delete, expensive to miss).
4. **Conflict checks are advisory.** The weekly sweep (docs/reviews/) flags
   contradictions; it never resolves them.

## Entry format

    - ID: PC-DEC-<NNN>
      Date: YYYY-MM-DD
      Source: Discord thread "<name>" / kanban <id> / link
      Speaker: Spahrep | DarkJester
      Verbatim: "..."
      Status: PENDING | APPROVED | REJECTED | SUPERSEDED (by PC-DEC-<id>)
      Notes: (optional — only clarifications asked & answered, never inference)

## Pending

- ID: PC-DEC-001
  Date: 2026-09-15
  Source: CLI session (C1 triage of docs/reviews/2026-09-15.md)
  Speaker: Spahrep
  Verbatim: "We can still do the monster instnace, it's just saved in a JSON for the portal instnace. I was informed this was a faster/lighter way to do it instead of a DB heavy way to do it. Do you dissagree?"
  Status: APPROVED (pinned 2026-09-15 — "ok, so let's fix that up")
  Notes: Resolves sweep conflict C1. Implemented as generate_monster() returning jsonb (no row persisted); instance lives in portal_run.battle_state jsonb. Also relevant: HP roll uses uniform_int (even distribution, Spahrep 2026-09-08), not Box-Muller — docs describe both the table and the distribution wrongly.

- ID: PC-DEC-002
  Date: 2026-09-15
  Source: Discord thread (C2 of docs/reviews/2026-09-15.md; original statement 19:39:43)
  Speaker: Spahrep
  Verbatim: "Are you capapble of just having it stay in the normal order and randomly seelcting where it lands?"
  Status: APPROVED (pinned 2026-09-15 — "update it to what it actualy is now please")
  Notes: Refines PC-DEC-001-era roulette spec. Shipped behavior (bcbf3e4): row stays G→Y→R, sweep lands on a random box uncorrelated with the drawn die; reveal happens at the roll (landed box morphs into drawn die).

- ID: PC-DEC-003
  Date: 2026-09-15
  Source: CLI session (C3 triage of docs/reviews/2026-09-15.md)
  Speaker: Spahrep
  Verbatim: "We aren't sure quite yet how we are going to do it, but I think the menu system is the front runner. Maybe this can be an undecided thing in the douments."
  Status: APPROVED (promoted 2026-09-16 — mechanism chosen by PC-DEC-010)
  Notes: Direction, not a decision — recorded in battle-status-ui.md as FRONT-RUNNER with the ">"-vs-preview-band question marked UNDECIDED. Promote only when the mechanism is actually chosen.

- ID: PC-DEC-004
  Date: 2026-09-16
  Source: CLI session (C3 follow-up)
  Speaker: Spahrep
  Verbatim: "the current preview marker system doesnt exsit, and the timing column isn't exactly workign as intended either, so we need to come back to that oo"
  Status: PENDING
  Notes: Implementation-reality statement, not a design decision. Confirmed against code: no preview/marker system in js/battle-app.js (grep preview = 0); only renderQueue() exists. Recorded in battle-status-ui.md status banner. Whole timing/preview area is an open revisit — no ticket yet.

- ID: PC-DEC-005
  Date: 2026-09-16
  Source: CLI session (designer-review follow-up, PC-61 triage)
  Speaker: Spahrep
  Verbatim: "yea, i dont want paper, we will be doing this fully digital"
  Status: APPROVED (stated as direction by Spahrep, 2026-09-16)
  Notes: Declines the game-designer review's 10-player paper prototype recommendation.
  Stop/continue + face-value visibility validation happens in the live game instead.
  Recorded on PC-61 (t_7fcf0c1d) and in docs/reviews/2026-09-16-decision-briefs.md.

- ID: PC-DEC-006
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "C1) You have a Belt loop (BL) and 2 consumeable slots (C1 & C2)."
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Human ruling on sweep conflict C1 (inventory-slots.md "second weapon, not a
  utility item" vs DarkJester "weapon or consumable"): the loadout row is BL + C1 + C2.
  Does NOT settle what the belt may hold or whether BL is a third drinkable hand —
  those remain open (PC-57 q3).

- ID: PC-DEC-007
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "With \"You cant sell your last weapon\" \"Everyone gets the start weapon on account creation\" then you can never get stuck w/o a weapon."
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Human ruling on sweep conflict C2 + confirms anti-softlock chain (sweep
  candidates 1/3/7, shipped PC-52): no-sell-last-weapon + starter weapon granted on
  account creation = never weaponless. Start weapon = DarkJester's SSS.

- ID: PC-DEC-008
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "Players use accuracy."
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Human ruling on sweep conflict C3 (carried from 09-15): player attacks roll
  accuracy, miss = 0 damage. Already shipped 7ef335d; combat-system.md still silent on
  the rule (needs capture + pin before the doc edit).

- ID: PC-DEC-009
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "we do wean the ap/gold transparent bar at the bottom"
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: "wean" read as "want" (typo). Human ruling on sweep conflict C4 (carried from
  09-15 — Spahrep 09-15: "I like the one that has the transparent bar on the bottom"):
  AP+gold bottom dock HUD. Already shipped 5c6286e; ap-economy.md still silent on the HUD.

- ID: PC-DEC-010
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "DW style combat menu is in fact the goal."
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Human ruling on sweep conflict C5 / PC-DEC-003 FRONT-RUNNER / PC-56: the
  Dragon-Warrior per-hand menu is the combat command mechanism. PC-DEC-003's note said
  promote only when the mechanism is actually chosen — this is the choice statement;
  pin to flip. "\">\" markers vs preview band" + web-vs-CLI surface-first stay open.

- ID: PC-DEC-011
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "We want a weapon in hand to be universally better than an empty had, except for weapon swaps and drinking potions. So yes, jester is right"
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Rules PC-62 + sweep candidate 7 (DarkJester's Fist rule): a weapon in hand
  beats an empty hand in every case except weapon swaps and drinking potions; Fist DMG
  confirmed "very, very bad", out-DPS'd by the worst weapon. Concrete Fist base
  speed/damage values remain a build-time tuning choice constrained by that ranking
  (sweep's speed-direction ambiguity: DJ said "higher then average" while the shipped
  Fist is fast at prep/cooldown 6 — the binding rule is the DPS ranking, not a stated
  number). PC-62 flipped done.

- ID: PC-DEC-012
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "Jester was confused. we have 2x Hands, and BL/C1/C2"
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Rules the belt-content remainder of sweep conflict C1: the loadout is 2 hands
  + belt loop (BL) + 2 consumable slots (C1, C2). Corrects DarkJester's
  belt-as-third-consumable framing as confusion. Belt = BL swap/reserve slot per
  shipped code; inventory-slots.md L17 "second weapon" direction stands, L87 "utility
  slot" contradiction to fix at pin.

- ID: PC-DEC-013
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "using a consumeable take sthe speed of the weapon in the hand + the speed of the consumeable"
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Rules PC-57's core formula: consumable use time = weapon-in-hand speed +
  consumable speed — the hand-tied model is confirmed (not potion-speed-only MVP).
  Still open: pre/post split (one-sample rule at the post window?) and whether the
  belt slot is drinkable.

- ID: PC-DEC-014
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "The player will never see monster HP. It is hidden behind words always."
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Rules PC-61 remainder (colors-only vs full numbers): monster HP is NEVER shown
  as numbers — words (Healthy/Injured/Battered/Critical) always. No visibility toggle.

- ID: PC-DEC-015
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "We have an invite system and we will send out invites to friends when we are ready. Before that I suspect our testing harness will have to do many full runs."
  Status: APPROVED (promoted 2026-09-16 — direct instruction: fix the docs)
  Notes: Rules PC-61 remainder (who plays): validation path = testing harness runs many
  full runs first, then invites to friends via the invite system when ready.

## Approved & Promoted

- ID: PC-DEC-001 — Monster instances live in JSON (battle_state), not a table. Promoted to current-design-status.md (§ Monster Stats), combat-engine-plan.md, admin-gui-brief.md. Decided by Spahrep, 2026-09-15.
- ID: PC-DEC-002 — Roulette sweep stays in normal G→Y→R order and lands on a random box; die reveal happens at the roll, never during the sweep. Promoted to encounter-system.md (§ Selection animation), portal-runs.md (§ Die pool). Decided by Spahrep, 2026-09-15.
- ID: PC-DEC-003 — DW per-hand menu is the combat command mechanism (choice confirmed by PC-DEC-010). Promoted to battle-status-ui.md (§ Dragon-Warrior Menu — CONFIRMED). Promoted 2026-09-16.
- ID: PC-DEC-006 — Loadout row = BL + C1 + C2. Promoted to inventory-slots.md, portal-runs.md, consumables.md, core-philosophy.md, run-ux-flow.md, current-design-status.md (slot labels). Promoted 2026-09-16.
- ID: PC-DEC-007 — No-sell-last-weapon + starter weapon on account creation = never stuck. Promoted to shops-and-economy.md + run-ux-flow.md (≥1 hand weapon entry rule). Promoted 2026-09-16.
- ID: PC-DEC-008 — "Players use accuracy." Promoted to combat-system.md (§ Accuracy hit-roll rule). Promoted 2026-09-16.
- ID: PC-DEC-009 — AP/gold transparent bottom bar. Promoted to ap-economy.md (§ Bottom dock HUD). Promoted 2026-09-16.
- ID: PC-DEC-010 — DW-style combat menu is the goal. Promoted to battle-status-ui.md (mechanism CONFIRMED; ">"-vs-band + visuals parked). Promoted 2026-09-16.
- ID: PC-DEC-011 — Weapon-in-hand universally better than empty hand (except swaps/potions); Fist out-DPS'd by worst weapon. Promoted to inventory-slots.md (Fist rule) + run-ux-flow.md. Promoted 2026-09-16.
- ID: PC-DEC-012 — Loadout = 2 hands + BL + C1/C2; belt-as-third-consumable was confusion. Promoted to inventory-slots.md (belt = swap/reserve). Promoted 2026-09-16.
- ID: PC-DEC-013 — Consumable use time = weapon-in-hand speed + consumable speed. Promoted to current-design-status.md + inventory-slots.md + consumables.md. Promoted 2026-09-16.
- ID: PC-DEC-014 — Monster HP words-only, never numbers. Consistent with battle-status-ui.md (§ Monster HP — Words Only); no edit needed. Promoted 2026-09-16.
- ID: PC-DEC-015 — Validation: harness full runs first, then friend invites. Recorded in docs/reviews/2026-09-16.md. Promoted 2026-09-16.

## Rejected / Superseded

(none yet)
