grant usage on schema public to service_role;

grant select, insert, update, delete on public.workouts to service_role;
grant select, insert, update, delete on public.workout_exercises to service_role;
grant select, insert, update, delete on public.workout_sets to service_role;
grant select, insert, update, delete on public.nutrition_days to service_role;
grant select, insert, update, delete on public.nutrition_meals to service_role;
grant select, insert, update, delete on public.nutrition_items to service_role;
grant select, insert, update, delete on public.body_measurements to service_role;
grant select, insert, update, delete on public.daily_health_logs to service_role;
