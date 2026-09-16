# Design Decisions

Log of design decisions stated by Spahrep or DarkJester (mainly in Discord
threads and CLI sessions). A statement that resolves/changes/confirms a design
point IS the decision — there is no approval step. Entries are captured verbatim
and applied to the permanent docs in the same pass (Spahrep 2026-09-16).

## Rules

1. **Capture is verbatim.** An entry is a direct quote of what the deciding
   person said. No paraphrase, no summary, no interpretation, no inference. If
   the bot cannot quote it verbatim, it does not capture it.
2. **The statement is the decision.** When Spahrep or DarkJester states
   something that resolves/changes/confirms a design point, it is decided the
   moment it is said. The bot logs it here and applies it to the permanent docs
   immediately. No "pin it", no magic phrase, no waiting for approval.
3. **Ambiguous or question-shaped statements** are logged as OPEN with the open
   question spelled out — never guessed into a ruling.
4. **Conflict checks are advisory.** The daily sweep (docs/reviews/) flags
   contradictions; it applies new decisions and flags genuine conflicts.

## Entry format

    - ID: PC-DEC-<NNN>
      Date: YYYY-MM-DD
      Source: Discord thread "<name>" / kanban <id> / link
      Speaker: Spahrep | DarkJester
      Verbatim: "..."
      Status: DECIDED | OPEN | REJECTED | SUPERSEDED (by PC-DEC-<id>)
      Notes: (optional — only clarifications asked & answered, never inference)

## Decided

- ID: PC-DEC-001
  Date: 2026-09-15
  Source: CLI session (C1 triage of docs/reviews/2026-09-15.md)
  Speaker: Spahrep
  Verbatim: "We can still do the monster instnace, it's just saved in a JSON for the portal instnace. I was informed this was a faster/lighter way to do it instead of a DB heavy way to do it. Do you dissagree?"
  Status: DECIDED
  Notes: Resolves sweep conflict C1. Implemented as generate_monster() returning jsonb (no row persisted); instance lives in portal_run.battle_state jsonb. Also relevant: HP roll uses uniform_int (even distribution, Spahrep 2026-09-08), not Box-Muller — docs describe both the table and the distribution wrongly.

- ID: PC-DEC-002
  Date: 2026-09-15
  Source: Discord thread (C2 of docs/reviews/2026-09-15.md; original statement 19:39:43)
  Speaker: Spahrep
  Verbatim: "Are you capapble of just having it stay in the normal order and randomly seelcting where it lands?"
  Status: DECIDED
  Notes: Refines PC-DEC-001-era roulette spec. Shipped behavior (bcbf3e4): row stays G→Y→R, sweep lands on a random box uncorrelated with the drawn die; reveal happens at the roll (landed box morphs into drawn die).

- ID: PC-DEC-003
  Date: 2026-09-15
  Source: CLI session (C3 triage of docs/reviews/2026-09-15.md)
  Speaker: Spahrep
  Verbatim: "We aren't sure quite yet how we are going to do it, but I think the menu system is the front runner. Maybe this can be an undecided thing in the douments."
  Status: DECIDED (mechanism chosen by PC-DEC-010)
  Notes: Direction, not a decision — recorded in battle-status-ui.md as FRONT-RUNNER with the ">"-vs-preview-band question marked UNDECIDED. PC-DEC-010 confirmed the DW menu is the mechanism.

- ID: PC-DEC-005
  Date: 2026-09-16
  Source: CLI session (designer-review follow-up, PC-61 triage)
  Speaker: Spahrep
  Verbatim: "yea, i dont want paper, we will be doing this fully digital"
  Status: DECIDED
  Notes: Declines the game-designer review's 10-player paper prototype recommendation. Stop/continue + face-value visibility validation happens in the live game instead. Recorded on PC-61 (t_7fcf0c1d) and in docs/reviews/2026-09-16-decision-briefs.md.

- ID: PC-DEC-006
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "C1) You have a Belt loop (BL) and 2 consumeable slots (C1 & C2)."
  Status: DECIDED
  Notes: Human ruling on sweep conflict C1 (inventory-slots.md "second weapon, not a utility item" vs DarkJester "weapon or consumable"): the loadout row is BL + C1 + C2. Does NOT settle what the belt may hold or whether BL is a third drinkable hand — those remain open (PC-57 q3).

- ID: PC-DEC-007
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "With \"You cant sell your last weapon\" \"Everyone gets the start weapon on account creation\" then you can never get stuck w/o a weapon."
  Status: DECIDED
  Notes: Human ruling on sweep conflict C2 + confirms anti-softlock chain (sweep candidates 1/3/7, shipped PC-52): no-sell-last-weapon + starter weapon granted on account creation = never weaponless. Start weapon = DarkJester's SSS.

- ID: PC-DEC-008
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "Players use accuracy."
  Status: DECIDED
  Notes: Human ruling on sweep conflict C3 (carried from 09-15): player attacks roll accuracy, miss = 0 damage. Already shipped 7ef335d; combat-system.md updated with the rule.

- ID: PC-DEC-009
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "we do wean the ap/gold transparent bar at the bottom"
  Status: DECIDED
  Notes: "wean" read as "want" (typo). Human ruling on sweep conflict C4 (carried from 09-15 — Spahrep 09-15: "I like the one that has the transparent bar on the bottom"): AP+gold bottom dock HUD. Already shipped 5c6286e; ap-economy.md updated with the HUD.

- ID: PC-DEC-010
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "DW style combat menu is in fact the goal."
  Status: DECIDED
  Notes: Human ruling on sweep conflict C5 / PC-DEC-003 FRONT-RUNNER / PC-56: the Dragon-Warrior per-hand menu is the combat command mechanism. ">" markers vs preview band + web-vs-CLI surface-first stay open.

- ID: PC-DEC-011
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "We want a weapon in hand to be universally better than an empty had, except for weapon swaps and drinking potions. So yes, jester is right"
  Status: DECIDED
  Notes: Rules PC-62 + sweep candidate 7 (DarkJester's Fist rule): a weapon in hand beats an empty hand in every case except weapon swaps and drinking potions; Fist DMG confirmed "very, very bad", out-DPS'd by the worst weapon. Concrete Fist base speed/damage values remain a build-time tuning choice constrained by that ranking (sweep's speed-direction ambiguity: DJ said "higher then average" while the shipped Fist is fast at prep/cooldown 6 — the binding rule is the DPS ranking, not a stated number). PC-62 flipped done.

- ID: PC-DEC-012
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "Jester was confused. we have 2x Hands, and BL/C1/C2"
  Status: DECIDED
  Notes: Rules the belt-content remainder of sweep conflict C1: the loadout is 2 hands + belt loop (BL) + 2 consumable slots (C1, C2). Corrects DarkJester's belt-as-third-consumable framing as confusion. Belt = BL swap/reserve slot per shipped code; inventory-slots.md L17 "second weapon" direction stands, L87 "utility slot" contradiction fixed.

- ID: PC-DEC-013
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "using a consumeable take sthe speed of the weapon in the hand + the speed of the consumeable"
  Status: DECIDED
  Notes: Rules PC-57's core formula: consumable use time = weapon-in-hand speed + consumable speed — the hand-tied model is confirmed (not potion-speed-only MVP). Still open: pre/post split (one-sample rule at the post window?) and whether the belt slot is drinkable.

- ID: PC-DEC-014
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "The player will never see monster HP. It is hidden behind words always."
  Status: DECIDED
  Notes: Rules PC-61 remainder (colors-only vs full numbers): monster HP is NEVER shown as numbers — words (Healthy/Injured/Battered/Critical) always. No visibility toggle.

- ID: PC-DEC-015
  Date: 2026-09-16
  Source: Discord thread "Item and combat slot design discussion" (1549746327032963083)
  Speaker: Spahrep
  Verbatim: "We have an invite system and we will send out invites to friends when we are ready. Before that I suspect our testing harness will have to do many full runs."
  Status: DECIDED
  Notes: Rules PC-61 remainder (who plays): validation path = testing harness runs many full runs first, then invites to friends via the invite system when ready.

## Open

- ID: PC-DEC-004
  Date: 2026-09-16
  Source: CLI session (C3 follow-up)
  Speaker: Spahrep
  Verbatim: "the current preview marker system doesnt exsit, and the timing column isn't exactly workign as intended either, so we need to come back to that oo"
  Status: OPEN
  Notes: Implementation-reality statement, not a design decision. Confirmed against code: no preview/marker system in js/battle-app.js (grep preview = 0); only renderQueue() exists. Recorded in battle-status-ui.md status banner. Whole timing/preview area is an open revisit — no ticket yet.

## Rejected / Superseded

(none yet)
