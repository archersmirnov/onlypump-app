-- Role-based access and invite links for ONLYPUMP test/admin flow.
alter table public.profiles
  add column if not exists roles text[] default '{}',
  add column if not exists is_owner boolean default false,
  add column if not exists is_admin boolean default false,
  add column if not exists is_trainer boolean default false,
  add column if not exists trainer_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists access_expires_at timestamptz,
  add column if not exists invited_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists invite_code text,
  add column if not exists deleted_at timestamptz;

create table if not exists public.profile_invite_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  trainer_profile_id uuid references public.profiles(id) on delete set null,
  access_days integer,
  access_expires_at timestamptz,
  max_uses integer,
  uses_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists profile_invite_links_code_idx on public.profile_invite_links(code);
create index if not exists profile_invite_links_created_by_idx on public.profile_invite_links(created_by_profile_id);
create index if not exists profiles_trainer_profile_id_idx on public.profiles(trainer_profile_id);
create index if not exists profiles_roles_gin_idx on public.profiles using gin(roles);

update public.profiles
set
  roles = array(select distinct unnest(coalesce(roles, '{}') || array['owner', 'admin', 'trainer'])),
  is_owner = true,
  is_admin = true,
  is_trainer = true,
  access_status = 'allowed',
  access_granted_at = coalesce(access_granted_at, now()),
  deleted_at = null
where lower(coalesce(telegram_username, '')) = 'archer_ss';

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.profile_invite_links to service_role;
