alter table public.daily_health_logs
  add column if not exists cardio_completed boolean,
  add column if not exists extra_activity_completed boolean,
  add column if not exists measurements_done boolean,
  add column if not exists photo_done boolean;

grant select, insert, update, delete on public.daily_health_logs to service_role;

notify pgrst, 'reload schema';
