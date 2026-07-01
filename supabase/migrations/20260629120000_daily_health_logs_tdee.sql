alter table public.daily_health_logs
  add column if not exists tdee_kcal integer default 0,
  add column if not exists bmr_kcal integer default 0,
  add column if not exists neat_kcal integer default 0,
  add column if not exists tef_kcal integer default 0,
  add column if not exists eat_kcal integer default 0,
  add column if not exists bmr_percent integer default 0,
  add column if not exists neat_percent integer default 0,
  add column if not exists tef_percent integer default 0,
  add column if not exists eat_percent integer default 0,
  add column if not exists tef_needs_review boolean default false,
  add column if not exists neat_needs_review boolean default false,
  add column if not exists eat_needs_review boolean default false,
  add column if not exists tdee_formula_version text default '';

grant select, insert, update, delete on public.daily_health_logs to service_role;
