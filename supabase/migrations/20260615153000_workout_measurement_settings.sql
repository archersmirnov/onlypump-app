alter table public.workout_exercises
  add column if not exists measure_weight_enabled boolean not null default true,
  add column if not exists measure_reps_enabled boolean not null default true,
  add column if not exists measure_time_enabled boolean not null default false,
  add column if not exists measure_rir_enabled boolean not null default false,
  add column if not exists measure_rpe_enabled boolean not null default false,
  add column if not exists weight_unit text not null default 'kg',
  add column if not exists double_weight_in_stats boolean not null default false;

alter table public.workout_sets
  add column if not exists work_time_seconds integer not null default 0;

alter table public.profiles
  add column if not exists default_weight_unit text not null default 'kg';

alter table public.workouts
  add column if not exists estimated_calories_burned integer not null default 0,
  add column if not exists duration_seconds integer not null default 0;
