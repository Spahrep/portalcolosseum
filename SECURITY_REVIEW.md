# Portal Colosseum — Auth Flow Security Review

**Scope:** `login.html`, `signup.html`, `game.html` (JS sections), `api/env.js`, `public/env.js`.
**Approach:** Static review of client-side JS, token handling, OAuth/password flows, XSS surfaces, and security headers/config.
**Summary:** 2 HIGH-severity issues (token theft, auth bypass), 1 CRITICAL (session-token storage in `localStorage`), plus 3 medium/lint issues. Overall risk is **elevated** — a single successful XSS leads to full account takeover because refresh tokens are persisted in XSS-readable storage and the game page can be accessed with no session at all.

---

## Finding 1 — CRITICAL: Full session (incl. refresh token) persisted to `localStorage`

**Files:** `login.html` (L291, L420, L467), `signup.html` (L175), `game.html` (L127).

All auth pages call `localStorage.setItem('supabaseSession', JSON.stringify(session))` after login, callback, and on every `getSession()` hit in `game.html`. The Supabase `session` object contains:
- `access_token` — a JWT valid for ~1 hour.
- `refresh_token` — a long-lived credential that can mint **new** access tokens indefinitely until revoked.

**Why it matters:** `localStorage` is readable by **any** JS executing in the page context. It survives tab close, is shared across tabs, and is *not* `HttpOnly`. Any XSS — in the app, a third-party dependency, or the `esm.sh` CDN (see Finding 4) — immediately yields the victim's refresh token, enabling persistent account takeover that survives logout (the attacker can mint fresh access tokens after the victim logs out). This is the single highest-impact issue because it turns any future XSS into a critical.

> Note: Supabase JS v2 *also* stores the session in `localStorage` itself by default (the `createClient()` calls pass no custom `storage`/cookie adapter), so tokens are duplicated in storage — removing the manual `localStorage.setItem('supabaseSession', …)` lines alone is insufficient; the client default must be overridden too.

**Fix:**
- **Primary:** Do not keep refresh tokens on the client at all. Move auth behind a server boundary that stores the refresh token in an `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) cookie. The SPA then calls an authenticated `/api/me` (or a `protected` Edge Function) using the cookie, and the server holds the refresh token.
- **Practical incremental step if a server boundary isn't available yet:** (a) remove every manual `localStorage.setItem('supabaseSession', …)`; (b) configure `createClient` with an in-memory storage adapter so tokens never persist to `localStorage` — accepting that refreshes are lost on reload; (c) call `supabase.auth.refreshSetAuth()` carefully or re-prompt on reload. This stops the *persistent* XSS theft but does not eliminate it for the page's lifetime.
- Either way, **add CSRF protection** for any cookie-based approach (double-submit or signed cookie) and ensure `credentials: 'include'` pairs with a restrictive `SameSite`.

---

## Finding 2 — HIGH: Authentication bypass on `/game` via stale/manipulable `localStorage`

**File:** `game.html` (L114–L146).

`initGame()` only redirects to `/login` when `playerName` resolves to `'Guest'`. In every fallback path, a non-empty `playerName` in `localStorage` grants access with **no session check**:

```js
// no session:
playerName = localStorage.getItem('playerName') || 'Guest';
if (playerName === 'Guest') { window.location.href = '/login'; return; }  // ← any value != 'Guest' stays
...
// exception / supabase-not-initialized:
playerName = localStorage.getItem('playerName') || 'Guest';  // ← no redirect, stays on page
```

**Why it matters:** A user can `localStorage.setItem('playerName','admin')` in the console (or carry over a value from a previously-logged-out session where `logout()` did run but the value lingered) and reach the arena page with no valid Supabase session. The page then renders `player-name` from that unverified value. Even worse, the `catch` block on a transient Supabase error silently downgrades to the unauthenticated path instead of failing closed.

**Fix:** Make the check **fail closed**:
- If `supabase.auth.getSession()` returns **no** session → `window.location.href = '/login'; return;` unconditionally. Do **not** consult `localStorage` for access decisions.
- If `supabase.auth.getSession()` **throws** → fail closed to `/login` (do not fall back to localStorage).
- Treat `localStorage.playerName` as a **purely cosmetic cache** (display name only), never as an auth signal.
- Guard the whole boot path: if `supabase` didn't initialize, redirect to `/login` (current "Guest" fallback keeps the page rendered with stale data).

---

## Finding 3 — HIGH: No Content-Security-Policy (no XSS defense-in-depth)

**Files:** all HTML pages; `vercel.json` has no `headers` block.

There is **no** CSP `<meta>` tag and **no** `Content-Security-Policy` response header anywhere (verified: zero matches for `Content-Security-Policy`/`http-equiv`/security headers across the repo). Combined with:
- inline `<script>` blocks and inline `style` on every page,
- `<script src="https://esm.sh/...">` first-party-equivalent execution,
- inline `onclick="…"` handlers,

…there is no mitigation layer between a bug and arbitrary script execution. CSP would at least cap the blast radius of any injection and block the most common XSS exfiltration channels (`connect-src` restricting token exfiltration to the legitimate Supabase origin).

**Fix:** Add a restrictive CSP via `vercel.json` `headers` (prefer an HTTP header over a `<meta>` so it applies to the env.js response too):
```json
{ "headers": [{
  "source": "/(.*)",
  "headers": [{
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline' esm.sh https://*.supabase.co; connect-src 'self' https://*.supabase.co; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  }]
}]}
```
Then progressively harden: replace inline `onclick` with `addEventListener` and drop `'unsafe-inline'` from `script-src`; self-host (or pin+sign) the Supabase bundle and drop the `esm.sh` host.

---

## Finding 4 — MEDIUM: Unpinned CDN dependency with no Subresource Integrity

**Files:** `login.html` (L33), `signup.html` (L22), `game.html` (L30).

```html
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

The dependency is imported from `esm.sh` with:
- **no version pin** — `@2` always resolves to the latest `2.x` (which can introduce breaking changes or, on a compromised/compromised-proxy CDN, malicious code), and
- **no Subresource Integrity** (`integrity="…"`) — the browser cannot verify the payload hash, so any in-path tampering (MITM on non-HSTS, CDN compromise, sub-domain hijack of `esm.sh`) runs as first-party script with full access to `window.ENV`, the Supabase client, and the `localStorage` tokens.

**Fix:**
- Pin to an exact release, e.g. `@supabase/supabase-js@2.44.4` (verify the SRI hash against the published artifact).
- Add an `integrity="sha384-…"` attribute matched to that exact file so tampering is detected by the browser.
- **Stronger:** vendor/bundle the client at build time and serve it from your own origin (`self`), removing the runtime third-party dependency entirely — this also shrinks your CSP surface (Finding 3).

---

## Finding 5 — MEDIUM: OAuth uses the implicit (hash) flow instead of PKCE

**File:** `login.html` (L323–L351), `signup.html` (L93–L104), and the callback handler (login L454–L477, signup L168–L180).

`signInWithOAuth()` is called with no `authRedirectFlowType`, so the client defaults to the **implicit flow**: the authorization server returns `access_token`+`refresh_token` straight in the URL hash, which `getSessionFromUrl({ storeSession: true })` then parses and persists.

**Why it matters:** Tokens transiently live in `window.location.hash`, which is visible to:
- browser history / session history (the hash is committed to the navigation entry until the redirect-to-`/game` clears it), and
- any `referrer`-leak-adjacent surface (e.g. a misconfigured downstream request, or analytics/crash reporters that read `location`).

PKCE (authorization-code-with-PKCE) instead returns an opaque `code` that the client exchanges server-side, so tokens never touch the URL and the code is single-use. The JS client supports this via `authRedirectFlowType: 'pkce'` in `createClient` or per-`signInWithOAuth` options.

**Fix:**
- Initialize the client (or each OAuth call) with `authRedirectFlowType: 'pkce'`:
  ```js
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { authRedirectFlowType: 'pkce' }
  });
  ```
- Then switch callback handling to the code-exchange path — `supabase.auth.exchangeCodeForSession(code)` (or rely on auto-handoff in current v2 when `storeSession` is default) — instead of `getSessionFromUrl`.
- This is a **defense-in-depth** improvement on top of Finding 1; the refresh-token-in-`localStorage` risk remains until Finding 1 is fixed.

---

## Additional (lower-severity) notes

- **`api/env.js` `Cache-Control: public`** — the anon key (and per-preview `SUPABASE_URL`) is served with `Cache-Control: public, max-age=0, s-maxage=0, must-revalidate`. For preview deployments with distinct keys, `public` lets an intermediate CDN serve one preview's envelope to a different preview. → Change to `Cache-Control: no-store` for this response, or `private`.
- **`window.debugSupabase = () => supabase`** (`login.html` L497) — exposes the entire client (anon key + live session/tokens) to the console and to any XSS. Remove or gate behind a `NODE_ENV === 'development'` check before release.
- **`signup.html` username check is non-authoritative** — availability is checked client-side via a `select` then stored to `pendingUsername` in `localStorage`, but `signUp()` is called without passing `data: { username }`, so the profile-creation trigger has no username to persist. Race-condition + TOCTOU. Enforce uniqueness server-side (DB unique constraint + RLS-trusted insert in an Edge Function) rather than as a client gate.
- **`getSessionFromUrl` is deprecated** in current `@supabase/supabase-js` v2 in favor of `exchangeCodeForSession`; migration aligns with the PKCE fix (Finding 5).

---

## Priority order

| # | Issue | Priority | Files |
|---|-------|----------|-------|
| 1 | Refresh/access tokens persisted to `localStorage` | **CRITICAL** | login, signup, game |
| 2 | `/game` accessible with no session (stale `playerName` in `localStorage`) | **HIGH** | game.html |
| 3 | No CSP anywhere | **HIGH** | all HTML, vercel.json |
| 4 | Unpinned `esm.sh` import, no SRI | MEDIUM | login, signup, game |
| 5 | OAuth implicit flow (tokens in URL hash), not PKCE | MEDIUM | login, signup |

The two critical/high issues (1 and 2) should be fixed before any meaningful "authenticated game" content lands on `/game`.
