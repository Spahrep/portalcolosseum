# Database Naming Convention & Primary Key Strategy

**Source:** Research + Project Decision (2026-08-30)
**Updated:** 2026-09-01 — Added PK strategy documentation
**Status:** Active Convention

## Table Naming

- **Singular form**: `weapon_template`, `attack`, `weapon_instance`
- **Snake_case**: all lowercase, underscores between words
- **Descriptive**: `weapon_template` not `wtemplate`

## Primary Key Strategy

### Design Decision: BIGINT for game data, UUID for auth

| Table | PK Type | Reason |
|---|---|---|
| `user` / `profiles` | `uuid` | Required — must reference Supabase `auth.users` table which uses UUID |
| `weapon_template` | `bigint` (auto-increment) | Game data table — integers are human-readable, compact, and standard in game dev |
| `attack` | `bigint` (auto-increment) | Same as above |
| `weapon_template_attack` | `bigint` (auto-increment) | Junction table — consistent with parent tables |
| `match` | TBD | Future table — likely `bigint` for same game-data reasons |

### Rationale

1. **UUID is forced for `profiles`**: Supabase Auth's `auth.users` table uses UUID for all user IDs. The `profiles` table references it and must use the same type.

2. **BIGINT for game data tables**: 
   - **Debugging**: Integer IDs (`weapon_template #3`) are readable in logs and error messages, unlike UUIDs (`a1b2c3d4-...`)
   - **Testing**: Can type `curl /api/weapons/1` instead of copying a UUID
   - **Performance**: 8 bytes vs 16 bytes = half the index size; integer comparison is faster than 16-byte memcmp
   - **Industry standard**: Most game studios (Steam, Minecraft, etc.) use integer IDs for game entities
   - **No security loss**: Weapon templates are public data (anyone can view them via RLS). IDs only need to be unguessable when they're sensitive (like user data)

3. **Consistency within table groups**: Once `profiles` is UUID (by necessity), keeping game tables on BIGINT is acceptable — the two types serve different purposes (identity vs game entities).

### Implementation

PostgreSQL `bigint` with `generated always as identity` for auto-increment:
```sql
id bigint primary key generated always as identity,
```

### When to use UUID instead

- User-facing IDs that need to be unguessable (invites, password reset tokens)
- Tables that directly reference `auth.users`
- Any table where enumeration attacks are a concern (e.g., user-generated content with privacy controls)

## Column Naming

- **Lowercase**: `base_damage`, not `Base_Damage`
- **Snake_case**: `slot_1_pool`, `created_at`
- **Consistent terminology**: `created_at` / `updated_at` on all timestamp columns

## Future Tables (anticipated)

- `weapon_template` ✅ (exists)
- `attack` ✅ (exists)
- `weapon_instance` — instantiated weapons with rolled stats
- `element` — elemental damage types
- `weapon_type` — sword, dagger, axe, etc.
- `match` — match records
- `inventory_item` — player's carried items
- `portal_run` — player's portal run progress
