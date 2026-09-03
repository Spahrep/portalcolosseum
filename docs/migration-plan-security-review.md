# Security Review: Migration Plan — Vercel → Supabase Edge Functions

**Document under review:** `docs/migration-plan-vercel-to-supabase-edge.md`
**Reviewer:** Hermes Agent (security-focused)
**Date:** 2026-09-02
**Overall risk assessment: HIGH — the plan does not adequately address the security regressions inherent in crossing origins.**

---

## Executive Summary

The migration plan moves two Edge Functions (`session.js`, `env.js`) from Vercel
(same-origin: `portalcolosseum.com`) to Supabase Edge Functions (cross-origin:
`*.supabase.co`). This single architectural change cascades into five distinct
security regressions, several of which are **not acknowledged** in the plan.

The most severe issue: the current `session.js` sets **HttpOnly cookies scoped to
`portalcolosseum.com`**. After migration to `supabase.co`, those cookies either
(a) cannot be set for `portalcolosseum.com` (browser domain-boundary enforcement)
or (b) would be **third-party cookies** that modern browsers block outright.
There is **no path** described in the plan that preserves the HttpOnly
protection of the refresh token while maintaining cross-origin operation.

Additionally, the plan's CORS configuration is **missing
`Access-Control-Allow-Credentials: true`**, which means even the current
`credentials: 'include'` calls from the frontend would fail in production
after migration.

Finally, the code on disk shows that **all four frontend JS modules still use
`localStorage`-backed PKCE storage** — the full session object (including the
`refresh_token`) remains in `localStorage` and is therefore XSS-readable. The
plan implicitly assumes a hybrid cookie+memory model that does not match
reality, causing it to understate the XSS risk of Option A.

---

## Focus Area 1 — Cross-Origin Session Management (Vercel Edge → Supabase Edge)

### Current architecture (same-origin)
- `POST /api/session` receives a `refresh_token` from the client, validates it
  via the Supabase Admin API (`service_role`), and sets an
  **HttpOnly / Secure / SameSite=Lax** cookie scoped to `portalcolosseum.com`.
- The client calls `/api/session` with `credentials: 'include'`; the browser
  automatically attaches the cookie.
- `GET /api/session` reads the cookie, refreshes the token server-side, and
  returns the access token in the JSON body (not persisted client-side).
- `DELETE /api/session` clears the cookie.

**Security properties preserved by same-origin:**
| Property | Mechanism |
|---|---|
| XSS cannot read refresh token | HttpOnly cookie |
| Token not in localStorage long-term | Access token returned in body, used ephemerally |
| CSRF on state-changing ops | SameSite=Lax (cookie not sent on cross-site POST) |

### After migration (cross-origin)
The frontend must call
`https://tfwwapxewlxiclufpcct.supabase.co/functions/v1/session`. This creates a
cross-origin request between `portalcolosseum.com` and `supabase.co`.

**Critical finding — the plan's CORS block is incomplete:**
```http
Access-Control-Allow-Origin: https://portalcolosseum.com
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```
**Missing:** `Access-Control-Allow-Credentials: true`

Without this header, the browser **will not send or receive cookies** on
cross-origin requests even if `credentials: 'include'` is set on the fetch
call. The current frontend code uses `credentials: 'include'` in every
`/api/session` call (confirmed in `game-app.js` L190, L212, L277; `login-app.js`
L69, L171; `signup-app.js` L306, L338). All of these would break after
migration unless the CORS config is corrected.

**Recommendation:** If any cookie-based approach is retained, add
`Access-Control-Allow-Credentials: true` to the Supabase Edge Function
CORS headers.

### Security regression matrix

| Threat | Same-origin (current) | Cross-origin (migrated) | Notes |
|---|---|---|---|
| Refresh token theft via XSS | HttpOnly cookie — not readable | Depends on option (see Area 2) | See analysis below |
| CSRF | SameSite=Lax blocks cross-site POST | CORS-only (weaker) | CORS is a browser-mechanism, not a cryptographic guarantee |
| Token replay | Cookie is Secure + SameSite | JSON body (Option A) — token in JS memory | See Area 2 |
| Cookie fixation | N/A — cookie set server-side | N/A — cookies don't work cross-origin | See Area 2 |

---

## Focus Area 2 — Cookie Domain Issue & Tradeoff Analysis

### The hard constraint
A cookie set by `https://tfwwapxewlxiclufpcct.supabase.co` receives
`Domain=supabase.co` (or no Domain attribute, defaulting to the exact host).
The browser **will not** store or send this cookie for requests to
`portalcolosseum.com`. This is not a CORS or configuration issue — it is a
fundmental browser security boundary. The `Domain` attribute cannot cross
registrable domain boundaries.

**Compounding factor:** Safari ITP, Firefox Enhanced Tracking Protection, and
Chrome's announced third-party cookie phase-out will block third-party cookies
regardless of `SameSite` or `Secure` attributes.

### Discrepancy in the plan vs. actual code
The plan presents Option A as "return tokens in JSON body, store in memory."
However, the code on disk shows that **all four frontend modules
(`login-app.js`, `signup-app.js`, `game-app.js`, `reset-password-app.js`)
configure the Supabase client with a `localStorage`-backed storage adapter:**
```js
storage: {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key)
}
```
This means the Supabase JS SDK writes the **full session object (including
`refresh_token`) to `localStorage`** — which is XSS-readable. The
`SECURITY_REVIEW_PASS2.md` claims this was changed to in-memory no-op storage,
but the current code does not reflect that. **The plan's Option A analysis is
based on an incorrect assumption about the current storage model.**

If Option A is adopted as-is (tokens in JSON body, no cookies) but the
`localStorage`-backed storage adapter remains, the `refresh_token` would be
exposed to XSS in two places:
1. In the JSON response (interceptable by a man-in-the-browser XSS)
2. In `localStorage` (persistently stored by the Supabase SDK)

### Option A: JSON body + in-memory storage — security tradeoff analysis

**What the plan claims (gain):**
- Eliminates HTTP cookie domain/scope issues entirely.
- No third-party cookie dependency.

**Security gains:**
- ✅ No persistent cookie to steal via network interception (though Secure
  mitigates this already).
- ✅ If truly in-memory only, XSS during page lifetime cannot read a token that
  has been garbage-collected.

**Security losses:**
- ❌ **Refresh token in JS-accessible memory** — any XSS that fires while the
  page is loaded can read the session via `supabase.auth.getSession()`.
  While not *persistent* like localStorage, the window of exposure is the
  entire page session (potentially hours for a game tab left open).
- ❌ **Session destruction on reload** — in-memory storage is wiped on every
  full page load. The user is logged out on refresh, back/forward, tab close,
  and browser restart. For a game, this is a severe UX regression.
- ❌ **No server-side session revocation capability** — the client holds the
  only copy of the refresh token. If the token is leaked, revocation must
  happen through Supabase's token revocation API, which requires knowing the
  token. With a server-side cookie, revocation can be forced by simply
  clearing the cookie.
- ❌ **Race condition on token refresh** — without a persistent refresh token,
  the client must refresh proactively before the 1-hour access token expires.
  If the page is backgrounded and the refresh fails silently, the user loses
  their session without recourse.
- ❌ **PKCE code_verifier still in localStorage** — even with Option A, the
  Supabase SDK needs to persist the PKCE code_verifier across OAuth redirects
  (the provider flow opens a new browser context). If the storage adapter is
  set to localStorage (as the current code does), the code_verifier is still
  XSS-readable. Switching to in-memory breaks the OAuth flow.
- ❌ **Indirect security from poor UX** — users frustrated by frequent
  logouts may adopt insecure workarounds (staying logged in on shared devices,
  writing down credentials, using simpler passwords).

### Option B: Reverse proxy through Vercel — security tradeoff analysis

**Security gains:**
- ✅ Preserves all current security properties (same-origin cookies, HttpOnly,
  SameSite=Lax).
- ✅ No CORS complexity.

**Security losses:**
- ❌ **Defeats the migration purpose** — if the session function still routes
  through Vercel, the team still pays for Vercel Edge Function execution.
- ❌ **Adds proxy attack surface** — path traversal, SSRF via malformed paths,
  header injection, response splitting. The proxy must carefully strip
  attacker-controlled headers.
- ❌ **Increased latency** — Vercel → Supabase Edge → Supabase Auth, double
  hop instead of direct.

### Unaddressed alternatives

The plan presents only two options. Two additional approaches should be
considered:

1. **Custom domain for Supabase Edge Functions** — Supabase supports custom
   domains for Edge Functions. If the session function is served at
   `https://portalcolosseum.com/functions/v1/session`, it would be
   same-origin and cookies would work. This preserves all security properties
   while still moving execution off Vercel. Cost/complexity of custom domain
   setup is not addressed in the plan.

2. **Keep session function on Vercel; migrate only env.js** — The session
   function is the only one with security-critical secrets (service_role key)
   and cookie-based auth. Migrating env.js (which only serves the public anon
   key) is low-risk and achieves partial migration. This avoids the cookie
   domain problem entirely.

### Recommendation for Area 2
- **Do not adopt Option A without also switching the PKCE storage adapter to
  in-memory** — but document that this breaks OAuth cross-context flows
  (password reset via email link, social login).
- **Add `Access-Control-Allow-Credentials: true`** if any cookie-based approach
  is retained.
- **Consider the custom-domain alternative** to preserve HttpOnly cookie
  protection.
- **Do not adopt Option B** unless the team is willing to accept continued
  Vercel Edge Function cost (contradicting the migration goal).

---

## Focus Area 3 — Service Role Key Exposure Risk

### Current state (Vercel)
- `SUPABASE_SERVICE_ROLE_KEY` is a Vercel project-level environment variable.
- It is used only in `api/session.js` (token exchange) and
  `api/invite-verify.js` (invite key validation).
- Vercel encrypts env vars at rest and restricts them to the deployment
  environment. Each function is a separate deployment unit.

### Migration to Supabase Edge Functions
- The service_role key would be stored as a Supabase project secret
  (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`).
- **All Edge Functions in the project share the same secret namespace** —
  `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` is available to every function.

### Increased exposure risks

#### 3.1 Shared secret namespace (HIGH)
If a future Edge Function is deployed with a bug — e.g., an error handler that
serializes `Deno.env` to a response, a debug endpoint, or a logging statement
that includes the key — the service_role key would be exposed. Since all
functions share the secret, a bug in the *env* function could compromise the
session function's secrets and vice versa. On Vercel, env vars are also
shared across functions, but Vercel's isolation model and error handling
differ (Vercel sanitizes error output more aggressively).

**Mitigation:** Supabase Edge Functions should be audited for any code path
that could serialize environment variables to responses, logs, or error
messages. The `env.js` function is trivial, but if it's expanded or if
debug logging is added, the risk increases.

#### 3.2 Error logging exposure (MEDIUM)
Supabase Edge Functions capture stdout/stderr in their built-in logs. If an
error occurs in `getSupabaseAdmin()` (e.g., the key is unset and the error
message includes the key name), or if a library logs configuration on
startup, the service_role key could appear in Supabase's log viewer. The
Supabase log viewer is accessible to project members with appropriate roles.

**Current code risk:** `api/session.js` line 45:
```js
throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
```
This logs the variable *name* but not the value — safe. But any future
change that logs the actual key value (e.g., for debugging) would be
catastrophic.

#### 3.3 Admin API for token refresh (MEDIUM — design concern)
The session function uses `admin.auth.refreshSession()` with the service_role
key. This can refresh **any user's** token — not just the authenticated
user's. The function accepts a `refresh_token` in the POST body with no
additional binding to the requesting user's identity.

**Risk scenario:** If an attacker can call the session function (e.g., via a
CORS bypass, or if the CORS config is misconfigured to allow their origin),
they can submit any user's refresh token and get a valid access token back.
This is not a new risk introduced by the migration, but the migration makes
it cross-origin, increasing the attack surface (more CORS preflight
interactions, potential for origin confusion).

**Mitigation:** The function should validate the `Origin` header server-side
on every request, not just rely on CORS preflight.

#### 3.4 Key rotation window (MEDIUM)
Rotating the service_role key requires:
1. Creating a new key in the Supabase dashboard
2. Setting it as a Supabase Edge Function secret
3. Redeploying all affected functions

There is a window where old deployments may still reference the old key. If the
old key is compromised and then rotated, old function deployments (still
serving traffic) would be using the old (now-revoked) key, causing
authentication failures. The same applies on Vercel, but Vercel's deployment
model makes the cutoff cleaner.

### Recommendation for Area 3
- **Scope secrets per-function** if possible — though Supabase Edge Functions
  share a project-level secret namespace, so this may not be feasible.
- **Audit all error/log paths** in the migrated function for accidental
  exposure of `Deno.env` values.
- **Add server-side Origin/Referer validation** on every request to the
  session function, as defense-in-depth alongside CORS.
- **Document the rotation procedure** with a clear cutoff plan.

---

## Focus Area 4 — CORS Security

### The plan's proposed CORS config
```http
Access-Control-Allow-Origin: https://portalcolosseum.com
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Issues

#### 4.1 Missing `Access-Control-Allow-Credentials` (HIGH — functional blocker)
Without this header set to `true`, the browser will not send cookies or
receive `Set-Cookie` headers on cross-origin requests. The current frontend
uses `credentials: 'include'` on all session calls. If the plan adopts
cookie-based auth (which the current code depends on), **every session call
will fail silently** — the cookie won't be sent, and the function will return
401. The plan does not mention this header at all.

If Option A (JSON body, no cookies) is adopted, `credentials: 'omit'` would
be needed on the client side, but the plan does not specify this change
either. The migration code example in Phase 2.2 shows:
```js
// May need: credentials: 'omit' (depending on cookie approach)
```
This uncertainty indicates the plan has not resolved a fundamental
architectural decision.

#### 4.2 Missing `Vary: Origin` (LOW — cache poisoning)
Without `Vary: Origin`, an intermediate CDN (including Supabase's) could
cache a response from one origin and serve it to a different origin. Since
the origin is restricted to `https://portalcolosseum.com`, the practical risk
is low, but it's a defense-in-depth gap. Best practice: add
`Vary: Origin` whenever `Access-Control-Allow-Origin` is a non-`*` value.

#### 4.3 No server-side Origin validation (MEDIUM — CSRF defense gap)
CORS preflight (`OPTIONS`) is enforced by the browser, but **simple requests**
(GET, and POST with `application/x-www-form-urlencoded` or `text/plain`)
bypass preflight entirely. A malicious site can issue a `GET /session` to the
Supabase function without a preflight challenge if the `Origin` header is
not validated server-side.

While the malicious site's `fetch()` response would be unreadable (CORS
blocks the response for non-allowlisted origins), the **request itself**
(sending data to the endpoint, triggering side effects) could still succeed.
For a `GET /api/session` with a refresh_token in localStorage (XSS-readable),
this is not directly exploitable. But for endpoints that accept `POST` or
`DELETE` with simple content types, CSRF is possible.

**Mitigation:** Validate the `Origin` or `Referer` header server-side on
all non-GET/OPTIONS requests. The current `api/session.js` does not do this.

#### 4.4 `env.js` endpoint CORS exposure (LOW)
The `env.js` function returns `SUPABASE_ANON_KEY` — which is public by
Supabase design. However, adding CORS headers to expose it cross-origin
means any site that can pass the origin check can read the anon key. While
the anon key only has RLS-scoped permissions, a misconfigured CORS policy
(e.g., allowing wildcard or echoing Origin) would let any site obtain the
key and probe the PostgREST API directly, bypassing the frontend's
intended usage patterns.

**Mitigigation:** The env function should use the same restrictive CORS
policy (specific origin, no wildcard). The plan's Phase 3.1 mentions it "will
need its own CORS headers" but provides no specific policy.

#### 4.5 Authorization header with anon key (LOW — information leak via header)
The migration example in Phase 2.2 sends
`Authorization: Bearer ${anonKey}`. The anon key is already public (served
via env.js), so this is not a new exposure. However, sending the anon key as
an Authorization header means it may appear in proxy logs, browser dev tools
network tab (already visible), and Supabase's own request logging. With
cookies, the auth credential is implicit and does not appear in request
headers that might be logged.

### Recommendation for Area 4
- **Add `Access-Control-Allow-Credentials: true`** if cookies are retained;
  set `credentials: 'include'` on the client.
- **If Option A (no cookies) is adopted**, set `credentials: 'omit'` on all
  client fetch calls and remove the `Authorization` header from the CORS
  allowed headers (not needed for JSON body auth).
- **Add `Vary: Origin`** to all responses.
- **Add server-side Origin/Referer validation** on all state-changing
  requests (POST, DELETE) as CSRF defense-in-depth.
- **Do NOT echo the Origin header** — hardcode the specific origin.

---

## Focus Area 5 — Environment Variable Exposure (`env.js` → Supabase Edge)

### Current state
- `/api/env.js` is a Vercel serverless function that injects
  `window.ENV.SUPABASE_URL` and `window.ENV.SUPABASE_ANON_KEY` via JavaScript
  execution (`<script src="/api/env.js">`).
- `Cache-Control: no-store` prevents caching (already fixed per
  SECURITY_REVIEW_PASS2).
- `Content-Type: application/javascript` — the response is executed as a
  script, meaning any injection into the response could become XSS.
- The **anon key is already exposed to the browser** — this is by Supabase's
  design. The anon key has only the permissions granted by RLS policies.
- The **service_role key is NOT exposed** — it is only used server-side in
  Edge Functions.

### Migration change
- Move to a Supabase Edge Function.
- Change from JS injection to JSON response (per plan: "Return config as
  JSON instead of injecting JS").
- Add CORS headers for cross-origin access.

### Security analysis

#### 5.1 Anon key exposure — no change (LOW)
The anon key is already public in the current architecture. Moving env.js
to a Supabase Edge Function does not change the anon key's exposure level.
The anon key is designed to be client-side safe — it only has permissions
granted by RLS. **No regression.**

#### 5.2 JS injection → JSON: security improvement (LOW)
Switching from `<script src="/api/env.js">` (executes returned JS) to a
`fetch()` + `JSON.parse()` model is a **security improvement**:
- JS injection means the response is executed as code. If a bug causes
  untrusted data to be included in the response, it becomes XSS.
- JSON is parsed as data, not executed. Even if the response is tampered
  with, it cannot execute script unless the consuming code does `eval()` or
  `innerHTML` with the values.

**Caveat:** The JSON approach introduces a **race condition** — the app must
wait for the fetch to complete before reading `window.ENV`. If the app does
not properly await this, it may fall back to insecure defaults (empty
strings) or crash. The migration code example shows:
```js
async function loadConfig() {
  const res = await fetch('.../env');
  window.ENV = await res.json();
}
```
The plan does not describe how to ensure all scripts wait for this to
complete before reading `window.ENV`.

#### 5.3 CORS misconfiguration amplifies anon key exposure (MEDIUM)
If env.js is moved cross-origin, it must have CORS headers. If misconfigured
(e.g., `Access-Control-Allow-Origin: *` or echoing Origin), the anon key
and `SUPABASE_URL` would be readable by **any website**, not just
`portalcolosseum.com`.

While the anon key is public by design, exposing the `SUPABASE_URL` (which
reveals the Supabase project reference) to any site allows an attacker to:
- Probe the PostgREST API directly with the anon key
- Identify the exact Supabase project for targeted attacks
- Test rate limits and API behavior from an external context

**Mitigation:** Use the same restrictive CORS policy as the session function
(specific origin only, `Vary: Origin`).

#### 5.4 The env.js function should not migrate at all (RECOMMENDATION)
The `env.js` function serves two static values (`SUPABASE_URL` and
`SUPABASE_ANON_KEY`) that are **already public**. There is no security
benefit to serving them from a Supabase Edge Function:
- **No secrets are involved** — the anon key is designed to be client-side.
- **The migration adds CORS complexity** (cross-origin, headers, preflight)
  for zero security gain.
- **A misconfigured CORS policy** on env.js could expose the Supabase URL
  to any site — a new attack vector that doesn't exist today (same-origin
  means only `portalcolosseum.com` can ever read the env.js response).

**Recommendation:** Keep `env.js` on Vercel (same-origin, no CORS needed).
Only migrate `session.js` (the function with the actual secret — the
service_role key).

Alternatively, if the env config is to be served from Supabase, consider
making `SUPABASE_URL` and `SUPABASE_ANON_KEY` available as **static build-
time constants** embedded in the HTML, since they are public and do not
need runtime injection. The current serverless-function approach provides
zero security benefit for public values.

### Recommendation for Area 5
- **Keep env.js on Vercel** — it serves only public values and migrating it
  adds CORS risk without security benefit.
- **If migrated, use strict CORS** (specific origin, `Vary: Origin`, no
  wildcard).
- **If the JSON approach is adopted, ensure all frontend scripts properly
  await config loading** before initializing the Supabase client.

---

## Pre-existing Issues That the Migration Amplifies or Preserves

These issues exist in the current codebase (not introduced by the migration,
but relevant to the security posture):

### Issue A: Refresh token in localStorage (CRITICAL — pre-existing)
All four frontend modules configure the Supabase client with a
`localStorage`-backed storage adapter. This means the **full session object
(including `refresh_token`) is written to `localStorage`** by the Supabase SDK
itself. This is XSS-readable and persistent across tabs and browser restarts.

The `SECURITY_REVIEW_PASS2.md` claims this was fixed (changed to in-memory
no-op storage), but **the code on disk does not reflect this** — all four
modules use `localStorage.getItem/setItem/removeItem`. This discrepancy means
either:
1. The fix was reverted after the review, or
2. The review was inaccurate.

This is critical for the migration because:
- Option A assumes tokens are "stored temporarily in memory (not localStorage)"
  per the plan (L66). But the current code stores them in localStorage.
- If Option A is adopted without fixing the storage adapter, the XSS exposure
  remains — the refresh token is in localStorage regardless of the cookie
  approach used by the session function.

**Recommendation:** Before migration, fix the PKCE storage adapter to use
in-memory storage. This breaks OAuth cross-context flows (password reset via
email link, social login) — a documented tradeoff. If those flows are needed,
consider keeping the code_verifier in localStorage (it's single-use and
low-value) while keeping the session tokens in memory.

### Issue B: Missing `Vary: Origin` and `Allow-Credentials` in current session.js (HIGH)
The current `api/session.js` already sets CORS headers for
`Access-Control-Allow-Origin: https://portalcolosseum.com` but omits both
`Vary: Origin` and `Access-Control-Allow-Credentials: true`. While this
happens to work today (same-origin requests don't need CORS), it would break
immediately after migration to cross-origin.

### Issue C: `invite-verify.js` not in scope (MEDIUM — planning gap)
The migration plan mentions only `session.js` and `env.js`, but
`api/invite-verify.js` also uses the `SUPABASE_SERVICE_ROLE_KEY` and would
also need migration if the goal is to make Vercel "purely a static asset
host." The plan's "What stays on Vercel" section says "Nothing else," but
the invite-verify function is not addressed. This should either be:
- Added to the migration scope (with the same CORS/secret-exposure
  considerations), or
- Explicitly excluded and documented as remaining on Vercel.

### Issue D: No server-side Origin validation (MEDIUM)
None of the current Edge Functions validate the `Origin` or `Referer`
header server-side. They rely entirely on CORS for origin restriction. For
state-changing operations (POST, DELETE), this is a CSRF risk if a simple
request bypasses preflight.

---

## Checklist of Required Changes Before Migration

| # | Requirement | Area | Priority |
|---|---|---|---|
| 1 | Fix the PKCE storage adapter to match the intended security model (in-memory for session tokens; localStorage only for code_verifier if OAuth cross-context is needed) | Pre-existing / Area 2 | **CRITICAL** |
| 2 | Resolve the `credentials: 'include'` vs `'omit'` decision and update all frontend fetch calls accordingly | Area 1, Area 4 | **CRITICAL** |
| 3 | Add `Access-Control-Allow-Credentials: true` to CORS headers IF cookies are retained | Area 1, Area 4 | **HIGH** |
| 4 | Add `Vary: Origin` to all CORS responses | Area 4 | **MEDIUM** |
| 5 | Add server-side `Origin`/`Referer` validation on POST/DELETE handlers | Area 4 | **MEDIUM** |
| 6 | Decide whether `env.js` and `invite-verify.js` should also migrate | Area 5, Issue C | **MEDIUM** |
| 7 | Verify that `SUPABASE_SERVICE_ROLE_KEY` is never logged or serialized in any error path | Area 3 | **HIGH** |
| 8 | Add a key-rotation procedure with a documented cutoff window | Area 3 | **MEDIUM** |
| 9 | Resolve the PKCE code_verifier storage requirement for OAuth/password-reset flows before switching to in-memory | Area 2 | **CRITICAL** |

---

## Summary

The migration from same-origin Vercel Edge Functions to cross-origin Supabase
Edge Functions introduces a **class of security regressions that the plan
does not adequately address**:

1. **Cookies cannot work cross-origin** — the HttpOnly/SameSite cookie
   protection of the refresh token is fundamentally incompatible with the
   supabase.co → portalcolosseum.com cross-origin model. Option A (JSON body)
   replaces it with JS-accessible memory, which is weaker against XSS.
2. **The CORS config is incomplete** — missing `Allow-Credentials`, missing
   `Vary: Origin`, and no server-side Origin validation.
3. **The service_role key moves to a shared secret namespace** — all Edge
   Functions share Supabase project secrets, increasing blast radius if any
   function has an error-handling or logging bug.
4. **The plan's assumptions about the current storage model are wrong** — the
   code still uses localStorage-backed PKCE storage, so the "in-memory" premise
   of Option A does not hold.
5. **env.js has no reason to migrate** — it serves only the public anon key,
   and moving it cross-origin adds CORS risk without security benefit.

**The single most important action before migration: resolve the cookie vs.
token-in-memory architectural decision explicitly, and fix the actual
storage adapter in the frontend code to match.**
