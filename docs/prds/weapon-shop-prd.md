# Weapon Shop — Product Definition (PRD)

**Status:** ✅ APPROVED — signed off by Spahrep (PC-DEC-074, 2026-10-19)
**Author:** Hermes Agent (game-design synthesis of Portal Colosseum design notes + Spahrep rulings)
**Related notes:** `docs/shops-and-economy.md`, `docs/weapon-generation.md`, `docs/ap-economy.md`, `docs/inventory-slots.md`, `docs/progression-gating.md`, `docs/current-design-status.md` (Open item 4)
**Decision IDs referenced:** PC-DEC-007 (no-sell-last-weapon + starter granted), PC-DEC-011 (weapon-in-hand beats empty hand), PC-DEC-018/073 (AP/gold reset, AP component superseded by 073), PC-DEC-019 (backpack purge), PC-DEC-013 (consumable use-time), PC-DEC-045 (starting HP), PC-DEC-050/051 (crit), PC-DEC-017 (config table = game_config), PC-DEC-053 (no hardcoding → game_config)

---

## 1. Problem Statement

The player lives in a town between runs, earning gold and weapons through portal runs. Today there is **no gold sink and no way to spend earned gold** — gold accumulates past usefulness, the 20-slot backpack fills with D/E/F-tier drops, and a player who rolled poorly into a run has no way to improve their weapon outside of farming again. The player needs a place where they can **spend gold to improve their kit**, **sell junk to free their backpack**, and feel that gold is *worth earning*.

## 2. Solution

A **shop window in town** (a screen popover, same interaction pattern as the portal-loadout screen) selling a small, fixed, **procedurally-rolled inventory** of weapons and consumables. Items are priced by their **grade (roll)**, gated by **portal progress** (can't buy above your tier), refreshed **daily at 00:00 GMT** (the game's daily reset moment). **Rerolling** the stock has an **exponential gold cost**; **X AP** (config value) resets that cost back to base. The player can also **sell any backpack item** (including shop-bought ones) at a steep discount (~25% of its cost — tuning value) as the backpack release valve.

Everything happens **in the shop screen** until the player leaves.

## 3. Key Design Principles (confirmed + derived)

- **One economy, two faucets.** Shop items are priced by their **roll/grade**; dropped items are costed by **template**. Both feed one gold economy and must be balanced together. (Confirmed — shops-and-economy.md)
- **Universal grade system.** D–S bell curve grades every item (weapons, consumables). S ≈ 0.15%, A ≈ 2.1%. (Confirmed)
- **Shop tier = best portal unlocked.** The town has a "magical aura" scaling with portal progress; you cannot buy your way past content. (Confirmed)
- **Daily reset moment.** 00:00 GMT is the game's reset heartbeat — AP accrual, shop stock refresh, and any growth counters (incl. rerolls) all reset together. (Confirmed via Spahrep answer)
- **Gold is secondary; AP is primary.** Shop is a gold sink; reroll-reset spends AP. (Confirmed)
- **Three anti-grind gates.** Portal tier gates loot, shop tier gates purchases, entry cost taxes deep-portal farming. (Confirmed)
- **Anti-soft-lock.** You can never be weaponless: no selling your last weapon, starter granted on account creation. (Confirmed — PC-DEC-007; exact rule resolved by Spahrep: you must always have ≥1 weapon, hand or belt — see §8.2)
- **Anti-arbitrage.** Any item you sell — shop-bought or dropped — sells well below its cost (~25% suggested, tuning). No buy-low/sell-high exploit. (Confirmed via Spahrep answer: sell anything, far less; 25% suggestion is tuning)

## 4. User Stories

### Player (core)
1. As a player, I can open the shop from town and see today's inventory of rolled weapons and potions, so I know what's available before spending.
2. As a player, I can buy a weapon or potion with gold, so I can improve my kit between runs.
3. As a player, I can see each item's grade (D–S), stats, and price, so I can compare value and choose.
4. As a player, I can reroll the shop's inventory for a gold cost, so I can hunt for a better roll.
5. As a player, I see the **next reroll cost** before I commit, so the escalation is transparent.
6. As a player, I can spend X AP to reset the reroll cost to base, so I can buy my way back to an affordable reroll when the cost climbs too steep.
7. As a player, I can sell any item in my backpack for a discounted price, so I can clear space and earn gold.
8. As a player, I can leave the shop and return later within the same day and see the same inventory and the same reroll counter, so my progress isn't lost.
### New player
9. As a new player, I understand the shop sells items at my progress tier and no higher, so I learn that progress buys access, not gold-skips.

### Returning player
10. As a returning player, my reroll counter and stock reset with the daily reset, so each day is a fresh shopping decision.
11. As a low-gold player, I can sell my D/E/F junk for a small gold drip, so I have steady income to fund small purchases.

### Operator (Spahrep / DarkJester)
12. As an operator, I can tune the reroll base/multiplier and the AP-reset X via a **config value**, so numbers don't require code deploys.
13. As an operator, I can see and tune the buy-price and sell-price formulas, so the economy stays balanced.
14. As an operator, I can observe whether the shop is being used as intended (gold spent, rerolls bought), so I can tune the drip.

## 5. Implementation Decisions

### Modules / surfaces
- **Shop data source:** the shop's daily inventory is **procedurally rolled** at the daily reset, priced by grade. It must be determinable per-player or per-shop state — see Open Decisions (per-player vs global shop stock).
- **Buy:** consumes gold, grants a `weapon_instance` / `consumable_instance` owned by the player (matching the purged-backpack model: items live as instance rows with a player FK).
- **Sell:** consumes a player-owned instance, grants gold (sell formula below). Respect the no-sell-last-weapon rule.
- **Reroll:** costs gold (exponential); decrements nothing else. On success, re-rolls the visible stock; **does NOT reset AP**.
- **AP reset:** costs X AP (config); resets the reroll gold counter to base. Decrements AP.
- **Pricing:** driven by continuous `quality_multiplier` (from real power_score), not discrete grade.
  - See `docs/design/weapon-pricing-and-grading.md` (accepted PC-DEC-076).
  - Buy = `template.base_price × quality_multiplier × 1.40`
  - Sell = `template.base_price × quality_multiplier × 0.42`
  - Tier (S/A/B/C/D) is aesthetic only. S ≤ 5% rarity (target ~1.5%).
- **Schema note:** `game_config` single-row table holds global tunables (per the established pattern) — reroll base, reroll multiplier, AP-reset X, sell discount, refresh hour. No new config file.
- **Seam + cascade (pc-coding-standards):** the shop is a new screen/flow. No import-back-up: the shop UI module must not import `battle-app.js`/`cli-app.js`/`admin-app.js`; it renders through its own leaf module and state flows via bind* hooks. Target ≤3 files touched, cascade ≤40k tokens. No code snippets/paths in this PRD (they go stale).

### Out of decomposition scope
- No new combat interactions: shop is entirely outside the run. Run loadout/entry flow untouched.
- No new item types beyond weapons + consumables (MVP constraint).

## 6. Testing Decisions

- **External behavior only.** Tests assert: buying grants an owned instance; selling grants gold and frees backpack; reroll changes stock and raises cost; AP reset lowers cost to base and spends AP; daily refresh restocks and resets the reroll counter; no-sell-last-weapon holds; a player can never buy above their shop tier.
- **Date-robust discipline (per pc-coding-standards):** compute "today"/reset dynamically (`new Date().toISOString().slice(0,10)` = UTC), never hardcode a date that rots.
- **Prior art:** existing instance/sell/buy tests in `tests/`.

## 7. Out of Scope

- **Armor, materials, throwables, pouches** (PMVP item types) — the shop sells weapons + consumables only for MVP.
- **2H weapons** (PMVP).
- **Wizard tent / healing model** (separate, still open — ap-economy.md).
- **Shop UI theming / visual flourish** beyond the functional panel.
- **Leaderboard badges / achievements** driven by shop activity.
- **Real-money / premium shop.** Everything is in-game gold + AP.
- **Exact tuning values** (reroll base/multiplier, AP X, price curve, sell %). These fill the tuning table during implementation, not the PRD.

## 8. Open Decisions (need Spahrep sign-off)

1. **Per-player vs global shop stock** — **RESOLVED by Spahrep: per-player.** Each player's daily stock is rolled individually. Rationale: players sit on different portal tiers, and PMVP wizard-tent purchases (auras/spells that improve shop rolls) must affect only the buying player. No shared "town" stock.
2. **No-sell-last-weapon exact rule** — **RESOLVED by Spahrep: you must always have at least 1 weapon.** A sale that would bring the player's owned `weapon_instance` count to 0 is rejected — "weapon" means any weapon (hand or belt), not just a hand weapon. Matches PC-DEC-007 wording.
3. **Reroll counter semantics on refresh** — **RESOLVED by Spahrep: refresh resets reroll counter** (the 00:00 GMT daily reset is the game's reset moment, resets growth things incl. rerolls). [Recorded, now confirmed, not an open question in final]

## 9. Constraint Gates

- ✅ No XP/level system reintroduced. (Shop is gold+AP, not XP.)
- ✅ Consumables remain floor/window model (shop rolls potions via same generator; no contravention).
- ✅ AP is primary meter, gold secondary. (Reroll-reset spends AP; buys/sells spend gold.)
- ✅ 'dimensions' used for consumable floor/window — vocabulary preserved in doc.
- ✅ Single combat clock untouched — shop has no combat integration.
- ✅ Weapons + consumables only (MVP item types).

## 10. Further Notes

- **Gold drip:** D/E/F-tier items sell for little but reliably — the gentle upward earnings curve that funds small purchases. This is a feature, not a bug.
- **The daily reset as heartbeat:** folding the shop reroll-counter into the 00:00 GMT reset gives the game a single "moment" players learn to come back for — consistent with AP accrual. Design win: fewer timers to remember, one cadence.
- **Pricing formula is the one real design asterisk** — the notes say shop items priced by roll, drops by template, but the concrete buy+sell formulas (and whether sell% is a flat discount or grade-scaled) are unruled. This is the highest-risk open number because it defines the whole gold economy's feel. Recommend it be a tuning table with sensible defaults at build time, then tuned from play data.
- **AP-check hook already exists at the store screen.** PC-DEC-073 coded AP daily-reset checks to fire "on screen switches (store, run start)" — the store/shop screen is already an AP-cron trigger point. So the X-AP reroll reset needs no new timing infrastructure: the same screen-switch AP checkpoint that tops up daily AP can also refresh shop reroll counters, keeping the whole shop tied to one cadence.
- References: PC-DEC-007 (no-sell-last-weapon + starter granted — the shop's anti-soft-lock dressing), PC-DEC-019 (backpack purge — items as instances with player FK), PC-DEC-017/053 (config table = game_config — all shop tunables live there), PC-DEC-073 (AP reset — cadence 00:00 GMT, store screen is an AP-check trigger). Shop is a consumer of the existing instance + config patterns.

---

*End of PRD. Any claim not traceable to cited notes or a Spahrep ruling is flagged `[ASSUMPTION]` inline. **Assumption count: 2*** (listed in §5 buy-price, §5 sell-price).

---
*Approved by Spahrep, 2026-10-19 (PC-DEC-074).*
