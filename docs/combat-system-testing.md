# Combat System Testing

**Purpose:** Master reference document for all combat system testing. This defines the standard procedure, existential checks, and flow for every combat test run on portalcolosseum.com. All combat testing follows this document — no ad-hoc smoke tests.

**Related docs:**
- `docs/attack-queue-animation-testing.md` — queue-specific animation/rendering checks
- `docs/action-visual-lifecycle.md` — Master Clock model and queue lifecycle specification
- `docs/combat-engine-plan.md` — engine architecture

---

## 0. Test Environment

- **Site:** https://portalcolosseum.com (LIVE — no local testing)
- **Test account:** hermes-playtest (or as provided)
- **Portal:** Any unlocked portal with at least 1 battle (Portal 1 recommended)
- **Browser:** Firefox (per Spahrep)
- **Test runs:** Use a throwaway run. End Run after each test session.

---

## 1. Existential Checks (Every Tick, Every Phase)

These MUST pass at every step. If any fails, the battle is stuck — stop, report, do not continue.

### 1.1 Monster Panel
- [ ] Not "No monsters present"
- [ ] At least one monster card visible
- [ ] Monster has an HP label (Healthy / Wounded / Critical)
- [ ] Monster card has a name matching the encounter

### 1.2 Player HP
- [ ] Shows a number (e.g. "HP: 1000"), not "—"
- [ ] HP bar fill width is > 0%
- [ ] HP never exceeds max_hp (overheal cap)

### 1.3 Action Queue
- [ ] Queue has entries (≥1)
- [ ] Each entry shows a label and tic count (or "—" for ready tokens)
- [ ] No entry shows "undefined", "null", or empty text
- [ ] Queue reflows when entries change (no broken layout)

### 1.4 Action Menu
- [ ] When a hand is Ready, the action menu displays options (Attack, Use Potion, Swap, Belt items)
- [ ] "No hand ready" is acceptable ONLY if both hands are winding/cooldown AND monsters are still present
- [ ] Cascade menus work: selecting Attack → shows targets → shows confirm
- [ ] Keyboard navigation works (arrow keys, Enter, Escape)

### 1.5 Message Log
- [ ] Contains narration text (may be in-progress typewriter)
- [ ] Each tick produces at least one narration line
- [ ] No empty or error-looking lines

### 1.6 Loadout
- [ ] Weapon names display (not "—")
- [ ] LH weapon, RH weapon, and Belt weapon all show (or "Empty" / "—" if slot is empty)
- [ ] Loadout persists after page reload

### 1.7 Dice Display
- [ ] Dice panel shows remaining/used counts for green/yellow/red dice
- [ ] If a die is drawn for the current battle, its face value is visible
- [ ] Dice data updates between battles

### 1.8 Potions
- [ ] Potion A and B are visible in the UI (or "Empty" if none equipped)
- [ ] Used potions show "(used)" status
- [ ] Potion labels show effect type + value range (e.g. "Heal: 30-45")

---

## 2. Full Combat Flow

### 2.1 Login & Portal Entry
- [ ] portalcolosseum.com loads the town screen
- [ ] AP, gold, and location markers render
- [ ] Enter The Portal button works
- [ ] Portal selection screen shows available portals
- [ ] Selected portal loads run-equip screen

### 2.2 Equipment
- [ ] LH, RH, and Belt weapons show correct names and stats
- [ ] Backpack items load
- [ ] ENTER PORTAL button works (costs AP)

### 2.2a Pre-Run Potion Equipment
Before entering the portal, the test account must have a **heal potion** and a **speed potion** in the backpack for in-battle potion testing.

- [ ] Backpack contains at least one Heal potion (consumable with effect_type 'heal')
- [ ] Backpack contains at least one Speed potion (consumable with effect_type 'buff' that affects speed)
- [ ] Equip Heal potion to Potion A slot on the run-equip screen
- [ ] Equip Speed potion to Potion B slot on the run-equip screen
- [ ] Both potions show in the battle UI loadout when the battle starts
- [ ] Both potions show their effect label (e.g. "Heal: 30-45")

**If potions are not available in inventory:** Note this as a test blocker — potion testing is a required phase of every combat test pass.

### 2.3 Battle Load
- [ ] Battle header: "BATTLE N OF 5 — TIC X" renders
- [ ] ALL existential checks pass (§1)
- [ ] Queue entries match: hands (approach rows) + monsters (attack rows)
- [ ] Dice display reflects drawn die for the battle
- [ ] Typewriter (if ceremony plays) shows countdown 5... 3... 1...

### 2.4 First Attack Commit

1. **Select action:**
   - [ ] L.HAND or R.HAND options appear in the action menu
   - [ ] Attack submenu lists available attacks for the selected hand
2. **Target selection:**
   - [ ] Monster targets are listed and selectable
3. **Confirm:**
   - [ ] Confirmation dialog shows attack summary
   - [ ] Confirming returns "Yes" / commit proceeds
4. **Post-commit:**
   - [ ] Message log shows "tic N — LH prepares a [Attack Name]..."
   - [ ] Queue shows L. Hand [Attack Name] with tic countdown and timing bar
   - [ ] ALL existential checks still pass (§1)
   - [ ] Monsters still present and visible
   - [ ] Player HP still shows numeric value
   - [ ] The other hand is still in its queue position (Ready, or its own state)

### 2.5 Attack Resolution

1. **Winding:** Attack tick counts down toward zero
2. **Impact:** When winding reaches 0:
   - [ ] Narration: "LH [Attack Name] hits [Monster] for X damage!"
   - [ ] Monster HP bar depletes
   - [ ] If damage is 0: shows "misses" narration (accuracy miss)
   - [ ] If critical: narration includes "CRITICAL!"
3. **Cooldown:** After impact, a cooldown row appears
4. **Ready:** After cooldown, the hand returns to Ready
5. [ ] ALL existential checks pass at every phase (§1)

### 2.6 Multiple Attacks

- [ ] Player can make 2+ attacks in sequence
- [ ] After attack resolves, the hand goes Ready and can attack again
- [ ] Other hand can attack while first hand is winding/cooldown
- [ ] Queue state is consistent across multiple attack cycles
- [ ] ALL existential checks pass after each attack (§1)

### 2.7 Monster Death & Queue Purge

When a monster's HP reaches 0:

1. **Death trigger:**
   - [ ] Damage narration executes normally (shows the killing blow)
   - [ ] Monster card shows death animation (CSS `.monster-dying` class applied)
   - [ ] Monster card remains in DOM briefly for death animation, then sweeps clean

2. **Queue purge of dead monster's attacks:**
   - [ ] Any pending attack rows belonging to the dead monster are removed from the queue
   - [ ] If the dead monster had a `ready` token at the top of the queue, it is immediately removed (no AI roll occurs)
   - [ ] No "ghost" rows remain referencing the dead monster
   - [ ] Remaining queue entries reflow correctly (no gap, no broken layout)

3. **PC-68: Cancel queued player attacks on dead target:**
   - [ ] If a player hand has a winding attack targeting the monster that just died, that winding attack transitions to cooldown (not impact)
   - [ ] Narration: "RH attack cancelled — target already defeated"
   - [ ] After cooldown resolves, the hand returns to Ready normally

4. **Multiple monsters remaining:**
   - [ ] If other monsters are still alive, the battle continues
   - [ ] No error state from the partial wipe
   - [ ] Queue correctly shows remaining monsters' attacks

5. **Last monster dies:**
   - [ ] When all monsters are dead, `battle_over` flag is set
   - [ ] "All monsters defeated" or equivalent message appears
   - [ ] Queue drains to empty
   - [ ] Advance UI appears (Continue / Stop) — see §2.8

6. [ ] ALL existential checks (§1) pass at every phase of monster death

### 2.8 Battle Completion (Win)

When all monsters are defeated and the battle is won:

1. **Advance UI appears:**
   - [ ] "Continue to next battle" and "Retire run" options are visible
   - [ ] Continue button is labeled with the next battle number (e.g. "BATTLE 2/5")
   - [ ] Retire run button clearly states it ends the run and collects loot
   - [ ] Keyboard navigation works (arrow to select, Enter to confirm)

2. **Continue to next battle:**
   - [ ] Clicking Continue → loads next battle with fresh monsters
   - [ ] New battle header shows correct BATTLE N+1 OF 5
   - [ ] Dice rolls for the new battle
   - [ ] Fresh monster cards render
   - [ ] Queue populates with new approach/attack rows
   - [ ] Player HP is at full (healed between battles)
   - [ ] ALL existential checks pass for the new battle (§1)

3. **Final battle (N of N):**
   - [ ] After final battle, advance shows "Run Complete" instead of Continue
   - [ ] Loot summary appears with gold earned and items found
   - [ ] LP and any loot items are displayed
   - [ ] Return to town button works

4. **Retire run (mid-run):**
   - [ ] Clicking Retire Run ends the run
   - [ ] Loot accumulated so far is awarded
   - [ ] Return to town works with no stuck state

5. **Potions are consumed correctly on win:**
   - [ ] Any potions used during the battle show "(used)" status after the battle
   - [ ] Returning to town and checking inventory confirms the potion consumable was consumed

6. [ ] ALL existential checks (§1) pass at every phase of battle completion

### 2.8a Player Death (Loss Screen)

When the player's HP reaches 0:

1. **Death trigger:**
   - [ ] Monster attack that kills the player resolves normally (narration + damage numbers)
   - [ ] Player HP bar depletes to 0 or near-0
   - [ ] "You have been defeated" or equivalent loss message appears in the message log
   - [ ] Player death animation / effect plays

2. **Loss screen (`showLossScreen`):**
   - [ ] After the killing blow resolves, the loss panel replaces the UI (NOT the win advanceUI)
   - [ ] Panel displays a defeat message, not "Battle complete. Monsters defeated."
   - [ ] "Return to Town" button is present
   - [ ] The run is ended server-side (fire-and-forget `battle/end {choice: stop}`)
   - [ ] Clicking Return to Town navigates to `/game.html`

3. **Post-loss state:**
   - [ ] The server run status is set to `dead` (not `abandoned`)
   - [ ] Prize pool weapons are forfeited (deleted from weapon_instance)
   - [ ] Loot earned up to that point is discarded

### 2.9 Potion Use & Consumption

1. Select "Use Potion" from the action menu
2. Choose potion A (Heal potion) — test with the equipped heal potion
3. [ ] Message log shows "[hand] drinks [Potion Name]..."
4. [ ] Queue shows drinking row with tic count
5. [ ] After drinking, heal effect applies — player HP increases by the expected amount
6. [ ] Used potion slot shows "(used)" status in the loadout
7. [ ] ALL existential checks pass (§1)

8. Test potion B (Speed potion):
   - [ ] Select and use the speed potion on a subsequent Ready turn
   - [ ] Message log shows buff application
   - [ ] Buff is active (damage/speed/accuracy modifier applied to next attack)
   - [ ] Speed potion slot shows "(used)" status

9. **Potion consumption confirmation:**
   - [ ] After the potion resolves, the run's `consume_a_used` or `consume_b_used` flag is set to `true`
   - [ ] Attempting to use the same potion slot again returns error: "Potion already used"
   - [ ] Between battles (win → next battle), used potion slots remain flagged — no re-drinking
   - [ ] Potion instances in the DB are NOT deleted; the flag is the source of truth

10. **Potion edge cases:**
    - [ ] Attempting to use an already-used potion slot shows an error
    - [ ] No queue corruption from the error
    - [ ] If no potion is equipped in a slot, selecting it shows appropriate message

### 2.10 Weapon Swap

1. Select "Swap" from the action menu
2. [ ] Message log: "Belt swap ([hand]) — cooldown N tics"
3. [ ] Queue shows cooldown row
4. [ ] After cooldown, hand is Ready with swapped weapon
5. [ ] Loadout reflects the weapon change
6. [ ] ALL existential checks pass (§1)

### 2.11 End Run

- [ ] End Run button opens confirmation dialog
- [ ] Typing "End Run" and confirming returns to town
- [ ] No stuck dialogs or error states
- [ ] AP/gold updated appropriately

---

## 3. Page Reload / Resume Testing

### 3.1 Mid-Battle Reload

1. Start a battle
2. Commit an attack (winding state)
3. Reload the page (`window.location.reload()`)
4. [ ] Battle resumes at current state
5. [ ] Queue reflects the in-progress winding attack
6. [ ] Monsters still present with correct HP
7. [ ] Player HP preserved
8. [ ] Action menu appears when a hand is Ready
9. [ ] ALL existential checks pass (§1)

### 3.2 Mid-Battle Reload After Impact

1. Let an attack land (monster HP reduced)
2. Reload
3. [ ] Monster HP shows the reduced value
4. [ ] Queue shows correct state (cooldown for the attacking hand)
5. [ ] Player can continue the battle normally

---

## 4. Error States & Edge Cases

### 4.1 Hand Not Ready

- [ ] Committing an attack when the hand is not Ready shows an error
- [ ] No queue corruption from the error
- [ ] Action menu correctly shows which hands are Ready

### 4.2 All Monsters Dead

- [ ] Attack that kills the last monster resolves normally
- [ ] Death animation plays
- [ ] Advance UI appears
- [ ] No stuck queue entries after monsters die

### 4.3 Player Death

- [ ] Monster attack brings player HP to 0
- [ ] "You have been defeated" message appears
- [ ] Run ends as "dead" / abandoned
- [ ] Return to town works

### 4.4 Battle-over Monsters (PC-68 Cancel)

- [ ] If a player attack is winding and all targets die before it fires:
- [ ] The winding attack is cancelled (cooldown instead of impact)
- [ ] Narration says attack was cancelled
- [ ] No impact damage is applied

---

## 5. Queue Animation Checks (Human-Eye Required)

These checks are in `docs/attack-queue-animation-testing.md`. Run that document separately whenever queue rendering or animation code changes.

Quick cross-reference:
- [ ] Queue item entry/exit animations play smoothly
- [ ] Timing bars fill correctly
- [ ] Typewriter syncs with queue position
- [ ] Ready tokens surface with no lag
- [ ] Monster death animations play

---

## 6. Bug Report Template

When a test finds a failure, report:

```
**Step:** [step number / description]
**Phase:** [initial load / post-commit / post-tick / post-kill / page-reload]
**Check failed:** [which existential check (§1.x) or flow step (§2.x)]
**Expected:** [what should happen]
**Actual:** [what actually happened — paste rendered DOM state]
**API response (if relevant):** [paste the failing API response]
**Repro:** [steps to reproduce]
**Browser state:** [page URL, run ID, battle number, visible errors in console]
```

---

## 7. Test Pass Criteria

A combat test pass is:
- All existential checks (§1) pass at every phase
- All flow steps (§2) complete without error
- No console errors during the test
- Page reload (§3) preserves state correctly
- All queue animation checks (§5 in related doc) pass on visual review

A test is BLOCKED if any existential check fails. Do not continue past a failed existential check — stop, report per §6, and fix before retrying.

---

## 8. Version History

| Date | Change |
|------|--------|
| 2026-09-23 | Created from combat-smoke-test skill protocol + live test findings |