-- Extend user_profiles and create sync triggers with auth.users

-- 1) Table definition (id references auth.users)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  providers text[],
  provider_type text,
  auth_created_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure columns exist (idempotent add)
alter table public.user_profiles add column if not exists display_name text;
alter table public.user_profiles add column if not exists email text;
alter table public.user_profiles add column if not exists phone text;
alter table public.user_profiles add column if not exists providers text[];
alter table public.user_profiles add column if not exists provider_type text;
alter table public.user_profiles add column if not exists auth_created_at timestamptz;
alter table public.user_profiles add column if not exists last_sign_in_at timestamptz;
alter table public.user_profiles add column if not exists created_at timestamptz default now();
alter table public.user_profiles add column if not exists updated_at timestamptz default now();

-- 2) Insert trigger: sync on new auth.users
create or replace function public.handle_auth_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_providers text[];
begin
  select coalesce(array_agg(distinct provider), array[]::text[])
    into v_providers
  from auth.identities
  where user_id = new.id;

  insert into public.user_profiles (
    id, display_name, email, phone, providers, provider_type, auth_created_at, last_sign_in_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.email,
    new.phone,
    v_providers,
    coalesce(new.raw_app_meta_data->>'provider', case when array_length(v_providers,1) > 0 then v_providers[1] else 'email' end),
    new.created_at,
    new.last_sign_in_at
  ) on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_insert on auth.users;
create trigger on_auth_user_insert
after insert on auth.users
for each row execute function public.handle_auth_user_insert();

-- 3) Update trigger: sync on changes in auth.users
create or replace function public.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_providers text[];
begin
  select coalesce(array_agg(distinct provider), array[]::text[])
    into v_providers
  from auth.identities
  where user_id = new.id;

  update public.user_profiles
  set
    display_name   = coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', display_name),
    email          = coalesce(new.email, email),
    phone          = coalesce(new.phone, phone),
    providers      = case when array_length(v_providers,1) is not null then v_providers else providers end,
    provider_type  = coalesce(new.raw_app_meta_data->>'provider', provider_type),
    auth_created_at= coalesce(new.created_at, auth_created_at),
    last_sign_in_at= coalesce(new.last_sign_in_at, last_sign_in_at),
    updated_at     = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_update on auth.users;
create trigger on_auth_user_update
after update on auth.users
for each row execute function public.handle_auth_user_update();

-- 4) One-time backfill for existing users
insert into public.user_profiles (id, display_name, email, phone, providers, provider_type, auth_created_at, last_sign_in_at)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name'),
  u.email,
  u.phone,
  (
    select coalesce(array_agg(distinct i.provider), array[]::text[])
    from auth.identities i
    where i.user_id = u.id
  ) as providers,
  coalesce(u.raw_app_meta_data->>'provider', 'email') as provider_type,
  u.created_at,
  u.last_sign_in_at
from auth.users u
left join public.user_profiles p on p.id = u.id
where p.id is null;

-- 6) Ensure default access policy for all users (peppy_only)
create or replace function ensure_default_access()
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_access_policies (user_id, access_type, updated_at)
  select u.id, 'human_only', now()
  from public.user_profiles u
  left join public.user_access_policies p on p.user_id = u.id
  where p.user_id is null;
end;
$$;

-- 5) (Optional) RLS policies sketch (enable and refine based on your needs)
-- alter table public.user_profiles enable row level security;
-- create policy user_read_own_profile on public.user_profiles for select using (auth.uid() = id);
-- create policy admin_read_profiles on public.user_profiles for select using (exists (select 1 from public.admin_users where id = auth.uid()));
