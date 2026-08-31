# Portal Colosseum — Auth Flow Security Review (Pass 2)

**Scope:** `login.html`, `signup.html`, `game.html` (JS sections), `api/env.js`, `public/env.js`, `vercel.json`.
**Commit reviewed:** `5d1bbf1` ("security: Fix all auth flow vulnerabilities from security review")
**Approach:** Diff analysis of commit `5d1bbf1` against the original `SECURITY_REVIEW.md` findings, plus static verification of the current on-disk state and targeted repo-wide pattern searches.

---

## 1. Verification — All 5 Original Findings

### Finding 1 — CRITICAL: Session (incl. refresh token) persisted to `localStorage` → **FIXED** ✅

| Checkpoint | Evidence |
|---|---|
| Manual `localStorage.setItem('supabaseSession', …)` removed | `git show 5d1bbf1` removes every `setItem('supabaseSession')` call across `login.html`, `signup.html`, `game.html`. Repo-wide search confirms **zero** matches in source (only references inside `SECURITY_REVIEW.md` itself remain). |
| Supabase client given in-memory storage adapter | All three `createClient()` calls now pass `auth.storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }`. The client no longer writes to `localStorage` by default. |
| `getSessionFromUrl({ storeSession: true })` replaced | All three files now call `supabase.auth.getSession()` instead. No `getSessionFromUrl` or `exchangeCodeForSession` references remain in source. |

**Mechanism:** The refresh token now lives only in page memory for the lifetime of a single document load. An XSS on the site cannot read it from `localStorage` because it is never written there. However — see §2.1 for the functional tradeoff this introduces.

---

### Finding 2 — HIGH: Auth bypass on `/game` via stale/manipulable `localStorage` → **FIXED** ✅

| Checkpoint | Evidence |
|---|---|
| No `localStorage` consulted for access decisions | `game.html` `initGame()` no longer reads `playerName` from `localStorage` to decide whether to grant access. Every fallback path now redirects to `/login` unconditionally. |
| Fail-closed on missing session | `if (session)` → render game; `else` → `window.location.href = '/login'; return;`. |
| Fail-closed on error (catch block) | `catch` block now redirects to `/login` instead of falling back to `localStorage`. |
| Fail-closed on client-init failure | `if (SUPABASE_URL)` guard → `else` branch redirects to `/login` (previously fell through to localStorage). |
| `localStorage.playerName` treated as cosmetic only | `localStorage.setItem('playerName', playerName)` is retained for display caching but is never read by `initGame()` for auth decisions. |

**Result:** Setting `localStorage.setItem('playerName', 'admin')` in the console no longer grants access to `/game`. The page fails closed on every path.

---

### Finding 3 — HIGH: No Content-Security-Policy → **FIXED** ✅

| Checkpoint | Evidence |
|---|---|
| CSP header added to `vercel.json` | `"headers"` block with a single `Content-Security-Policy` entry covering `"source": "/(.)"` (all routes). |
| Policy restricts script execution | `script-src 'self' 'unsafe-inline' esm.sh https://*.supabase.co` |
| Token-exfiltration channel blocked | `connect-src 'self' https://*.supabase.co` — limits fetch/XHR destinations. |
| Additional CSP directives | `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `img-src 'self' data: https:`, `style-src 'self' 'unsafe-inline'`. |

> ⚠️ See §2.2 — the CSP is weakened by `'unsafe-inline'` in `script-src` (inline `onclick` handlers remain). The header exists but does not fully deliver the XSS defense-in-depth that Finding 3 intended.

---

### Finding 4 — MEDIUM: Unpinned `esm.sh` dependency, no Subresource Integrity → **NOT FIXED** ❌

| Checkpoint | Evidence |
|---|---|
| Version pin? | Import still reads `https://esm.sh/@supabase/supabase-js@2` — `@2` resolves to the latest 2.x on every request. No exact semver pin. |
| SRI `integrity` attribute? | Not present on any `<script type="module">` tag. Repo-wide search confirms zero `integrity=` matches. |

**This finding was entirely missed by commit `5d1bbf1`.** The commit message claims "Fix all auth flow vulnerabilities" but the diff contains no changes to the esm.sh import lines (L33 of `login.html` / `game.html`, L22 of `signup.html`).

---

### Finding 5 — MEDIUM: OAuth implicit flow → PKCE → **FIXED** ✅

| Checkpoint | Evidence |
|---|---|
| `flowType: 'pkce'` configured | All three `createClient()` calls now pass `auth: { flowType: 'pkce', detectSessionInUrl: true, … }`. |
| `getSessionFromUrl` removed | Replaced with `supabase.auth.getSession()` in all callback handlers. |
| Deprecated `storeSession: true` removed | No longer passed anywhere. |
| Callback detection updated for code param | `window.location.search.includes('code=')` now triggers callback handling (PKCE returns a `code`, not a hash). |

---

### Summary table — original findings

| # | Original Finding | Severity | Status | Fix commit coverage |
|---|---|---|---|---|
| 1 | Refresh/access tokens persisted to `localStorage` | CRITICAL | **FIXED** ✅ | In-memory storage adapter + `setItem('supabaseSession')` removed |
| 2 | `/game` accessible with no session (stale `playerName`) | HIGH | **FIXED** ✅ | Fail-closed redirects in all branches |
| 3 | No Content-Security-Policy | HIGH | **FIXED** ✅* | CSP header added (see §2.2 for residual weakness) |
| 4 | Unpinned `esm.sh` import, no SRI | MEDIUM | **NOT FIXED** ❌ | Overlooked — no changes to import lines |
| 5 | OAuth implicit flow, not PKCE | MEDIUM | **FIXED** ✅ | `flowType: 'pkce'` + `getSession()` |

---

## 2. New Issues Introduced or Remaining Gaps

### 2.1 In-memory storage adapter makes sessions non-recoverable on reload — functional regression

Commit `5d1bbf1` chose the original review's "practical incremental step" (Finding 1 fix option b): an in-memory storage adapter with no-op `getItem`/`setItem`/`removeItem`. This eliminates **persistent** XSS token theft but introduces a significant usability regression:

- **Hard refresh on `/game` → session lost.** The in-memory store is cleared on every full page load. There is no refresh token to restore the session, so `getSession()` returns `null` and the user is bounced to `/login`.
- **Any navigation that causes a full page load** (clicking a link that opens in a new tab, browser back/forward, browser restart) logs the user out.
- **OAuth handoff dependency.** The auth flow now strictly requires the `code` query parameter to be present on the callback page. If the redirect chain breaks or the code is consumed/stored before `getSession()` runs, re-authentication is the only recovery path.

This is the acknowledged tradeoff from the original review, but for a game where players may refresh or leave a tab open, it effectively makes the session as fragile as the implicit-hash flow. The **proper** fix remains the original review's primary recommendation: a server boundary that stores the refresh token in an `HttpOnly`/`Secure`/`SameSite` cookie.

### 2.2 CSP `script-src` includes `'unsafe-inline'` — XSS mitigation is largely ineffective

The CSP was added (Fixing Finding 3) but every button across all three HTML pages still uses **inline `onclick` handlers**:

```
login.html  L188: <button onclick="signInWithProvider('google')">
login.html  L191: <button onclick="signInWithProvider('github')">
login.html  L207: <button onclick="signInWithEmail()">
login.html  L210: <button onclick="sendResetEmail()">
login.html  L215: <button onclick="sendMagicLink()">
signup.html L37:  <button onclick="signInWithProvider('google')">
signup.html L40:  <button onclick="signInWithProvider('github')">
signup.html L58:  <button onclick="signUpWithEmail()">
game.html  L76:  <button onclick="logout()">
```

With `'unsafe-inline'` in `script-src`, the CSP does **not** block inline event handlers or inline `<script>` blocks. Any XSS that injects `<script>` or `onclick` attributes executes unhindered. The `connect-src` restriction still limits exfiltration channels (no arbitrary fetch), but token theft via `window.location` redirect is not blocked by CSP.

**Impact on Finding 4:** Because the unpinned esm.sh import is still present *and* the CSP allows `esm.sh` in `script-src` *and* `'unsafe-inline'` is tolerated, a compromised or MITM'd esm.sh response has two vectors to execute attacker code, and inline-handler CSP weakness means there is no defense-in-depth net.

### 2.3 Dead-code callback detection — `access_token` hash check remains in `login.html`

`login.html` L507:
```js
if (window.location.search.includes('code=') || window.location.hash.includes('access_token')) {
```

With PKCE (`flowType: 'pkce'`), the callback URL contains `?code=…`, **not** `#access_token=…`. The `access_token` hash check is a dead-code remnant of the implicit flow. It is not actively exploitable (calling `handleAuthCallback()` on a hash containing `access_token` would simply find no session via `getSession()` and redirect to `/login`), but it indicates an incomplete migration and could confuse future maintainers.

### 2.4 Signup email redirect targets undefined route — pre-existing bug, still unfixed

`signup.html` L160:
```js
options: { emailRedirectTo: window.location.origin + '/signup-callback' }
```

There is **no `/signup-callback` route** in `vercel.json` (routes defined: `/`, `/login`, `/signup`, `/game`, and catch-all `/(.*)`). After a user clicks the email-verification link, they land on `https://portalcolosseum.com/signup-callback` → served by the catch-all as `/signup-callback` (a static file that does not exist) → **404**. The user cannot complete email/password signup.

This was not in the original 5 findings (it's an auth-flow correctness bug, not a security vulnerability per se) and was not addressed by commit `5d1bbf1`.

### 2.5 Signup username TOCTOU — pre-existing, noted in original review, still unfixed

From the original review's "Additional notes":
- `signup.html` L153: `localStorage.setItem('pendingUsername', username)` — username cached in `localStorage` (XSS-readable).
- `signup.html` L156–L162: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: '/signup-callback' } })` — **no `data: { username }` is passed**, so the username stored in `pendingUsername` is never sent to Supabase during account creation.
- Username availability is checked client-side via a `profiles.select('username')` query (L135–L139) with no server-side unique constraint enforcement.

This is a TOCTOU race + data loss issue. It was listed as a lower-severity additional note and remains untouched by the fix commit.

### 2.6 `console.log` of user PII in success paths

`login.html` L436: `console.log('Login successful:', data.user.email);`
`login.html` L347: `console.log(\`${provider} OAuth initiated successfully\`);`

These log the user's email address to the browser console. While not a high-severity issue (console output is not persisted and requires local access or an XSS to read), it is an unnecessary PII exposure that could be removed.

### 2.7 Missing security headers beyond CSP

Only `Content-Security-Policy` is configured in `vercel.json`. The following standard security headers are absent on all routes:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin` (or `no-referrer`)
- `Strict-Transport-Security` (HSTS)

The `api/env.js` endpoint sets `Content-Type: application/javascript` and `Cache-Control: no-store` (the latter being a correct fix for Finding 5's cache note), but does not set the above headers.

---

## 3. Priority Table — Top 5 Key Findings

| # | Finding | Severity | Status | Primary File(s) |
|---|---|---|---|---|
| 1 | **esm.sh import unpinned, no Subresource Integrity** — `@supabase/supabase-js@2` resolves to latest 2.x on every load; no `integrity` attribute. Combined with CSP allowing `esm.sh` in `script-src`, a CDN compromise or MITM injects first-party code with full access to the in-memory session. The fix commit overlooked this entirely. | MEDIUM | **UNFIXED** | login.html, signup.html, game.html |
| 2 | **CSP `script-src` includes `'unsafe-inline'`** — inline `onclick` handlers remain on every button, so the CSP provides no inline-script XSS protection. The `connect-src` restriction still limits exfiltration, but token theft via `window.location` redirect remains possible. | MEDIUM | **UNFIXED** | all HTML |
| 3 | **Session lost on every page reload** (in-memory storage adapter tradeoff) — the chosen fix for Finding 1 eliminates persistent XSS token theft but makes sessions non-recoverable across any full page load. Users are logged out on refresh, back/forward, or tab restart. | LOW→MEDIUM | **TRADEOFF** (acknowledged) | all HTML |
| 4 | **Signup email redirect targets undefined `/signup-callback` route** — users completing email/password signup via the verification email land on a 404 page and cannot enter the game. Pre-existing correctness bug, unfixed. | LOW | **UNFIXED** | signup.html, vercel.json |
| 5 | **Signup username TOCTOU** — client-side availability check + `pendingUsername` in `localStorage`, but `signUp()` is called without `data: { username }`, so the username is never persisted to the profile. Race condition + data loss. Pre-existing, noted in original review. | LOW | **UNFIXED** | signup.html |

---

## 4. Overall Assessment

**Net status:** 4 of 5 original findings are fixed. The auth bypass (Finding 2) and token-persistence (Finding 1) issues — the two highest-severity items — are resolved. PKCE is correctly implemented (Finding 5). The CSP header is present (Finding 3).

**Critical gap:** Finding 4 (unpinned esm.sh, no SRI) was **not addressed by the fix commit**. This is the single most important remaining item: the in-memory storage adapter removed the *persistent* XSS vector, but a compromised esm.sh response can still steal the *active* session during a page view (tokens are readable via `supabase.auth.getSession()` while the page is loaded, and exfiltration via `window.location` redirect is not blocked by `connect-src`).

**Recommended next actions (priority order):**
1. **Pin the esm.sh version** to an exact release (e.g., `@supabase/supabase-js@2.44.4`) and **add SRI `integrity` attributes** — or ideally vendor the bundle and serve from `self`.
2. **Replace inline `onclick` handlers** with `addEventListener` so `'unsafe-inline'` can be dropped from `script-src`, making the CSP an effective XSS mitigation layer.
3. **Address the session-persistence tradeoff** with a server boundary (HttpOnly refresh-token cookie + `/api/me` Edge Function) — the in-memory approach is a stopgap, not a long-term solution for a game requiring persistent sessions.
4. **Fix the `/signup-callback` route** (add a route in `vercel.json` or change `emailRedirectTo` to `/game` or `/signup`) so email verification completes successfully.
5. **Pass `data: { username }`** in `signUp()` and enforce username uniqueness via a database unique constraint + RLS-trusted insert in an Edge Function.
