alter table public.profiles
  add column if not exists steps_per_day integer,
  add column if not exists workouts_per_week integer,
  add column if not exists high_protein_enabled boolean default false,
  add column if not exists higher_fat_enabled boolean default false,
  add column if not exists manual_nutrition_targets_enabled boolean default false,
  add column if not exists nutrition_targets_updated_at timestamptz;

alter table public.nutrition_goal_history
  add column if not exists steps_per_day integer,
  add column if not exists workouts_per_week integer,
  add column if not exists high_protein_enabled boolean default false,
  add column if not exists higher_fat_enabled boolean default false,
  add column if not exists manual_nutrition_targets_enabled boolean default false;
