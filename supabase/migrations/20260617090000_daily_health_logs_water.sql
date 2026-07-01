alter table public.daily_health_logs
add column if not exists water_ml integer default 0,
add column if not exists water_target_ml integer default 2500;

grant select, insert, update, delete on public.daily_health_logs to service_role;
