# Admin GUI — Grok Implementation Brief

## Overview

Build a `/admin` CRUD GUI for Portal Colosseum game configuration tables. The primary goal: let admins manage weapon templates and their attack mapping tables using **joined display names** instead of raw PK/FK integer IDs.

## Tech Stack (match existing patterns exactly)

- **Frontend:** Static `.html` + vanilla JS `.js` file (no React, no Next.js, no framework)
  - Pattern: `admin.html` + `admin-app.js` (same as `login.html` + `login-app.js`, `game.html` + `game-app.js`)
  - Import Supabase client from `https://esm.sh/@supabase/supabase-js@2.112.4` (CSP allows this)
  - Read config from `window.ENV` (set by `/api/env.js`)
  - Shared stylesheet: `style.css` (dark orange/brown fantasy theme: `#ff6b3b` primary, `#101f48` background, Courier New monospace)
- **Backend:** Vercel serverless API routes in `/api/admin/` directory
  - Pattern: follow `api/session.js` style — ES module `export async function GET/POST/PUT/DELETE`, use `createClient` with `SUPABASE_SERVICE_ROLE_KEY`
  - CORS headers: same as `api/session.js` (`Access-Control-Allow-Origin: https://portalcolosseum.com`)
- **Routing:** Add `/admin` route to `vercel.json` (same pattern as `/game`, `/login`, etc. with full CSP headers)
- **Auth:** Supabase OAuth (GitHub/Google) — same login flow as the game. No separate admin credentials.

## Security Model

1. User logs in at `/admin` using the same Supabase OAuth flow as the game (GitHub/Google)
2. The admin page sends the user's JWT access_token to `/api/admin/*` routes via `Authorization: Bearer <token>` header
3. Each `/api/admin/*` route:
   a. Creates a Supabase admin client with `SUPABASE_SERVICE_ROLE_KEY`
   b. Verifies the JWT by calling `supabase.auth.getUser(token)`
   c. Checks `profiles.is_admin = true` for that user's UUID
   d. If not admin → return 403 JSON `{ error: "Admin access required" }`
   e. If admin → proceed with the service-role client to do the DB operation
4. The service-role key NEVER reaches the client. All DB operations happen server-side.

### Auth helper pattern (put in each route or shared):

```javascript
import { createClient } from '@supabase/supabase-js';

async function verifyAdmin(request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Extract JWT from Authorization header
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { error: 'No auth token', status: 401 };

  // Verify the token
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token', status: 401 };

  // Check is_admin flag
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.is_admin) {
    return { error: 'Admin access required', status: 403 };
  }

  return { admin, user };
}
```

## Pages to Build

### 1. Admin Login Gate (`/admin` → `admin.html`)

- If user has no active session → show login buttons (GitHub, Google — same as `login.html`)
- If user has session → check `is_admin` via `/api/admin/auth-check` endpoint
  - If admin → show the admin dashboard
  - If not admin → show "Access denied" message
- The dashboard shows a simple menu: Attacks, Weapon Templates, Monster Templates
- All admin page text/data loads via `/api/admin/*` routes (never direct client Supabase queries)

### 2. Attacks Manager (`/admin` → Attacks tab)

**Table:** `attack` (16 rows currently)

**List view:** Table showing all attacks with columns:
- name, attack_type, base_damage_multiplier, prepare_time, cooldown_time, is_multi_target, is_spell, weight
- Each row has Edit and Delete buttons
- "Create New Attack" button at top

**Edit/Create form fields:**
- `name` (text, unique)
- `description` (textarea, nullable)
- `attack_type` (dropdown: simple, advanced, magic, multi_enemy, buff, debuff — these are the existing CHECK constraint values, do NOT add new ones)
- `base_damage_multiplier` (number, default 1.0)
- `prepare_time` (integer, default 10)
- `cooldown_time` (integer, default 10)
- `is_multi_target` (checkbox, default false)
- `is_spell` (checkbox, default false — "If true, this attack is only eligible for optional (Slot 3+) pools")
- `weight` (number, default 1.0)
- `allowed_weapon_types` (multi-select or comma-separated text, nullable — "NULL means all weapon types")

**Delete rule:** BLOCK deletion if the attack is referenced by:
- `weapon_template.slot_0_attack_id`
- `weapon_template_attack_mapping.attack_id`
- `monster_template.slot_0_attack_id`
- `monster_template_attack_mapping.attack_id`
- `weapon_instance.slot_N_attack_id` (any slot)
- `monster_instance.slot_N_attack_id` (any slot)
Show the user which references block deletion.

### 3. Weapon Templates Manager (`/admin` → Weapon Templates tab)

**Table:** `weapon_template` (7 rows currently)

**List view:** Table showing all weapon templates with columns:
- name, weapon_type, base_damage, base_speed, base_accuracy
- Each row has Edit and Delete buttons
- "Create New Weapon Template" button at top

**Edit/Create form fields:**
- `name` (text, unique)
- `weapon_type` (text — e.g., sword, dagger, axe, staff)
- `base_damage` (integer)
- `damage_range` (integer, default 0)
- `base_speed` (integer — lower = faster)
- `speed_variance` (integer, default 0)
- `base_accuracy` (integer)
- `accuracy_range` (integer, default 0)
- `slot_0_attack_id` (dropdown populated from `attack` table — shows attack **name**, stores attack **id**)
- `slot_1_chance` (float 0.0-1.0, default 1.0)
- `slot_2_chance` (float 0.0-1.0, default 0.8)
- `slot_3_chance` (float 0.0-1.0, default 0.4)
- `slot_4_chance` (float 0.0-1.0, default 0.0)

**Delete rule:** BLOCK deletion if the template is referenced by:
- `weapon_instance.template_id`
- `weapon_template_attack_mapping.weapon_template_id`
Show the user which references block deletion.

### 4. Weapon Template Attack Mapping (sub-view of Weapon Templates)

This is the PRIMARY feature — the reason we're building this admin GUI.

When you click a weapon template in the list, you see a **per-template editor** page showing:

**Header:** Weapon template name and stats (read-only summary)

**Slot 0:** Shows the base attack name (from `slot_0_attack_id`), read-only — it's set in the template form above.

**Slots 1-3:** For each slot, show a section listing all attacks assigned to that slot via `weapon_template_attack_mapping`:
- Each row shows: **attack name** (joined from `attack` table), **weight** (editable inline), and a **Remove** button
- Each slot section has an **"Add Attack to Slot N"** button that opens a dropdown/picker showing all attacks NOT already in this slot
- Adding an attack inserts a new row in `weapon_template_attack_mapping` with the template_id, attack_id, slot number, and default weight 1.0
- Weight changes update the `weapon_template_attack_mapping.weight` column

**API endpoints needed:**
- `GET /api/admin/weapon-templates/:id/mappings` — returns all mapping rows for a template, with attack names joined
- `POST /api/admin/weapon-templates/:id/mappings` — add attack to a slot `{ attack_id, slot, weight }`
- `PATCH /api/admin/weapon-templates/:id/mappings/:mappingId` — update weight
- `DELETE /api/admin/weapon-templates/:id/mappings/:mappingId` — remove attack from slot

**The mapping table constraint:** `slot` CHECK constraint allows slots 1, 2, 3 only (NOT 0 or 4). Slot 0 is on the template itself, slot 4 currently has no mapping pool (slot_4_chance defaults to 0).

### 5. Monster Templates Manager (`/admin` → Monster Templates tab)

Same structure as Weapon Templates but for `monster_template` + `monster_template_attack_mapping`.

**Table:** `monster_template` (1 row currently)

**Edit/Create form fields:**
- `name` (text)
- `base_damage` (integer)
- `damage_range` (integer)
- `base_speed` (integer)
- `speed_variance` (integer)
- `base_accuracy` (integer)
- `accuracy_range` (integer)
- `slot_0_attack_id` (dropdown from `attack` table — name shown, id stored)
- `slot_1_chance` through `slot_4_chance` (float 0.0-1.0, default 0)

**Monster template attack mapping sub-view:**
- Same per-template editor pattern as weapons
- Monster mapping allows slots 1-4 (CHECK constraint: `slot >= 1 AND slot <= 4`)
- Uses `monster_template_attack_mapping` table (columns: monster_template_id, attack_id, slot, weight)

**Delete rule:** BLOCK deletion if the template is referenced by:
- `monster_instance.template_id`
- `monster_template_attack_mapping.monster_template_id`

## API Route Structure

All routes go in `/api/admin/` directory. Each is a separate `.js` file (Vercel serverless function).

```
api/admin/
  auth-check.js          — POST: verify admin status (returns { is_admin: bool })
  attacks.js             — GET (list all), POST (create)
  attacks/
    [id].js              — GET (single), PUT (update), DELETE (with dependency check)
  weapon-templates.js    — GET (list all), POST (create)
  weapon-templates/
    [id].js              — GET (single), PUT (update), DELETE (with dependency check)
    [id]/
      mappings.js        — GET (list mappings with attack names), POST (add mapping)
      mappings/
        [mappingId].js   — PATCH (update weight), DELETE (remove mapping)
  monster-templates.js   — GET (list all), POST (create)
  monster-templates/
    [id].js              — GET (single), PUT (update), DELETE (with dependency check)
    [id]/
      mappings.js        — GET (list mappings with attack names), POST (add mapping)
      mappings/
        [mappingId].js   — PATCH (update weight), DELETE (remove mapping)
```

**NOTE on Vercel routing:** Vercel serverless functions with dynamic path segments use bracket notation (`[id].js`). Make sure `vercel.json` routes `/api/admin/*` correctly. The existing `api/session.js` is already served at `/api/session` without explicit routing in vercel.json — Vercel auto-discovers files in `/api/`. Files in `/api/admin/` should be auto-served at `/api/admin/*`.

## vercel.json Changes

Add this route entry BEFORE the catch-all `/(.*)` route:

```json
{
  "src": "/admin",
  "dest": "/admin.html",
  "headers": {
    "Content-Security-Policy": "default-src 'self'; script-src 'self' esm.sh https://*.supabase.co; connect-src 'self' https://*.supabase.co https://esm.sh; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  }
}
```

## Database Schema Reference

### attack table
- id (bigint, PK, identity)
- name (varchar, unique)
- description (varchar, nullable)
- attack_type (varchar, CHECK: simple|advanced|magic|multi_enemy|buff|debuff)
- base_damage_multiplier (float8, default 1.0)
- prepare_time (int, default 10)
- cooldown_time (int, default 10)
- is_multi_target (bool, default false)
- is_spell (bool, default false)
- weight (float8, default 1.0)
- allowed_weapon_types (text[], nullable — NULL = all weapon types)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### weapon_template table
- id (bigint, PK, identity)
- name (varchar, unique)
- weapon_type (varchar)
- base_damage (int)
- damage_range (int, default 0)
- base_speed (int)
- speed_variance (int, default 0)
- base_accuracy (int)
- accuracy_range (int, default 0)
- slot_0_attack_id (bigint, FK → attack.id, NOT NULL)
- slot_1_chance (float8, default 1.0)
- slot_2_chance (float8, default 0.8)
- slot_3_chance (float8, default 0.4)
- slot_4_chance (float8, default 0.0)
- created_at, updated_at (timestamptz)

### weapon_template_attack_mapping table
- id (bigint, PK, identity)
- weapon_template_id (bigint, FK → weapon_template.id)
- attack_id (bigint, FK → attack.id)
- slot (int, CHECK: slot IN [1,2,3])
- weight (real, default 1.0)
- created_at (timestamptz)

### monster_template table
- id (bigint, PK, identity ALWAYS)
- name (text)
- base_damage (int)
- damage_range (int)
- base_speed (int)
- speed_variance (int)
- base_accuracy (int)
- accuracy_range (int)
- slot_0_attack_id (bigint, FK → attack.id)
- slot_1_chance through slot_4_chance (real, default 0)
- created_at (timestamptz)

### monster_template_attack_mapping table
- id (bigint, PK, identity ALWAYS)
- monster_template_id (bigint, FK → monster_template.id)
- attack_id (bigint, FK → attack.id)
- slot (int, CHECK: slot >= 1 AND slot <= 4)
- weight (real, default 1.0)
- created_at (timestamptz)

## Files to Create

1. `admin.html` — Admin page HTML (login gate + dashboard container)
2. `admin-app.js` — Admin page JS (auth check, dashboard navigation, CRUD UI rendering)
3. `api/admin/auth-check.js` — POST: verify admin status
4. `api/admin/attacks.js` — GET (list), POST (create)
5. `api/admin/attacks/[id].js` — GET, PUT, DELETE (with dependency check)
6. `api/admin/weapon-templates.js` — GET (list), POST (create)
7. `api/admin/weapon-templates/[id].js` — GET, PUT, DELETE (with dependency check)
8. `api/admin/weapon-templates/[id]/mappings.js` — GET (list with joins), POST (add)
9. `api/admin/weapon-templates/[id]/mappings/[mappingId].js` — PATCH, DELETE
10. `api/admin/monster-templates.js` — GET (list), POST (create)
11. `api/admin/monster-templates/[id].js` — GET, PUT, DELETE (with dependency check)
12. `api/admin/monster-templates/[id]/mappings.js` — GET (list with joins), POST (add)
13. `api/admin/monster-templates/[id]/mappings/[mappingId].js` — PATCH, DELETE

## Files to Modify

1. `vercel.json` — Add `/admin` route (before the catch-all)

## Out of Scope (do NOT build)

- No Invite Key Manager
- No Users/admin management panel
- No weapon_instance, monster_instance, or player_inventory management (those are generated at runtime)
- No new attack types, weapon types, or game mechanics
- No separate admin credentials system
- No changes to existing pages (login, game, signup, etc.)
- No changes to database schema

## Key Reminders

- All DB operations use the service-role key SERVER-SIDE only. The client never has the service key.
- The client sends the user's JWT to the API, the API verifies admin status before every operation.
- Show attack/template NAMES in the UI, not integer IDs. The API routes should JOIN and return names.
- Block all deletes that have FK dependencies — check before deleting and return a helpful error.
- Match the existing code style: vanilla JS, ES module imports from esm.sh, Courier New monospace theme.
- The existing CSP allows: `script-src 'self' esm.sh https://*.supabase.co` and `connect-src 'self' https://*.supabase.co https://esm.sh`
- Follow naming convention: singular snake_case table names (attack, weapon_template, etc.)
