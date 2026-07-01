alter table public.workouts
  add column if not exists client_workout_id text;

create unique index if not exists workouts_profile_client_workout_id_idx
  on public.workouts(profile_id, client_workout_id)
  where client_workout_id is not null;

notify pgrst, 'reload schema';
