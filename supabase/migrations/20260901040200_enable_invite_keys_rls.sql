-- ============================================================
-- Enable RLS on invite_keys table
-- ============================================================
-- The invite_keys table contains invite codes that should ONLY be
-- accessible by the Supabase service_role key (used server-side by
-- the /api/invite-verify Edge Function). Anon users must NOT be able
-- to read or modify invite keys via the Data API.
-- ------------------------------------------------------------
-- Without RLS, anyone with the anon key could:
--   - Read all invite codes and bypass the invite-only system
--   - Mark keys as unused and reuse them indefinitely
-- With RLS, anon access is denied by default (no policies = no access).
-- The service_role key bypasses RLS, so the Edge Function works normally.

-- Enable Row Level Security
alter table public.invite_keys enable row level security;

-- Create an explicit deny-all policy for anon users.
-- This makes the intent clear: no one can access invite_keys via the
-- anon key. The service_role key (used by our Edge Function) bypasses
-- RLS entirely.
create policy "Deny all access to anon users"
on public.invite_keys
for all
using (false)
with check (false);
