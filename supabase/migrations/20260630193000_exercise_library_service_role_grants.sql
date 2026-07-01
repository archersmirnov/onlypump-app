grant usage on schema public to service_role;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.workouts to service_role;
grant select, insert, update, delete on public.workout_exercises to service_role;
grant select, insert, update, delete on public.workout_sets to service_role;
grant select, insert, update, delete on public.exercise_library to service_role;
grant select, insert, update, delete on public.program_templates to service_role;
grant select, insert, update, delete on public.program_template_workouts to service_role;
grant select, insert, update, delete on public.program_template_exercises to service_role;
grant select, insert, update, delete on public.program_exercise_alternatives to service_role;
grant select, insert, update, delete on public.user_programs to service_role;
grant select, insert, update, delete on public.user_program_exercise_settings to service_role;

notify pgrst, 'reload schema';
