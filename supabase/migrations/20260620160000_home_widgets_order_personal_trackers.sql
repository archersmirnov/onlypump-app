-- Stores home widget layout and personal tracker state per profile.
alter table public.profiles
  add column if not exists home_widgets_order jsonb default null,
  add column if not exists personal_trackers jsonb default null,
  add column if not exists home_state_updated_at timestamptz;

grant select, insert, update, delete on public.profiles to service_role;
