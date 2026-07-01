alter table public.profiles
  add column if not exists nutrition_tracking_mode text default 'calories';

alter table public.profiles
  drop constraint if exists profiles_nutrition_tracking_mode_check;

alter table public.profiles
  add constraint profiles_nutrition_tracking_mode_check
  check (nutrition_tracking_mode in ('calories', 'palms'));

alter table public.nutrition_goal_history
  add column if not exists nutrition_tracking_mode text default 'calories';

alter table public.nutrition_goal_history
  drop constraint if exists nutrition_goal_history_nutrition_tracking_mode_check;

alter table public.nutrition_goal_history
  add constraint nutrition_goal_history_nutrition_tracking_mode_check
  check (nutrition_tracking_mode in ('calories', 'palms'));

alter table public.nutrition_days
  add column if not exists manual_entry_mode text default 'calories',
  add column if not exists manual_palm_units jsonb default '{}'::jsonb;

alter table public.nutrition_days
  drop constraint if exists nutrition_days_manual_entry_mode_check;

alter table public.nutrition_days
  add constraint nutrition_days_manual_entry_mode_check
  check (manual_entry_mode in ('calories', 'palms'));
