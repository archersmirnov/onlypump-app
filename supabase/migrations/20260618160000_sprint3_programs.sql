create extension if not exists pgcrypto;

create table if not exists public.program_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text unique,
  name text not null,
  description text not null default '',
  goal text,
  default_duration_weeks integer not null default 8,
  min_duration_weeks integer not null default 4,
  max_duration_weeks integer not null default 16,
  default_difficulty text not null default 'intermediate',
  workouts_per_week integer not null default 3,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_template_workouts (
  id uuid primary key default gen_random_uuid(),
  program_template_id uuid not null references public.program_templates(id) on delete cascade,
  template_workout_key text,
  week_number integer not null default 1,
  day_index integer not null default 1,
  title text not null,
  workout_type text not null default 'strength',
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_template_exercises (
  id uuid primary key default gen_random_uuid(),
  program_template_workout_id uuid not null references public.program_template_workouts(id) on delete cascade,
  template_exercise_key text,
  exercise_library_id uuid references public.exercise_library(id) on delete set null,
  exercise_name text not null,
  sort_order integer not null default 1,
  target_sets integer not null default 3,
  rep_min integer not null default 8,
  rep_max integer not null default 12,
  target_reps integer,
  target_weight numeric,
  target_duration_seconds integer,
  target_distance numeric,
  measurement_mode text not null default 'weight_reps',
  progression_mode text not null default 'double_progression',
  progression_weight_step numeric not null default 2.5,
  progression_rep_step integer not null default 1,
  deload_weight_steps integer not null default 1,
  regression_threshold_sessions integer not null default 2,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_exercise_alternatives (
  id uuid primary key default gen_random_uuid(),
  program_template_exercise_id uuid not null references public.program_template_exercises(id) on delete cascade,
  exercise_library_id uuid references public.exercise_library(id) on delete set null,
  exercise_name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.user_programs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  program_template_id uuid references public.program_templates(id) on delete set null,
  template_key text,
  client_id text,
  name text not null,
  started_at date not null default current_date,
  duration_weeks integer not null default 8,
  difficulty text not null default 'intermediate',
  plan_mode text not null default 'flexible',
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_program_exercise_settings (
  id uuid primary key default gen_random_uuid(),
  user_program_id uuid not null references public.user_programs(id) on delete cascade,
  program_template_exercise_id uuid references public.program_template_exercises(id) on delete set null,
  template_exercise_key text,
  client_id text,
  selected_exercise_library_id uuid references public.exercise_library(id) on delete set null,
  selected_exercise_name text not null,
  target_sets integer not null default 3,
  rep_min integer not null default 8,
  rep_max integer not null default 12,
  progression_weight_step numeric not null default 2.5,
  progression_rep_step integer not null default 1,
  progression_mode text not null default 'double_progression',
  deload_weight_steps integer not null default 1,
  regression_threshold_sessions integer not null default 2,
  measurement_mode text not null default 'weight_reps',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workouts
  add column if not exists user_program_id uuid references public.user_programs(id) on delete set null,
  add column if not exists user_program_client_id text,
  add column if not exists program_template_workout_id uuid references public.program_template_workouts(id) on delete set null,
  add column if not exists program_template_workout_key text,
  add column if not exists program_week_number integer,
  add column if not exists program_day_index integer,
  add column if not exists program_name text,
  add column if not exists program_plan_mode text,
  add column if not exists program_difficulty text,
  add column if not exists is_program_generated boolean not null default false;

alter table public.workout_exercises
  add column if not exists user_program_exercise_setting_id uuid references public.user_program_exercise_settings(id) on delete set null,
  add column if not exists user_program_exercise_setting_client_id text,
  add column if not exists program_template_exercise_id uuid references public.program_template_exercises(id) on delete set null,
  add column if not exists program_template_exercise_key text,
  add column if not exists planned_sets integer,
  add column if not exists planned_rep_min integer,
  add column if not exists planned_rep_max integer,
  add column if not exists planned_weight numeric,
  add column if not exists planned_reps integer,
  add column if not exists progression_state jsonb,
  add column if not exists double_count_in_statistics boolean not null default false;

alter table public.exercise_library
  add column if not exists double_weight_in_stats boolean not null default false,
  add column if not exists double_count_in_statistics boolean not null default false;

create index if not exists program_template_workouts_template_idx
  on public.program_template_workouts(program_template_id, sort_order);

create index if not exists program_template_exercises_workout_idx
  on public.program_template_exercises(program_template_workout_id, sort_order);

create index if not exists user_programs_profile_idx
  on public.user_programs(profile_id, status);

create index if not exists user_program_exercise_settings_program_idx
  on public.user_program_exercise_settings(user_program_id);

create index if not exists workouts_user_program_idx
  on public.workouts(user_program_id, workout_date);
