# Workorder: Central UX Controller + Personal Timing Config

Status: OPEN — implementation delegated to Grok Build CLI (per AGENTS.md).
Owner of decisions: Spahrep (PC). Assistant role: design + integrate + verify.

## Context

PC-117 landed-hit sequencing (typewriter tell → pause → shake → damage payload)
is currently implemented locally in `feed-render.js` (`typeSplitHit`, `HIT_PAUSE_MS`)
and `monster-render.js` (`handleDeferredHit`). It works and is unit-tested, but
durations are hardcoded constants scattered across modules, and the sequencing is
hand-choreographed inside the typewriter.

Spahrep requested TWO architectural upgrades (both confirmed in-thread):
1. **One central UX controller** that owns effect sequences and timing for the
   FULL master-clock pipeline (typewriter + all visuals: shake, death, queue, HP),
   not just hit feel.
2. **Per-user timing config** — users can speed everything up/down from their
   personal settings menu, plus a screenshake on/off toggle.

Confirmed config shape (threat):
- **`ux_speed`** — one global multiplier (float, `1.0` = normal, `>1` faster, `<1` slower).
  Scales EVERY effect duration proportionally. Option 1 chosen; per-effect knobs
  are easy to add later because the controller reads all timing through one surface.
- **`screenshake_on`** — boolean toggle. `false` ⇒ screen shake / monster flash
  completely suppress (wires into the existing `suppressHitFeedback`-guarded path).

## Existing foundation (DO NOT rebuild — build on it)

- **Per-user config persistence already exists.** `api/user/profile.js` GET/PATCH
  merges keys into a JSONB `settings` column on the `profiles` table (PATCH does a
  partial `jsonb_merge`). Adding `ux_speed` / `screenshake_on` = just two new keys.
  No new table, no migration.
- **`settings-menu.js`** already wires menu buttons → `setSpeed`/`setFontSize`
  (localStorage) → `syncSettings()` (server PATCH). New knobs follow this pattern.
- **`settings-controller.js`** is the client-side module state source of truth
  (localStorage cache + subscriber registry). Extend it; do NOT fork it.
- `loadServerSettings()` (`js/session.js:161`) fetches profile settings on page
  load and hydrates localStorage (server wins). New keys join this merge.

## Current hardcoded durations → must become config-driven

| Name | File | Default |
|---|---|---|
| `HIT_PAUSE_MS` | `feed-render.js:21` | 320 ms |
| `QUEUE_EXIT_MS` | `queue-render.js:12` | 280 |
| `QUEUE_REMOVE_GAP_MS` | `queue-render.js:15` | 100 |
| `QUEUE_GAP_MS` | `queue-render.js:17` | 300 |
| `QUEUE_WIPE_MS` | `queue-render.js:18` | 250 |
| `QUEUE_FLASH_MS` | `queue-render.js:19` | 150 |
| `QUEUE_ENTER_MS` | `queue-render.js:20` | 250 |
| `QUEUE_FILL_MS` | `queue-render.js:24` | 700 |
| `MONSTER_FADE_MS` | `monster-render.js:15` | 1400 |
| `MONSTER_DEATH_MS` | `monster-render.js:53` | 1200 |
| typewriter `charMs`/`lineDelayMs` | `text-speed.js` presets | already preset-driven |
| shake / crit-shake keyframe lengths | `run.html` CSS | ~280 / ~420 |

The typewriter char speed stays on the EXISTING text-speed preset
(normal/slow/instant) — `ux_speed` is the ADDITIVE global multiplier on top, so an
instant preset is still instant regardless of `ux_speed`.

## Deliverable: `js/battle/ux-controller.js`

A single module that:

1. **Owns a `TIMING` map** — every named duration above with its base default
   (the base is what plays at `ux_speed === 1.0`).
2. **Exposes `dur(name)`** — returns `base / ux_speed` (milliseconds). THE single
   choke point where the global multiplier applies. Never recompute per call site.
3. **Owns the beat sequences** — the typewriter's `typeSplitHit` choreography moves
   OUT of `feed-render.js` into the controller (tell → pause `dur('hitPause')` →
   shake/flash via `handleDeferredHit` → payload).
4. **Reads the two config values** from the extended `settings-controller.js`.
   `dur()` reads `ux_speed` live (not cached) so changing the slider mid-battle
   affects the next beat without a reload. `screenshake_on` gates the shake/flash.

### Concurrency contract (CRITICAL — do not break)

The master clock (`battle-app.js` `tickLoop`, ~line 2097) does:
```
const narrateP = awaitNarration(bs.feed);
const visualsP = awaitTickVisuals(deathBefore);
await Promise.all([narrateP, visualsP]);
```
`awaitTickVisuals` queries `.container` / `.monster-hit` DOM synchronously at
kick-off. A deferred shake that starts MID-typing is invisible to that snapshot and
could be cut off by `releaseProcessedHead`. RULE: **the hit shake completes inside
the narration promise (`narrateP`)** — i.e. the shake's `animationend` resolves
before narration resolves. `awaitTickVisuals` keeps handling death cards and
non-hit visuals. This is already the design in `typeSplitHit`; preserve it.

## Files to change

- **`js/settings-controller.js`** — add `ux_speed` + `screenshake_on` state,
  accessors, setters (localStorage + subscriber pattern, mirroring speed/font).
- **`js/session.js`** (`loadServerSettings`) — hydrate the two new keys from the
  server profile merge.
- **`js/settings-menu.js`** + settings CSS/HTML — add a speed slider + screenshake
  toggle following the existing `speed-opt`/`font-opt` pattern. Slider maps to a
  discrete set (e.g. 0.5 / 0.75 / 1.0 / 1.25 / 1.5 ×) OR a continuous slider —
  Spahrep said "easy to change later," so a simple 3-5 step control is fine.
- **`js/battle/ux-controller.js`** — NEW. TIMING map, `dur()`, beat sequences.
- **`js/battle/feed-render.js`** — `typeSplitHit` routes through the controller;
  drop `HIT_PAUSE_MS` hardcode.
- **`js/battle/queue-render.js`**, **`js/battle/monster-render.js`** — replace
  `*_MS` constants with `dur('name')` reads.
- **`js/battle/battle-app.js`** — bind the controller; wire `screenshake_on:false`
  into the existing `suppressHitFeedback` guard.
- **`run.html`** — if keyframe shake lengths must scale, drive them via CSS
  custom property set from JS (or via a class duration toggle); otherwise leave
  the CSS keyframes and scale the JS-triggered timing only.

## Hard rules

- Engine feed schema UNCHANGED (renderer-only; no feed-schema/parsing/resume break).
- `parseHitLine`/`splitHitLine` in `hit-feedback.js` are unit-tested and CORRECT —
  do not rewrite; only route their output through the controller.
- Do NOT break: click-to-skip (`feed-skip.js`), the master-clock await-BOTH
  contract, existing `node --test tests/hit-feedback.test.js` (28 tests,
  currently passing).
- Circular-import avoidance: `feed-render.js` must NOT import `monster-render.js`;
  effects are bound in from `battle-app.js` (existing `bindFeedRender` pattern).
- No API keys/tokens/passwords in code or logs.

## Verification

- `node --test tests/hit-feedback.test.js` stays green (the split parser doesn't change).
- Add/extend tests for `ux-controller` `dur()` logic (pure function, testable).
- Build + live-site verification ONLY against the live site (portalcolosseum.com),
  per AGENTS.md — never local files.
- Manual UX check: normal hit → beat is tell → pause → shake → damage; flip
  screenshake off → no shake/flash but text beat unchanged; raise speed → all
  durations compress.