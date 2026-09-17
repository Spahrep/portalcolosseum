# Run UX Flow (web + native CLI)

**Updated:** 2026-09-16 — ≥1 hand weapon entry rule + empty-hand Fist (PC-DEC-007/011); flow locked for build 2026-09-13 (Spahrep 2026-09-13); copy is draft (designer-consult suggestions, approved shape, words adjustable).

## Run Start — three-phase gate

Locked structure (Spahrep 2026-09-13): starting a new run is a gated, three-phase flow instead of an immediate create.

1. **Preamble** (`run new`) — atmospheric threshold screen. Run is NOT created yet.
   - Live commands during preamble: `inventory`, `inspect #`, `ready`, `help` (+ `clear`). Anything else → gentle re-prompt, never a dead end.
   - `inspect #` during preamble = **item inspect** (client-side pretty-print from the `/weapons` + `/consumables` payloads). The existing monster-template `inspect` is unchanged once inside a run.
2. **Ready → loadout pick** (`ready`) — the existing interactive pick sequence (LH / RH / BL / C1 / C2; empty = skip; `inventory` re-lists) runs, then the CLI shows the **assembled loadout recap** (first time the full loadout appears in human language): one line per slot, name, damage, attacks (prep/cd), "empty" for empty slots.
   - Lock note phrased as neutral information: "This loadout locks the moment you step through the portal. You cannot change it between fights."
3. **Confirm** (`confirm`) — creates the run (POST /runs). Requires **≥1 hand weapon** (LH or RH) at portal entry; a loadout with zero hand weapons is rejected with a clear message (belt does NOT count — it has no attack path, it's a swap/reserve slot). Empty HANDS are fine: an empty hand gets real actions — drink potions, or make an unarmed **Fist** attack (very low damage, fast speed, out-DPS'd by the worst weapon — dual wielding is the damage ceiling, an empty hand is a consumable/recovery tool, not a softlock). After creation: flavor beat, dice + battle-1 monsters print (existing behavior), then a clear "type battle start" prompt.

Copy drafts (approved shape, wording adjustable):

```
You stand before an open portal. A run of battles awaits on the other side.
What you bring now is all you will have.

Commands: inventory | inspect # | ready | help
Type "ready" when you are prepared.
```

```
Your loadout for this run:
  Left Hand: #12 Short Sword (25 dmg) — Slash (p3/c2), Thrust (p4/c1)
  Right Hand: empty
  BL: empty
  C1: empty
  C2: empty

This loadout locks the moment you step through the portal. You cannot change it between fights.

Type "confirm" to enter, or "inventory" to adjust.
```

## After-Battle — continue / stop offer

Locked structure (Spahrep 2026-09-13): after every battle **win**, the CLI offers the choice instead of expecting the player to know `battle end` exists.

- Detection: existing `turnPromptFromState` already prints "The battle is over. The crowd roars." on `battle_over`. Extend it: on victory (battle_over && !player_dead) print the offer with battle N of total, current HP, and the choice. Guard against re-offering on later commits (offer once per battle).
- Bare `continue` / `stop` become top-level commands (existing `battle end continue|stop` stays as an alias). Continue → next battle (API already does this); stop → run ends (status `abandoned` today).
- **Loot is NOT implemented (2026-09-13)** — the offer's pool line stays honest: "The prize pool has grown." No fake numbers, no loot claims. The stop-share % / actual loot lines land with the loot system.

```
Battle 2 of 5 complete. Your HP: 38/52.
The prize pool has grown.

Type "continue" to risk the next fight, or "stop" to claim your current share and end the run.
```

## Flavor beats (designer consult, once per run, second-person PC-35 voice)

1. On `run new`: "The air shimmers. Something ancient watches from the other side."
2. On `ready` before recap: "You check your straps one last time."
3. On `confirm`: "The portal pulls you through."
4. On first battle win: "The first monster falls. The pool stirs."
5. On `stop`: "You step back through the portal. The prize is yours — for now."

## Parity & guardrails

- Native CLI gets the same flow. `run new --lh --rh --belt --ca --cb` flags and `--quiet`/`--json` skip the interactive gate entirely (byte-for-byte parity preserved).
- Presentation layer only: no API, engine, schema, dice, or balance changes. No new dependencies, plain JS.

## PC-50r: One active run, auto-resume, End Run (2026-09-15)

- One active run enforced by partial unique index on portal_run (user_id) WHERE status='active' + API 400 on duplicate + migration purge of extras (richest battle_state kept).
- Auto-resume: game.html (town) and run-equip.html check GET /runs/active on load; if active run exists, redirect to /run.html?id=... before any town/equip UI (no flash).
- End Run button: always visible in run.html top bar. Opens confirm dialog with exact copy: "you will lose all loot from this run and nothing will be refunded. Type 'End Run' to confirm." Confirm button disabled until input trims + lowercases to exactly 'end run'. On confirm: POST abandon endpoint, clear localStorage currentRunId, redirect to town. Post-battle Stop run button untouched.
