alter table public.profiles
  add column if not exists display_name_locked boolean default false,
  add column if not exists display_name_source text default 'telegram',
  add column if not exists display_name_updated_at timestamptz;
