alter table public.profiles
  add column if not exists goal_intensity_percent numeric;

alter table public.nutrition_goal_history
  add column if not exists goal_intensity_percent numeric;
