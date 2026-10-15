# AP Daily Reset — Product Definition

**Product:** Portal Colosseum daily Action Point (AP) allowance
**Author:** Hermes Agent · **Date:** 2026-10-15
**Decision record:** PC-DEC-073
**Scope:** AP economy only. Gold, admin tooling, and player-management are out of scope.

---

## 1. What this is

Portal Colosseum gives every player a daily allowance of **Action Points (AP)** — the primary meter they spend to enter runs. This document defines exactly how that daily allowance is awarded: each calendar day a player accrues **100 AP**, up to a maximum pool of **500**. Days add up, so a returning player is never behind a daily player — while the cap prevents hoarding.

No other systems change. AP is the primary meter; gold stays secondary and untouched by this design.

## 2. Player-facing rules

- Every calendar day, each player accrues **100 AP**.
- AP accrued this way **adds up** across missed days and is **capped** at the pool maximum of **500 AP**. Spending still works exactly as it does today.
- A player who has not played for several days banks an allowance for each missed day when they return — up to the cap.

### Concrete numbers

| Setting | Value | Config key |
|---|---|---|
| Daily allowance | **100 AP** per day | `game_config.daily_ap_gain` |
| Balance cap | **500 AP** | `game_config.max_ap` |
| New-player starting balance | **250 AP** | `game_config.starting_ap` |
| Reset time | **00:00 GMT** (fixed, daily) | — |

All three numbers are configuration, not code. Raising the daily allowance or the cap is a single settings change.

## 3. How the allowance is awarded (no cron)

The allowance is granted **lazily** — on demand, the moment it is needed — rather than by a scheduled job. Two cooperating behaviors that run the same accrual logic guarantee every player gets their allowance exactly when they should:

1. **Server-side (primary).** Whenever a player *switches to a screen or state where AP matters* — starting a run (charge point), entering a store/shop, or loading their profile/dashboard — the game first checks how many days have passed since the allowance was last granted, and accrues 100 AP per day. Excluded: passive meter refreshes, which just show the cached balance. If nothing has changed, the check costs almost nothing and does not touch the stored "last granted" day.
2. **Client-side (backstop, for the already-online player).** A player sitting in the open app across midnight won't naturally hit the server again to trigger the check. So while the app is open, it runs a lightweight interval that notices when the **UTC calendar date has changed**, and re-checks its own AP. This is a once-a-day event at most, and it runs against the app-global heartbeat — it is **not** tied to combat or the battle loop.

Both paths run the same single, idempotent accrual: after it has run once for a given day, later checks that same day do nothing — so running it twice can never change the outcome. There is **no cron job** and no background batch, so there is nothing to keep alive, and a dormant player costs the system nothing.

### Why this design

- **Correct for every player:** a player who arrives after midnight, or who was already seated across it, or who returns after a week away — all receive their allowance at the right moment.
- **Cheap:** the server check scales with how much players actually play, not with the calendar. Idle players generate zero work.
- **No moving parts:** no scheduler to monitor or that can silently fail. The mechanism is just a check that runs on a player's screen switches — starting a run, entering a store, opening a dashboard.

## 4. Award semantics (the exact rule)

At the moment a player switches into a screen/state where AP matters (start of a run, store entry, dashboard load) — with the player's last **granted** day (`last_daily_ap`) and today's UTC date:

- **First time (no prior grant):** no retroactive accrual beyond the player's starting balance; today is recorded as the granted day.
- **Same day as last grant:** no change.
- **New day(s) since last grant:** accrue **100 AP for each missed day**, add to the existing balance, cap at **500**, then record today as the granted day.

`last_daily_ap` is updated **only when a grant actually fires** — reading or spending AP, or a passive meter refresh, never advances it. It records the last day the bonus was *added*, not the last time AP was touched.

The accrual (for `n` missed days):

```
new_balance = balance + (daily_allowance × n)   // one allowance per missed day
new_balance = min(new_balance, cap)             // never above the pool cap
```

**Guarantees that always hold, by design:**

- An accrual never decreases a player's AP.
- A balance never exceeds the cap (500).
- Accruing is idempotent across repeated checks on the same day — after the first, there are no more missed days, so later checks change nothing.

## 5. Behavior examples

| Situation | What happens |
|---|---|
| Player logs in at 00:05 GMT and immediately starts a run | Accrues their 100 AP for the new day before the run is charged |
| Player away 3 days, returns at 0 AP | Accrues 3 × 100 = **300** (capped at 500) |
| Player away 5 days, returns at 0 AP | Accrues 5 × 100 but is **capped at 500** |
| Player sitting at 450 AP at the day change | Accrues 100, ending at **500** (the cap) |
| Brand-new player | Starts at 250; their own day-one balance |
| Player already in the app at midnight | The app notices the day change and accrues the new day's AP in place |
| Player's balance is at 480 and the cap is 500 | A catch-up grants +20 more and caps at **500** — never above |

## 6. Where the tracking lives

- The player's live AP balance already exists on their profile.
- A new field, **`last_daily_ap`** (a UTC date), records the last day the daily accrual was **applied** — i.e. the last day the bonus was actually added to the balance. It advances only when a grant fires. Reading or spending AP never changes it. A missing value simply means "not yet accrued," which is treated as today (so a brand-new player does not suddenly bank back-pay).

## 7. Configuration

The three settings live in the existing game configuration table, which is the single source of truth. Any of them can be changed with a one-line update; the next in-game check picks it up automatically. This is deliberately the same mechanism the rest of the game's tunable values already use.

## 8. Out of scope

- Gold economy and spending.
- Admin or debugging tools to grant, remove, or adjust AP or gold for any player.
- A grant history / audit ledger (could be added later; not required for this feature).
