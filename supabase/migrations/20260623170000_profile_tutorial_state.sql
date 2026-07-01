-- Stores cross-device interactive tutorial progress per profile.
alter table public.profiles
  add column if not exists tutorial_completed_screens jsonb default '[]'::jsonb,
  add column if not exists tutorial_skipped_screens jsonb default '[]'::jsonb,
  add column if not exists tutorial_awards jsonb default '[]'::jsonb,
  add column if not exists tutorial_completed_at timestamptz,
  add column if not exists tutorial_skipped_at timestamptz,
  add column if not exists tutorial_state_updated_at timestamptz;

grant select, insert, update, delete on public.profiles to service_role;
