-- Manual import for legacy tracker data.
-- Run in Supabase SQL Editor after the profiles for @kampeta and @kat_racheeva exist.
-- Safe to rerun: daily logs and measurements are upserted; imported workout placeholders are recreated.

create or replace function pg_temp.onlypump_import_legacy_tracker(
  p_username text,
  p_person_label text,
  p_tracker jsonb,
  p_measurements jsonb
) returns void
language plpgsql
as $$
declare
  p_profile_id uuid;
  r record;
begin
  select id
  into p_profile_id
  from public.profiles
  where lower(trim(leading '@' from coalesce(telegram_username, ''))) = lower(trim(leading '@' from p_username))
  limit 1;

  if p_profile_id is null then
    raise exception 'ONLYPUMP import: profile @% not found', trim(leading '@' from p_username);
  end if;

  for r in
    select *
    from jsonb_to_recordset(p_tracker) as x(
      log_date date,
      weight_kg numeric,
      steps_count integer,
      sleep_start text,
      sleep_end text,
      sleep_duration_minutes integer,
      strength boolean,
      cardio boolean,
      extra_activity boolean,
      measurements_done boolean,
      photo_done boolean,
      note text
    )
  loop
    insert into public.daily_health_logs (
      profile_id,
      log_date,
      steps_count,
      sleep_started_at,
      sleep_ended_at,
      sleep_duration_minutes,
      cardio_completed,
      extra_activity_completed,
      measurements_done,
      photo_done,
      notes,
      updated_at
    ) values (
      p_profile_id,
      r.log_date,
      r.steps_count,
      case when r.sleep_start is null then null else (r.log_date::text || 'T' || r.sleep_start || ':00+04:00')::timestamptz end,
      case
        when r.sleep_end is null then null
        when r.sleep_start is not null and r.sleep_end::time <= r.sleep_start::time then ((r.log_date + 1)::text || 'T' || r.sleep_end || ':00+04:00')::timestamptz
        else (r.log_date::text || 'T' || r.sleep_end || ':00+04:00')::timestamptz
      end,
      r.sleep_duration_minutes,
      coalesce(r.cardio, false),
      coalesce(r.extra_activity, false),
      r.measurements_done,
      r.photo_done,
      concat_ws(E'\n',
        'Импорт трекера ' || p_person_label,
        case when r.weight_kg is null then null else 'Вес из дневного трекера: ' || r.weight_kg || ' кг' end,
        case when r.note is null then null else 'Примечание: ' || r.note end,
        'Силовая: ' || case when coalesce(r.strength, false) then 'да' else 'нет' end || '; кардио: ' || case when coalesce(r.cardio, false) then 'да' else 'нет' end || '; доп/активность: ' || case when coalesce(r.extra_activity, false) then 'да' else 'нет' end,
        case when r.measurements_done is null then null else 'Замеры: ' || case when r.measurements_done then 'да' else 'нет' end end,
        case when r.photo_done is null then null else 'Фото: ' || case when r.photo_done then 'да' else 'нет' end end
      ),
      now()
    )
    on conflict (profile_id, log_date) do update set
      steps_count = coalesce(excluded.steps_count, public.daily_health_logs.steps_count),
      sleep_started_at = coalesce(excluded.sleep_started_at, public.daily_health_logs.sleep_started_at),
      sleep_ended_at = coalesce(excluded.sleep_ended_at, public.daily_health_logs.sleep_ended_at),
      sleep_duration_minutes = coalesce(excluded.sleep_duration_minutes, public.daily_health_logs.sleep_duration_minutes),
      cardio_completed = coalesce(excluded.cardio_completed, public.daily_health_logs.cardio_completed),
      extra_activity_completed = coalesce(excluded.extra_activity_completed, public.daily_health_logs.extra_activity_completed),
      measurements_done = coalesce(excluded.measurements_done, public.daily_health_logs.measurements_done),
      photo_done = coalesce(excluded.photo_done, public.daily_health_logs.photo_done),
      notes = case
        when public.daily_health_logs.notes is null or public.daily_health_logs.notes like ('Импорт трекера ' || p_person_label || '%') then excluded.notes
        else public.daily_health_logs.notes
      end,
      updated_at = now();
  end loop;

  for r in
    select *
    from jsonb_to_recordset(p_tracker) as x(
      log_date date,
      weight_kg numeric,
      steps_count integer,
      sleep_start text,
      sleep_end text,
      sleep_duration_minutes integer,
      strength boolean,
      cardio boolean,
      extra_activity boolean,
      measurements_done boolean,
      photo_done boolean,
      note text
    )
    where weight_kg is not null
  loop
    insert into public.body_measurements (
      profile_id,
      measurement_date,
      weight_kg,
      source,
      notes
    ) values (
      p_profile_id,
      r.log_date,
      r.weight_kg,
      'legacy_tracker_import',
      'Импорт дневного веса из трекера ' || p_person_label
    )
    on conflict (profile_id, measurement_date) do update set
      weight_kg = coalesce(excluded.weight_kg, public.body_measurements.weight_kg),
      source = excluded.source,
      notes = excluded.notes;
  end loop;

  for r in
    select *
    from jsonb_to_recordset(p_measurements) as x(
      measurement_date date,
      weight_kg numeric,
      neck_cm numeric,
      shoulders_cm numeric,
      chest_cm numeric,
      biceps_cm numeric,
      abdomen_cm numeric,
      waist_cm numeric,
      glutes_cm numeric,
      thigh_cm numeric,
      calf_cm numeric,
      note text
    )
  loop
    insert into public.body_measurements (
      profile_id,
      measurement_date,
      weight_kg,
      neck_cm,
      shoulders_cm,
      chest_cm,
      biceps_cm,
      abdomen_cm,
      waist_cm,
      glutes_cm,
      thigh_cm,
      calf_cm,
      source,
      notes
    ) values (
      p_profile_id,
      r.measurement_date,
      r.weight_kg,
      r.neck_cm,
      r.shoulders_cm,
      r.chest_cm,
      r.biceps_cm,
      r.abdomen_cm,
      r.waist_cm,
      r.glutes_cm,
      r.thigh_cm,
      r.calf_cm,
      'legacy_tracker_import',
      coalesce(r.note, 'Импорт замеров из трекера ' || p_person_label)
    )
    on conflict (profile_id, measurement_date) do update set
      weight_kg = coalesce(excluded.weight_kg, public.body_measurements.weight_kg),
      neck_cm = coalesce(excluded.neck_cm, public.body_measurements.neck_cm),
      shoulders_cm = coalesce(excluded.shoulders_cm, public.body_measurements.shoulders_cm),
      chest_cm = coalesce(excluded.chest_cm, public.body_measurements.chest_cm),
      biceps_cm = coalesce(excluded.biceps_cm, public.body_measurements.biceps_cm),
      abdomen_cm = coalesce(excluded.abdomen_cm, public.body_measurements.abdomen_cm),
      waist_cm = coalesce(excluded.waist_cm, public.body_measurements.waist_cm),
      glutes_cm = coalesce(excluded.glutes_cm, public.body_measurements.glutes_cm),
      thigh_cm = coalesce(excluded.thigh_cm, public.body_measurements.thigh_cm),
      calf_cm = coalesce(excluded.calf_cm, public.body_measurements.calf_cm),
      source = excluded.source,
      notes = excluded.notes;
  end loop;

  delete from public.workouts
  where profile_id = p_profile_id
    and notes like ('Импорт трекера ' || p_person_label || ':%');

  for r in
    select *
    from jsonb_to_recordset(p_tracker) as x(
      log_date date,
      weight_kg numeric,
      steps_count integer,
      sleep_start text,
      sleep_end text,
      sleep_duration_minutes integer,
      strength boolean,
      cardio boolean,
      extra_activity boolean,
      measurements_done boolean,
      photo_done boolean,
      note text
    )
    where coalesce(strength, false) or coalesce(cardio, false) or coalesce(extra_activity, false)
  loop
    insert into public.workouts (
      profile_id,
      workout_date,
      title,
      status,
      notes,
      total_sets,
      total_volume,
      estimated_calories_burned,
      duration_seconds,
      workout_type
    ) values (
      p_profile_id,
      r.log_date,
      coalesce(nullif(r.note, ''), case when coalesce(r.strength, false) then 'Силовая из трекера' when coalesce(r.cardio, false) then 'Кардио из трекера' else 'Активность из трекера' end),
      'completed',
      'Импорт трекера ' || p_person_label || ': силовая=' || case when coalesce(r.strength, false) then 'да' else 'нет' end || '; кардио=' || case when coalesce(r.cardio, false) then 'да' else 'нет' end || '; доп/активность=' || case when coalesce(r.extra_activity, false) then 'да' else 'нет' end,
      0,
      0,
      0,
      0,
      case when coalesce(r.strength, false) then 'strength' when coalesce(r.cardio, false) then 'cardio' else 'mobility' end
    );
  end loop;

  raise notice 'Imported tracker for @%: % daily rows, % measurement rows',
    trim(leading '@' from p_username),
    jsonb_array_length(p_tracker),
    jsonb_array_length(p_measurements);
end;
$$;

select pg_temp.onlypump_import_legacy_tracker(
  'kampeta',
  'Полины',
  $tracker$[
    {
      "log_date": "2026-06-15",
      "weight_kg": null,
      "steps_count": 7679,
      "sleep_start": "00:30",
      "sleep_end": "09:00",
      "sleep_duration_minutes": 510,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": false,
      "photo_done": false,
      "note": "День отдыха + прогулка. Весь день на ногах."
    },
    {
      "log_date": "2026-06-16",
      "weight_kg": null,
      "steps_count": 4235,
      "sleep_start": "00:00",
      "sleep_end": "08:30",
      "sleep_duration_minutes": 510,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "55км на велике + силовая на верх и заднюю поверхность бедер."
    },
    {
      "log_date": "2026-06-17",
      "weight_kg": null,
      "steps_count": 551,
      "sleep_start": "01:30",
      "sleep_end": "08:30",
      "sleep_duration_minutes": 420,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "45 км на велике. Очень много стресса."
    },
    {
      "log_date": "2026-06-18",
      "weight_kg": null,
      "steps_count": 11571,
      "sleep_start": "00:30",
      "sleep_end": "09:00",
      "sleep_duration_minutes": 510,
      "strength": true,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "Силовая на спину и без велика."
    },
    {
      "log_date": "2026-06-19",
      "weight_kg": null,
      "steps_count": 4075,
      "sleep_start": "01:00",
      "sleep_end": "09:30",
      "sleep_duration_minutes": 510,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "46км на велике + силовая на верх. Очень доволен этим днем, сил полно."
    },
    {
      "log_date": "2026-06-20",
      "weight_kg": null,
      "steps_count": 10594,
      "sleep_start": "01:00",
      "sleep_end": "09:30",
      "sleep_duration_minutes": 510,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "Силовая на низ."
    },
    {
      "log_date": "2026-06-21",
      "weight_kg": null,
      "steps_count": 10227,
      "sleep_start": "01:30",
      "sleep_end": "10:00",
      "sleep_duration_minutes": 510,
      "strength": true,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": null
    },
    {
      "log_date": "2026-06-22",
      "weight_kg": null,
      "steps_count": 429,
      "sleep_start": "01:00",
      "sleep_end": "10:00",
      "sleep_duration_minutes": 540,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": false,
      "photo_done": null,
      "note": "первый день цикла, тусила дома, хотелось срастись с диваном."
    },
    {
      "log_date": "2026-06-23",
      "weight_kg": null,
      "steps_count": 4483,
      "sleep_start": "01:00",
      "sleep_end": "10:00",
      "sleep_duration_minutes": 540,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "лучше, чем вчера, но по-прежнему не фонтан."
    },
    {
      "log_date": "2026-06-24",
      "weight_kg": null,
      "steps_count": 433,
      "sleep_start": "01:30",
      "sleep_end": "09:00",
      "sleep_duration_minutes": 450,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "не выспалась + холод собачий — никуда не пошла, хотя в остальном было ок, если бы не недосып, была бы активнее."
    }
  ]$tracker$::jsonb,
  $measurements$[
    {
      "measurement_date": "2026-06-22",
      "weight_kg": null,
      "neck_cm": null,
      "shoulders_cm": 92,
      "chest_cm": 90,
      "biceps_cm": 28,
      "abdomen_cm": 79,
      "waist_cm": 67,
      "glutes_cm": 93,
      "thigh_cm": 51,
      "calf_cm": 34,
      "note": "Импорт замеров из трекера Полины. Вес в источнике был ошибкой формулы #DIV/0!, поэтому не импортирован."
    }
  ]$measurements$::jsonb
);

select pg_temp.onlypump_import_legacy_tracker(
  'kat_racheeva',
  'Кати',
  $tracker$[
    {
      "log_date": "2026-06-19",
      "weight_kg": 62.3,
      "steps_count": 11600,
      "sleep_start": "23:30",
      "sleep_end": "08:00",
      "sleep_duration_minutes": 510,
      "strength": true,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": false,
      "photo_done": false,
      "note": "Силовая на грудь, бицепс."
    },
    {
      "log_date": "2026-06-20",
      "weight_kg": 61.9,
      "steps_count": 7200,
      "sleep_start": "02:00",
      "sleep_end": "10:30",
      "sleep_duration_minutes": 510,
      "strength": false,
      "cardio": true,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "35 мин на наклонной 10% дорожке на скорости 3."
    },
    {
      "log_date": "2026-06-21",
      "weight_kg": 62.0,
      "steps_count": 9680,
      "sleep_start": "00:30",
      "sleep_end": "08:00",
      "sleep_duration_minutes": 450,
      "strength": true,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": true,
      "photo_done": null,
      "note": "Силовая на ноги и ягодицы. Днем спала часик."
    },
    {
      "log_date": "2026-06-22",
      "weight_kg": 61.95,
      "steps_count": 10450,
      "sleep_start": "00:30",
      "sleep_end": "06:30",
      "sleep_duration_minutes": 360,
      "strength": true,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "Силовая на спину и трицепс."
    },
    {
      "log_date": "2026-06-23",
      "weight_kg": 61.55,
      "steps_count": 11100,
      "sleep_start": "23:30",
      "sleep_end": "06:30",
      "sleep_duration_minutes": 420,
      "strength": true,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "Силовая на грудь, плечи, бицепс."
    },
    {
      "log_date": "2026-06-24",
      "weight_kg": 61.4,
      "steps_count": 1370,
      "sleep_start": "00:00",
      "sleep_end": "08:00",
      "sleep_duration_minutes": 480,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": "День отдыха."
    },
    {
      "log_date": "2026-06-25",
      "weight_kg": 61.6,
      "steps_count": null,
      "sleep_start": null,
      "sleep_end": null,
      "sleep_duration_minutes": 0,
      "strength": false,
      "cardio": false,
      "extra_activity": false,
      "measurements_done": null,
      "photo_done": null,
      "note": null
    }
  ]$tracker$::jsonb,
  $measurements$[
    {
      "measurement_date": "2026-06-21",
      "weight_kg": 61.78125,
      "neck_cm": 32.5,
      "shoulders_cm": 104,
      "chest_cm": 86,
      "biceps_cm": 31.5,
      "abdomen_cm": 74,
      "waist_cm": 63,
      "glutes_cm": 97,
      "thigh_cm": 55,
      "calf_cm": 37,
      "note": "Импорт замеров из трекера Кати."
    }
  ]$measurements$::jsonb
);
