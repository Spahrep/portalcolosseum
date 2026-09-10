# Combat Engine — Plan (Slice 1: Engine Core + Combat API)

**Status:** Plan of record, 2026-09-10. Dispatch #1 → Grok (grok-4.3). Client UI wiring = Slice 2. Dice-pool battle generation = Slice 3 (needs portal dice config tables + point-cost balance pass).

## Architecture: Server-Authoritative (decided from existing design)

The project is already committed to server-owned combat state:

- Monster max HP is a **secret** rolled per instance (`monster_instance.max_hp`); the UI shows words only (Healthy/Injured/Battered/Critical). The client can never see the number, therefore it can never resolve damage.
- `generate_monster()` is `SECURITY DEFINER` — authenticated users cannot insert `monster_instance` rows directly.
- RLS is owner-only everywhere; the admin API already runs on a service-role client from Vercel serverless.

**Engine = pure ESM modules under `js/combat/`** (no I/O, deterministic given inputs + injected RNG), imported by a Vercel serverless catch-all **`api/combat/[...path].js`** (mirrors `api/admin/[...path].js`: CORS, `json()`, service-role client, JWT verification). Supabase is the state of record: `portal_run` rows + `battle_state jsonb` + `monster_instance` rows.

**Commit-driven flow:** client POSTs an action (commit attack / select target / continue / stop). Server verifies ownership (JWT uid == run.user_id, belt-and-suspenders with RLS), advances the simulation resolving everything until the next player decision point, persists, returns authoritative `{queue, participants (HP words only), feed, run state}`. Client animates the countdown between commits for feel only.

## Participants

- **Player:** HP 1000 (constant; `portal_run.player_hp`), two hands LH/RH, each with a `weapon_instance` from the run loadout. Hand state machine: Ready → winding (prepare) → impact → cooldown → Ready. Attacks are **player-chosen** per hand from the equipped weapon's granted attack set (`weapon_template_attack_mapping`) — matches gui1/gui2 command boxes. Cast/cooldown deltas roll once at commit (the browse band is client display only).
- **Monsters:** 1–5 per battle (in `battle_state.participants`), created server-side via `generate_monster()` at battle start. Each has rolled max_hp (secret, uniform), damage range, speed (**ticks per attack cycle**), accuracy, and granted attack slots (slot_0 mandatory + mapping-weighted slots per the chance chain). Monster cycle: attack lands → next attack row spawns (weighted pick from granted slots). Multiple rows per monster down the queue is intended (the old tic bar's failure mode).

## Tic Queue

Sorted array of `{id, label, event, tics}`. Every tick: decrement all; fire events at 0 (player-first on ties); re-sort only on commit. Hand rows morph (attack name → Ready, same row identity). Row identity: hands = permanent row; monsters = per-cycle row. Cap ~10 visible rows is a client concern.

## HP Tracking

- **Player:** `portal_run.player_hp` (persisted, authoritative).
- **Monsters:** `max_hp` on `monster_instance` (secret, uniform roll — **`generate_monster()` must be switched off Box-Muller for HP**); `current_hp` lives in `battle_state`. Server maps current/max → word: Healthy 100–76%, Injured 75–51%, Battered 50–26%, Critical 25–0%. Client receives words + damage numbers only.
- **Damage:** base ± delta from the instance roll; accuracy check (MVP: roll vs accuracy → hit); multi-target attacks reduced per target; buffs flat/additive with separate end tics (engine primitives; no buff data exists yet).
- **Death:** all monsters dead → battle won; player HP ≤ 0 → run dead. In-flight events of dead participants are cancelled at fire (MVP rule; the PMVP death-cancel nuance stays parked). Ties: player resolves first — locked.

## portal_run Integration

- **Create run** (`POST /api/combat/runs`): JWT user must own the loadout `weapon_instance`s (hand_l/hand_r/belt), have < 3 active runs, portal_template exists → INSERT `portal_run` (status active, current_battle 1, total_battles = template.fights, player_hp 1000, battle_state {}). Entry cost (AP/gold) NOT enforced — profiles lacks the columns (future slice).
- **Start battle:** MVP stub group (simple pick from seeded templates) — dice-pool generation is Slice 3. `generate_monster()` per member; init battle_state; return participants (words only) + queue.
- **Commit:** validate hand ready + attack belongs to weapon; roll cast/cooldown; insert queue row; resolve events to the next decision point; persist; return state.
- **Battle end:** won → current_battle += 1; last battle → status completed. Continue → next battle; stop → abandoned; player dead → dead. Prize pool/loot = future slice (monster_loot_mapping empty).

## Locked Rules to Honor

Ties player-first · hit at +prepare_time · base_speed = ticks per attack · multi-target reduced per target · buffs flat/additive separate end tics · potion needs free hand (N/A — consumables deferred) · HP words only (no "Full") · queue cap ~10 rows (client) · X fights = `portal_template.fights` · 3 active portals cap · even-uniform HP delta.

## Required in Slice 1 (this dispatch)

1. `js/combat/*.js` — small per-concern pure modules (tic-queue, participants, hp-words, damage, buffs, engine orchestrator). No giant files.
2. `api/combat/[...path].js` — routes: runs (POST create, GET state), battle (POST start), commit (POST), continue/stop/abandon. Mirrors api/admin conventions.
3. `tests/combat-engine.test.js` — engine-level unit tests using the repo's test runner (see tests/utils.test.js, eslint.config.js). API routes are runtime-tested on deploy (same as admin API).
4. **Migrations (written by Grok, applied to prod by Hermes via sanctioned MCP after Claude review):** `20260910220000_uniform_monster_hp_roll.sql` — generate_monster() rolls HP with a uniform distribution (uniform_int helper); APPLIED + verified. `20260910220100_seal_portal_run_rls.sql` — seals portal_run (REVOKE anon/authenticated, drop owner policy, keep admin policy); APPLIED + verified. Follow-up `20260910XXXXXX_restore_authenticated_grants_portal_run.sql` — restores authenticated table grants (admin policy no-op fix), FORCE RLS, anon stays revoked.

## Explicitly Excluded from Slice 1

Client UI wiring in game.html/game-app.js (Slice 2) · dice-pool generation + portal dice config tables (Slice 3) · loot/prize pool · consumables/potions · entry costs · any edits to existing files · any commits · any prod/local DB applies.

## Definition of Done

`js/combat/*.js` + `api/combat/[...path].js` + tests passing; `node --check` clean on all JS; migration file written but not applied; zero changes to existing files; no commits; exact file list + test output reported.
