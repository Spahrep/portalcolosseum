# CODEMAP

Symbol index for Portal Colosseum JavaScript. Grep a name; do not read this file whole.

Do not edit line numbers by hand. Regenerate (overwrites this file):

```bash
node scripts/generate-codemap.mjs
```

Scanned `.js` files under `js/`, `api/`, `lib/`, and `public/test/cli/`.
Skipped directories: `node_modules`, `.git`, `.worktrees`, `.vercel`, `tests/`.
Bracket filenames (`api/combat/[...path].js`) are literal paths, not globs.

- Files: 60
- Symbols: 621 (220 export, 401 local)

`visibility` is `export` or `local`. Kinds: `function`, `async function`, `class`, `const` (a `*` suffix marks a generator).
Included: function declarations at any indent (including named function expressions), classes (exported or not), and exported consts whose value is a function, arrow, object, or array (including `Object.freeze` / `Object.seal` of those).
Omitted: scalar constants (strings, numbers, booleans), re-exports (`export { … }` / `export default name`), and class methods — open the class line.

## Files

| file | symbols | exports |
|---|---:|---:|
| `api/admin/[...path].js` | 18 | 6 |
| `api/build.js` | 2 | 1 |
| `api/combat/[...path].js` | 26 | 12 |
| `api/combat/dev/[...path].js` | 15 | 7 |
| `api/config.js` | 3 | 2 |
| `api/env.js` | 0 | 0 |
| `api/session.js` | 10 | 4 |
| `api/user/profile.js` | 6 | 3 |
| `js/admin-app.js` | 41 | 0 |
| `js/auth-helpers.js` | 5 | 5 |
| `js/battle-app.js` | 77 | 0 |
| `js/battle-debug.js` | 3 | 1 |
| `js/battle/action-menu-rows.js` | 4 | 4 |
| `js/battle/arena-letters.js` | 5 | 4 |
| `js/battle/dice-render.js` | 8 | 5 |
| `js/battle/feed-render.js` | 22 | 14 |
| `js/battle/feed-skip.js` | 1 | 1 |
| `js/battle/intro-countdown.js` | 2 | 2 |
| `js/battle/monster-render.js` | 19 | 2 |
| `js/battle/potion-target.js` | 1 | 1 |
| `js/battle/queue-render.js` | 26 | 15 |
| `js/battle/text-speed.js` | 3 | 3 |
| `js/battle/ux-controller.js` | 9 | 7 |
| `js/combat/buffs.js` | 2 | 2 |
| `js/combat/combat-api.js` | 3 | 3 |
| `js/combat/damage.js` | 4 | 4 |
| `js/combat/dice.js` | 3 | 3 |
| `js/combat/engine.js` | 44 | 3 |
| `js/combat/hit-feedback.js` | 3 | 3 |
| `js/combat/hp-words.js` | 2 | 2 |
| `js/combat/loot.js` | 3 | 3 |
| `js/combat/participants.js` | 6 | 6 |
| `js/combat/potion-contract.js` | 8 | 8 |
| `js/combat/potion-effects.js` | 3 | 2 |
| `js/combat/tic-queue.js` | 13 | 9 |
| `js/game-app.js` | 17 | 0 |
| `js/landing-app.js` | 0 | 0 |
| `js/login-app.js` | 5 | 0 |
| `js/mobile-app.js` | 3 | 0 |
| `js/portal-select-app.js` | 8 | 0 |
| `js/pure-utils.js` | 2 | 2 |
| `js/reset-password-app.js` | 3 | 0 |
| `js/run-equip-app.js` | 42 | 0 |
| `js/session.js` | 7 | 7 |
| `js/settings-controller.js` | 18 | 14 |
| `js/settings-menu.js` | 12 | 12 |
| `js/signup-app.js` | 6 | 0 |
| `js/town-url.js` | 1 | 0 |
| `js/utils.js` | 1 | 1 |
| `lib/combat-http.js` | 9 | 9 |
| `lib/combat-run.js` | 5 | 5 |
| `public/test/cli/cli-app.js` | 33 | 0 |
| `public/test/cli/command-history.js` | 5 | 1 |
| `public/test/cli/commands-dev.js` | 14 | 1 |
| `public/test/cli/commands-inventory.js` | 2 | 1 |
| `public/test/cli/feed-narration.js` | 2 | 1 |
| `public/test/cli/panel-nav.js` | 6 | 1 |
| `public/test/cli/queue-labels.js` | 3 | 3 |
| `public/test/cli/side-panels.js` | 11 | 9 |
| `public/test/cli/text-builders.js` | 6 | 6 |

## Symbols

| file | line | visibility | kind | name |
|---|---:|---|---|---|
| `api/admin/[...path].js` | 68 | local | function | `json` |
| `api/admin/[...path].js` | 72 | local | function | `getAdminClient` |
| `api/admin/[...path].js` | 81 | local | async function | `verifyAdmin` |
| `api/admin/[...path].js` | 101 | local | async function | `getBody` |
| `api/admin/[...path].js` | 108 | local | async function | `crudSubresource` |
| `api/admin/[...path].js` | 169 | local | async function | `checkAttackDeleteBlockers` |
| `api/admin/[...path].js` | 186 | local | async function | `checkWeaponTemplateDeleteBlockers` |
| `api/admin/[...path].js` | 195 | local | async function | `checkMonsterTemplateDeleteBlockers` |
| `api/admin/[...path].js` | 204 | local | async function | `checkPortalTemplateDeleteBlockers` |
| `api/admin/[...path].js` | 213 | local | async function | `checkConsumableTemplateDeleteBlockers` |
| `api/admin/[...path].js` | 220 | local | function | `validateConsumableTemplate` |
| `api/admin/[...path].js` | 242 | export | async function | `OPTIONS` |
| `api/admin/[...path].js` | 246 | export | async function | `GET` |
| `api/admin/[...path].js` | 247 | export | async function | `POST` |
| `api/admin/[...path].js` | 248 | export | async function | `PUT` |
| `api/admin/[...path].js` | 249 | export | async function | `PATCH` |
| `api/admin/[...path].js` | 250 | export | async function | `DELETE` |
| `api/admin/[...path].js` | 252 | local | async function | `handle` |
| `api/build.js` | 17 | local | function | `json` |
| `api/build.js` | 21 | export | async function | `GET` |
| `api/combat/[...path].js` | 40 | local | function | `rollStat` |
| `api/combat/[...path].js` | 54 | export | function | `rollMultiplier` |
| `api/combat/[...path].js` | 70 | export | function | `monstersForLoot` |
| `api/combat/[...path].js` | 76 | export | function | `entryCosts` |
| `api/combat/[...path].js` | 88 | export | async function | `chargeRunEntry` |
| `api/combat/[...path].js` | 119 | export | async function | `refundRunEntry` |
| `api/combat/[...path].js` | 142 | export | function | `grantedSlotAttackIds` |
| `api/combat/[...path].js` | 157 | local | function | `shapeMenuAttack` |
| `api/combat/[...path].js` | 173 | local | async function | `loadGrantedAttacks` |
| `api/combat/[...path].js` | 188 | local | function | `attacksOf` |
| `api/combat/[...path].js` | 196 | local | function | `commitSnapshot` |
| `api/combat/[...path].js` | 220 | local | async function | `startingHp` |
| `api/combat/[...path].js` | 224 | local | function | `computeStopShare` |
| `api/combat/[...path].js` | 251 | local | async function | `handle` |
| `api/combat/[...path].js` | 275 | local | async function | `generateOneMonster` |
| `api/combat/[...path].js` | 558 | local | function | `weaponInfo` |
| `api/combat/[...path].js` | 585 | local | async function | `potionInfo` |
| `api/combat/[...path].js` | 1503 | local | async function | `findActiveRun` |
| `api/combat/[...path].js` | 1512 | local | async function | `handApproachSpeeds` |
| `api/combat/[...path].js` | 1516 | local | async function | `buildPotionLoadout` |
| `api/combat/[...path].js` | 1537 | export | async function | `OPTIONS` |
| `api/combat/[...path].js` | 1540 | export | async function | `GET` |
| `api/combat/[...path].js` | 1541 | export | async function | `POST` |
| `api/combat/[...path].js` | 1542 | export | async function | `PUT` |
| `api/combat/[...path].js` | 1543 | export | async function | `PATCH` |
| `api/combat/[...path].js` | 1544 | export | async function | `DELETE` |
| `api/combat/dev/[...path].js` | 22 | export | async function | `handleCombatDev` |
| `api/combat/dev/[...path].js` | 23 | local | async function | `generateOneMonster` |
| `api/combat/dev/[...path].js` | 26 | local | async function | `findActiveRun` |
| `api/combat/dev/[...path].js` | 29 | local | async function | `handApproachSpeeds` |
| `api/combat/dev/[...path].js` | 32 | local | async function | `buildPotionLoadout` |
| `api/combat/dev/[...path].js` | 36 | local | async function | `createAndEquipWeapon` |
| `api/combat/dev/[...path].js` | 82 | local | async function | `rebuildBattleState` |
| `api/combat/dev/[...path].js` | 646 | local | function | `rollConsumableForCaller` |
| `api/combat/dev/[...path].js` | 819 | local | async function | `devHttp` |
| `api/combat/dev/[...path].js` | 832 | export | async function | `OPTIONS` |
| `api/combat/dev/[...path].js` | 835 | export | async function | `GET` |
| `api/combat/dev/[...path].js` | 836 | export | async function | `POST` |
| `api/combat/dev/[...path].js` | 837 | export | async function | `PUT` |
| `api/combat/dev/[...path].js` | 838 | export | async function | `PATCH` |
| `api/combat/dev/[...path].js` | 839 | export | async function | `DELETE` |
| `api/config.js` | 17 | local | function | `json` |
| `api/config.js` | 21 | export | async function | `GET` |
| `api/config.js` | 52 | export | async function | `OPTIONS` |
| `api/session.js` | 47 | local | function | `checkRateLimit` |
| `api/session.js` | 56 | local | function | `getSupabaseAdmin` |
| `api/session.js` | 78 | local | function | `buildCookie` |
| `api/session.js` | 82 | local | function | `clearCookie` |
| `api/session.js` | 89 | local | function | `getCookie` |
| `api/session.js` | 100 | local | async function | `exchangeRefreshToken` |
| `api/session.js` | 126 | export | function | `OPTIONS` |
| `api/session.js` | 133 | export | async function | `GET` |
| `api/session.js` | 189 | export | async function | `POST` |
| `api/session.js` | 241 | export | function | `DELETE` |
| `api/user/profile.js` | 22 | local | function | `json` |
| `api/user/profile.js` | 26 | local | function | `getAdminClient` |
| `api/user/profile.js` | 35 | local | async function | `verifyUser` |
| `api/user/profile.js` | 46 | export | function | `OPTIONS` |
| `api/user/profile.js` | 53 | export | async function | `GET` |
| `api/user/profile.js` | 78 | export | async function | `PATCH` |
| `js/admin-app.js` | 25 | local | function | `initSupabase` |
| `js/admin-app.js` | 29 | local | async function | `getToken` |
| `js/admin-app.js` | 34 | local | async function | `apiCall` |
| `js/admin-app.js` | 57 | local | async function | `checkAdminSession` |
| `js/admin-app.js` | 99 | local | function | `showLoginGate` |
| `js/admin-app.js` | 104 | local | function | `showAccessDenied` |
| `js/admin-app.js` | 110 | local | function | `showDashboard` |
| `js/admin-app.js` | 116 | local | function | `setupOAuthButtons` |
| `js/admin-app.js` | 133 | local | function | `setupTabs` |
| `js/admin-app.js` | 145 | local | async function | `loadTab` |
| `js/admin-app.js` | 178 | local | async function | `saveResource` |
| `js/admin-app.js` | 199 | local | async function | `deleteResource` |
| `js/admin-app.js` | 213 | local | function | `wireRowActions` |
| `js/admin-app.js` | 225 | local | async function | `renderAttacks` |
| `js/admin-app.js` | 267 | local | function | `showAttackForm` |
| `js/admin-app.js` | 300 | local | function | `updateBandPreview` |
| `js/admin-app.js` | 333 | local | async function | `deleteAttack` |
| `js/admin-app.js` | 341 | local | async function | `renderWeaponTemplates` |
| `js/admin-app.js` | 382 | local | function | `showWeaponTemplateForm` |
| `js/admin-app.js` | 439 | local | async function | `deleteWeaponTemplate` |
| `js/admin-app.js` | 453 | local | async function | `renderMappingEditor` |
| `js/admin-app.js` | 467 | local | function | `buildSlotMappingEditorHtml` |
| `js/admin-app.js` | 510 | local | function | `buildPoolMappingEditorHtml` |
| `js/admin-app.js` | 557 | local | function | `wireMappingEditor` |
| `js/admin-app.js` | 647 | local | async function | `showWeaponMappingEditor` |
| `js/admin-app.js` | 710 | local | async function | `renderMonsterTemplates` |
| `js/admin-app.js` | 753 | local | function | `showMonsterTemplateForm` |
| `js/admin-app.js` | 813 | local | async function | `deleteMonsterTemplate` |
| `js/admin-app.js` | 821 | local | async function | `showMonsterMappingEditor` |
| `js/admin-app.js` | 882 | local | async function | `showMonsterLootMappingEditor` |
| `js/admin-app.js` | 944 | local | async function | `renderPortalTemplates` |
| `js/admin-app.js` | 983 | local | function | `showPortalTemplateForm` |
| `js/admin-app.js` | 1032 | local | async function | `deletePortalTemplate` |
| `js/admin-app.js` | 1040 | local | async function | `showPortalMonsterMappingEditor` |
| `js/admin-app.js` | 1102 | local | async function | `showPortalLootMappingEditor` |
| `js/admin-app.js` | 1164 | local | async function | `renderConsumableTemplates` |
| `js/admin-app.js` | 1202 | local | function | `showConsumableTemplateForm` |
| `js/admin-app.js` | 1242 | local | function | `updatePreview` |
| `js/admin-app.js` | 1287 | local | async function | `deleteConsumableTemplate` |
| `js/admin-app.js` | 1295 | local | function | `esc` |
| `js/admin-app.js` | 1302 | local | function | `val` |
| `js/auth-helpers.js` | 22 | export | function | `showMessage` |
| `js/auth-helpers.js` | 60 | export | async function | `signInWithProvider` |
| `js/auth-helpers.js` | 100 | export | function | `validatePassword` |
| `js/auth-helpers.js` | 113 | export | function | `getInviteVerifyUrl` |
| `js/auth-helpers.js` | 128 | export | async function | `verifyInviteKey` |
| `js/battle-app.js` | 75 | local | class | `BattleClock` |
| `js/battle-app.js` | 179 | local | function | `sleep` |
| `js/battle-app.js` | 190 | local | function | `waitForEvent` |
| `js/battle-app.js` | 225 | local | async function | `runQueueRemoval` |
| `js/battle-app.js` | 242 | local | async function | `groupLiftRemaining` |
| `js/battle-app.js` | 307 | local | function | `onActionMenuMouseMove` |
| `js/battle-app.js` | 312 | local | function | `bindActionMenuRowInput` |
| `js/battle-app.js` | 319 | local | function | `onActionMenuKeyDown` |
| `js/battle-app.js` | 348 | local | function | `enterMasterClock` |
| `js/battle-app.js` | 349 | local | function | `leaveMasterClock` |
| `js/battle-app.js` | 351 | local | function | `prefersReducedMotion` |
| `js/battle-app.js` | 356 | local | function | `animationsSkipped` |
| `js/battle-app.js` | 361 | local | function | `findQueueRowByIdentity` |
| `js/battle-app.js` | 374 | local | function | `findReadyCommits` |
| `js/battle-app.js` | 385 | local | function | `pinProcessedHead` |
| `js/battle-app.js` | 400 | local | function | `silentPopHead` |
| `js/battle-app.js` | 422 | local | function | `reseatSameKeySuccessor` |
| `js/battle-app.js` | 452 | local | async function | `releaseProcessedHead` |
| `js/battle-app.js` | 485 | local | function | `measuredRowHeight` |
| `js/battle-app.js` | 492 | local | function | `domRowIsPlayer` |
| `js/battle-app.js` | 500 | local | function | `insertIndexFor` |
| `js/battle-app.js` | 531 | local | async function | `openInsertGap` |
| `js/battle-app.js` | 548 | local | async function | `playInsertMarker` |
| `js/battle-app.js` | 566 | local | async function | `playInsertCeremony` |
| `js/battle-app.js` | 604 | local | async function | `playQueueTransition` |
| `js/battle-app.js` | 635 | local | async function | `awaitTickVisuals` |
| `js/battle-app.js` | 663 | local | async function | `playCommitArrival` |
| `js/battle-app.js` | 727 | local | function | `showMessage` |
| `js/battle-app.js` | 737 | local | function | `showErrorState` |
| `js/battle-app.js` | 757 | local | function | `showSessionExpired` |
| `js/battle-app.js` | 777 | local | function | `setBusy` |
| `js/battle-app.js` | 794 | local | function | `finishBattleIntro` |
| `js/battle-app.js` | 846 | local | function | `readyHeadOf` |
| `js/battle-app.js` | 853 | local | function | `introSeenKey` |
| `js/battle-app.js` | 857 | local | function | `introAlreadySeen` |
| `js/battle-app.js` | 861 | local | function | `markIntroSeen` |
| `js/battle-app.js` | 865 | local | function | `renderPlayerHP` |
| `js/battle-app.js` | 890 | local | function | `renderLoadout` |
| `js/battle-app.js` | 903 | local | function | `beginAfterIntro` |
| `js/battle-app.js` | 926 | local | function | `playThreeTwoOne` |
| `js/battle-app.js` | 949 | local | function | `playIntroCountdown` |
| `js/battle-app.js` | 958 | local | function | `setIntroTicLabel` |
| `js/battle-app.js` | 963 | local | function | `clearIntroTimer` |
| `js/battle-app.js` | 971 | local | function | `finishIntroSnap` |
| `js/battle-app.js` | 998 | local | function | `ensureAdvanceOverlayStyles` |
| `js/battle-app.js` | 1150 | local | function | `mountOverlay` |
| `js/battle-app.js` | 1158 | local | function | `showAdvanceUI` |
| `js/battle-app.js` | 1178 | local | function | `mountAdvanceOverlay` |
| `js/battle-app.js` | 1217 | local | function | `renderLootChoices` |
| `js/battle-app.js` | 1295 | local | async function | `extractAndLeave` |
| `js/battle-app.js` | 1318 | local | function | `revealRandomLoot` |
| `js/battle-app.js` | 1342 | local | function | `orderedLootIds` |
| `js/battle-app.js` | 1357 | local | function | `confirmSelectedLoot` |
| `js/battle-app.js` | 1366 | local | function | `mountLootRoulette` |
| `js/battle-app.js` | 1386 | local | function | `sweepLootPicks` |
| `js/battle-app.js` | 1401 | local | function | `showExtractionSummary` |
| `js/battle-app.js` | 1417 | local | async function | `fightOn` |
| `js/battle-app.js` | 1441 | local | function | `showLossScreen` |
| `js/battle-app.js` | 1483 | local | async function | `commitThenTick` |
| `js/battle-app.js` | 1505 | local | async function | `doAttack` |
| `js/battle-app.js` | 1525 | local | async function | `doSwap` |
| `js/battle-app.js` | 1556 | local | function | `renderActionMenu` |
| `js/battle-app.js` | 1595 | local | function | `setMarkers` |
| `js/battle-app.js` | 1600 | local | function | `clearMarkers` |
| `js/battle-app.js` | 1617 | local | function | `yesNoRows` |
| `js/battle-app.js` | 1624 | local | function | `back` |
| `js/battle-app.js` | 1635 | local | function | `pickTarget` |
| `js/battle-app.js` | 1663 | local | function | `pickPotion` |
| `js/battle-app.js` | 1679 | local | function | `pickEquip` |
| `js/battle-app.js` | 1688 | local | function | `selectTop` |
| `js/battle-app.js` | 1722 | local | function | `renderStack` |
| `js/battle-app.js` | 1789 | local | function | `paintReadout` |
| `js/battle-app.js` | 1843 | local | async function | `usePotion` |
| `js/battle-app.js` | 1856 | local | async function | `loadBattle` |
| `js/battle-app.js` | 2016 | local | function | `setupEndRunButton` |
| `js/battle-app.js` | 2059 | local | async function | `init` |
| `js/battle-app.js` | 2140 | local | async function | `advance` |
| `js/battle-debug.js` | 60 | local | function | `createDebugLog` |
| `js/battle-debug.js` | 149 | local | function | `debugLog` |
| `js/battle-debug.js` | 181 | export | function | `debugLog` |
| `js/battle/action-menu-rows.js` | 12 | export | function | `potionFor` |
| `js/battle/action-menu-rows.js` | 16 | export | function | `showInfo` |
| `js/battle/action-menu-rows.js` | 25 | export | function | `attackInfo` |
| `js/battle/action-menu-rows.js` | 54 | export | function | `buildRootActionRows` |
| `js/battle/arena-letters.js` | 12 | export | function | `arenaLetterFromLabel` |
| `js/battle/arena-letters.js` | 19 | local | function | `monsterKey` |
| `js/battle/arena-letters.js` | 31 | export | function | `assignArenaLetters` |
| `js/battle/arena-letters.js` | 60 | export | function | `letterForMonster` |
| `js/battle/arena-letters.js` | 67 | export | function | `targetCardLabel` |
| `js/battle/dice-render.js` | 15 | export | function | `bindDiceRender` |
| `js/battle/dice-render.js` | 38 | export | function | `renderDice` |
| `js/battle/dice-render.js` | 164 | export | function | `updateCurrentDie` |
| `js/battle/dice-render.js` | 172 | export | function | `performSweepAnimation` |
| `js/battle/dice-render.js` | 186 | local | function | `step` |
| `js/battle/dice-render.js` | 199 | local | function | `stepDelay` |
| `js/battle/dice-render.js` | 217 | export | function | `rollDiceAnimation` |
| `js/battle/dice-render.js` | 229 | local | function | `step` |
| `js/battle/feed-render.js` | 20 | export | function | `bindFeedRender` |
| `js/battle/feed-render.js` | 52 | export | function | `getRenderedFeedLines` |
| `js/battle/feed-render.js` | 53 | export | function | `setRenderedFeedLines` |
| `js/battle/feed-render.js` | 54 | export | function | `addRenderedFeedLines` |
| `js/battle/feed-render.js` | 55 | export | function | `isTypingInProgress` |
| `js/battle/feed-render.js` | 56 | export | function | `setFeedPinned` |
| `js/battle/feed-render.js` | 58 | export | function | `typeFeedLinesAsync` |
| `js/battle/feed-render.js` | 65 | export | async function | `awaitNarration` |
| `js/battle/feed-render.js` | 73 | export | function | `clearTyping` |
| `js/battle/feed-render.js` | 90 | local | function | `cancelTypingTimers` |
| `js/battle/feed-render.js` | 95 | local | function | `finishTypingBatch` |
| `js/battle/feed-render.js` | 123 | local | function | `typeNextLine` |
| `js/battle/feed-render.js` | 181 | local | function | `typeSplitHit` |
| `js/battle/feed-render.js` | 217 | local | function | `stripTic` |
| `js/battle/feed-render.js` | 226 | local | function | `typeOneText` |
| `js/battle/feed-render.js` | 235 | local | function | `restartWithDump` |
| `js/battle/feed-render.js` | 242 | local | function | `typeChar` |
| `js/battle/feed-render.js` | 270 | export | function | `completeCurrentTypingLine` |
| `js/battle/feed-render.js` | 296 | export | function | `typeFeedLines` |
| `js/battle/feed-render.js` | 327 | export | function | `renderFeed` |
| `js/battle/feed-render.js` | 388 | export | function | `populateFeedInstantly` |
| `js/battle/feed-render.js` | 407 | export | function | `appendFeedLine` |
| `js/battle/feed-skip.js` | 9 | export | function | `nextTypingStateAfterClick` |
| `js/battle/intro-countdown.js` | 7 | export | const | `INTRO_COUNTDOWN_STEPS` |
| `js/battle/intro-countdown.js` | 9 | export | function | `shouldPlayIntroCountdown` |
| `js/battle/monster-render.js` | 16 | export | function | `setMonstersPendingReveal` |
| `js/battle/monster-render.js` | 24 | local | function | `bandClass` |
| `js/battle/monster-render.js` | 36 | export | function | `setSuppressHitFeedback` |
| `js/battle/monster-render.js` | 41 | local | function | `hitFeedbackBlocked` |
| `js/battle/monster-render.js` | 58 | local | function | `triggerWindowShake` |
| `js/battle/monster-render.js` | 69 | local | function | `triggerMonsterHit` |
| `js/battle/monster-render.js` | 90 | local | function | `triggerCritWindowShake` |
| `js/battle/monster-render.js` | 101 | local | function | `triggerCritMonsterHit` |
| `js/battle/monster-render.js` | 122 | local | function | `waitForHitAnimation` |
| `js/battle/monster-render.js` | 156 | local | function | `handleHitLine` |
| `js/battle/monster-render.js` | 178 | local | function | `handleDeferredHit` |
| `js/battle/monster-render.js` | 190 | local | function | `syncArenaLetters` |
| `js/battle/monster-render.js` | 195 | local | function | `arenaLetterOf` |
| `js/battle/monster-render.js` | 199 | local | function | `renderMonsters` |
| `js/battle/monster-render.js` | 256 | local | function | `buildMonsterCard` |
| `js/battle/monster-render.js` | 289 | local | function | `appendNoMonsters` |
| `js/battle/monster-render.js` | 297 | local | function | `finishDeath` |
| `js/battle/monster-render.js` | 317 | local | function | `hideForReveal` |
| `js/battle/monster-render.js` | 322 | local | function | `revealMonsters` |
| `js/battle/potion-target.js` | 8 | export | function | `potionCommitPayload` |
| `js/battle/queue-render.js` | 26 | export | function | `setQueueBarInfo` |
| `js/battle/queue-render.js` | 30 | export | function | `clearQueueBarInfo` |
| `js/battle/queue-render.js` | 34 | export | function | `isQueueRowExiting` |
| `js/battle/queue-render.js` | 39 | export | function | `forgetQueueRowExiting` |
| `js/battle/queue-render.js` | 48 | export | function | `queueRowKey` |
| `js/battle/queue-render.js` | 54 | local | function | `isMonsterLabel` |
| `js/battle/queue-render.js` | 59 | export | function | `isMonsterQueueRow` |
| `js/battle/queue-render.js` | 63 | local | function | `isMonsterCooldownRow` |
| `js/battle/queue-render.js` | 69 | local | function | `queueAnimationsSkipped` |
| `js/battle/queue-render.js` | 80 | export | function | `queueRowEnterClass` |
| `js/battle/queue-render.js` | 91 | export | function | `armQueueRowEnter` |
| `js/battle/queue-render.js` | 104 | local | function | `monsterQueueName` |
| `js/battle/queue-render.js` | 121 | local | function | `paintPredictionBar` |
| `js/battle/queue-render.js` | 138 | local | function | `yAtTics` |
| `js/battle/queue-render.js` | 205 | export | function | `renderQueue` |
| `js/battle/queue-render.js` | 324 | export | function | `diffQueueForAnimation` |
| `js/battle/queue-render.js` | 343 | local | function | `isReconciledQueueRow` |
| `js/battle/queue-render.js` | 352 | export | function | `clearQueueDom` |
| `js/battle/queue-render.js` | 383 | export | function | `markQueueRowExiting` |
| `js/battle/queue-render.js` | 407 | local | function | `queueRowDisplayLabel` |
| `js/battle/queue-render.js` | 424 | local | function | `playerRowTargetName` |
| `js/battle/queue-render.js` | 442 | export | function | `buildQueueRow` |
| `js/battle/queue-render.js` | 511 | export | function | `updateQueueRowInPlace` |
| `js/battle/queue-render.js` | 584 | export | function | `sortQueueRows` |
| `js/battle/queue-render.js` | 593 | local | function | `queueLabel` |
| `js/battle/queue-render.js` | 600 | local | function | `queueEventName` |
| `js/battle/text-speed.js` | 8 | export | const | `TEXT_SPEEDS` |
| `js/battle/text-speed.js` | 32 | export | const | `TEXT_SPEED_KEYS` |
| `js/battle/text-speed.js` | 35 | export | function | `normalizeSpeedKey` |
| `js/battle/ux-controller.js` | 21 | export | const | `TIMING` |
| `js/battle/ux-controller.js` | 68 | export | function | `dur` |
| `js/battle/ux-controller.js` | 77 | export | function | `screenshakeEnabled` |
| `js/battle/ux-controller.js` | 82 | export | function | `applyTimingScale` |
| `js/battle/ux-controller.js` | 98 | export | function | `bindUxController` |
| `js/battle/ux-controller.js` | 104 | local | function | `trackShake` |
| `js/battle/ux-controller.js` | 115 | export | function | `whenHitsSettled` |
| `js/battle/ux-controller.js` | 119 | local | function | `fireImpact` |
| `js/battle/ux-controller.js` | 145 | export | function | `playLandedHit` |
| `js/combat/buffs.js` | 4 | export | function | `createBuff` |
| `js/combat/buffs.js` | 8 | export | function | `applyBuffs` |
| `js/combat/combat-api.js` | 10 | export | function | `getAuthToken` |
| `js/combat/combat-api.js` | 30 | export | async function | `apiCall` |
| `js/combat/combat-api.js` | 53 | export | async function | `checkAuth` |
| `js/combat/damage.js` | 4 | export | function | `rollDamage` |
| `js/combat/damage.js` | 10 | export | function | `checkHit` |
| `js/combat/damage.js` | 14 | export | function | `multiTargetReduction` |
| `js/combat/damage.js` | 19 | export | function | `resolveAttack` |
| `js/combat/dice.js` | 11 | export | function | `drawRandomDie` |
| `js/combat/dice.js` | 17 | export | function | `rollDieFace` |
| `js/combat/dice.js` | 24 | export | function | `selectMonsterGroup` |
| `js/combat/engine.js` | 17 | local | function | `logLine` |
| `js/combat/engine.js` | 22 | local | function | `pickMonsterAttack` |
| `js/combat/engine.js` | 30 | local | function | `rollStat` |
| `js/combat/engine.js` | 41 | export | function | `rollMultiplier` |
| `js/combat/engine.js` | 50 | local | function | `monsterAttackByName` |
| `js/combat/engine.js` | 55 | local | function | `describeEffect` |
| `js/combat/engine.js` | 64 | local | function | `normalizePotion` |
| `js/combat/engine.js` | 69 | local | function | `battleIsOver` |
| `js/combat/engine.js` | 74 | local | function | `buildStateSnapshot` |
| `js/combat/engine.js` | 106 | local | function | `applyPotionWithCrit` |
| `js/combat/engine.js` | 125 | local | function | `applyTickCost` |
| `js/combat/engine.js` | 137 | local | function | `consumeReadyForHand` |
| `js/combat/engine.js` | 151 | local | function | `stampMonsterStrike` |
| `js/combat/engine.js` | 161 | local | function | `carryMonsterStrike` |
| `js/combat/engine.js` | 171 | local | function | `monsterStrikeLabel` |
| `js/combat/engine.js` | 179 | local | function | `queueNextMonsterAttack` |
| `js/combat/engine.js` | 192 | local | function | `markHandReady` |
| `js/combat/engine.js` | 199 | local | function | `handleHandFire` |
| `js/combat/engine.js` | 288 | local | function | `resolveMonsterImpact` |
| `js/combat/engine.js` | 327 | local | function | `handleMonsterFire` |
| `js/combat/engine.js` | 345 | local | function | `handleFire` |
| `js/combat/engine.js` | 365 | local | function | `fireAndExpireBuffs` |
| `js/combat/engine.js` | 371 | local | function | `peekPhase` |
| `js/combat/engine.js` | 375 | local | function | `processPhase` |
| `js/combat/engine.js` | 383 | local | function | `cleanupPhase` |
| `js/combat/engine.js` | 396 | local | function | `removePhase` |
| `js/combat/engine.js` | 400 | local | function | `commitAttackAction` |
| `js/combat/engine.js` | 431 | local | function | `commitPotionAction` |
| `js/combat/engine.js` | 487 | export | function | `createEngine` |
| `js/combat/engine.js` | 499 | local | function | `peek` |
| `js/combat/engine.js` | 503 | local | function | `process` |
| `js/combat/engine.js` | 507 | local | function | `cleanup` |
| `js/combat/engine.js` | 511 | local | function | `remove` |
| `js/combat/engine.js` | 519 | local | function | `tick` |
| `js/combat/engine.js` | 562 | local | function | `isBattleOver` |
| `js/combat/engine.js` | 566 | local | function | `commitAttack` |
| `js/combat/engine.js` | 570 | local | function | `startBattle` |
| `js/combat/engine.js` | 614 | local | function | `getState` |
| `js/combat/engine.js` | 621 | local | function | `getPersistedState` |
| `js/combat/engine.js` | 635 | local | function | `loadState` |
| `js/combat/engine.js` | 647 | local | function | `commitPotion` |
| `js/combat/engine.js` | 651 | local | function | `swapHandWithBelt` |
| `js/combat/engine.js` | 689 | local | function | `cancelQueuedAttacksOnDeadTargets` |
| `js/combat/engine.js` | 707 | export | function | `resumeEngine` |
| `js/combat/hit-feedback.js` | 30 | export | function | `parseHitLine` |
| `js/combat/hit-feedback.js` | 57 | export | function | `splitHitLine` |
| `js/combat/hit-feedback.js` | 94 | export | function | `arenaKey` |
| `js/combat/hp-words.js` | 4 | export | function | `getHpWord` |
| `js/combat/hp-words.js` | 13 | export | const | `HP_BANDS` |
| `js/combat/loot.js` | 10 | export | function | `normalInt` |
| `js/combat/loot.js` | 25 | export | function | `weightedPick` |
| `js/combat/loot.js` | 39 | export | function | `generateLoot` |
| `js/combat/participants.js` | 7 | export | function | `createPlayer` |
| `js/combat/participants.js` | 19 | export | function | `createMonster` |
| `js/combat/participants.js` | 41 | export | function | `isPlayerDead` |
| `js/combat/participants.js` | 46 | export | function | `isMonsterDead` |
| `js/combat/participants.js` | 50 | export | function | `applyDamage` |
| `js/combat/participants.js` | 62 | export | function | `swapHandWithBelt` |
| `js/combat/potion-contract.js` | 4 | export | const | `POTION_SLOTS` |
| `js/combat/potion-contract.js` | 5 | export | const | `POTION_CATEGORIES` |
| `js/combat/potion-contract.js` | 6 | export | const | `BUFF_EFFECT_TYPES` |
| `js/combat/potion-contract.js` | 7 | export | const | `ALL_EFFECT_TYPES` |
| `js/combat/potion-contract.js` | 8 | export | const | `HAND_LABELS` |
| `js/combat/potion-contract.js` | 10 | export | const | `POTION_ROW_EVENTS` |
| `js/combat/potion-contract.js` | 11 | export | const | `POTION_PHASES` |
| `js/combat/potion-contract.js` | 18 | export | function | `potionPrePostTicks` |
| `js/combat/potion-effects.js` | 11 | local | function | `rollWindowEffect` |
| `js/combat/potion-effects.js` | 19 | export | function | `buildPotionPayload` |
| `js/combat/potion-effects.js` | 41 | export | function | `applyPotionEffect` |
| `js/combat/tic-queue.js` | 11 | export | function | `createQueue` |
| `js/combat/tic-queue.js` | 18 | local | function | `tieCategory` |
| `js/combat/tic-queue.js` | 27 | local | function | `labelRank` |
| `js/combat/tic-queue.js` | 34 | local | function | `orderedInsertIndex` |
| `js/combat/tic-queue.js` | 50 | export | function | `addEvent` |
| `js/combat/tic-queue.js` | 58 | local | function | `firstActionableIndex` |
| `js/combat/tic-queue.js` | 62 | export | function | `popNext` |
| `js/combat/tic-queue.js` | 71 | export | function | `peekHead` |
| `js/combat/tic-queue.js` | 77 | export | function | `removeHead` |
| `js/combat/tic-queue.js` | 85 | export | function | `commitNewRow` |
| `js/combat/tic-queue.js` | 92 | export | function | `replaceReadyWithSuccessor` |
| `js/combat/tic-queue.js` | 101 | export | function | `queuesMatch` |
| `js/combat/tic-queue.js` | 120 | export | function | `computeTimingMarkers` |
| `js/game-app.js` | 71 | local | function | `panToLocation` |
| `js/game-app.js` | 95 | local | function | `navigateLocations` |
| `js/game-app.js` | 109 | local | function | `enterLocation` |
| `js/game-app.js` | 138 | local | function | `isNotReadyModalOpen` |
| `js/game-app.js` | 143 | local | function | `hideNotReadyModal` |
| `js/game-app.js` | 156 | local | function | `menuFocusItems` |
| `js/game-app.js` | 163 | local | function | `isMenuSettingsOpen` |
| `js/game-app.js` | 168 | local | function | `hideMenuSettings` |
| `js/game-app.js` | 176 | local | function | `updateMenuFocus` |
| `js/game-app.js` | 183 | local | function | `activateMenuFocus` |
| `js/game-app.js` | 190 | local | function | `handleMenuKeydown` |
| `js/game-app.js` | 240 | local | function | `initLocations` |
| `js/game-app.js` | 257 | local | function | `resetBackground` |
| `js/game-app.js` | 273 | local | async function | `initGame` |
| `js/game-app.js` | 326 | local | function | `showOnboarding` |
| `js/game-app.js` | 338 | local | function | `renderStep` |
| `js/game-app.js` | 372 | local | function | `finishOnboarding` |
| `js/login-app.js` | 25 | local | function | `initSupabase` |
| `js/login-app.js` | 38 | local | async function | `checkExistingSession` |
| `js/login-app.js` | 61 | local | async function | `signInWithEmail` |
| `js/login-app.js` | 114 | local | function | `startCooldown` |
| `js/login-app.js` | 142 | local | async function | `sendResetEmail` |
| `js/mobile-app.js` | 17 | local | async function | `initGame` |
| `js/mobile-app.js` | 46 | local | function | `hideNotReadyModal` |
| `js/mobile-app.js` | 51 | local | function | `hideMenuSettings` |
| `js/portal-select-app.js` | 13 | local | function | `showToast` |
| `js/portal-select-app.js` | 21 | local | function | `updateHighlight` |
| `js/portal-select-app.js` | 33 | local | function | `activatePortal` |
| `js/portal-select-app.js` | 44 | local | function | `handleArrowKey` |
| `js/portal-select-app.js` | 70 | local | function | `getColumns` |
| `js/portal-select-app.js` | 86 | local | function | `renderPortals` |
| `js/portal-select-app.js` | 137 | local | function | `setupKeyboardNav` |
| `js/portal-select-app.js` | 166 | local | async function | `init` |
| `js/pure-utils.js` | 6 | export | function | `escapeHtml` |
| `js/pure-utils.js` | 24 | export | function | `weightedPick` |
| `js/reset-password-app.js` | 33 | local | function | `initSupabase` |
| `js/reset-password-app.js` | 42 | local | async function | `handleResetCode` |
| `js/reset-password-app.js` | 90 | local | async function | `resetPassword` |
| `js/run-equip-app.js` | 36 | local | async function | `loadData` |
| `js/run-equip-app.js` | 82 | local | function | `isWeapon` |
| `js/run-equip-app.js` | 83 | local | function | `isConsumable` |
| `js/run-equip-app.js` | 85 | local | function | `renderBackpack` |
| `js/run-equip-app.js` | 123 | local | function | `selectBackpackItem` |
| `js/run-equip-app.js` | 139 | local | function | `highlightTargets` |
| `js/run-equip-app.js` | 156 | local | function | `clearHighlights` |
| `js/run-equip-app.js` | 165 | local | function | `buildPopupHtml` |
| `js/run-equip-app.js` | 212 | local | function | `positionPopup` |
| `js/run-equip-app.js` | 283 | local | function | `showInfoFor` |
| `js/run-equip-app.js` | 291 | local | function | `hidePopup` |
| `js/run-equip-app.js` | 295 | local | function | `onHoverItem` |
| `js/run-equip-app.js` | 307 | local | function | `onHoverLeave` |
| `js/run-equip-app.js` | 322 | local | function | `showInspectPopup` |
| `js/run-equip-app.js` | 329 | local | function | `setupDismiss` |
| `js/run-equip-app.js` | 339 | local | function | `assignToSlot` |
| `js/run-equip-app.js` | 370 | local | function | `unequipSlot` |
| `js/run-equip-app.js` | 378 | local | function | `renderLoadout` |
| `js/run-equip-app.js` | 431 | local | function | `renderDiceTray` |
| `js/run-equip-app.js` | 457 | local | function | `renderAll` |
| `js/run-equip-app.js` | 463 | local | function | `setupKeyboard` |
| `js/run-equip-app.js` | 491 | local | async function | `enterPortal` |
| `js/run-equip-app.js` | 536 | local | function | `setupEnterButton` |
| `js/run-equip-app.js` | 559 | local | function | `setupCancelButton` |
| `js/run-equip-app.js` | 575 | local | function | `apiErrorText` |
| `js/run-equip-app.js` | 584 | local | function | `setAdminStatus` |
| `js/run-equip-app.js` | 591 | local | function | `firstEmptySlot` |
| `js/run-equip-app.js` | 603 | local | function | `placeNewItem` |
| `js/run-equip-app.js` | 617 | local | function | `ownedKey` |
| `js/run-equip-app.js` | 619 | local | async function | `syncOwned` |
| `js/run-equip-app.js` | 660 | local | function | `fillSlotSelect` |
| `js/run-equip-app.js` | 671 | local | function | `renderTemplateRows` |
| `js/run-equip-app.js` | 706 | local | function | `renderAdminTemplates` |
| `js/run-equip-app.js` | 714 | local | function | `inventoryForDelete` |
| `js/run-equip-app.js` | 722 | local | function | `renderAdminDeleteList` |
| `js/run-equip-app.js` | 763 | local | async function | `generateFromTemplate` |
| `js/run-equip-app.js` | 781 | local | function | `askDelete` |
| `js/run-equip-app.js` | 790 | local | async function | `confirmDelete` |
| `js/run-equip-app.js` | 810 | local | async function | `openAdminPanel` |
| `js/run-equip-app.js` | 825 | local | function | `buildAdminOverlay` |
| `js/run-equip-app.js` | 912 | local | async function | `setupAdminPanel` |
| `js/run-equip-app.js` | 935 | local | async function | `init` |
| `js/session.js` | 30 | export | async function | `persistRefreshCookie` |
| `js/session.js` | 58 | export | async function | `ensureSession` |
| `js/session.js` | 125 | export | function | `fillHudName` |
| `js/session.js` | 139 | export | async function | `redirectIfActiveRun` |
| `js/session.js` | 162 | export | async function | `loadServerSettings` |
| `js/session.js` | 198 | export | async function | `bootstrapTownSession` |
| `js/session.js` | 212 | export | async function | `logout` |
| `js/settings-controller.js` | 9 | export | const | `UX_SPEEDS` |
| `js/settings-controller.js` | 24 | local | function | `storageGet` |
| `js/settings-controller.js` | 33 | local | function | `storageSet` |
| `js/settings-controller.js` | 42 | local | function | `parseUxSpeed` |
| `js/settings-controller.js` | 48 | local | function | `init` |
| `js/settings-controller.js` | 66 | export | function | `getSpeedPreset` |
| `js/settings-controller.js` | 67 | export | function | `getSpeedKey` |
| `js/settings-controller.js` | 68 | export | function | `getFontSizeKey` |
| `js/settings-controller.js` | 69 | export | function | `getUxSpeed` |
| `js/settings-controller.js` | 70 | export | function | `getScreenshakeOn` |
| `js/settings-controller.js` | 72 | export | function | `setSpeed` |
| `js/settings-controller.js` | 81 | export | function | `setFontSize` |
| `js/settings-controller.js` | 89 | export | function | `setUxSpeed` |
| `js/settings-controller.js` | 98 | export | function | `setScreenshakeOn` |
| `js/settings-controller.js` | 107 | export | function | `onSpeedChange` |
| `js/settings-controller.js` | 111 | export | function | `onFontSizeChange` |
| `js/settings-controller.js` | 115 | export | function | `onUxSpeedChange` |
| `js/settings-controller.js` | 119 | export | function | `onScreenshakeChange` |
| `js/settings-menu.js` | 34 | export | function | `showMenuSettings` |
| `js/settings-menu.js` | 48 | export | function | `showNotReadyModal` |
| `js/settings-menu.js` | 53 | export | function | `highlightSpeedButtons` |
| `js/settings-menu.js` | 64 | export | function | `highlightFontButtons` |
| `js/settings-menu.js` | 71 | export | function | `highlightUxButtons` |
| `js/settings-menu.js` | 78 | export | function | `highlightShakeButtons` |
| `js/settings-menu.js` | 85 | export | function | `setBattleTextSpeed` |
| `js/settings-menu.js` | 91 | export | function | `setQueueFontSize` |
| `js/settings-menu.js` | 96 | export | function | `setUxSpeedSetting` |
| `js/settings-menu.js` | 102 | export | function | `setScreenshakeSetting` |
| `js/settings-menu.js` | 113 | export | async function | `syncSettings` |
| `js/settings-menu.js` | 139 | export | function | `initMenuSettings` |
| `js/signup-app.js` | 38 | local | function | `initSupabase` |
| `js/signup-app.js` | 47 | local | async function | `submitInviteKey` |
| `js/signup-app.js` | 102 | local | async function | `markInviteKeyUsed` |
| `js/signup-app.js` | 129 | local | function | `startOAuthSignup` |
| `js/signup-app.js` | 142 | local | async function | `signUpWithEmail` |
| `js/signup-app.js` | 250 | local | async function | `handleAuthCallback` |
| `js/town-url.js` | 9 | local | function | `getTownUrl` |
| `js/utils.js` | 21 | export | function | `supabaseClient` |
| `lib/combat-http.js` | 9 | export | function | `__setAdminClientForTests` |
| `lib/combat-http.js` | 13 | export | const | `CORS` |
| `lib/combat-http.js` | 20 | export | function | `json` |
| `lib/combat-http.js` | 24 | export | function | `getAdminClient` |
| `lib/combat-http.js` | 34 | export | async function | `verifyUser` |
| `lib/combat-http.js` | 46 | export | async function | `verifyAdmin` |
| `lib/combat-http.js` | 63 | export | function | `potionUsedFlags` |
| `lib/combat-http.js` | 79 | export | async function | `loadOwnedActiveRun` |
| `lib/combat-http.js` | 97 | export | async function | `persistBattle` |
| `lib/combat-run.js` | 6 | export | async function | `startingHp` |
| `lib/combat-run.js` | 16 | export | async function | `generateOneMonster` |
| `lib/combat-run.js` | 49 | export | async function | `findActiveRun` |
| `lib/combat-run.js` | 58 | export | async function | `handApproachSpeeds` |
| `lib/combat-run.js` | 82 | export | async function | `buildPotionLoadout` |
| `public/test/cli/cli-app.js` | 53 | local | function | `clearRunId` |
| `public/test/cli/cli-app.js` | 58 | local | function | `unlockDevMode` |
| `public/test/cli/cli-app.js` | 87 | local | async function | `showAfterBattleOffer` |
| `public/test/cli/cli-app.js` | 109 | local | function | `appendLine` |
| `public/test/cli/cli-app.js` | 117 | local | function | `appendLines` |
| `public/test/cli/cli-app.js` | 121 | local | function | `printError` |
| `public/test/cli/cli-app.js` | 125 | local | function | `printAmber` |
| `public/test/cli/cli-app.js` | 129 | local | function | `printGreen` |
| `public/test/cli/cli-app.js` | 133 | local | function | `printDim` |
| `public/test/cli/cli-app.js` | 138 | local | async function | `initAuth` |
| `public/test/cli/cli-app.js` | 191 | local | async function | `apiCall` |
| `public/test/cli/cli-app.js` | 211 | local | function | `turnPromptFromState` |
| `public/test/cli/cli-app.js` | 251 | local | function | `printStateFromRun` |
| `public/test/cli/cli-app.js` | 309 | local | async function | `cmdHelp` |
| `public/test/cli/cli-app.js` | 355 | local | async function | `cmdState` |
| `public/test/cli/cli-app.js` | 368 | local | async function | `promptUser` |
| `public/test/cli/cli-app.js` | 375 | local | async function | `cmdRunNew` |
| `public/test/cli/cli-app.js` | 384 | local | async function | `cmdReady` |
| `public/test/cli/cli-app.js` | 403 | local | async function | `cmdConfirm` |
| `public/test/cli/cli-app.js` | 469 | local | async function | `cmdRun` |
| `public/test/cli/cli-app.js` | 483 | local | async function | `cmdBattleStart` |
| `public/test/cli/cli-app.js` | 502 | local | async function | `cmdAttack` |
| `public/test/cli/cli-app.js` | 534 | local | async function | `cmdMenu` |
| `public/test/cli/cli-app.js` | 659 | local | async function | `runCommit` |
| `public/test/cli/cli-app.js` | 673 | local | async function | `cmdSwap` |
| `public/test/cli/cli-app.js` | 688 | local | async function | `cmdUsePotion` |
| `public/test/cli/cli-app.js` | 710 | local | async function | `cmdBattleEnd` |
| `public/test/cli/cli-app.js` | 749 | local | function | `cmdClear` |
| `public/test/cli/cli-app.js` | 754 | local | function | `handleCommand` |
| `public/test/cli/cli-app.js` | 818 | local | async function | `main` |
| `public/test/cli/cli-app.js` | 903 | local | async function | `refreshRunPanels` |
| `public/test/cli/cli-app.js` | 916 | local | async function | `cmdEquip` |
| `public/test/cli/cli-app.js` | 955 | local | function | `cmdCancel` |
| `public/test/cli/command-history.js` | 9 | export | function | `createCommandHistory` |
| `public/test/cli/command-history.js` | 16 | local | function | `push` |
| `public/test/cli/command-history.js` | 21 | local | function | `onArrowUp` |
| `public/test/cli/command-history.js` | 28 | local | function | `onArrowDown` |
| `public/test/cli/command-history.js` | 35 | local | function | `resetBrowse` |
| `public/test/cli/commands-dev.js` | 10 | export | function | `createDevCommands` |
| `public/test/cli/commands-dev.js` | 22 | local | async function | `cmdDevEquip` |
| `public/test/cli/commands-dev.js` | 52 | local | async function | `cmdDevRoll` |
| `public/test/cli/commands-dev.js` | 85 | local | async function | `cmdDevDel` |
| `public/test/cli/commands-dev.js` | 99 | local | async function | `cmdDevSet` |
| `public/test/cli/commands-dev.js` | 164 | local | async function | `cmdDevWin` |
| `public/test/cli/commands-dev.js` | 177 | local | async function | `cmdDevKill` |
| `public/test/cli/commands-dev.js` | 190 | local | async function | `cmdDevList` |
| `public/test/cli/commands-dev.js` | 278 | local | async function | `cmdDevGive` |
| `public/test/cli/commands-dev.js` | 321 | local | async function | `cmdDevNuke` |
| `public/test/cli/commands-dev.js` | 336 | local | async function | `cmdListTemplates` |
| `public/test/cli/commands-dev.js` | 352 | local | async function | `cmdInspect` |
| `public/test/cli/commands-dev.js` | 412 | local | async function | `cmdDevAbandonRun` |
| `public/test/cli/commands-dev.js` | 423 | local | async function | `cmdGrant` |
| `public/test/cli/commands-inventory.js` | 5 | export | function | `createInventoryCommands` |
| `public/test/cli/commands-inventory.js` | 6 | local | async function | `cmdInventory` |
| `public/test/cli/feed-narration.js` | 5 | export | function | `createFeedNarrator` |
| `public/test/cli/feed-narration.js` | 7 | local | function | `narrateFeed` |
| `public/test/cli/panel-nav.js` | 18 | local | function | `getPanelElements` |
| `public/test/cli/panel-nav.js` | 22 | local | function | `clearPanelFocus` |
| `public/test/cli/panel-nav.js` | 28 | local | function | `dismissInfoPop` |
| `public/test/cli/panel-nav.js` | 35 | local | function | `showInfoPop` |
| `public/test/cli/panel-nav.js` | 66 | local | function | `setFocusedPanel` |
| `public/test/cli/panel-nav.js` | 76 | export | function | `setupPanelNavigation` |
| `public/test/cli/queue-labels.js` | 6 | export | const | `QUEUE_ACTION_LABELS` |
| `public/test/cli/queue-labels.js` | 10 | export | function | `monsterQueueLabel` |
| `public/test/cli/queue-labels.js` | 22 | export | function | `letterOf` |
| `public/test/cli/side-panels.js` | 27 | export | function | `initSidePanels` |
| `public/test/cli/side-panels.js` | 38 | export | function | `setMenuAttack` |
| `public/test/cli/side-panels.js` | 42 | export | function | `isSelectMode` |
| `public/test/cli/side-panels.js` | 46 | export | function | `nudgeSelect` |
| `public/test/cli/side-panels.js` | 51 | export | function | `blankActionQueue` |
| `public/test/cli/side-panels.js` | 55 | export | function | `updateSidePanelsFromRun` |
| `public/test/cli/side-panels.js` | 184 | export | function | `enterSelectMode` |
| `public/test/cli/side-panels.js` | 191 | export | function | `exitSelectMode` |
| `public/test/cli/side-panels.js` | 201 | local | function | `updateSelectHighlight` |
| `public/test/cli/side-panels.js` | 210 | export | async function | `showItemDetailForCurrent` |
| `public/test/cli/side-panels.js` | 221 | local | async function | `showItemDetailForSlot` |
| `public/test/cli/text-builders.js` | 8 | export | function | `buildPreambleText` |
| `public/test/cli/text-builders.js` | 13 | export | function | `buildRecapText` |
| `public/test/cli/text-builders.js` | 54 | export | function | `buildAfterBattleOffer` |
| `public/test/cli/text-builders.js` | 73 | export | function | `buildItemInspectText` |
| `public/test/cli/text-builders.js` | 97 | export | function | `buildPreambleDenied` |
| `public/test/cli/text-builders.js` | 101 | export | function | `buildConfirmDenied` |
