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

- ID: PC-DEC-016
  Date: 2026-09-16
  Source: Discord thread "Ensure players keep one weapon" (1549499851736350781)
  Speaker: Spahrep
  Verbatim: "OK  please create a weapon template. It's name is \"SSS\", damage 5, delta zero. Speed 20, delta zero. Accuracy 70, delta zero. Tell me the unique ID generated for this template ID"
  Status: DECIDED
  Notes: Fixes the SSS blocker raised by DarkJester (06:58: "I don't see anything in the database for the SSS"). Concrete SSS template: flat stats, zero deltas (5/0 dmg, 20/0 speed, 70/0 accuracy) — seeded 6a219a9, granted on account creation per PC-DEC-007/SSS rule. Also confirms the template is the delivery mechanism (template → weapon_instance at account creation).

- ID: PC-DEC-017
  Date: 2026-09-16
  Source: Discord thread "Ensure players keep one weapon" (1549499851736350781)
  Speaker: Spahrep
  Verbatim: "ok, we will make a config table. It will basicaly be global variables."
  Status: DECIDED
  Notes: Replaces the JSON-config-file option (Spahrep 07:34: "if we had a json .config file, wouldn't we be able to do the same thing wthout adding a useless row to 99% of entries in teh templat etable?") — starter-template marker must NOT become a near-empty column on every template row. Implemented as game_config single-row table (e3b2a82, 06987e3).

- ID: PC-DEC-018
  Date: 2026-09-16
  Source: Discord thread "Ensure players keep one weapon" (1549499851736350781)
  Speaker: Spahrep
  Verbatim: "Starting gold = 0, Starting AP=10"
  Status: DECIDED
  Notes: First values in the new game_config table (shipped e593b7e, verified live). Max AP and Daily AP Gain remain open (docs have max = 3× daily gain).

- ID: PC-DEC-019
  Date: 2026-09-16
  Source: Discord thread "Audit unused database tables and columns" (1549497584375038003)
  Speaker: Spahrep
  Verbatim: "ok, let's purge the player_inventory table."
  Status: DECIDED
  Notes: Resolves the audit's orphan-table question (Spahrep 08:10: "how are inventory item associated with the player?"). player_inventory + player_backpack view dropped 09fabfb (PC-55). Player items live as weapon_instance rows with player_id FK; no separate backpack table.

- ID: PC-DEC-020
  Date: 2026-09-16
  Source: Discord thread "Work on PC56" (1549763814285648016) — OOB ruling during build handoff
  Speaker: Spahrep
  Verbatim: "I'm not sure what is being asked. For now lets do the simple markers, we can add in full band preview later"
  Status: DECIDED
  Notes: Ruling on PC-DEC-010's open "'>'-markers vs preview band" fork (battle-status-ui.md timing display): '>' markers for the DW menu NOW, full band preview deferred (PMVP). Shipped c864a4d/241c29a; battle-status-ui.md updated.

- ID: PC-DEC-021
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "At the start of combat, each hand gets assigned an 'initiative' value. This is from 1 to their speed value (the equiped weapon)."
  Status: SUPERSEDED (2026-09-17, PC-DEC-032)
  Notes: Stated in answer to the "which hand opens?" design-review question. Purpose ruled later the same day (PC-DEC-029): player-vs-monster ordering within a tic — the player is not guaranteed to act first. Hand-order tie-break when both hands are ready = PC-DEC-028. The ROLL (1..weapon speed) was replaced by Spahrep's deterministic model (PC-DEC-032): each hand sits on the track at its weapon's instance speed, no roll.

- ID: PC-DEC-022
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "you cant close the root window. Maybe we add in a 'Delay' or 'defend' but that's PMVP"
  Status: DECIDED
  Notes: Esc at the root action window = no-op; the hand stays in the menu until a command resolves. Delay / Defend commands = PMVP. Rules out the design-review lean that Esc at root closes the menu.

- ID: PC-DEC-023
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "The equip is the BL, i wasn't sure how to phrase it, the wording is not locked in stone. Maybe it says 'Belt Loop: Dagger'"
  Status: DECIDED
  Notes: The root menu's bottom row is the belt loop (BL swap surface, per the DarkJester swap ask). Preferred label "Belt Loop: <weapon name>"; wording not locked. BL swap timing formula remains open (pending-decisions.md #4).

- ID: PC-DEC-024
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "yes, potions follow the same flow. For offensive items (PMVP) they will also have the enemy selectoin."
  Status: DECIDED
  Notes: Potions cascade a hand-target window (LH/RH) then confirm. Offensive consumables (PMVP) cascade the enemy-selection window instead.

- ID: PC-DEC-025
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "There was a basic attack selected. If we had of selected Quick Strike, it would have said 'Confirm Quickstrike: B <<monster name>>'."
  Status: DECIDED
  Notes: Confirm-window line format = "Confirm <AttackName>: <letter> <monster name>" (e.g. "Confirm Quick Strike: B Giant Rat"; basic attack = "Confirm Attack: B Giant Rat").

- ID: PC-DEC-026
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "Yes, all the flow is nicely wrapped into one area of the screen, with easy to navigate keyboard commands, but they could use mouse if they wanted to."
  Status: DECIDED
  Notes: Keyboard-first (arrows + Enter + Esc) AND mouse click support; the whole cascade lives in one screen area.

- ID: PC-DEC-027
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "The orange blue colour scheem is not locked in. PMVP people can change their window options."
  Status: DECIDED
  Notes: Window palette (orange/blue) is not a locked design; per-player window theming = PMVP.

- ID: PC-DEC-028
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "When 2 hands are ready at the same time, the hand with the faster base attack (lowest speed) goes first. if they are the same, then LH goes first."
  Status: DECIDED
  Notes: Both-hands-ready order in the DW cascade: the hand whose equipped weapon has the LOWEST speed acts first; equal speed → left hand first. The web GUI's hand-switch chip (prefHand) was never asked for — Spahrep 2026-09-16: "I dont think i've ever asked for a hand-switch chip"; removed in PC-63. Order is deterministic; no override UI.

- ID: PC-DEC-029
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "The initiative is so the player doesnt always go first, it may be a monster that goes first."
  Status: DECIDED
  Notes: Clarifies the PURPOSE of PC-DEC-021's per-hand initiative (1..equipped-weapon speed): ordering the player against monsters within a tic — the player is NOT guaranteed to act first; a monster may. Compare side ruled the same day (PC-DEC-030): monsters use their instance speed, ties → player first. Roll timing (combat start, per PC-DEC-021) stated; integration with the timing rail still OPEN.

- ID: PC-DEC-030
  Date: 2026-09-16
  Source: Discord thread "Implement Dragon Warrior style command selection" (1549822905100017745)
  Speaker: Spahrep
  Verbatim: "Monsters have a speed value for thier instance, they start with that. Ties mean players go first."
  Status: DECIDED
  Notes: Monster side of the initiative compare: NO roll — each monster's initiative IS its instance speed value from combat start. Tie → player acts first. Assumption (not stated): HIGHER initiative acts first within a tic — consistent with a hand rolling max vs a monster's static speed producing a tie (player first); flagged for confirmation when the engine ticket is built (PC-64). How initiative ordering composes with the existing windup/timing rail is NOT ruled — engine design, Spahrep + DarkJester decide together.

- ID: PC-DEC-031
  Date: 2026-09-15
  Source: Discord thread "Ensure players keep one weapon" (1549499851736350781), 16:35:28 — captured late by the 2026-09-17 sweep (listed as uncaptured candidate 2 in docs/reviews/2026-09-16.md)
  Speaker: DarkJester
  Verbatim: "you can switch your weapon with whatever is in your belt loop mid combat whenever your hand has an action. If I want to switch my dagger for my great axe, it should compare the base speeds of both weapons and delay that hands next action by whichever is longer."
  Status: DECIDED
  Notes: Belt-loop swap timing formula. Shipped as PC-54: mid-battle swap when the hand is Ready, delay = max of the two weapons' speeds (implemented on the weapon `speed` field; js/combat/participants.js swapHandWithBelt). Closes current-design-status.md Open Q #4's formula half; the BL root-menu row (PC-DEC-023) is the swap surface. Still open: whether the swapped-in weapon can attack immediately or needs a draw tic.

- ID: PC-DEC-032
  Date: 2026-09-17
  Source: Discord thread "Initial turn order decision" (1550154633501085840)
  Speaker: Spahrep
  Verbatim: "The intial tic ordering: 1) LH/RH each get their weapons base speed and get put on the track 2) Each monster get's put on the track based on their instance's speed" + "Once the hands get to zero, then they get their action."
  Status: DECIDED
  Notes: SUPERSEDES PC-DEC-021's roll (initiative 1..weapon speed). Deterministic placement: at combat start each hand gets one **approach** row on the timing rail at its weapon's instance speed (unarmed hand = `game_config.fist_speed`, migration 20260917140000); monsters already seed attack rows at their instance speed. When an approach row hits 0 the hand becomes Ready and the player picks their action THEN. `startBattle` advances to the first decision point, so a faster monster genuinely acts before the player. Ties → player first (PC-DEC-030, unchanged). Attack timing formula (weapon speed + rolled prepare/cooldown) unchanged — the approach row is initial placement only; after an attack's cooldown the hand is actionable immediately as before. Shipped as PC-64.

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
