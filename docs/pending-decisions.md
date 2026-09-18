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

- ID: PC-DEC-033
  Date: 2026-09-17
  Source: Discord thread 1550108847467921430, 08:39 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "When you type 'End Run' you should be able to hit enter to confirm, right now it forces you to use the mouse to click the button"
  Status: DECIDED
  Notes: Keyboard-first confirm for the End Run typed-confirmation dialog (same principle as PC-DEC-026). Shipped a70c8a9 (fix(run): Enter confirms End Run typed-confirmation dialog). Applied to run-ux-flow.md.

- ID: PC-DEC-034
  Date: 2026-09-17
  Source: Discord thread 1550127819139579909, 09:54–09:58 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "When an attack is selected, the time (tics) before it fires should be weapon base speed + a roll on the attack's speed (Base + delta roll). Then after the attack fires, the hand goes back into the que with a delay of X tics, where X is the weapon's speed." + "if attacks alreayd have pre/post speeds, keep those, just make sure that the base speed of the weapon is added into each computation" + "i forgot we had a pre-post range field seperately. This still works though, Any time an attack's speed is calcualted, pre or post, you add in the weapon"
  Status: DECIDED
  Notes: CONFIRMS the documented attack timing formula (battle-status-ui.md): windup = weapon base speed + rolled prepare, cooldown = weapon base speed + rolled cooldown — attack pre/post ranges are kept and the weapon's base speed is added into each computation. The engine had drifted (weapon speed missing from timings); fixed same day (6a996bd: weapon base speed added into every attack timing computation). Applied to battle-status-ui.md.

- ID: PC-DEC-035
  Date: 2026-09-17
  Source: Discord thread 1550127819139579909, 10:10–10:12 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "for unarmed, let's remove the hard coding and put any required values in our configuration table for now. We may move them later, but I dont want hard coded valeus anywhere."
  Status: DECIDED
  Notes: Triggered by "where do we have the damange and speeds asigned to unarmed? Are they in a config table or hard coded?" (10:10). Fist/unarmed stats moved from hardcoded constants into `game_config` (migrations 20260917120000 + 20260917140000; 84be3d4): fist_damage, fist_accuracy, fist_prepare_time (+range), fist_cooldown_time (+range), fist_speed. The client consumes the server's fist payload — no hardcoded unarmed values anywhere. Applied to current-design-status.md.

- ID: PC-DEC-036
  Date: 2026-09-17
  Source: Discord thread 1550151417426354318, 11:28–11:33 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "When a die is 'rolling' i want it to flash each time it is rolled. If not flash, then another visual notificatoin. The issue is some times it shows 10 multipe times in a row (dice can have the same value on multiple faces) and it looks like it is stuck before changing again seconds later."
  Status: DECIDED
  Notes: Mechanism refined in-thread: "instead of a flash, could the number on the die instead 'rotate' between rolls?" (11:33) — the chosen notification is the die face ROTATING per roll tick (shipped as PC-70, 1303299: spin the die face in per roll tick instead of flashing). Applied to battle-status-ui.md.

- ID: PC-DEC-037
  Date: 2026-09-17
  Source: Discord thread 1550151417426354318, 11:31 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "i didnt say to stop the die from rolling the same thing several times in a row, that is 100% allowed and an expected design"
  Status: DECIDED
  Notes: Natural die repeats are allowed and expected — no consecutive-face filtering (dice can have the same value on multiple faces). Shipped as PC-70 (56be7e0: keep natural repeats — flash only, no consecutive-face filtering). Applied to battle-status-ui.md.

- ID: PC-DEC-038
  Date: 2026-09-17
  Source: Discord thread 1550153771609227316, 11:37–11:54 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "Before the die is finished rolling, there should be no command window displayed. The monsters should be hidden and the timing track should be hidden. After the die is rolled, the monsters should fade in 1 at a time, and then after all the monsers are in, the timing table should fill up from First (next) to last."
  Status: DECIDED
  Notes: Battle-intro sequence ruling. Refinements same thread: "Ok, i checked it myself, it is working, but let's have the fade in be more pronoucned. And each item on the tracker should fade in one at a time." (11:49); "the fade duration needs to be longer and or pause a bit between each element being loaded." (11:51); "Looks good, but the action menu came in before the time track was filled" (11:54 → the command window must wait for the timing track). Shipped: f76ea21 (command window + timing track hidden until the dice ceremony completes), e7d32f5 (pronounced one-at-a-time reveals), cec8a60 (command window waits for the timing track). Applied to battle-status-ui.md.

- ID: PC-DEC-039
  Date: 2026-09-17
  Source: Discord thread 1550153771609227316, 12:41 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "The battle still starts at Tic 0, and progresses until the first entity has an action."
  Status: DECIDED
  Notes: Refines PC-DEC-032's presentation: the battle is PRESENTED from Tic 0 and progresses until the first entity acts — no jump straight to the first decision point. Shipped as the PC-64 battle intro (5dde661/212b014 on branch pc-64-battle-intro: `intro` timeline on the startBattle result + tic-0 countdown presentation). Engine placement unchanged (PC-DEC-032): startBattle still advances the clock so a faster monster genuinely acts first. Applied to battle-status-ui.md + current-design-status.md.

- ID: PC-DEC-040
  Date: 2026-09-17
  Source: Discord thread 1550153771609227316, 13:00 — captured by the 2026-09-17 midday sweep
  Speaker: Spahrep
  Verbatim: "we dont need to worry about the web CLI any more. We focus on the actual game now."
  Status: DECIDED
  Notes: Direction change: the product focus is the actual game (run.html GUI), not the web CLI's UX. This is NOT a deprecation of the web CLI — clarified by PC-DEC-041 (web CLI is the sole CLI after the native purge) and PC-DEC-042 ("We are keeping webCLI", 2026-09-17): the web CLI stays as the canonical, engine-parity test harness; "not a focus" means no new product UX work there, not "drop it". Supersedes the old native-cli.md maintenance note's "canonical, fully-maintained" framing only in that sense. Applied to native-cli.md (file since removed by the PC-DEC-041 purge).

- ID: PC-DEC-041
  Date: 2026-09-17
  Source: CLI session (native-CLI purge)
  Speaker: Spahrep
  Verbatim: "let's purge the native CLI then from the codebase and update documents and memory accordingly and we will keep doing the web-cli"
  Status: DECIDED
  Notes: Native CLI (scripts/cli/) deleted from the repo — its two audiences (agent-driven headless QA, human terminal play) evaporated; the web CLI is the sole CLI and the in-browser fixture factory (engine parity kept). Supersedes PC-DEC-040's "native CLI stays fix-on-break" (it is gone, not dormant). Shared potion-format.mjs moved to js/combat/ so the engine fixture tests keep importing it. Applied to: repo (scripts/cli/ + docs/native-cli.md removed), potion-contract.md, run-ux-flow.md, cli-app.js comments.

- ID: PC-DEC-042
  Date: 2026-09-17
  Source: Discord thread 1550210298768662663 (reply to the midday sweep's conflict flags)
  Speaker: Spahrep
  Verbatim: "We are keeping webCLI."
  Status: DECIDED
  Notes: Response to the sweep's flag ① — confirms PC-DEC-041: the web CLI (public/test/cli/cli-app.js) is KEPT as the sole CLI and stays the canonical, engine-parity test harness. PC-DEC-040's "no longer a focus" means no new product-UX work on the web CLI (the game GUI is the product), NOT deprecation. Applied to: pending-decisions.md (PC-DEC-040 note amended to point here).

- ID: PC-DEC-043
  Date: 2026-09-17
  Source: Discord thread 1550243055871729677 ("Look in the shared folder there is an image "casscadeIssue". Can we change how the windows cascade?")
  Speaker: Spahrep
  Verbatim: "each window needs to overlap the existing one by some amount, for the exact amoutn you can use the /personality designer"
  Status: DECIDED
  Notes: Cascade geometry ruling from shared/CascadeIssue.png ("Actual" vs "Desired" panels). All cascade windows render at ONE uniform box — the tallest window's natural height, capped to the panel — and step down-right by a fixed amount (named constants CASCADE_STEP_X/Y), so every window overlaps the parent by the same amount and no window floats disconnected from the stack. Tuned 2026-09-17 (same thread, "they end up pushing down too far"): steps set to 96px right / 26px down — a parent's rows are obsolete once you advance ("you really dont need to see it, so it can overlap the words too"), so only the parent's hand tab stays visible and the stack stays compact (downward reach ~52px + box height, vs 124px + box before). Applied to js/battle-app.js renderStack + run.html .dw-window (box-sizing: border-box, width 316px total = previous 290px content).

- ID: PC-DEC-044
  Date: 2026-09-17
  Source: Discord thread 1550247561699401790 ("We need to adjust how the battle logging window displays. Each entry should look like it is typed...")
  Speaker: Spahrep
  Verbatim: "Each entry should look like it is typed. And there should be a delay after each line, let's start with 1s and we can adjust. The display speed (how long between each line) is probably going to be a user config option." / "Your call, set it up how you think works best for the game, we can always change it later."
  Status: DECIDED
  Notes: Typewriter battle log (MESSAGE LOG, #message-box) — exact values delegated to the gamedesigner persona ("talk to the /personality designer to get some info"), ruling recorded per that persona. Ruling: (1) only NEW feed lines type — the log is re-rendered wholesale on every commit, so the renderer diffs by line count (incremental append) or the whole history re-types itself each turn; (2) per-char reveal at 15ms/char, 1000ms beat after each line completes (Spahrep's starting value); (3) soft gate — the action menu is inert while a batch types (the player must read the result before deciding; same pattern as the intro ceremony gating the command window), and clicking the log instantly completes pending typing; (4) three text-speed presets behind ONE knob — standard (15ms/1000ms, default) / slow (25ms/1600ms) / instant (no typing = today's behavior, no gate) — stored client-side in localStorage (pc_battle_text_speed), per-browser not per-account (display taste ≠ game rules; the DB config table stays for game config), small TEXT SPEED control in the MESSAGE LOG title row; (5) system text stays instant: 'Battle begins...' placeholder, showMessage toasts/errors, and intro-countdown appendFeedLine (its pacing is the countdown dwell, PC-64); finishIntroSnap re-renders the full feed from the top (from-top flag) so the battle-start log types once after the countdown snaps, holding onDone until the reveal completes. Pure client-side presentation in js/battle-app.js + run.html — no API/DB changes. Applied to: PC-66 (kanban → Grok builder).

- ID: PC-DEC-045
  Date: 2026-09-17
  Source: Discord thread "Initial turn order decision" (1550154633501085840), ~14:35 (message 1550198430180319313) — captured by the 2026-09-18 nightly sweep
  Speaker: Spahrep
  Verbatim: "is Player_max_HP in a config talbe, it shouldnt' be hard coded."
  Status: DECIDED
  Notes: Player max HP must come from the config table, not a hard-coded literal — extends PC-DEC-035's no-hardcoding principle to the player. Shipped 271a75d (2026-09-17, pushed to main): `game_config.starting_hp` read via a startingHp() helper and wired into all startBattle sites + the run insert + the heal-potion cap; `js/combat/participants.js` keeps PLAYER_MAX_HP=1000 only as the offline engine fallback — the live value is fully config-driven. Applied to combat-system.md, potion-contract.md, current-design-status.md.

- ID: PC-DEC-046
  Date: 2026-09-17
  Source: Discord thread 1550243421862502432 ("Fix second attack cooldown on kill"), 17:33 — confirmed 18:03 (message 1550250876415770625); captured by the 2026-09-18 nightly sweep
  Speaker: DarkJester
  Verbatim: "If you send two attacks at the same enemy and the first one kills it the other hand should immediately start the moves cooldown time instead of being redirected or missing." + "Ok, please make it so that after the first move kills, the hand targeting it immediately goes on that moves cooldown"
  Status: DECIDED
  Notes: Kill-cancel rule. When an attack impact kills a monster, any other hand still winding an attack whose targets are ALL dead is cancelled straight into its own move's cooldown at the kill tic — no finishing the cast, no corpse whiff, no redirect for explicit targets. Shipped 48ddd58 (engine.js): multi-target attacks survive partial kills (cancel only when every queued target is dead); auto-target attacks (no explicit target) still redirect to the first living monster; the cancelled hand pays its own move's cooldown (insurance tax — no free double-tap). Feed line: "RH attack cancelled — target already defeated". Partially resolves the parked "death-cancels-in-flight = PMVP" item: the player same-enemy double-tap case is ruled; whether a monster that dies on a tic still resolves its own in-flight attack stays PMVP. Applied to battle-status-ui.md + current-design-status.md.

- ID: PC-DEC-047
  Date: 2026-09-17
  Source: Discord thread 1550222931395743796 ("Check run 74 logs for Heavy Chop damage"), 16:12 — sequencing 16:25 (1550228413514784971), ticket 16:50 (1550232534065881109); captured by the 2026-09-18 nightly sweep
  Speaker: DarkJester
  Verbatim: "Also, the attacks should have ranges for their multipliers, so instead of heavy chop being x1.5 DMG it should be a range of 1.3 - 1.7 for an example, and an even spread for more variance."
  Status: DECIDED
  Notes: Attack damage multipliers are base ± range with an EVEN (uniform) spread for more variance — Heavy Chop x1.5 rolls 1.3–1.7, EV stays 1.5. Sequencing ruled same thread: "Fix the double count, then I'll do a run to make sure it is fixed, then if I report success we add the ranges" — double-count bug fixed 31430f0; verification passed (Heavy Chop = 57 = 38 × 1.5); then "Create the ticket, and have the mult adjustment be done how ever you think is best" — delegated to the builder ticket, shipped on branch wt/pc-65 (kanban done): `base_damage_multiplier_range` on the attack table (uniform ± roll, 0 = no variance), monster damage = mean ± σ via a `damage_variance` column (Box-Muller), both admin-editable with a band preview. Applied to combat-system.md + current-design-status.md.

- ID: PC-DEC-048
  Date: 2026-09-18
  Source: Discord thread 1550484095316787241 ("During a portal run, when a monster hits a player…"), 2026-09-18
  Speaker: Spahrep
  Verbatim: "During a portal run, when a monster hits a player, the UI (not incluing the background just the thing sin the window for the portal; run) need to have a 'shake'. Work as designer to figure out the particulars.  Likewise when a player hits a monster, that monster needs to have a shake/flash, potentially a sprite change. We dont have sprites yet, so put that part on the to do list and complete what you can."
  Status: DECIDED
  Notes: Hit feedback shipped on main 986cd97 (PC-70). The FORM is Spahrep's decision (window shake on monster→player; monster shake/flash on player→monster; sprite change deferred to TODO). Amplitudes/durations are assistant-determined values per the gamedesigner persona, justified by the impact-impulse recipe (short, sharp, decaying — a jolt, not rumble): run-window contents jolt 4px/280ms (the .container only — page background and status dock stay put, per "not incluing the background"); monster card recoils 3px/220ms; sprite box white-flashes 180ms (white = universal hit-confirmed signal, not red — red stays the HP-band severity language). Values are exposed as named constants (HIT_FEEDBACK in js/battle-app.js; keyframes in run.html) for easy retuning. Feedback fires as the feed line starts typing; misses/Ready/defeat get none (feedback must not lie about impact). Intro-countdown fires shake live; the intro-snap history re-type is suppressed so old hits don't re-shake. Sprite change on hit (hit/damaged sprite variant swap at impact) = TODO, tracked in battle-status-ui.md Open/Visual Nits; no sprites yet — the white-flash already occupies the sprite box, so the swap slot is reserved.

- ID: PC-DEC-049
  Date: 2026-09-18
  Source: Discord thread 1550496129332813914 ("When someone retuns to a battle after exiting part way…"), 2026-09-18
  Speaker: Spahrep
  Verbatim: "When someone retuns to a battle after exiting part way, we dont need to show the roll animations and slow feed all the old action logs. It can simply put them right back to where they were. The action log should instantly be populated, and the dice should be insntaly selected etc."
  Status: DECIDED
  Notes: Battle resume = instant restore (shipped main 38a29a7 as PC-72). Loading run.html?id=<run> is ALWAYS a resume unless it is the genuine first entry of a NEW run: the die ceremony (sweep + roll) and the intro countdown + full-history re-type play only (a) on first entry — a sessionStorage marker set by run-equip right before navigating to a freshly created run, and (b) on in-session battle continue. Every other load — returning after exiting part way, reload, reopened tab, direct URL, the run-equip active-run bounce — restores instantly: the action log populates at once (no typewriter, historical hits do NOT re-shake), the current die renders already selected with its face + rolled value, monsters render without the fade-in, and the command window + timing track appear immediately. sessionStorage (not localStorage) so a closed tab never replays the ceremony.

- ID: PC-DEC-050
  Date: 2026-09-18
  Source: Discord thread "Critical strike implementation options" (1550487390219407391), message 1550490208850419773, ~12:10 ADT
  Speaker: Spahrep
  Verbatim: "Ok, looks like we need to give monsters a base chance. put all the previously generated at 5%. Put all current weapon instances at 5%. Put all current attacks at 1.1 factor. I dont think we need a floor and a ceilling. This game is going ot have swings of outrageous fortune. Dowe need any other deciions before implementing? Also potions need a crit chance. this will be much simpler as they only crit off of their own crit rate, they aren't impacted by the weapon using them (maybe later PMVP we can have some weapon enchantment that does it, but not now). Potions crit effect should go in a config table, and for now it will be +50% effect and +50% on duration."
  Status: DECIDED
  Notes: Critical strike system architecture. weapon_template.crit_base/range → rolled into weapon_instance.crit_chance (uniform roll base ± range). attack.crit_factor (multiplies the weapon instance's crit chance) + attack.crit_multiplier (damage multiplier on crit). Monster_template mirrors weapons (crit_base/range → rolled per monster instance). No floor, no ceiling on crit chance — "swings of outrageous fortune" is the design. Backfill: weapon instances at 5%, monster templates at 5%, attacks at factor 1.1. Potions crit independently from their own rate (template-level crit_base/range, rolled onto potion instance — NOT weapon-in-hand). Potion crit effect in game_config: +50% effect multiplier, +50% duration multiplier (potion_crit_effect_multiplier, potion_crit_duration_multiplier). PMVP: weapon enchantment that affects potion crit (noted, not now). Misses can't crit (accuracy roll first). Multi-target attacks roll crit per target. Shipped: migration 20260918120000_crit_strikes.sql, engine.js, api/combat/[...path].js, tests/crit-strikes.test.js. Decided by Spahrep, 2026-09-18.

- ID: PC-DEC-051
  Date: 2026-09-18
  Source: Discord thread "Critical strike implementation options" (1550487390219407391), message 1550491071967010918, ~12:35 ADT
  Speaker: Spahrep
  Verbatim: "1) yes, set attacks to 2x for now. 2) Sounds good. 3) No, potion templates get crit rates, just like weaon, and they live on the potion insntance. 4) Go with your instinct on this one. 5) Yes, we need to update all the weapon info screens/mouseovers, and the combat engine will need to be udpated. 6) CLI tool should be able to do almost anything we need for testing, it's god mode. I think we are ready, any more clarifications or pushbacks?"
  Status: DECIDED
  Notes: Follow-up clarifications to PC-DEC-050. (1) All current attacks → crit_multiplier ×2.0 (crit_factor stays 1.1). (2) Templates flat: crit_base 5, crit_range 0 on weapon_template and monster_template (backfill: instances at 5%, monsters at 5%). (3) Potion templates get crit rates (crit_base/range, rolled onto potion_instance) — mirrors weapons exactly, NOT a global config value. Existing potion instances backfilled at 5% (templates 5/0). (4) Instinct: fist_crit_chance in game_config (default 5%), ×2.0 — no attack path is crit-dead. (5) All weapon info screens/mouseovers updated to display crit; combat engine feed shows "CRITICAL!" tag; admin-gui-brief UI (crit_factor, crit_multiplier on attacks; crit_base/range on weapon/monster templates). (6) CLI is god mode: display and set crit on weapons/potions. Crit stays out of the item grade formula this pass (everything's flat 5% — a no-op). Shipped on main alongside PC-DEC-050 (migration 20260918120000_crit_strikes.sql, engine.js, api/combat/[...path].js, js/admin-app.js, js/run-equip-app.js, tests/crit-strikes.test.js). Applied to: weapon-generation.md, combat-system.md, current-design-status.md. Decided by Spahrep, 2026-09-18.

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
