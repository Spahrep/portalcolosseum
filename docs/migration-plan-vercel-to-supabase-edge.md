# Migration Plan: Vercel → Supabase Edge Functions

## Overview

**Goal:** Move **existing** Edge Functions from Vercel to Supabase Edge Functions.
Vercel becomes purely a static asset host.

**What's being migrated:**
- `/api/session.js` — Session management (auth bridge)
- `/api/env.js` — Environment config endpoint

**What stays on Vercel:**
- Static HTML/CSS/JS frontend
- Nothing else — Vercel becomes pure static hosting

**What stays on Supabase:**
- Database (PostgreSQL)
- Auth
- Storage

---

## Current Architecture

| Component | Provider | Location |
|-----------|----------|----------|
| Static frontend | Vercel | `/` (auto-deploy) |
| Session management | Vercel Edge | `/api/session.js` |
| Environment config | Vercel Edge | `/api/env.js` |
| Authentication | Supabase | Built-in Auth |
| Database | Supabase | PostgreSQL |

---

## Target Architecture

| Component | Provider | Location |
|-----------|----------|----------|
| Static frontend | Vercel | `/` (auto-deploy) |
| Session management | **Supabase Edge** | `/supabase/functions/session/` |
| Environment config | **Supabase Edge** | `/supabase/functions/env/` |
| Authentication | Supabase | Built-in Auth |
| Database | Supabase | PostgreSQL |

---

## Phase 1: Setup & Environment (1 hour)

### 1.1 Supabase CLI Setup
- [ ] Verify Supabase CLI installed locally (`supabase --version`)
- [ ] Link local project to remote: `supabase link --project-id tfwwapxewlxiclufpcct`

### 1.2 Copy Existing Functions
Create new files in `supabase/functions/`:
```
supabase/
├── functions/
│   ├── session/
│   │   └── index.ts        # Migrated from api/session.js
│   └── env/
│       └── index.ts        # Migrated from api/env.js
└── ...
```

### 1.3 Environment Variables
Verify these exist in Supabase project (they should, since Vercel already uses them):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Check via: `supabase secrets list`

---

## Phase 2: Migrate Session Management (1 hour)

### 2.1 Copy session.js logic to Supabase Edge Function

The existing `api/session.js` already has all the correct logic.
Create `supabase/functions/session/index.ts` with the **same logic**,
adapted for the Supabase Edge runtime:

```typescript
import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

// Same cookie-building logic, GET/POST/DELETE handlers
// Key difference: use Deno.env.get() instead of process.env
// Key difference: Supabase Edge Functions use a different handler signature
```

### 2.2 Update Frontend Calls
In your client-side JS files (`login-app.js`, `signup-app.js`, etc.):
```javascript
// OLD: fetch('/api/session')
// NEW: fetch('https://tfwwapxewlxiclufpcct.supabase.co/functions/v1/session')
```

The URL pattern is:
`https://<PROJECT_REF>.supabase.co/functions/v1/<function-name>`

### 2.3 Remove session.js from Vercel
Delete `api/session.js` from Vercel's `/api/` directory, or leave it
empty but remove the route from `vercel.json`.

---

## Phase 3: Migrate env.js (30 min)

### 3.1 Copy env.js logic
Create `supabase/functions/env/index.ts` with the existing env-serving logic.

### 3.2 Update Frontend Calls
```javascript
// OLD: fetch('/api/env')
// NEW: fetch('https://tfwwapxewlxiclufpcct.supabase.co/functions/v1/env')
```

### 3.3 Remove env.js from Vercel

---

## Phase 4: Verification (1 hour)

### 4.1 Local Testing
- Run `supabase start` to test locally
- Test session management flow locally:
  - Signup/login → POST /api/session (via Supabase function)
  - Refresh token on page load → GET /api/session
  - Logout → DELETE /api/session
- Verify no 500 errors or CORS issues

### 4.2 Security Review (Claude Required)
This migration touches:
- **Supabase service_role key usage** → Claude review
- **Auth/RLS/session handling** → Claude review
- **Environment variable exposure** → Claude review

### 4.3 Production Deploy
1. Deploy Supabase functions:
   ```bash
   supabase functions deploy session
   supabase functions deploy env
   ```
2. Deploy frontend update (`vercel --prod`)
3. Monitor auth flow in production
4. Check for CORS issues
5. Verify session cookies work across both domains

---

## Rollback Plan

If issues arise:
1. Revert frontend API calls back to `/api/session` and `/api/env`
2. Restore `api/session.js` and `api/env.js` to Vercel
3. No database changes needed — rollback is purely code-level

---

## Constraints Checklist
- [x] No new stack (staying on Vercel + Supabase)
- [x] No SladeMini production (everything tested via preview)
- [x] No paid hosting upgrade (Supabase Edge has generous free tier)
- [x] CSP compatible (functions return JSON, no inline scripts)
- [x] Git author: `slademini@theslades.ca`

---

*Created: 2026-09-02*