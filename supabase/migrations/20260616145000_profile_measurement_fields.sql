alter table public.profiles
  add column if not exists shoulders_cm numeric,
  add column if not exists chest_cm numeric,
  add column if not exists biceps_cm numeric,
  add column if not exists abdomen_cm numeric,
  add column if not exists glutes_cm numeric,
  add column if not exists thigh_cm numeric,
  add column if not exists calf_cm numeric;

alter table public.body_measurements
  add column if not exists shoulders_cm numeric,
  add column if not exists chest_cm numeric,
  add column if not exists biceps_cm numeric,
  add column if not exists abdomen_cm numeric,
  add column if not exists glutes_cm numeric,
  add column if not exists thigh_cm numeric,
  add column if not exists calf_cm numeric;
