# Playthrough Harness

Autonomous full-run player for Portal Colosseum live API.

## Run
```bash
PLAYTHROUGH_JWT=ey... node scripts/playthrough.mjs
```

## Env
- `PLAYTHROUGH_JWT` (required) — Bearer token for the caller
- `PLAYTHROUGH_BASE_URL` (default https://portalcolosseum.com)
- `PLAYTHROUGH_LH` / `PLAYTHROUGH_RH` / `PLAYTHROUGH_BELT` — weapon instance ids (overrides auto-pick highest-damage)
- `PLAYTHROUGH_ATTACK_ID` — fixed attack id for both hands (default: first attack of each weapon)

## Output
- `scripts/run-summary.json` — machine-readable aggregate (run_id, outcome, per-battle stats, totals)
- stdout human summary with equipment, per-battle damage dealt/taken, attacks committed

## Behavior
- Abandons any active runs first (bounded)
- Picks 3 weapons (or uses env), creates run on portal 1
- Plays all 5 battles or until death
- Turn loop: GET state, then commit BOTH hands unconditionally each iteration — the server decides (ready hand fires the attack, busy hand fast-forwards the clock via `advanced:true`); accumulate feed from every commit response; stop on `battle_over`/`player_dead` in a commit response
- Damage: LH/RH feed lines = dealt; monster lines + hp delta = taken
- Always exits 0 (death is valid outcome); non-zero only on network/auth/shape errors
- Hard caps: 10 abandons, 300 turns/battle, 15s per call

## Constraints followed
- Pure Node 18+ ESM + global fetch + AbortController timeout
- No new deps
- No silent catch; explicit errors
- Uses exact routes/shapes from api/combat/[...path].js (commit, target_ids, {weapons}, battle_state nesting, 'start a run first', Ready state, feed cap=10)
