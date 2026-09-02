# Codebase Audit: Principle Violations & Bugs — Grok Fix Brief

## Context

This brief packages all findings from the codebase audit for the Portal Colosseum project.
The codebase has already been partially refactored (old inline scripts → ES modules, implicit flow → PKCE,
localStorage sessions → HttpOnly cookies). The remaining issues below were identified in the current,
already-refactored state.

## Priorities

- **HIGH**: Fix broken password reset flow (Bug A)
- **MEDIUM**: Fix HTML structure issues (Bug B), remove debug logs (Bug C), fix missing element references in gui1
- **LOW**: Dead CSS cleanup, font consistency, .gitignore dedup, inline style consolidation

---

## 🔴 Bugs

### Bug A: Password reset flow completely broken on login page (HIGH)
**File**: `login-app.js` + `login.html`

`login-app.js` has `startCooldown()`, `stopCooldown()`, and `sendResetEmail()` functions
that all call `document.getElementById('reset-link')`. This function exists in JS but:
1. `sendResetEmail()` is **never bound to any click handler** in DOMContentLoaded — the cooldown logic,
   rate limiting (60s), and `resetPasswordForEmail` call are all dead code
2. `login.html` line 76 has `<a href="/reset-password">` — a static link to `/reset-password`,
   NOT an interactive element with `id="reset-link"`. No click triggers `sendResetEmail()`.
3. If `sendResetEmail()` were called, `startCooldown(60)` at line 261 would crash with
   `TypeError: Cannot set properties of null` because `getElementById('reset-link')` returns null

**Fix**:
- In `login.html`, replace the static `<a href="/reset-password" class="text-orange">Reset it here</a>`
  with `<button id="reset-link" class="text-orange" type="button">Reset it</button>`
- In `login-app.js` DOMContentLoaded, add:
  `document.getElementById('reset-link').addEventListener('click', sendResetEmail);`
- `sendResetEmail()` calls `supabase.auth.resetPasswordForEmail` with `redirectTo: window.location.origin + '/reset-password'`

**Rationale**: The rate-limiting/cooldown logic was specifically written to handle the 429
`over_email_send_rate_limit` errors you encountered during alpha signup testing. But it never fires.

### Bug B: Unclosed/mismatched HTML divs in login.html and signup.html (LOW)
**Files**: `login.html` line 40, `signup.html` line 46

Both pages open `<div class="auth-overlay">` but never close it explicitly. The div nesting
has an extra `</div>` that closes it implicitly but with malformed structure.

**Fix**: Add an explicit closing `</div>` for `.auth-overlay` before `.login-page`/`.auth-container`.

### Bug C: `console.log` debug statement in production (LOW)
**File**: `reset-password-app.js` line 121

`console.log('Session established after code exchange')` — debug log left in production code.

**Fix**: Remove the line.

### Bug D: Dead CSS in style.css (LOW — DRY violation)
**File**: `style.css` lines 86-92

`.login-form input { ... }` styles reference `class="login-form"` which no HTML page uses anymore.
All forms use `.auth-container`, `.form-group`, etc. Dead code.

**Fix**: Remove the `.login-form` CSS rule.

### Bug E: Missing element references in GUI test site (MEDIUM)
**File**: `public/test/gui1/index.html`

The game script references these elements that don't exist in the HTML:
- Line 739: `document.getElementById('equip-panel')` — no element with `id="equip-panel"` in HTML
- Line 755: `document.getElementById('left-hand')` — no element with `id="left-hand"` in HTML
- Line 757: `document.getElementById('belt')` — no element with `id="belt"` in HTML

These are used in the `equip-row` click handler for the equipment swap demo (Bronze Axe).
If clicked, the handler will crash with `TypeError: Cannot set property 'innerText' of null`.

**Fix**: Either add the missing elements to the HTML or guard the references with null checks.

### Bug F: `selectMonster` function parameter bug (LOW)
**File**: `public/test/gui1/index.html` line 493

Function signature is `function selectMonster(elOrIndex)` but the implementation never uses
a parameter named `el` — it references `el` on line 505 which refers to a local variable that
may not be set correctly. Actually looking closer, `el` is declared with `let el;` on line 500
and assigned based on the parameter. This is actually correct. **Not a bug.**

Wait — line 501 uses `elOrIndex` (the parameter) but the parameter name in the signature on
line 493 is `elOrIndex`. This is fine. **False alarm.**

### Bug G: `innerHTML` usage with untrusted data in gui1 (MEDIUM — XSS)
**File**: `public/test/gui1/index.html`

Lines 436, 441, 516, 531, 537, 577, 592, 594, 708:
Uses `innerHTML` for HTML string construction in several places. While the gui1 page has
its own restrictive CSP (`script-src 'self'`), it still violates the XSS-prevention principle.
Lines 436/441 do `innerHTML.replace('[ ]', '[x]')` which is safe (bracket text only).
Lines 452-460 build footer content with hardcoded HTML — safe because no user input.
Line 577: `herbEl.innerHTML.replace('[x]', '[-]').replace('Herb', '<s>Herb</s>')` — hardcoded, safe.
Line 708: `footer.innerHTML = 'Select target (A/B/C) then Enter'` — safe.

**Assessment**: All `innerHTML` usage in gui1 is on static/hardcoded content. Not exploitable.
But for consistency with the XSS-prevention principle applied elsewhere, consider converting
to `createElement` + `textContent`. **Low priority.**

---

## 🟡 Principle Violations

### PV1: Press Start 2P font — MUST NOT APPEAR ANYWHERE (CRITICAL per user)
**File**: `public/test/gui1/index.html` lines 8, 14, 286

The user's explicit instruction: "press Start 2P should not appear anywhere."

Lines using Press Start 2P:
- Line 8: `@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');`
- Line 14: `font-family: 'Press Start 2P', 'Courier New', monospace;`
- Line 286: `font-family: 'Press Start 2P', 'Courier New', monospace;`

**Fix**:
- Replace the `@import` with: `@import url('https://fonts.googleapis.com/css2?family=Pixeloid+Mono:wght@400;700&display=swap');`
- Replace all `font-family: 'Press Start 2P', 'Courier New', monospace;` with `font-family: 'Pixeloid Mono', 'Courier New', monospace;`

The user prefers Pixeloid Mono over Press Start 2P. The main game pages (`game.html`) already
use Pixeloid Mono. Only the gui1 test page still uses Press Start 2P.

### PV2: Inline `<style>` blocks on auth pages (Separation of Concerns / DRY)
**Files**: `login.html`, `signup.html`, `reset-password.html`, `passwords.html`

Each has an inline `<style>` block with identical `body` styles. Only the background image
differs per page (though all currently use `logo.jpg`). The gui1 page legitimately needs inline
styles (separate CSP, standalone page).

**Fix**: Extract the common `body` styles into `auth.css` (or `style.css`), use inline styles
only for page-specific `background-image` if they ever differ.

### PV3: `style_src 'unsafe-inline'` in CSP (Defense in Depth)
**File**: `vercel.json` (all route headers)

All CSP policies include `style-src 'self' 'unsafe-inline'`. This is required by the inline
`<style>` blocks (PV2) and inline `style="..."` attributes on HTML elements.

**Fix**: After resolving PV2 (extract inline styles to CSS), and replacing inline style
attributes with classes, tighten CSP to `style-src 'self'`.

### PV4: Duplicate `.env.local*` pattern in .gitignore (DRY)
**File**: `.gitignore` line 13 + line 31

Line 13: `.env.local` (literal)
Line 31: `.env.local*` (glob — matches `.env.local`, `.env.local.bak`, etc.)

The glob on line 31 makes line 13 redundant.

**Fix**: Remove the duplicate line 13 (`.env.local`) or replace line 31's glob with more specific
patterns if broader coverage isn't needed.

### PV5: Inline `style="..."` attributes across HTML (Separation of Concerns)
**Files**: `login.html`, `signup.html`, `reset-password.html`, `passwords.html`, `index.html`

Examples:
- `style="display: none;"` on `#auth-message` divs
- `style="text-align: center;"` on hints
- `style="color:#ff6b35; display: none;"` on `#invite-error`

**Fix**: Move these to CSS classes in `auth.css`.

---

## 📋 Summary Table

| # | Title | Severity | File(s) | User |
|---|-------|----------|---------|------|
| A | Password reset flow dead code — `sendResetEmail()` never bound, `reset-link` element missing | HIGH | `login-app.js`, `login.html` | Spahrep |
| B | Unclosed `.auth-overlay` div in auth pages | LOW | `login.html`, `signup.html` | Spahrep |
| C | Debug `console.log` in production | LOW | `reset-password-app.js` | Spahrep |
| D | Dead CSS `.login-form` styles | LOW | `style.css` | Spahrep |
| E | Missing element refs (`equip-panel`, `left-hand`, `belt`) in gui1 crash on equip swap | MEDIUM | `public/test/gui1/index.html` | Spahrep |
| PV1 | "Press Start 2P" appears in gui1 — MUST NOT APPEAR ANYWHERE | CRITICAL | `public/test/gui1/index.html` | Spahrep |
| PV2 | Inline `<style>` blocks duplicate across auth pages | LOW | 4 HTML files | Spahrep |
| PV3 | `style-src 'unsafe-inline'` in CSP | LOW | `vercel.json` | Spahrep |
| PV4 | Duplicate `.env.local` pattern in .gitignore | VERY LOW | `.gitignore` | Spahrep |
| PV5 | Inline `style="..."` attributes on HTML elements | LOW | 5 HTML files | Spahrep |

## Instructions

Fix all items marked HIGH and MEDIUM first (Bugs A, E, PV1). Then fix the LOW items
(B, C, D, PV2, PV3, PV4, PV5).

After fixes:
1. Commit with author `slademini@theslades.ca`
2. Deploy to Vercel with `vercel --prod`
3. Verify all fixed files return HTTP 200 at `https://portalcolosseum.com`
4. Confirm "Press Start 2P" no longer appears anywhere in the codebase
5. Test password reset flow: click "Reset it" on login page → should call `sendResetEmail()` → email sent to Supabase → redirect flow works
