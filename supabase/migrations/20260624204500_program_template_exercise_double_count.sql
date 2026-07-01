alter table public.program_template_exercises
  add column if not exists double_weight_in_stats boolean not null default false,
  add column if not exists double_count_in_statistics boolean not null default false;

notify pgrst, 'reload schema';
