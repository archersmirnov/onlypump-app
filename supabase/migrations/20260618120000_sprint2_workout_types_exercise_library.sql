alter table public.workouts
  add column if not exists workout_type text not null default 'strength';

alter table public.workout_exercises
  add column if not exists source_exercise_id uuid,
  add column if not exists exercise_category text not null default 'strength',
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists measurement_mode text not null default 'weight_reps',
  add column if not exists distance_unit text not null default 'km',
  add column if not exists counts_in_muscle_stats boolean not null default true;

alter table public.workout_sets
  add column if not exists weight_value numeric,
  add column if not exists reps_value integer,
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists distance_value numeric not null default 0,
  add column if not exists manual_calories numeric,
  add column if not exists estimated_calories numeric not null default 0;

create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  exercise_name text not null,
  normalized_name text not null,
  exercise_category text not null default 'strength',
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  measurement_mode text not null default 'weight_reps',
  weight_unit text not null default 'kg',
  distance_unit text not null default 'km',
  counts_in_muscle_stats boolean not null default true,
  is_custom boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_library_profile_id_idx
  on public.exercise_library(profile_id);

create index if not exists exercise_library_category_idx
  on public.exercise_library(exercise_category);

create unique index if not exists exercise_library_profile_normalized_category_idx
  on public.exercise_library(profile_id, normalized_name, exercise_category)
  where profile_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_exercises_source_exercise_id_fkey'
  ) then
    alter table public.workout_exercises
      add constraint workout_exercises_source_exercise_id_fkey
      foreign key (source_exercise_id)
      references public.exercise_library(id)
      on delete set null;
  end if;
end $$;
