create extension if not exists pgcrypto;

create table if not exists public.nutrition_days (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  profile_id uuid references public.profiles(id) on delete cascade,
  nutrition_date date not null,
  calories_target integer default 2500,
  protein_target numeric default 180,
  fat_target numeric default 70,
  carbs_target numeric default 250,
  calories_total numeric default 0,
  protein_total numeric default 0,
  fat_total numeric default 0,
  carbs_total numeric default 0,
  constraint nutrition_days_profile_date_key unique (profile_id, nutrition_date)
);

create table if not exists public.nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  nutrition_day_id uuid references public.nutrition_days(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_title text not null,
  meal_order integer default 0,
  calories_total numeric default 0,
  protein_total numeric default 0,
  fat_total numeric default 0,
  carbs_total numeric default 0,
  constraint nutrition_meals_day_type_key unique (nutrition_day_id, meal_type)
);

create table if not exists public.nutrition_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  nutrition_meal_id uuid references public.nutrition_meals(id) on delete cascade,
  food_key text not null,
  food_name text not null,
  food_category text,
  serving_grams numeric default 100,
  base_calories_per_100 numeric default 0,
  base_protein_per_100 numeric default 0,
  base_fat_per_100 numeric default 0,
  base_carbs_per_100 numeric default 0,
  selected_modifiers jsonb default '[]'::jsonb,
  calories_total numeric default 0,
  protein_total numeric default 0,
  fat_total numeric default 0,
  carbs_total numeric default 0,
  item_order integer default 0,
  notes text
);

create table if not exists public.nutrition_favorites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  profile_id uuid references public.profiles(id) on delete cascade,
  food_key text not null,
  food_snapshot jsonb not null,
  constraint nutrition_favorites_profile_food_key unique (profile_id, food_key)
);

create index if not exists nutrition_days_profile_date_idx on public.nutrition_days(profile_id, nutrition_date desc);
create index if not exists nutrition_meals_day_order_idx on public.nutrition_meals(nutrition_day_id, meal_order);
create index if not exists nutrition_items_meal_order_idx on public.nutrition_items(nutrition_meal_id, item_order);
create index if not exists nutrition_items_food_key_idx on public.nutrition_items(food_key);
create index if not exists nutrition_favorites_profile_food_idx on public.nutrition_favorites(profile_id, food_key);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists nutrition_days_set_updated_at on public.nutrition_days;
create trigger nutrition_days_set_updated_at
before update on public.nutrition_days
for each row execute function public.set_updated_at();

drop trigger if exists nutrition_meals_set_updated_at on public.nutrition_meals;
create trigger nutrition_meals_set_updated_at
before update on public.nutrition_meals
for each row execute function public.set_updated_at();

drop trigger if exists nutrition_items_set_updated_at on public.nutrition_items;
create trigger nutrition_items_set_updated_at
before update on public.nutrition_items
for each row execute function public.set_updated_at();

alter table public.nutrition_days enable row level security;
alter table public.nutrition_meals enable row level security;
alter table public.nutrition_items enable row level security;
alter table public.nutrition_favorites enable row level security;
