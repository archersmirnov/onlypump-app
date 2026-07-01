alter table public.daily_health_logs
  add column if not exists mood_key text,
  add column if not exists wellbeing_key text;

grant select, insert, update, delete on public.daily_health_logs to service_role;
