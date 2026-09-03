# Claude Migration Brief: Vercel → Supabase Edge Functions

## What We're Doing

Migrating the invite verification system from Vercel Edge Functions to Supabase Edge Functions, while keeping security-critical session management (`session.js`) and environment config (`env.js`) on Vercel.

## Why (Security Context)

- **invitee-verify.js**: Uses `service_role` key (server-side only). Benefits from Supabase secret namespace isolation. Safe to migrate.
- **session.js**: Sets HttpOnly cookies. MUST stay on Vercel because HttpOnly cookies cannot cross registrable domain boundaries (e.g., `supabase.co` → `portalcolosseum.com`). This is a fundamental browser security boundary.
- **env.js**: Serves only public `anon_key` (already public by design). No security benefit to migrating; adds CORS complexity. Stays on Vercel.

## Current State

- `api/invite-verify.js` — Vercel Edge function, 248 lines
- `supabase/functions/` — **directory doesn't exist yet** (migration target)
- `supabase/migrations/` — Has invite_keys table, RLS, seed data. **No RPC functions** (`verify_invite_key`, `mark_invite_key_used` are referenced but not defined)
- Frontend JS files (`landing-app.js`, `signup-app.js`) — call `/api/invite-verify` with hardcoded Vercel path

## What Claude Should Do

1. **Review the actual codebase** (all `.js`, `.ts`, `.sql`, `.json`, `.toml` files — NOT `.md` files)
2. **Identify all code that currently calls `/api/invite-verify`** and needs updating to the new Supabase Function URL
3. **Create the missing Supabase Edge Function** at `supabase/functions/invite-verify/index.ts`
4. **Create the missing RPC SQL migration** for `verify_invite_key` and `mark_invite_key_used` functions
5. **Update frontend JS** to call the new Supabase Function URL (derived from `window.ENV.SUPABASE_URL`, not hardcoded)
6. **Ensure test key "EyeOfTheWorld"** still works in the new function
7. **Add proper CORS headers** including `Vary: Origin`
8. **Server-side Origin validation** on all methods (especially DELETE)
9. **Generic error responses** — never leak `service_role` or internal details

## Constraints

- Do NOT modify `session.js` or `env.js` (they stay on Vercel)
- Do NOT remove `/api/invite-verify.js` from Vercel yet (keep during transition)
- Frontend must derive Supabase Function URL from existing `window.ENV.SUPABASE_URL`
- CORS: only `https://portalcolosseum.com` origin (no `Allow-Credentials` needed)
- Use `service_role` key for DB operations (server-side only, never exposed)

## Success Criteria

- Supabase Edge Function created and working
- All frontend calls updated to use the new function
- RPC functions exist and match the function's expectations
- Test key "EyeOfTheWorld" still validates
- No security regressions (XSS, token exposure, CORS misconfiguration)
