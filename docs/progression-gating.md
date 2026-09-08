# Progression Gating

**Updated:** 2026-09-08 — magical aura shop tiering, portal tiers as power tiers, anti-soft-lock reconciliation

## Portal Access

- New players begin with access only to **Portal #1**
- Subsequent portals are unlocked via triggers (exact unlock conditions TBD)
- Higher portals are significantly harder but offer better loot
- **Unlocking a portal grants the town a "magical aura"** that allows shops to sell that portal's tier — shop tier = best portal unlocked (see `shops-and-economy.md`)

## Portal Tiers = Item Power Tiers

- Each portal has its **own loot pool and enemies**; the portal you clear defines the ceiling of what you can hold from it (Portal 1 short swords cap ~30 damage even at S-tier; Portal 3 Elvish Longswords cap ~40 — examples, TBD)
- See `portal-runs.md` for the full design.

## Active Portals Limit

Players may have a maximum of **3 active portals** at any time.

**Rationale** (original):
- Prevents easy farming of low-level portals once the player becomes strong
- Mitigates soft-lock scenarios where a player gets stuck on a single hard portal after an unlucky run

**2026-09-08 reconciliation:** the anti-soft-lock rule (see `portal-runs.md`) is now the stronger design statement — **unlocked portals remain farmable forever; a player must always have at least one portal they can profitably clear.** Unlocking is permission, not replacement. The 3-active-portals limit and permanent farmability can coexist (the limit shapes which portals are "current"; it never removes a portal), but this interaction should be confirmed when the unlock flow is designed.

## Difficulty Scaling

- Portals have increasing overall difficulty — **each portal is a big step up**
- Goal: clear sense of progression without creating insurmountable walls
- A full clear of Portal 1 does not prepare you for Portal 2 — expect 1–2 fights max before being forced to stop or dying. The previous portal stays available as a farm while you gear up.

## Leaderboards & Seasons

Global leaderboards encourage community engagement:
- Example entry: "#1 Bob – Portal 5, fight 4"
- **The leaderboard tracks each player's deepest run** — this is the anti-grind design: banking AP or farming volume gives no leaderboard advantage (see `ap-economy.md`)
- **Seasons**: At the end of each season the leaderboard is archived; a fresh leaderboard begins with all accounts reset to zero for ranking purposes
- Accounts retain full historical performance data across seasons
- **Badges** awarded for achievements (e.g., "Portal 3 Slayer", "Completed run with all red dice")
- Potential future enhancement: leaderboards display the gear and monsters from a player's best run
