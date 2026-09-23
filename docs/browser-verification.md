# Browser Verification Workflow for Portal Colosseum

**Last updated:** 2026-09-22  
**Purpose:** How to drive the normal game UI (`/game`) in the verification browser without relying on the user supplying credentials or JWT tokens. This workflow has been used successfully in dozens of past threads.

## Prerequisites
- The browser session must be named `portalcolosseum` (persistent across calls).
- The account `hermes-playtest@keithslade.com` must be pre-authenticated in that session (it is — the harness keeps the session alive).
- Use `browser_exec` with `session="portalcolosseum"`.

## Step-by-Step Verification Flow

1. **Start from clean state**
   ```js
   new_tab("https://portalcolosseum.com/game")
   wait_for_load()
   ```

2. **Enter the portal (normal game flow)**
   ```js
   // Click the "Enter The Portal" menu item
   js("Array.from(document.querySelectorAll('button, div, span, a')).find(el => (el.textContent || '').includes('Enter The Portal')).click()")
   wait_for_load()
   ```

3. **Confirm we are in a battle**
   ```js
   print("Current URL:", js("window.location.href"))
   print("Page state:", js("document.body.innerText.substring(0, 800)"))
   ```

4. **Perform an attack (normal UI path)**
   - The game UI renders attack buttons for the current weapon.
   - Click the first attack button (usually "Attack" or the first listed).
   ```js
   js("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Attack') || b.textContent.includes('Chop')).click()")
   wait_for_load()
   ```

5. **Advance the battle (if needed)**
   - If the UI shows a "Continue" or "Next" button after combat, click it.
   - Monitor the feed and queue for advancement.

6. **Full state capture**
   ```js
   js("document.body.innerText")
   ```

## Common Pitfalls & Fixes
- **No textarea**: The normal game does **not** use a textarea like the CLI harness. Use `click()` on rendered buttons.
- **Form hydration delay**: Always `wait_for_load()` after navigation or clicks.
- **Session name**: Always pass `session="portalcolosseum"` — this keeps the logged-in state.
- **OAuth vs email**: The test account uses email/password — the vault is not needed because the session is pre-warmed.

## Example Full Session (what worked this time)
- Loaded `/game`
- Clicked "Enter The Portal"
- Saw real weapons (Greatsword / Battle Axe), monster roster, queue with Ready hands, advancing feed, tic > 0
- No freeze at TIC 0 — `stepOnce` + `removeProcessedHead` + `advanceToNextDecision` loop is working.

This file is the single source of truth for future browser-driven verification. Do not improvise — load this file first.

**Related files:**
- `scripts/playthrough.mjs` — CLI-only fallback (JWT based)
- `public/test/cli/index.html` — unauthenticated test harness
- `api/combat/[...path].js` — the handler that was calling the wrong loop