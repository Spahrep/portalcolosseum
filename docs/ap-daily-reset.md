# AP Daily Reset — Detailed Design

**Status:** IMPLEMENTED — all values and mechanism locked by Spahrep 2026-10-15 (PC-DEC-073): fixed 00:00 GMT cadence, starting AP 250, daily allotment 100 (config), cap 500 (config), lazy grant-on-access **with a mid-session client backstop** (no cron). Shipped (migration 20261015192836 + api/lib/ap-daily.js, merged 2026-10-15) — no longer "ready for dispatch". Values config-driven via game_config (starting_ap=250, daily_ap_gain=100, max_ap=500).
**Author:** Hermes Agent, 2026-10-15
**Supersedes:** the "X per 24-hour period (exact X TBD)" placeholder in `docs/ap-economy.md` (line 8) and the 3× cap (line 9). This doc pins the numbers and the mechanism.

---

## 1. Decision Summary

| # | Decision | Value |
|---|----------|-------|
| D1 | Reset cadence | **Fixed daily reset at 00:00 GMT** (not a rolling 24h timer) |
| D2 | Daily allotment | **100 AP** per day |
| D3 | Total pool cap | **500 AP** (5 days' worth) |
| D4 | Starting AP (new player) | **250 AP** |
| D5 | Reset semantics | **Accrue 100 AP per elapsed day, clamped to the cap — never take away.** Each calendar day since the last grant adds 100 AP to the balance, capped at 500. Missed days accumulate (3 missed days at 0 AP → 300). |
| D6 | Mechanism | **Lazy grant-on-access at screen/state transitions** (idempotent) **plus a mid-session client backstop. No cron.** The server grants when the player crosses into an AP-consuming context — entering a store/shop, starting a portal run, or loading a dashboard — not on passive reads. A lightweight client heartbeat re-triggers the grant when the day rolls over while the player is already online. |
| D7 | Config storage | Three values in `game_config` (columns already exist): `starting_ap`, `max_ap`, `daily_ap_gain`. |
| D8 | Player state | Add `last_daily_ap` (date) to `profiles` — records the **last day the daily bonus was actually granted**, NOT the last time AP was read or spent. Existing `profiles.ap` is the live balance. |

**Why D5 (accrue per elapsed day, not top-up-to-floor, not once-per-elapsed-day):** Spahrep 2026-10-15 locked the rule plainly: "Every player gets 100 AP per day to a max of 500." Taken literally, that is an **additive per-day grant**: each elapsed calendar day adds 100 AP, capped at 500. If a player misses 3 days, they get 300 (on top of anything they kept); if they sit at 450, a new day adds 100 to hit the 500 cap. Two rejected alternatives:
- **Add-then-cap on a single latest day only** — this is the same as the /once-per-access/ variant below and fails the plain reading.
- **Top-up to floor once per access** *(`new_ap = max(ap, daily_gain)`, applied once regardless of elapsed days)* — the earlier D5. Spahrep explicitly rejected it (2026-10-15): "they receive **one** allowance for the current day — not one for each missed day — this is false. If someone misses 3 days, they get 300." So missed days **accumulate**.

The cap (500) is the only hoarding guard; players at or near the cap naturally see smaller effective gains because the clamp bites first.

**Why D6 (lazy transitions + backstop, no cron):** A fixed midnight reset *could* be a cron, but a cron that mutates every player row every day is redundant at small player counts and couples correctness to a scheduler staying alive. Lazy grant on screen/state transitions is idempotent, does zero work for dormant players, and can never miss a reset for a player who *arrives* and navigates. It runs only when the player crosses into an AP-consuming context (store, run start, dashboard) — not on passive reads. But it has a real hole: **a player already online at 00:00 GMT, sitting idle on one screen, never navigates a transition** — they're already "in." Relying on relog or navigation would be a bug players hit on a raid night. The fix is a **mid-session client backstop**: the client already keeps a lightweight interval while the app is open; on each tick it checks whether the UTC date changed and, if so, calls the same grant path. Same idempotent function, just triggered from two places — the server on a navigation/transition, the client on a date-rollover heartbeat. No cron, no batch job, and an online player self-corrects within one tick of midnight. This closes the exact gap Spahrep flagged (2026-10-15): "lazy does it on login (but then it will be missed if they're already logged in)".

---

## 2. Current State (grounding)

These are verified from the repo — do not re-derive them.

- **`game_config`** (table, id=1) already has columns: `starting_ap`, `max_ap`, `daily_ap_gain` — all `integer`, all currently `NULL` except `starting_ap = 10` (seeded by `20260916105455_game_config_starting_values.sql`). Migration `20260916104221_game_config_globals.sql` created them.
- **`profiles`** (player table) already has `ap integer NOT NULL DEFAULT 10` and `gold integer NOT NULL DEFAULT 0` (added by `20260930140000_run_entry_cost.sql`). No `last_daily_ap` column yet.
- **`portal_template.ap_cost`** is the per-run AP cost. **`entry_gold_cost`** is the gold fee.
- **`api/combat/[...path].js`** → `chargeRunEntry(admin, userId, template)` (line 88) reads `profiles.gold, profiles.ap`, checks sufficiency, and deducts. This is the **single integration point** where AP is spent. The daily grant must be applied *before* this read.
- **RLS:** players have no direct DB access. All reads/writes go through `service_role` + the API (`20260905110000_security_admin_only_access.sql`). The grant logic therefore lives in the API layer (or a `security definer` RPC), never client-side.
- **Migration naming:** `YYYYMMDDHHMMSS_name.sql` in `supabase/migrations/`.

---

## 3. Config Values

Set on `game_config` (id=1) via a new migration:

| Column | Value | Notes |
|--------|-------|-------|
| `starting_ap` | **250** | New-player starting balance. Overrides the current 10. |
| `max_ap` | **500** | Total pool cap = 5 × daily allotment. |
| `daily_ap_gain` | **100** | Daily allotment. |

**Config is the single source of truth.** All three are read at runtime; changing a value is one `UPDATE`, no schema change. This matches the existing `game_config` philosophy (per `20260916104221_game_config_globals.sql`).

**Note on `starting_ap` vs `max_ap`:** starting 250 with a 500 cap means a new player starts at half the cap — enough for ~2.5 days of play without logging in, but with headroom to earn. This is intentional (D4). If the cap were ever lowered below 250, the starting value would need re-checking (see §7 edge cases).

---

## 4. Schema Change

### 4.1 New migration: `supabase/migrations/<timestamp>_ap_daily_reset.sql`

```sql
-- AP daily reset (PC-DEC-073): 100 AP per elapsed day, cap 500, lazy grant-on-access 
-- at screen/state transitions + client backstop.
-- Spahrep 2026-10-15: cadence 00:00 GMT, start 250, 100/day (config), cap 500 (config), 
-- missed days accumulate. Checks fire only on screen switches (store, run start). All decided.

-- 1. Player-side: track the last reset date the player has been granted.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_daily_ap date;

COMMENT ON COLUMN public.profiles.last_daily_ap IS
  'Last 00:00 GMT reset date whose daily AP grant has been applied. NULL = never granted (treat as today).';

-- 2. Config values (columns already exist from 20260916104221).
UPDATE public.game_config
SET starting_ap   = 250,
    max_ap        = 500,
    daily_ap_gain = 100
WHERE id = 1;
```

**Why `date` not `timestamptz`:** the reset is a fixed calendar day in GMT. Storing a `date` (UTC) makes the comparison `last_daily_ap < current_date_utc` trivially correct and immune to timezone drift. The reset boundary is `00:00:00 UTC`.

### 4.2 No new table needed

The grant is a pure function of `(ap, last_daily_ap, config)`. No ledger/history table is required for MVP. If AP auditing is ever needed, add a separate `ap_transaction` table later — out of scope here.

---

## 5. The Grant Mechanism (core logic)

### 5.1 The rule

On a screen/state transition that touches AP (entering a store, starting a portal run, loading a dashboard), compute the number of reset days elapsed since `last_daily_ap`:

```
days_elapsed = floor( (current_date_utc - last_daily_ap) in days )
```

- If `last_daily_ap` is `NULL` (new player, or pre-migration row): treat as **today** — no retroactive grant. The player's starting AP (250) already covers their first day.
- If `days_elapsed >= 1`: accrue **100 AP per elapsed day**, set `last_daily_ap = current_date_utc`, and persist.
- If `days_elapsed == 0`: no change.

**Accrual formula (D5):**

```
new_ap = ap + (daily_ap_gain * days_elapsed)   -- one daily grant per elapsed day
new_ap = min(new_ap, max_ap)                   -- cap: never above the pool cap
```

Equivalently: `new_ap = min(ap + daily_ap_gain * days_elapsed, max_ap)`.

**Invariant: a reset NEVER decreases AP.** It only ever adds up to the cap. This is the hard guarantee that makes the reset safe for a player who logs in mid-day or across a boundary.

### 5.2 Why one grant per elapsed day, not once-per-access

A player away 3 days has `days_elapsed = 3` and accrues `3 × 100 = 300` (on top of any AP they kept, capped at 500). This is the plain reading Spahrep locked: "Every player gets 100 AP per day to a max of 500... If someone misses 3 days, they get 300." Missed days **accumulate** — there is no cap on *elapsed* days, only on the *balance* (500). The cap is the sole hoarding guard: a returning player who kept 450 banks only 50 on a new day (to 500), while one who drained to 0 banks the full 100.

> Edge: if the accrual would push `ap` above the cap, the clamp keeps it at 500 and `last_daily_ap` still advances to today. Correct — the player lost the surplus, not the grant.

### 5.3 Where it runs

**Server-side: lazy, in the API layer, fired on screen/state transitions — not on every read.** The grant only needs to run when a player crosses into a context where AP matters: entering a store/shop, starting a portal run, or loading a dashboard/management screen. Passive HUD reads do **not** need to fire it — they can show the cached balance, and the grant is guaranteed to run by the next transition anyway. This matches Spahrep 2026-10-15: "the 'checks' should only be done anytime they switch screens, e.g. go into a store, start a portal run."

The single helper is called at the top of the *transition* code paths that touch AP:

- `chargeRunEntry` in `api/combat/[...path].js` — starting a portal run (a transition; spend context). Must grant before the sufficiency check.
- **Any store/shop entry path** — a transition; spend context. When a store screen loads, grant before the player sees prices.
- `GET /api/user/profile` (`api/user/profile.js`) — **only when it's a real screen load, not a passive poll.** If the client fetches profile purely to keep the HUD meter fresh (no navigation), it should skip the grant and return cached AP; the grant fires on the next genuine transition. (The server cannot always distinguish a poll from a load, so the narrow rule is: the *client* triggers a granting fetch only when it navigates, and the *server* always grants on transition endpoints.)

**Helper signature (API layer, service_role):**

```js
// api/lib/ap-daily.js (new module)
export async function ensureDailyAp(admin, userId) {
  // 1. read config: daily_ap_gain, max_ap from game_config (id=1)
  // 2. read profile: ap, last_daily_ap
  // 3. if last_daily_ap is NULL -> set to today, return { granted: false, ap }
  // 4. if last_daily_ap < today:
  //      days = floor((today - last_daily_ap) / 1 day)
  //      new_ap = min(ap + (daily_ap_gain * days), max_ap)
  //      update profiles set ap = new_ap, last_daily_ap = today
  //      return { granted: true, ap: new_ap }
  // 5. else return { granted: false, ap }
}
```

**Client-side backstop (closes the already-online gap — D6).** The transition-based grant only fires when the player's client *navigates* to a screen that crosses the server. A player sitting idle on one screen across 00:00 GMT won't navigate on their own. So the client also runs a lightweight UTC date-rollover check while the app is open:

- A module-level interval in the app shell (the existing light app heartbeat; NOT the combat `tick()` in `engine.js`, which only runs during a battle).
- Each tick: compute `current UTC date`. If it differs from the last-seen UTC date, call a granting path (e.g. a `GET /api/user/profile?transition=1`, or a tiny dedicated `ensure-daily-ap` endpoint) and refresh the HUD AP display. The midnight rollover is a state transition in its own right, so it is legitimate to trigger the grant here.
- First check on app load also seeds the last-seen date.

This keeps a *single* idempotent grant function: the server runs it when the player crosses into a spending/navigation screen; the client re-triggers it the instant the calendar day rolls over while the player is online. No cron is needed — the system is correct for both "arrives at midnight" and "already seated at midnight."

**Why not a DB trigger / cron:** a trigger on `profiles` read isn't possible (triggers fire on writes, not reads), and a write-trigger would fire on the spend write too, creating ordering hazards. A cron is redundant given the lazy path + client backstop, and adds a scheduler to keep alive — exactly what Spahrep didn't want. The API helper + client heartbeat is the clean seam.

---

## 6. Integration Points

### 6.1 `chargeRunEntry` (the spend path) — REQUIRED

In `api/combat/[...path].js`, `chargeRunEntry` (line 88) currently does:

```js
const res = await admin.from('profiles').select('gold, ap').eq('id', userId).maybeSingle();
```

**Change:** call `ensureDailyAp(admin, userId)` *before* this read, so the balance reflects any pending reset before the sufficiency check. The helper returns the post-grant `ap`; use that value for the `haveAp` check and the deduction. This guarantees a player who logs in at 00:05 GMT and immediately starts a run gets their fresh 100 first.

**Ordering:** grant → read → check → deduct. Never deduct before granting.

**Non-fatal contract:** the grant is a *bonus* — it must never block run entry. If `ensureDailyAp` fails (e.g. an unmigrated DB missing the wallet columns, or a transient read error), `chargeRunEntry` must still proceed with the run (graceful degradation, matching the pre-existing behavior where a missing-wallet-columns DB still creates runs). `ensureDailyAp` itself returns a safe no-op `{ ap: 0, last_daily_ap: null }` on a profile-read error rather than throwing; the caller's catch is a last-resort backstop, not the primary path.

### 6.2 Store / screen entry + player read — RECOMMENDED

`GET /api/user/profile` (`api/user/profile.js`) returns the player's profile to the HUD. It should call `ensureDailyAp` **only when it represents a genuine screen transition** (e.g. `?transition=1` on the request, set by the client when it navigates to a screen that consumes/shows AP as a primary meter — store, run start, dashboard). A passive HUD poll that just keeps the meter fresh returns the cached balance without granting; the grant fires on the next real transition. The bottom-dock HUD shows `AP 24/30`-style meters per `ap-economy.md` line 10 — the **displayed cap should read from `max_ap` config**, not a hardcoded 30.

This endpoint (with `?transition=1`) is also the client-backstop target: when the UTC date rolls over mid-session, the client re-fetches profile flagged as a transition, which triggers the grant and returns the fresh AP for the HUD.

### 6.3 New-player creation — REQUIRED

`handle_new_user()` (in `20250831_create_profiles_table.sql`) inserts a profile with `ap` defaulting to 10. **Change:** the default must become `starting_ap` (250). Two options:

- **(a)** Change the column default to 250 in the migration, **or**
- **(b)** Set `ap = starting_ap` in the insert trigger, reading from `game_config`.

Option (b) is preferred — it keeps the default in sync with config rather than hardcoding 250 in two places. The trigger already exists; add `ap = (select starting_ap from game_config where id = 1)` to the insert. Also set `last_daily_ap = current_date` on insert so a brand-new player isn't immediately granted a daily accrual on first access (their 250 already covers day one).

---

## 7. Edge Cases & Guarantees

| # | Case | Behavior | Guarantee |
|---|------|----------|-----------|
| E1 | Player logs in at 00:05 GMT | Gets the day's accrual before any spend | Never spends pre-reset AP |
| E2 | Player away 3 days, returns at 0 AP | Accrues 3 × 100 = **300** (capped at 500) | Missed days accumulate |
| E3 | Player at 450 AP at reset | +100 → capped at **500**; `last_daily_ap` advances | Reset adds, capped |
| E4 | Player at 480 AP, spends 20 → 460, then reset | 460 + 100 is clamped to **500** | No double-dip beyond cap |
| E5 | New player (NULL `last_daily_ap`) | Treated as today; starts at 250 | No retroactive grant |
| E6 | Pre-migration existing players | `last_daily_ap` NULL → treated as today; accrue from their current balance on first access | Starts accruing from their real current AP |
| E7 | `max_ap` lowered below current balance | Balance stays (cap only clamps on grant, not on read) | Never force-decrease a player |
| E8 | `daily_ap_gain` raised | Per-day accrual rises; already-elapsed days still only accrue at the old rate on next access | Config change is a single UPDATE |
| E9 | Concurrent access (two requests same player) | Both compute same `new_ap`; idempotent write | No double-grant (last write wins, same value) |
| E10 | Clock skew / timezone | All comparisons in UTC `date` | Immune to local-timezone drift |
| E11 | Player already online at 00:00 GMT | Client backstop re-fetches profile within one tick; grant fires | No mid-session miss (closes the login-only gap) |

**Hard invariants (must hold in tests):**
1. A reset never decreases AP.
2. AP never exceeds `max_ap`.
3. A reset adds `daily_ap_gain` per elapsed day, clamped at `max_ap`.
4. Granting is idempotent — calling twice in the same day yields the same balance.

---

## 8. Files to Change / Create

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/<ts>_ap_daily_reset.sql` | **Create** | Add `last_daily_ap` to `profiles`; set config values (250/500/100). |
| `api/lib/ap-daily.js` | **Create** | `ensureDailyAp(admin, userId)` helper — the grant logic. |
| `api/combat/[...path].js` | **Edit** | Call `ensureDailyAp` at top of `chargeRunEntry`; use post-grant `ap`. |
| `api/user/profile.js` | **Edit** | Call `ensureDailyAp` before returning the profile **only for a genuine screen transition** (`?transition=1` set by the client when it navigates to a store/run-start/dashboard). A passive HUD poll returns cached AP without granting. |
| `js/<app-shell>.js` (the app-level heartbeat module) | **Create/Edit** | Client backstop: UTC date-rollover interval that re-fetches profile (triggers grant) and refreshes HUD. Do NOT hook into `engine.js` `tick()` (combat-only). |
| `supabase/migrations/<ts>_ap_new_player.sql` (or fold into above) | **Create** | Update `handle_new_user()` to set `ap = starting_ap` and `last_daily_ap = today`. |
| `docs/ap-economy.md` | **Edit** | Started 2026-10-15 (PC-DEC-073 capture): header + Resource section updated to fixed 00:00 GMT reset + start-250 + 100/day + cap 500, all from config. |
| `docs/current-design-status.md` | **Edit** | Ap economy section updated to the decided fixed-00:00-GMT reset + start-250 + 100/day + cap 500 (done 2026-10-15, PC-DEC-073). |
| `llms.txt` | **Edit** | Add this doc to the mechanic-docs index (standalone). |
| `tests/ap-daily-reset.test.js` | **Create** | Unit tests for the grant logic (see §9). |

**Note on `docs/ap-economy.md`:** this design doc can either (a) live as a standalone `docs/ap-daily-reset.md` and be linked from `ap-economy.md`, or (b) be folded into `ap-economy.md`. **Recommendation: standalone doc** — it's a distinct mechanism with its own test surface, and `ap-economy.md` stays the high-level economy overview. If standalone, add it to `llms.txt` and `DOCS.md`.

---

## 9. Test Plan

Create `tests/ap-daily-reset.test.js` (Node test, matching the existing `tests/` style). Cover:

1. **Grant on first access (NULL `last_daily_ap`):** no retroactive grant; balance unchanged; `last_daily_ap` set to today.
2. **Grant after 1 day at 0 AP:** → 100.
3. **Grant after 3 days at 0 AP:** → 300 (each missed day accrues), capped at 500.
4. **Grant while at 450 AP after 1 day:** 450 + 100 → 500 (capped).
5. **Cap:** 480 AP after 1 day → 500 (never exceeds); after 3 days at 500 → stays 500.
6. **Idempotency:** two calls same day → same balance.
7. **Never decreases:** any input, grant never lowers `ap`.
8. **Spend path integration:** `chargeRunEntry` grants before checking sufficiency (player at 0 AP, 1 day elapsed, run costs 50 → succeeds with 50 left).
9. **New player:** insert sets `ap = 250`, `last_daily_ap = today`.
10. **Config-driven:** changing `daily_ap_gain`/`max_ap` in `game_config` changes grant behavior without code change.
11. **Client backstop idempotency:** calling profile (which triggers the grant) twice across a simulated day boundary grants exactly once — the second call is a no-op.

---

## 10. Task Breakdown (for sub-agent dispatch)

Once approved, this decomposes into independent workstreams:

**Task A — Migration (schema + config):**
- Create `supabase/migrations/<ts>_ap_daily_reset.sql` (add `last_daily_ap`, set 250/500/100).
- Create migration to update `handle_new_user()` (set `ap = starting_ap`, `last_daily_ap = today`).
- Verify against existing migration conventions.

**Task B — Grant helper:**
- Create `api/lib/ap-daily.js` with `ensureDailyAp`.
- Pure logic, no side effects beyond the idempotent write.

**Task C — Spend-path integration:**
- Edit `chargeRunEntry` in `api/combat/[...path].js` to call `ensureDailyAp` before the sufficiency check.
- Use post-grant `ap` for the deduction.

**Task C2 — Screen-transition profile read + HUD:**
- Edit `api/user/profile.js` to call `ensureDailyAp` and grant **only when the request is a genuine screen transition** (`?transition=1` set by the client when it navigates to a store/run-start/dashboard screen). A passive HUD poll returns cached AP without granting — the grant fires on the next real transition.
- Ensure the HUD meter reads the real `max_ap` from `/api/config` (never hardcoded), per PC-DEC-073.

**Task C3 — Client mid-session backstop (closes the already-online gap):**
- Add a lightweight UTC date-rollover interval in the app-level heartbeat module (NOT `engine.js` `tick()`).
- On detecting a changed UTC date, re-fetch profile flagged as a transition (this triggers `ensureDailyAp`) and refresh the HUD AP display. The midnight rollover is itself a state transition, so granting here is legitimate.
- First check on app load seeds the last-seen UTC date.

**Task D — Tests:**
- Create `tests/ap-daily-reset.test.js` covering §9.
- `npm test` must pass (283+ baseline, 0 fail).

**Task E — Docs:**
- Update `docs/ap-economy.md`, `docs/current-design-status.md`, `llms.txt`, `DOCS.md`.
- Keep this standalone `docs/ap-daily-reset.md` as the detailed design artifact.

**Dependencies:** A -> B -> C (grant). C2 and C3 depend on B. D depends on B, C, C2. E is independent and can run in parallel.

---


## 11. Open Questions (for review)

1. **Standalone doc vs. fold into `ap-economy.md`?** — **RESOLVED: standalone** (Spahrep 2026-10-15: "stand alone"; captured in PC-DEC-073. This doc is the standalone artifact.)
2. **Cron fallback?** — **RESOLVED: no cron.** Lazy grant-on-access + mid-session client backstop is the mechanism (Spahrep 2026-10-15: "I thought we weren't using cron and were doing it the lazy way... A"; PC-DEC-073). A cron is not required for correctness and adds a scheduler to keep alive. Deferred indefinitely unless a real idle-correctness need appears.
3. **`starting_ap = 250`** — **DECIDED** (Spahrep 2026-10-15: "start at 250 for now"; PC-DEC-073). Cap = n/a to starting value decision.
4. **Existing players at 10 AP:** on first access they accrue from their real balance (no retroactive gift). — **RESOLVED/moot:** no real players exist yet (Spahrep 2026-10-15). No catch-up gift needed; existing rows get `last_daily_ap = NULL` (treated as today). No special migration branch for existing users.
5. **Should the HUD cap display read from `max_ap` config?** Currently mockups hardcode `24/30`. — **RESOLVED: yes, from config** (Spahrep 2026-10-15: "from the config, its the only thing that makes sense"; PC-DEC-073). Meter reads the real `max_ap` from `/api/config`, never hardcoded.

---

*All core values and the mechanism decided by Spahrep, 2026-10-15 (PC-DEC-073): fixed 00:00 GMT reset, starting AP 250, daily allotment 100 (config), cap 500 (config), lazy grant-on-access with mid-session client backstop, no cron. Ready for sub-agent dispatch.*
