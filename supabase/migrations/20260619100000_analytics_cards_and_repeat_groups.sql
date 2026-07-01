alter table public.profiles
  add column if not exists analytics_cards_order jsonb not null default '[]'::jsonb,
  add column if not exists analytics_cards_hidden jsonb not null default '[]'::jsonb;

alter table public.workouts
  add column if not exists repeat_group_id uuid,
  add column if not exists source_workout_id uuid references public.workouts(id) on delete set null;

create index if not exists workouts_repeat_group_idx
  on public.workouts(profile_id, repeat_group_id, workout_date);
