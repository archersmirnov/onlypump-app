alter table public.program_templates
  add column if not exists creator_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by_role text,
  add column if not exists audience text default 'унисекс',
  add column if not exists focus text,
  add column if not exists schedule_pattern text,
  add column if not exists cycle_length_days integer not null default 7,
  add column if not exists workout_count integer not null default 3,
  add column if not exists progression_type text not null default 'double_progression',
  add column if not exists visibility_scope text not null default 'all',
  add column if not exists target_role text,
  add column if not exists target_profile_ids uuid[] not null default '{}',
  add column if not exists is_user_created boolean not null default false;

alter table public.program_template_workouts
  add column if not exists offset_days integer,
  add column if not exists duration_minutes integer not null default 0;

alter table public.program_template_exercises
  add column if not exists muscle_group text,
  add column if not exists rest_seconds integer,
  add column if not exists rest_after_seconds integer,
  add column if not exists rir numeric,
  add column if not exists rpe numeric,
  add column if not exists tempo text;

create index if not exists program_templates_creator_idx
  on public.program_templates(creator_profile_id, created_at desc);

create index if not exists program_templates_target_profiles_gin_idx
  on public.program_templates using gin(target_profile_ids);

grant usage on schema public to service_role;

grant select, insert, update, delete on public.program_templates to service_role;
grant select, insert, update, delete on public.program_template_workouts to service_role;
grant select, insert, update, delete on public.program_template_exercises to service_role;
grant select, insert, update, delete on public.program_exercise_alternatives to service_role;
grant select, insert, update, delete on public.user_programs to service_role;
grant select, insert, update, delete on public.user_program_exercise_settings to service_role;

notify pgrst, 'reload schema';
