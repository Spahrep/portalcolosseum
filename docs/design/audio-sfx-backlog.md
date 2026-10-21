# Audio / SFX Backlog

**Created:** 2026-10-21 (Spahrep)
**Status:** Open worklist — no audio assets exist yet. This list is the master
backlog for what needs sounds. It is NOT a decision/mechanics doc; it only
tracks sound needs so no interaction ships silently.

---

## Priority framing

Two buckets, by how much the sound matters to legibility:

1. **Impact / feedback sounds** — these carry *meaning* (did I hit? did they
   hit? did my coin leave?). High priority; without them the game feels
   unresponsive.
2. **Transition / economy sounds** — these confirm an action landed (bought,
   sold, re-rolled). Cheaper to add, high polish value, tied to the shop
   economy that just shipped.

---

## 1. Combat impact (highest priority — the core feedback loop)

| Event | Notes |
|-------|-------|
| **Player hits mob** | Primary "I did damage" feedback. This is the #1 sound in the game. |
| **Mob hits player** | Pain/distinctive — must be clearly different from player-hit so the player reads "that was on ME." |
| **Miss** | Whiff/near-miss. Silent or soft; distinct cadence from hits. |
| **Crit** | Amplified, punchier version of the hit — the player should hear "bigger number" before they see it. |
| **Player death / mob death** | Distinct defeat/kill sound. Mob death is a reward cue; player death is a failure cue. |
| **Multi-target hits (Cleave/Whirlwind)** | Could reuse per-target hit, but a combined/echo variant sells "hit everyone." |

*This is the only category that already has touchpoints in combat code
(damage/feed paths). Everything below is brand new.*

## 2. Shop economy (just shipped — needs sounds now)

| Event | Notes |
|-------|-------|
| **Buying an item** | Coin-spend confirmation. Player handed over gold → distinct "purchase" tone. |
| **Selling an item** | Coin-gain confirmation — should feel rewarding (opposite of buy). |
| **Rerolling stock** | "Fate shakes the table" — shuffle/reroll. Should feel like a gamble. |
| **AP reset of reroll cost** | Distinct from gold reroll — AP spends differently, so the sound should too. |
| **Not enough gold / AP (rejected action)** | Error/denied tone — tells the player *before* they wonder why nothing happened. |

Note: buy/sell/reroll/AP-reset already have live endpoints and buttons, so the
hooks exist — they just need `playSfx()` calls wired in.

## 3. Inventory / item interaction

| Event | Notes |
|-------|-------|
| **Equip / unequip weapon** | Satisfying click/clank of swapping gear. |
| **Select shop item card** | Soft hover/select tick — confirms the card is focused. |
| **Open / close shop** | Door/booth settle — transition into and out of the vendor screen. |

## 4. Town / navigation

| Event | Notes |
|-------|-------|
| **Town ambience (looping)** | Low-volume background bed (wind, birds, town chatter). |
| **Portal enter / location select** | Confirmation ping when moving between town locations. |

## 5. Low priority / nice-to-have

| Event | Notes |
|-------|-------|
| **Potion drink** | Glug. |
| **Potion effect land** | Buff pop. |
| **Menu click** | Generic UI click. |
| **AP accrual / daily reset chime** | Subtle daily reward chime at 00:00 GMT. |
| **Leaderboard scroll / select** | When the leaderboard ships. |

---

## Technical notes (for implementation)

- No audio assets exist in the repo today. `public/` has images only
  (`public/pictures/`), no `public/audio/` or `public/sounds/`.
- No `playSfx`/`AudioContext`/`new Audio()` helper exists anywhere in `js/`
  (verified 2026-10-21). This will be net-new infrastructure.
- Recommend a single `js/audio.js` (or `js/sfx.js`) leaf module exporting
  `playSfx(name)` keyed off a name→URL map, called from the existing button
  handlers and combat feed paths. Follow pc-coding-standards: leaf module,
  no import-back-up, state flows via bind* hooks or direct `playSfx()` import.
- Mobile + desktop: `AudioContext` is the right API (must resume on first
  user gesture per autoplay policy — the shop button clicks and combat
  actions are already user gestures, so wiring SFX to them satisfies the
  gesture requirement).
- Keep files tiny (well under 30KB). A dozen short looped/one-shot effects is
  a small asset folder.