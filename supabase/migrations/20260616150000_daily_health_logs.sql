alter table public.profiles
  add column if not exists display_name_locked boolean default false,
  add column if not exists display_name_source text default 'telegram',
  add column if not exists display_name_updated_at timestamptz,
  add column if not exists goal_intensity_percent numeric default 10,
  add column if not exists deficit_percent numeric default 10,
  add column if not exists shoulders_cm numeric,
  add column if not exists chest_cm numeric,
  add column if not exists biceps_cm numeric,
  add column if not exists abdomen_cm numeric,
  add column if not exists glutes_cm numeric,
  add column if not exists thigh_cm numeric,
  add column if not exists calf_cm numeric;

alter table public.profiles
  alter column display_name_locked set default false,
  alter column display_name_source set default 'telegram',
  alter column goal_intensity_percent set default 10,
  alter column deficit_percent set default 10;

alter table public.body_measurements
  add column if not exists shoulders_cm numeric,
  add column if not exists chest_cm numeric,
  add column if not exists biceps_cm numeric,
  add column if not exists abdomen_cm numeric,
  add column if not exists glutes_cm numeric,
  add column if not exists thigh_cm numeric,
  add column if not exists calf_cm numeric;

with ranked_measurements as (
  select
    id,
    row_number() over (
      partition by profile_id, measurement_date
      order by created_at desc nulls last, id desc
    ) as row_index
  from public.body_measurements
)
delete from public.body_measurements
where id in (
  select id
  from ranked_measurements
  where row_index > 1
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'body_measurements_profile_date_unique'
  ) then
    alter table public.body_measurements
    add constraint body_measurements_profile_date_unique
    unique (profile_id, measurement_date);
  end if;
end $$;

alter table public.nutrition_goal_history
  add column if not exists goal_intensity_percent numeric default 10,
  add column if not exists deficit_percent numeric default 10;

alter table public.nutrition_goal_history
  alter column goal_intensity_percent set default 10,
  alter column deficit_percent set default 10;

create table if not exists public.daily_health_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  steps_count integer default 0,
  sleep_started_at timestamptz,
  sleep_ended_at timestamptz,
  sleep_duration_minutes integer default 0,
  sleep_latency_minutes integer default 0,
  sleep_awakenings integer default 0,
  sleep_quality_score numeric,
  recovery_score numeric,
  notes text,
  constraint daily_health_logs_profile_date_unique unique (profile_id, log_date)
);

with ranked_health_logs as (
  select
    id,
    row_number() over (
      partition by profile_id, log_date
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_index
  from public.daily_health_logs
)
delete from public.daily_health_logs
where id in (
  select id
  from ranked_health_logs
  where row_index > 1
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_health_logs_profile_date_unique'
  ) then
    alter table public.daily_health_logs
    add constraint daily_health_logs_profile_date_unique
    unique (profile_id, log_date);
  end if;
end $$;

create index if not exists daily_health_logs_profile_date_idx
on public.daily_health_logs(profile_id, log_date desc);

alter table public.daily_health_logs enable row level security;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.body_measurements to service_role;
grant select, insert, update, delete on public.nutrition_goal_history to service_role;
grant select, insert, update, delete on public.daily_health_logs to service_role;
