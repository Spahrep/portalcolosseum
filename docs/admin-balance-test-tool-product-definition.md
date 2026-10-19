# Product Definition — Admin Test Tool: Set Own AP / Gold

**Status:** DRAFT — pending Spahrep review & approval
**Date:** 2026-10-16
**Author:** Hermes Agent
**Owner:** Spahrep
**Scope:** Admin test tool. NOT a player-facing feature, NOT part of the game economy.

---

## 1. What it is

A quick, dirty admin-only tool to set your **own** AP and gold to arbitrary values for
testing. One of several admin test tools (later: adjust monster HP in combat, your HP in
combat, etc.). It is not a feature, not a wallet API, not an economy system — just a plain
DB value set so an admin can verify game systems respond correctly.

## 2. Why

An admin play-testing needs to put their own AP/gold into arbitrary states:

- Set them so you **don't have enough** for a purchase/entry, then try to buy/enter to see
  if you get correctly blocked.
- Drop AP to 0 to verify the accrued daily grant and the screen-transition check.
- Set AP or gold high to test high-tier runs without grinding.

Today there is no way to write a player's AP or gold — only game systems write them (daily
grant, entry deduction, loot awards). This tool fills that gap for admins only.

## 3. Scope

- **Self-service only.** Admin sets their own AP/gold. No user lookup, no "any player" tool.
- **Set-to only.** Two number inputs (AP, gold) + one Set button. No deltas, no history.
- **No economy guardrails.** Can set 0 or >500 deliberately. Only guard: reject a negative
  result (no negative gold/AP state).
- **`last_daily_ap` untouched** so the daily grant stays consistent.
- **Admin-only.** Same `is_admin` gate as every admin route. Zero exposure to players.

## 4. Where it lives

Inside the game, on the **persistent AP/gold status dock** — not the out-of-game CRUD app (`/admin`).
No floating admin panes, no per-screen button mounts.

The game already renders a fixed bottom status dock (`#status-dock`) on every in-game screen via
`js/hud-resources.js` (the same module that shows AP and gold). That dock is present on the
**town screen** (`game.html` — the main panorama with the Menu/Store/Portal/Wizard/Leaderboard
markers), the **loadout** (`run-equip-app.js`), **portal selection** (`portal-select-app.js`),
and any future **store** screen. It is the one UI surface guaranteed to exist across the whole
game proper.

**The admin button mounts onto this status dock** — a small ADMIN glyph pinned beside the AP/gold
cluster. Clicking it opens the admin panel (the existing PC-110 modal, which already holds
GENERATE WEAPON / GENERATE CONSUMABLE / DELETE INVENTORY; the AP/gold setter is one more section).

Why the dock and not a per-screen button:

- **It's floating by nature** — the dock persists on every in-game screen, so the button is
  everywhere without wiring it into each screen's init. No town/store screen needs special support.
- **It answers the town question directly** — "you're in town" means you're on `game.html`, which
  already shows the dock. No extra placement work.
- **One admin entry point for all test tools** — future tools (monster HP in combat, your HP in
  combat) open from the same dock button, instead of a button multiplying across every screen.
- **No triplication** — the panel code is extracted into a shared module
  (`js/admin/dev-panel.js`) exposing `mountAdminButton(dockEl)`, mounted once per screen (or
  injected via the shared bootstrap) rather than copied.

The loadout's existing ADMIN button is folded into this shared dock mount (its PC-110 panel is
the same modal). Portal selection gains the dock button for the first time (currently no admin
wiring — verified). The store, when built, gets it free because the dock will already be there.

## 5. API

A new dev route in the in-game dev catch-all `api/combat/dev/[...path].js` — the same file
that already hosts `/dev/grant`, `/dev/give-weapon`, `/dev/give-consumable`. Reuses the
existing `verifyAdmin` gate and `path`-switch pattern. **Not** in `/api/admin/[...path].js`
(that's the out-of-game CRUD app).

- **Endpoint:** `POST /api/combat/dev/set-ap-gold`
- **Auth:** `verifyAdmin` — same gate as `/dev/grant`. Targets the authenticated admin's own
  profile (`user.id`); no `:id` param.
- **Body:** `{ "ap": 300, "gold": 100 }` — both optional; omit the one you don't touch. Must
  be integers. At least one present, else `400`.
- **Guard:** final `ap >= 0` and `gold >= 0`; a negative result → `400`. `0` is valid. No
  cap on AP (may exceed 500). `last_daily_ap` untouched.
- **Behavior:** single `UPDATE profiles SET ap = $ap, gold = $gold WHERE id = $adminId`
  (unchanged field written back as its current value). Service-role admin client;
  `verifyAdmin` is the sole gate.
- **Response (200):** `{ "ap": 300, "gold": 100 }` — echoes new values so the UI confirms
  without a second read.
- **Errors:** `401` no/invalid token; `403` not admin; `400` bad/absent/negative-result
  payload.

No schema changes. `profiles.ap`, `profiles.gold` already exist.

## 6. UI

The admin panel opens from the **ADMIN glyph on the persistent status dock** (beside AP/gold),
present on town (`game.html`), loadout, portal selection, and future store. In that shared panel
(the PC-110 modal), an **AP / GC** section: two rows — **AP** and **Gold** — each with a
current-value label and a number input prefilled with the current value, plus one **Set** button.
Set posts to `POST /api/combat/dev/set-ap-gold`, then refreshes the labels from the echoed
response. Errors surface inline.

## 7. Edge Cases

| # | Case | Decision |
|---|---|---|
| E1 | Value above AP cap (500) | **Allow** — testing cap-above is a core use. |
| E2 | Set to `0` | **Allow** — "not enough to buy" is the #1 test. |
| E3 | Negative result (`-10`, or `gold: -5`) | **Reject** `400` — no negative value state. |
| E4 | Empty body / no currency | **Reject** `400`. |
| E5 | Non-integer (`100.5`, `abc`) | **Reject** `400`. |
| E6 | Non-admin call | **403** via `verifyAdmin`. |
| E7 | `last_daily_ap` untouched | Correct — daily grant stays idempotent; no double grant. |

## 8. Acceptance Criteria

1. Admin sees own current AP and gold in the in-game admin panel (opened from the ADMIN glyph
   on the status dock, visible on the town screen and all in-game screens).
2. Admin can set AP to an exact value — including `0` and `> 500` — and it persists on the
   next profile/HUD read.
3. Admin can set gold to an exact value and it persists.
4. AP `0` reproduces an "insufficient AP" block on purchase/entry.
5. Low gold reproduces an "insufficient gold" block.
6. Non-admin gets `403`; nothing is exposed to players.
7. Invalid/negative-result payload → `400` with a readable message.
8. No new Vercel function slot; change lives in the existing in-game dev catch-all.
9. `npm test` passes.

## 9. Rollout

Branch off `main` → implement → `npm test` → self-review → commit → push (Vercel
auto-deploys `portalcolosseum.com` on push to `main`). Preview URL before merge per the
preview-deploy rule. Admin-only + additive (new dev route + new panel section) → no
regression risk to player flows; run the full suite before merge.

---

*Reviewer approval unlocks build. On approval, the implementer proceeds end-to-end
(ticket → code → verify → commit → push → live-check) without further permission checkpoints.*
