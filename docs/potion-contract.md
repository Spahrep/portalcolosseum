# Potion Contract (PC-39) — Effect Schema & Timing

**Status:** Spec of record for PC-39, 2026-09-14. Source of truth for the engine implementation, API route, CLI parity, and e2e cards. Design rules come from `docs/consumables.md` (locked 2026-09-08, Spahrep + DarkJester + Hermes) and the PC-39 ticket; this doc formalizes them into a contract. Do not deviate from the locked rules; where this doc states a concrete number (formula, cap), it is the documented placeholder from the ticket, marked as a tuning knob.

## 1. Categories

A potion has exactly one effect type, from the DB CHECK (`consumable_template.effect_type`):

| Category | effect_type | Effect |
|---|---|---|
| **heal** | `heal` | Restores player HP instantly when the effect lands. |
| **buff** | `speed` \| `accuracy` \| `damage` | Adds a flat, temporary stat bonus to the player. |

Category mapping is derived, never stored: `heal` is its own category; `speed`, `accuracy`, `damage` are all `buff`.

## 2. Effect payloads

The **effect amount is the instance's `rolled_floor`** — the number on the card (`X+, up to Y`). No re-roll at use time; the value is fixed at generation.

- **Heal:** `{ type: 'heal', amount: rolled_floor }`. Instant — no duration. HP restored is capped at `PLAYER_MAX_HP` (1000, `js/combat/participants.js`). Overheal is wasted, never stored.
- **Buff:** `{ type: 'speed' | 'accuracy' | 'damage', value: rolled_floor, durationTicks: template.duration_ticks, endTic: tic + durationTicks }`.
  - Duration comes from the **template** (`duration_ticks`), never the instance. `duration_ticks` is NULL for heal templates.
  - `endTic` is computed at effect-land time: `endTic = state.tic + duration_ticks`.

## 3. Expiration semantics

- A buff is **active while `tic < endTic`**, expires when `tic >= endTic` (matches `js/combat/buffs.js`: `b.endTic > currentTic`).
- `expireBuffs(buffs, currentTic)` removes expired buffs each tick. Expired buffs contribute nothing to `applyBuffs`.
- Heals have no expiry — the effect is instantaneous at land.
- **Buffs are battle-scoped.** `startBattle()` resets `state.buffs = []` — buffs do not carry between fights. A potion drunk between fights applies its effect and is gone by the next battle.
- Feed events: buff apply and buff expire should be visible in the feed (apply at land; expire when removed).

## 4. Stacking rules

- **Flat, additive.** Two active speed potions → both values added (`applyBuffs` sums).
- **Separate end tics.** Each potion gets its own `endTic`; there is **no refresh mechanic** (a second potion never extends the first).
- **No cap** on stacked buffs (MVP).
- **No multiplicative** damage/HP buffs anywhere — flat and additive only.
- Same-type and different-type buffs both stack; a damage buff and a speed buff are independent.
- Potions themselves **do not stack in inventory** (full slot each, unique rolls) — loadout is locked at entry: the two consumable slots C1 + C2 are the entire consumable budget for the run (5 fights).

## 5. Free-hand requirement

- Using a potion in battle requires a hand whose state is **`Ready`** — "free" = not on cooldown/winding/impact.
- The hand **may be holding a weapon** — "free" means available to act, not empty.
- Drinking locks **that one hand** for pre + post. The **other hand keeps attacking** the whole time — drinking locks a hand, never the turn.
- If both hands are Ready, the caller picks deterministically: **prefer `LH`, else `RH`** (first Ready in LH/RH order).
- If no hand is Ready (both busy), the use is **rejected** — this is a contract error, not a queued action.
- Cooldowns live on **hands**, never weapons. Weapon speed does triple duty: attack rate, potion timing, swap timing.

## 6. Timing & phases

### 6.1 In-battle sequence

```
hand Ready → select potion → [pre tics] → EFFECT LANDS → [post tics] → hand Ready again
                                │                             │
                           hand locked                   hand still locked, buff running
```

1. **pre** — hand locks; row event `drinking`, tics = pre.
2. **effect** — at fire: heal applies (HP += amount, cap 1000) or buff starts (`createBuff(name, value, endTic)`, pushed to `state.buffs`). Slot marked used.
3. **post** — hand still locked; row morphs to `recovery`, tics = post. Buff runs during post.
4. hand returns to `Ready`.

Row lifecycle on the one-row-per-hand queue: `drinking → effect → recovery → (removed, hand Ready)`. The morph follows existing `morphHandRow` conventions so the UI's one-row-per-hand invariant holds.

### 6.2 Formula (documented placeholder — tuning knob)

```
pre  = post = ceil((weapon.speed + potion.rolled_speed) / 2)
total drink time = weapon.speed + potion.rolled_speed
```

- `weapon.speed` = the speed of the weapon in the drinking hand.
- `potion.rolled_speed` = the instance's rolled drink speed.
- Named as a placeholder constant in code; exact shape is TBD in the locked design (`docs/consumables.md`). Do not invent a new formula.
- **Pre-time is UNINTERRUPTIBLE for MVP.** Disruption (striking a hand mid-drink to throw off timing) is PMVP.

### 6.3 Legal phases

| Phase | Hand required? | pre/post? | Effect timing |
|---|---|---|---|
| **in-battle** (battle_state non-empty) | Yes — one hand `Ready` | pre → effect → post | effect lands between pre and post |
| **between-fights** (battle_state empty / no monsters) | No — instant apply | none | effect applies immediately on use |
| **town / outside portal** | — | — | **OUT OF SCOPE** for PC-39 (future ticket) |

Between fights there is no hand involvement and no queue: use → effect → persist. The same effect application rules (heal cap, buff creation) apply.

## 7. Action cost & single-use

- **Action cost = the hand being locked for `pre + post` tics** (`weapon.speed + potion.rolled_speed` total). The potion's "cooldown" IS pre + post, costed by the weapon in that hand.
- **Single-use per run.** Each slot (A/B) can be used at most once, tracked by `portal_run.consume_a_used` / `consume_b_used` (migration `20260914200000_consumable_used_flags.sql`). Reuse of a used slot is rejected.
- Slots are fixed at loadout: `consume_a_id` / `consume_b_id` on `portal_run`. Null slot = no potion equipped = reject.
- Between-fight use consumes the same single-use flag.

## 8. Shared contract module

`js/combat/potion-contract.js` — pure ESM, no I/O, no dependencies. Exports:

- **Constants:** `POTION_SLOTS` (`['A','B']`), `POTION_CATEGORIES` (`['heal','buff']`), `BUFF_EFFECT_TYPES` (`['speed','accuracy','damage']`), `ALL_EFFECT_TYPES`, `HAND_LABELS` (`['LH','RH']`), `HAND_FREE_STATE` (`'Ready'`), `POTION_ROW_EVENTS` (`{DRINKING:'drinking', EFFECT:'effect', RECOVERY:'recovery'}`), `POTION_PHASES` (`['in-battle','between-fights']`).
- **Formula functions:** `potionPrePostTicks(weaponSpeed, potionSpeed)` → `ceil((w+p)/2)`; `potionTotalTicks(weaponSpeed, potionSpeed)` → `w + p`. Marked as tuning placeholders.
- **JSDoc typedefs** (TypeScript-compatible via checkJs — this is the "TypeScript interface" surface for a plain-ESM repo): `PotionSlot`, `PotionEffectType`, `PotionCategory`, `HealEffect`, `BuffEffect`, `PotionEffectPayload` (discriminated union on `type`), `PotionUseRequest` (`{slot, phase}`), `PotionTiming` (`{preTicks, postTicks, totalTicks}`), `CombatBuff` (`{name, value, endTic, type}`), `PotionInstanceSummary` (instance_id, template_name, effect_type, effect_label, grade, used).

Importable by engine (`js/combat/`), API (`api/combat/[...path].js`), web CLI (`public/test/cli/cli-app.js` — served under `/js/`), and native CLI (`scripts/cli/*.mjs`). No runtime imports of engine internals; this module is the single shared vocabulary.

## 9. Acceptance mapping

| Acceptance | Where satisfied |
|---|---|
| Schema supports healing and buff potions | §1 (categories/effect types), §2 (payloads) |
| Legal pre/post phases unambiguous | §6.3 phase table, §6.1 sequence |
| Action cost documented | §7 (hand locked pre+post, single-use) |
| Free-hand constraint documented | §5 |
| TypeScript interfaces importable by engine + CLI | §8 (shared module) |
