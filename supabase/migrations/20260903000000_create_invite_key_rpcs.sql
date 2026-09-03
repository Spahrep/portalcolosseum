-- ============================================================
-- Portal Colosseum - Invite Key RPC Functions
-- ============================================================
-- Defines the two RPCs called by the invite-verify Supabase Edge
-- Function (supabase/functions/invite-verify/index.ts):
--
--   public.verify_invite_key(p_key text)     -> jsonb
--   public.mark_invite_key_used(p_key text)  -> boolean
--
-- Why RPCs instead of the Edge Function querying invite_keys directly:
--   1. The Edge Function needs no table privileges, so the deny-all RLS
--      policy from 20260901040200_enable_invite_keys_rls.sql remains the
--      single authoritative statement about who may touch this table.
--   2. Consuming a key becomes a single atomic UPDATE inside the database
--      instead of a read-then-write round trip from the edge.
--   3. The functions expose exactly two verbs and never return the key
--      list, so even a compromised caller cannot enumerate invite codes.
--
-- Both functions are SECURITY DEFINER (they must bypass RLS to read and
-- write invite_keys) with `search_path = ''` so that every reference is
-- schema-qualified and cannot be hijacked by a caller-controlled
-- search_path. EXECUTE is revoked from PUBLIC/anon/authenticated and
-- granted only to service_role.
--
-- The hardcoded test key ("EyeOfTheWorld") is intentionally NOT seeded
-- into invite_keys. It is matched in the Edge Function against the
-- INVITE_KEY_HARDCODED secret and is never consumed — a DB row would be
-- flipped to used = true on first signup and stop working.
-- ============================================================

-- ------------------------------------------------------------
-- verify_invite_key: is this key usable right now?
-- ------------------------------------------------------------
-- Returns jsonb: { "valid": boolean, "reason": text }
--   reason = 'ok'      -> key exists and is unused
--            'invalid' -> no such key
--            'used'    -> key exists but has already been consumed
--            'missing' -> no key supplied
-- `reason` is a stable machine code; user-facing wording lives in the
-- Edge Function so the database never dictates client copy.
create or replace function public.verify_invite_key(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used boolean;
begin
  if p_key is null or btrim(p_key) = '' then
    return jsonb_build_object('valid', false, 'reason', 'missing');
  end if;

  select ik.used
    into v_used
    from public.invite_keys ik
   where ik.key = p_key;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;

  if v_used then
    return jsonb_build_object('valid', false, 'reason', 'used');
  end if;

  return jsonb_build_object('valid', true, 'reason', 'ok');
end;
$$;

comment on function public.verify_invite_key(text) is
  'Checks whether an invite key exists and is unused. Returns {valid, reason}. '
  'Called by the invite-verify Edge Function with the service_role key.';

-- ------------------------------------------------------------
-- mark_invite_key_used: consume a key
-- ------------------------------------------------------------
-- Returns true only if THIS call flipped the key from unused to used.
-- The `and used = false` predicate makes consumption atomic: concurrent
-- callers race on the row and exactly one of them gets true, so a key
-- can never be reported as consumed twice.
create or replace function public.mark_invite_key_used(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_key is null or btrim(p_key) = '' then
    return false;
  end if;

  update public.invite_keys
     set used = true
   where key = p_key
     and used = false;

  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

comment on function public.mark_invite_key_used(text) is
  'Atomically consumes an invite key. Returns true only if this call was the '
  'one that marked it used. Called by the invite-verify Edge Function.';

-- ------------------------------------------------------------
-- Privileges
-- ------------------------------------------------------------
-- Postgres grants EXECUTE on new functions to PUBLIC by default. Because
-- these are SECURITY DEFINER and bypass RLS, leaving that default in place
-- would let any anon caller validate and burn invite keys through the Data
-- API — defeating the RLS policy on invite_keys entirely. Revoke first,
-- then grant narrowly.
revoke all on function public.verify_invite_key(text) from public;
revoke all on function public.mark_invite_key_used(text) from public;

-- Explicit, even though these roles only ever inherited from PUBLIC: it
-- documents the intent and survives a future default-privilege change.
revoke all on function public.verify_invite_key(text) from anon, authenticated;
revoke all on function public.mark_invite_key_used(text) from anon, authenticated;

grant execute on function public.verify_invite_key(text) to service_role;
grant execute on function public.mark_invite_key_used(text) to service_role;
