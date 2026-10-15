# AP Daily Reset — Detailed Design

**Status:** CORE DECIDED — Spahrep confirmed fixed 00:00 GMT cadence + starting AP 250 (2026-10-15, PC-DEC-073). Daily allotment + cap still OPEN pending verbatim quote. Do not implement the unconfirmed values (D2/D3) until locked.
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
| D5 | Reset semantics | **Top-up to floor, never take away.** At reset, if a player's AP < daily allotment, set it to the daily allotment; if ≥ allotment, leave it (still capped at 500). |
| D6 | Mechanism | **Lazy grant-on-access** (idempotent, computed on read), with an optional cron as a fallback/backfill. No per-day batch job over the whole player base. |
| D7 | Config storage | Three values in `game_config` (columns already exist): `starting_ap`, `max_ap`, `daily_ap_gain`. |
| D8 | Player state | Add `last_daily_ap` (date) to `profiles`. Existing `profiles.ap` is the live balance. |

**Why D5 (top-up-to-floor, not add-then-cap):** The design goal in `ap-economy.md` is "log in every 3 days, drain to zero, and you're on equal footing with a daily player." A pure *add 100, clamp to 500* treats a player sitting at 450 as "having used today's AP" when they didn't — they'd get +50 while a player at 0 gets +100. The floor-top-up makes the promise literal: **everyone has at least 100 AP to work with each day.** It also makes spending below 100 genuinely free (use-it-or-lose-it at the margin, per `ap-economy.md` line 17), which is the intended behavior.

**Why D6 (lazy, not cron):** A fixed midnight reset *could* be a cron, but a cron that mutates every player row every day is 100% redundant when the player base is small and it couples correctness to a scheduler staying alive. Lazy grant-on-access is idempotent, does zero work for dormant players, and can never miss a reset. The visible effect is identical: a player sees the post-reset value on their next interaction. A cron is kept only as an optional backfill/repair tool, not the primary mechanism.

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
-- AP daily reset (PC-DEC-073): fixed 00:00 GMT top-up, lazy grant-on-access.
-- Spahrep 2026-10-15: cadence fixed 00:00 GMT, start 250. 100/day + cap 500 = OPEN (awaiting verbatim).

-- 1. Player-side: track the last reset date the player has been granted.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_daily_ap date;

COMMENT ON COLUMN public.profiles.last_daily_ap IS
  'Last 00:00 GMT reset date the player''s AP was topped up to. NULL = never granted (treat as today).';

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

On any read of a player's AP (or any spend), compute the number of reset days elapsed since `last_daily_ap`:

```
days_elapsed = floor( (current_date_utc - last_daily_ap) in days )
```

- If `last_daily_ap` is `NULL` (new player, or pre-migration row): treat as **today** — no retroactive grant. The player's starting AP (250) already covers their first day.
- If `days_elapsed >= 1`: apply the top-up **once** (not once per elapsed day — see §5.2), set `last_daily_ap = current_date_utc`, and persist.
- If `days_elapsed == 0`: no change.

**Top-up formula (D5):**

```
new_ap = max(ap, daily_ap_gain)          -- floor: never below the daily allotment
new_ap = min(new_ap, max_ap)             -- cap: never above the pool cap
```

Equivalently: `new_ap = clamp(max(ap, daily_ap_gain), 0, max_ap)`.

**Invariant: a reset NEVER decreases AP.** It only ever adds up to the cap. This is the hard guarantee that makes the reset safe for a player who logs in mid-day or across a boundary.

### 5.2 Why top-up once, not once-per-elapsed-day

If a player is away 3 days, `days_elapsed = 3`. Applying the top-up 3 times would give `max(ap, 300)` — but the cap is 500 and the design intent is "equal footing with a daily player," not "compensate for missed days." The cap already prevents hoarding; granting multiple days would let a returning player bank up to the cap from a single absence, which is *more* generous than a daily player who hit the cap. **Apply the top-up exactly once per access, regardless of elapsed days.** A player who returns after 3 days at 0 AP gets 100 (the floor), not 300. This keeps the "use it or lose it" pressure intact.

> Edge: if `ap` is already ≥ `daily_ap_gain` (e.g. 450), the top-up is a no-op on the balance but still advances `last_daily_ap`. Correct — the player kept their AP, so they don't get a free refill on top of it.

### 5.3 Where it runs

**Primary: lazy, in the API layer.** A single helper, called at the top of any code path that reads or spends AP:

- `chargeRunEntry` in `api/combat/[...path].js` (the spend path — must grant before the sufficiency check).
- Any future AP-reading endpoint (e.g. a `GET /api/player` or HUD fetch).

**Helper signature (API layer, service_role):**

```js
// api/lib/ap-daily.js (new module)
export async function ensureDailyAp(admin, userId) {
  // 1. read config: daily_ap_gain, max_ap from game_config (id=1)
  // 2. read profile: ap, last_daily_ap
  // 3. if last_daily_ap is NULL -> set to today, return { granted: false, ap }
  // 4. if last_daily_ap < today:
  //      new_ap = clamp(max(ap, daily_ap_gain), 0, max_ap)
  //      update profiles set ap = new_ap, last_daily_ap = today
  //      return { granted: true, ap: new_ap }
  // 5. else return { granted: false, ap }
}
```

**Optional fallback: a cron** (Supabase scheduled Edge Function or `pg_cron`) that runs at 00:00 GMT and backfills any player whose `last_daily_ap` is stale. This is **not** required for correctness — the lazy path handles everything — but it's a cheap safety net if you want the DB to be "correct" even when no player is active. It must use the *same* top-up logic (idempotent, so running it and the lazy path together is safe).

**Why not a DB trigger:** the grant needs `game_config` values and a write to `profiles`; a trigger on `profiles` read isn't possible (triggers fire on writes, not reads), and a trigger on write would fire on the spend write too, creating ordering hazards. The API-layer helper is the clean seam.

---

## 6. Integration Points

### 6.1 `chargeRunEntry` (the spend path) — REQUIRED

In `api/combat/[...path].js`, `chargeRunEntry` (line 88) currently does:

```js
const res = await admin.from('profiles').select('gold, ap').eq('id', userId).maybeSingle();
```

**Change:** call `ensureDailyAp(admin, userId)` *before* this read, so the balance reflects any pending reset before the sufficiency check. The helper returns the post-grant `ap`; use that value for the `haveAp` check and the deduction. This guarantees a player who logs in at 00:05 GMT and immediately starts a run gets their fresh 100 first.

**Ordering:** grant → read → check → deduct. Never deduct before granting.

### 6.2 HUD / player read — RECOMMENDED

Any endpoint that returns the player's AP to the HUD should call `ensureDailyAp` first so the displayed value is post-reset. If the HUD currently reads `profiles.ap` directly, route it through the helper. (The bottom-dock HUD shows `AP 24/30`-style meters per `ap-economy.md` line 10 — the displayed cap should read from `max_ap` config, not a hardcoded 30.)

### 6.3 New-player creation — REQUIRED

`handle_new_user()` (in `20250831_create_profiles_table.sql`) inserts a profile with `ap` defaulting to 10. **Change:** the default must become `starting_ap` (250). Two options:

- **(a)** Change the column default to 250 in the migration, **or**
- **(b)** Set `ap = starting_ap` in the insert trigger, reading from `game_config`.

Option (b) is preferred — it keeps the default in sync with config rather than hardcoding 250 in two places. The trigger already exists; add `ap = (select starting_ap from game_config where id = 1)` to the insert. Also set `last_daily_ap = current_date` on insert so a brand-new player isn't immediately granted a top-up on first access (their 250 already covers day one).

---

## 7. Edge Cases & Guarantees

| # | Case | Behavior | Guarantee |
|---|------|----------|-----------|
| E1 | Player logs in at 00:05 GMT | Gets top-up before any spend | Never spends pre-reset AP |
| E2 | Player away 3 days, returns at 0 AP | Gets 100 (floor), not 300 | No multi-day compensation; cap pressure intact |
| E3 | Player at 450 AP at reset | Stays 450 (≥ floor), `last_daily_ap` advances | Reset never takes AP away |
| E4 | Player at 480 AP, spends 20 → 460, then reset | 460 ≥ 100, stays 460 | No double-dip |
| E5 | New player (NULL `last_daily_ap`) | Treated as today; starts at 250 | No retroactive grant |
| E6 | Pre-migration existing players | `last_daily_ap` NULL → treated as today; their current `ap` (10) is below floor → first access tops to 100 | Existing players get one immediate top-up to floor |
| E7 | `max_ap` lowered below current balance | Balance stays (cap only clamps on grant, not on read) | Never force-decrease a player |
| E8 | `daily_ap_gain` raised | Floor rises; players below new floor get topped up on next access | Config change is a single UPDATE |
| E9 | Concurrent access (two requests same player) | Both compute same `new_ap`; idempotent write | No double-grant (last write wins, same value) |
| E10 | Clock skew / timezone | All comparisons in UTC `date` | Immune to local-timezone drift |

**Hard invariants (must hold in tests):**
1. A reset never decreases AP.
2. AP never exceeds `max_ap`.
3. A player's AP is never below `daily_ap_gain` after a grant (unless they spent it since).
4. Granting is idempotent — calling twice in the same day yields the same balance.

---

## 8. Files to Change / Create

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/<ts>_ap_daily_reset.sql` | **Create** | Add `last_daily_ap` to `profiles`; set config values (250/500/100). |
| `api/lib/ap-daily.js` | **Create** | `ensureDailyAp(admin, userId)` helper — the grant logic. |
| `api/combat/[...path].js` | **Edit** | Call `ensureDailyAp` at top of `chargeRunEntry`; use post-grant `ap`. |
| `supabase/migrations/<ts>_ap_new_player.sql` (or fold into above) | **Create** | Update `handle_new_user()` to set `ap = starting_ap` and `last_daily_ap = today`. |
| `docs/ap-economy.md` | **Edit** | Started 2026-10-15 (PC-DEC-073 capture): header + Resource section updated to fixed 00:00 GMT reset + start-250. Remaining value cells (D2/D3) stay OPEN until the quote is on record. |
| `docs/current-design-status.md` | **Edit** | Ap economy section updated to the decided fixed-00:00-GMT reset + start-250 (done 2026-10-15, PC-DEC-073). |
| `llms.txt` | **Edit** | Add this doc to the mechanic-docs index (if it becomes a standalone doc). |
| `tests/ap-daily-reset.test.js` | **Create** | Unit tests for the grant logic (see §9). |

**Note on `docs/ap-economy.md`:** this design doc can either (a) live as a standalone `docs/ap-daily-reset.md` and be linked from `ap-economy.md`, or (b) be folded into `ap-economy.md`. **Recommendation: standalone doc** — it's a distinct mechanism with its own test surface, and `ap-economy.md` stays the high-level economy overview. If standalone, add it to `llms.txt` and `DOCS.md`.

---

## 9. Test Plan

Create `tests/ap-daily-reset.test.js` (Node test, matching the existing `tests/` style). Cover:

1. **Grant on first access (NULL `last_daily_ap`):** no retroactive grant; balance unchanged; `last_daily_ap` set to today.
2. **Grant after 1 day at 0 AP:** → 100.
3. **Grant after 3 days at 0 AP:** → 100 (not 300).
4. **No grant when at/above floor:** 450 stays 450; `last_daily_ap` advances.
5. **Cap:** 480 + grant → 500 (never exceeds).
6. **Idempotency:** two calls same day → same balance.
7. **Never decreases:** any input, grant never lowers `ap`.
8. **Spend path integration:** `chargeRunEntry` grants before checking sufficiency (player at 0 AP, 1 day elapsed, run costs 50 → succeeds with 50 left).
9. **New player:** insert sets `ap = 250`, `last_daily_ap = today`.
10. **Config-driven:** changing `daily_ap_gain`/`max_ap` in `game_config` changes grant behavior without code change.

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

**Task D — Tests:**
- Create `tests/ap-daily-reset.test.js` covering §9.
- `npm test` must pass (283+ baseline, 0 fail).

**Task E — Docs:**
- Update `docs/ap-economy.md`, `docs/current-design-status.md`, `llms.txt`, `DOCS.md`.
- Optionally create standalone `docs/ap-daily-reset.md`.

**Dependencies:** A → B (helper reads the columns A creates) → C (spend path uses helper). D depends on B+C. E is independent and can run in parallel.

---

## 11. Open Questions (for review)

1. **Standalone doc vs. fold into `ap-economy.md`?** — **RESOLVED: standalone** (Spahrep 2026-10-15: "stand alone"; captured in PC-DEC-073. This doc is the standalone artifact.)
2. **Cron fallback:** include the optional 00:00 GMT cron now, or defer? (Recommendation: defer — lazy path is sufficient; add cron only if you want DB-correctness when idle.)
3. **`starting_ap = 250`** — **DECIDED** (Spahrep 2026-10-15: "start at 250 for now"; PC-DEC-073). Cap = n/a to starting value decision.
4. **Existing players at 10 AP:** first access tops them to 100 (E6). Confirm that's acceptable (it's a one-time catch-up, not recurring).
5. **Should the HUD cap display read from `max_ap` config?** Currently mockups hardcode `24/30`. Recommend yes — route through config so the meter matches the real cap.

---

*Core mechanism decided by Spahrep, 2026-10-15 (PC-DEC-073): fixed 00:00 GMT reset, starting AP 250, standalone doc. Daily allotment (100) and cap (500) remain OPEN pending a verbatim quote. Awaiting those before implementation of the unconfirmed values.*
