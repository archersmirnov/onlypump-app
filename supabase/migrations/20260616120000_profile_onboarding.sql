alter table public.profiles
add column if not exists sex text,
add column if not exists birth_date date,
add column if not exists age integer,
add column if not exists neck_cm numeric,
add column if not exists waist_cm numeric,
add column if not exists hips_cm numeric,
add column if not exists body_fat_percent numeric,
add column if not exists activity_level text default 'moderate',
add column if not exists goal_type text default 'recomposition',
add column if not exists goal_description text,
add column if not exists target_weight_kg numeric,
add column if not exists calories_target integer,
add column if not exists protein_target numeric,
add column if not exists fat_target numeric,
add column if not exists carbs_target numeric,
add column if not exists onboarding_completed boolean default false,
add column if not exists onboarding_completed_at timestamptz,
add column if not exists profile_updated_at timestamptz default now();

do $$
begin
  alter table public.profiles
  add constraint profiles_sex_check
  check (sex is null or sex in ('male', 'female'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
  add constraint profiles_goal_type_check
  check (
    goal_type is null or goal_type in (
      'fat_loss',
      'muscle_gain',
      'recomposition',
      'maintenance'
    )
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  measurement_date date not null,
  weight_kg numeric,
  neck_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  body_fat_percent numeric,
  height_cm numeric,
  sex text,
  age integer,
  source text default 'profile_onboarding',
  notes text
);

create index if not exists body_measurements_profile_date_idx
on public.body_measurements(profile_id, measurement_date desc);

alter table public.body_measurements enable row level security;

grant select, insert, update, delete on public.body_measurements to service_role;

create table if not exists public.nutrition_goal_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  goal_type text,
  calories_target integer,
  protein_target numeric,
  fat_target numeric,
  carbs_target numeric,
  target_weight_kg numeric,
  source text default 'profile',
  notes text
);

create index if not exists nutrition_goal_history_profile_created_idx
on public.nutrition_goal_history(profile_id, created_at desc);

alter table public.nutrition_goal_history enable row level security;

grant select, insert, update, delete on public.nutrition_goal_history to service_role;
