-- Auth users are managed by Supabase Auth (auth.users table)
-- This profiles table extends auth.users with game-specific data

-- Create profiles table that links to Supabase Auth users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username varchar(32) unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) so profiles are only accessible by the owning user
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
on public.profiles for select using (true);

create policy "Users can insert their own profile."
on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile."
on public.profiles for update using (auth.uid() = id);

-- Trigger function to automatically update the updated_at column on row changes
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_temp
as $$
begin
  if auth.uid() is not null then
    new.updated_at = now();
    return new;
  else
    raise exception 'User ID is not set';
  end if;
end;
$$;

-- Attach the trigger to the profiles table
create trigger handle_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Trigger function to auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Use username from user metadata if provided (set via signUp data: { username }),
  -- otherwise fall back to preferred_username, then email prefix
  insert into public.profiles (id, username)
  values (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'username')::varchar(32),
      (NEW.raw_user_meta_data->>'preferred_username')::varchar(32),
      split_part(NEW.email, '@', 1)::varchar(32)
    )
  );
  return NEW;
end;
$$;

-- Attach the trigger to auth.users for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
