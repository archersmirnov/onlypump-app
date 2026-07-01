import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

const serializeError = (error: unknown) => {
  if (!error) return { message: "Unknown error" };
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: String(record.message || record.error_description || record.details || record.hint || JSON.stringify(record)),
      code: record.code,
      details: record.details,
      hint: record.hint,
    };
  }
  return { message: String(error) };
};

const fail = (error: unknown, status = 400) => {
  const serialized = serializeError(error);
  const message = serialized.message || "Unknown error";
  console.error("[WorkoutPersistence] save failed", error);
  console.error("onlypump-workouts-api error:", error);
  return json({ ok: false, error: message, error_details: serialized }, status);
};

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const decodeJwtPayload = (token: string) => {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const validateServiceRoleKey = (key: string) => {
  const text = String(key || "").trim();
  const payload = decodeJwtPayload(text);
  const role = String(payload?.role || "");
  const isPublishableKey = /^sb_publishable_/i.test(text) || /^sb_anon_/i.test(text);
  if (isPublishableKey || (role && role !== "service_role")) {
    return { ok: false, role: role || "publishable_or_anon" };
  }
  return { ok: true, role: role || "secret_key" };
};

const parseTelegramInitData = async (initData: string) => {
  const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const params = new URLSearchParams(initData || "");
  const hash = params.get("hash");
  if (!hash) throw new Error("Telegram initData hash is missing");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(dataCheckString));
  const calculatedHash = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");

  if (calculatedHash !== hash) throw new Error("Telegram initData verification failed");

  const user = JSON.parse(params.get("user") || "{}");
  if (!user?.id) throw new Error("Telegram user is missing");
  return user;
};

const displayNameFor = (user: Record<string, unknown>) => {
  const firstName = String(user.first_name || "").trim();
  const lastName = String(user.last_name || "").trim();
  const username = String(user.username || "").trim();
  return [firstName, lastName].filter(Boolean).join(" ") || username || String(user.id);
};

const displayNameForAuthUser = (user: Record<string, unknown>) => {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const firstName = String(metadata.first_name || "").trim();
  const lastName = String(metadata.last_name || "").trim();
  const displayName = String(metadata.display_name || metadata.full_name || "").trim();
  const email = String(user.email || "").trim();
  return displayName || [firstName, lastName].filter(Boolean).join(" ") || (email ? email.split("@")[0] : "") || String(user.id || "Пользователь");
};

const profileHasTelegramIdentity = (profile: Record<string, unknown> = {}) => Boolean(
  String(profile.telegram_id || "").trim() ||
  String(profile.telegram_username || "").trim()
);

const findCanonicalEmailProfile = async (
  supabase: ReturnType<typeof createClient>,
  email: string | null,
  excludeId = "",
  allowUnclaimed = true,
) => {
  if (!email) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .limit(20);
  if (error) throw error;
  const candidates = (data || []).filter((item: Record<string, unknown>) => String(item.id || "") !== excludeId);
  return candidates.find(profileHasTelegramIdentity)
    || (allowUnclaimed ? candidates.find((item: Record<string, unknown>) => !String(item.auth_user_id || "").trim()) : null)
    || null;
};

const ownerWebEmailAliases = new Set(["archer_s@bk.ru"]);

const findOwnerAliasProfile = async (
  supabase: ReturnType<typeof createClient>,
  email: string | null,
  excludeId = "",
) => {
  if (!email || !ownerWebEmailAliases.has(String(email).trim().toLowerCase())) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_username", "archer_ss")
    .limit(5);
  if (error) throw error;
  return (data || []).find((item: Record<string, unknown>) => String(item.id || "") !== excludeId) || null;
};

const findCanonicalWebProfile = async (
  supabase: ReturnType<typeof createClient>,
  email: string | null,
  excludeId = "",
  allowUnclaimed = true,
) => {
  return await findOwnerAliasProfile(supabase, email, excludeId)
    || await findCanonicalEmailProfile(supabase, email, excludeId, allowUnclaimed);
};

const getRequestAccessToken = (request: Request) => {
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return "";
  const publicKeys = [
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_ANON_KEY"),
  ].filter(Boolean);
  return publicKeys.includes(token) ? "" : token;
};

const toBoolean = (value: unknown, fallback = false) => {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
};

const normalizeAccessStatus = (value: unknown) => {
  const status = String(value || "pending").trim().toLowerCase();
  return ["allowed", "blocked", "pending"].includes(status) ? status : "pending";
};

const hasProfileAccess = (profile: Record<string, unknown>) => {
  return toBoolean(profile?.is_admin) || normalizeAccessStatus(profile?.access_status) === "allowed";
};

const minimalProfileForAccess = (profile: Record<string, unknown>) => ({
  id: profile.id,
  auth_user_id: profile.auth_user_id,
  email: profile.email,
  telegram_id: profile.telegram_id,
  telegram_username: profile.telegram_username,
  first_name: profile.first_name,
  last_name: profile.last_name,
  display_name: profile.display_name,
  display_name_locked: profile.display_name_locked,
  display_name_source: profile.display_name_source,
  access_status: normalizeAccessStatus(profile.access_status),
  is_admin: toBoolean(profile.is_admin),
  access_requested_at: profile.access_requested_at,
  access_granted_at: profile.access_granted_at,
  access_note: profile.access_note,
});

const accessDeniedResponse = (profile: Record<string, unknown>) => {
  const accessStatus = normalizeAccessStatus(profile?.access_status);
  return json({
    ok: false,
    access_denied: true,
    access_status: accessStatus,
    message: accessStatus === "blocked" ? "Доступ закрыт" : "Доступ к тесту пока закрыт",
    profile: minimalProfileForAccess(profile),
  }, 403);
};

const ensureProfile = async (supabase: ReturnType<typeof createClient>, user: Record<string, unknown>) => {
  const telegramId = String(user.id);
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) {
    const existingDisplayName = String(existing.display_name || "").trim();
    const displayNameLocked = toBoolean(existing.display_name_locked);
    const displayNameSource = String(existing.display_name_source || "");
    const displayNamePatch = !displayNameLocked && displayNameSource !== "manual" && !existingDisplayName
      ? {
        display_name: displayNameFor(user),
        display_name_locked: false,
        display_name_source: "telegram",
      }
      : {};
    const { data, error } = await supabase
      .from("profiles")
      .update({
        telegram_username: user.username || null,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        ...displayNamePatch,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      telegram_id: telegramId,
      telegram_username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      display_name: displayNameFor(user),
      display_name_locked: false,
      display_name_source: "telegram",
      access_status: "pending",
      is_admin: false,
      access_requested_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

const ensureWebProfile = async (supabase: ReturnType<typeof createClient>, authUser: Record<string, unknown>) => {
  const authUserId = String(authUser.id || "").trim();
  if (!authUserId) throw new Error("Supabase auth user is missing");
  const email = String(authUser.email || "").trim().toLowerCase() || null;
  const displayName = displayNameForAuthUser(authUser);
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) {
    const canonical = await findCanonicalWebProfile(supabase, email, String(existing.id || ""), false);
    if (canonical?.id && String(canonical.id || "") !== String(existing.id || "")) {
      const canonicalAuthUserId = String(canonical.auth_user_id || "").trim();
      if (canonicalAuthUserId && canonicalAuthUserId !== authUserId) {
        throw new Error("Этот email уже привязан к другому web-входу");
      }
      const detach = await supabase
        .from("profiles")
        .update({ auth_user_id: null })
        .eq("id", existing.id);
      if (detach.error) throw detach.error;
      const { data, error } = await supabase
        .from("profiles")
        .update({
          auth_user_id: authUserId,
          email,
        })
        .eq("id", canonical.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const displayNamePatch = !toBoolean(existing.display_name_locked)
      && String(existing.display_name_source || "") !== "manual"
      && !String(existing.display_name || "").trim()
      ? { display_name: displayName, display_name_source: "web", display_name_locked: false }
      : {};
    const { data, error } = await supabase
      .from("profiles")
      .update({
        email,
        ...displayNamePatch,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  if (email) {
    const emailProfile = await findCanonicalWebProfile(supabase, email);
    if (emailProfile?.id) {
      const canonicalAuthUserId = String(emailProfile.auth_user_id || "").trim();
      if (canonicalAuthUserId && canonicalAuthUserId !== authUserId) {
        throw new Error("Этот email уже привязан к другому web-входу");
      }
      const { data, error } = await supabase
        .from("profiles")
        .update({
          auth_user_id: authUserId,
          email,
        })
        .eq("id", emailProfile.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: authUserId,
      email,
      display_name: displayName,
      display_name_locked: false,
      display_name_source: "web",
      access_status: "pending",
      is_admin: false,
      access_requested_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

const resolveProfileFromRequest = async (
  supabase: ReturnType<typeof createClient>,
  request: Request,
  initData: unknown,
) => {
  if (String(initData || "").trim()) {
    const user = await parseTelegramInitData(String(initData));
    return ensureProfile(supabase, user);
  }
  const token = getRequestAccessToken(request);
  if (!token) throw new Error("Telegram initData or Supabase session is required");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw error || new Error("Supabase session verification failed");
  return ensureWebProfile(supabase, data.user as unknown as Record<string, unknown>);
};

const compact = (record: Record<string, unknown>) => {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: unknown) => {
  const text = String(value || "").trim();
  if (!text) return undefined;
  return uuidPattern.test(text) ? text : null;
};

const toStringArray = (value: unknown) => {
  const cleanItem = (item: unknown) => String(item || "").trim().replace(/^["'{\[]+|["'}\]]+$/g, "").trim();
  if (Array.isArray(value)) return value.map(cleanItem).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(cleanItem).filter(Boolean);
    } catch (_error) {}
    const pgArrayText = trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1) : trimmed;
    return pgArrayText.split(",").map(cleanItem).filter(Boolean);
  }
  return [];
};

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeProfileRoles = (profile: Record<string, unknown>) => {
  const roles = new Set(toStringArray(profile.roles).map((role) => role.toLowerCase()));
  const telegramUsername = String(profile.telegram_username || "").replace(/^@/, "").trim().toLowerCase();
  if (telegramUsername === "archer_ss") {
    roles.add("owner");
    roles.add("admin");
    roles.add("trainer");
  }
  if (toBoolean(profile.is_owner)) roles.add("owner");
  if (toBoolean(profile.is_admin)) roles.add("admin");
  if (toBoolean(profile.is_trainer)) roles.add("trainer");
  const memberRole = String(profile.member_role || "").trim().toLowerCase();
  if (["admin", "trainer", "student", "user"].includes(memberRole)) roles.add(memberRole);
  return Array.from(roles);
};

const profileHasRole = (profile: Record<string, unknown>, role: string) => normalizeProfileRoles(profile).includes(role);
const profileHasAnyRole = (profile: Record<string, unknown>, roles: string[]) => roles.some((role) => profileHasRole(profile, role));

const normalizeProgramVisibilityScope = (value: unknown, fallback = "private") => {
  const scope = String(value || fallback).trim().toLowerCase();
  return ["private", "all", "students", "trainer_students", "selected"].includes(scope) ? scope : fallback;
};

const isProgramTemplateVisibleToProfile = (template: Record<string, unknown>, viewer: Record<string, unknown>) => {
  const viewerId = String(viewer.id || "");
  const creatorId = String(template.creator_profile_id || "");
  if (!toBoolean(template.is_user_created)) return toBoolean(template.is_public, true);
  if (creatorId && creatorId === viewerId) return true;
  if (!toBoolean(template.is_public, false)) return false;
  const scope = normalizeProgramVisibilityScope(template.visibility_scope, "all");
  if (scope === "all") return true;
  const viewerMemberRole = String(viewer.member_role || "user").trim().toLowerCase();
  if (scope === "students") return viewerMemberRole === "student";
  if (scope === "trainer_students") return String(viewer.trainer_profile_id || "") === creatorId;
  if (scope === "selected") return toStringArray(template.target_profile_ids).includes(viewerId);
  return false;
};

const saveProgramTemplateWorkouts = async (
  supabase: ReturnType<typeof createClient>,
  template: Record<string, unknown>,
  templateKey: string,
  workoutInputs: Record<string, unknown>[],
  options: { pruneMissing?: boolean } = {},
) => {
  const templateId = uuidOrNull(template.id);
  if (!templateId) throw new Error("Не удалось сохранить программу: не найден id шаблона");
  const createdWorkouts: Record<string, unknown>[] = [];
  const createdExercises: Record<string, unknown>[] = [];
  const createdAlternatives: Record<string, unknown>[] = [];
  const keptWorkoutIds = new Set<string>();
  const keptExerciseIds = new Set<string>();

  for (let workoutIndex = 0; workoutIndex < workoutInputs.length; workoutIndex += 1) {
    const workoutInput = workoutInputs[workoutIndex] || {};
    const workoutKey = String(workoutInput.template_workout_key || workoutInput.templateWorkoutKey || `${templateKey}-day-${workoutIndex + 1}`);
    const workoutFields = compact({
      program_template_id: templateId,
      template_workout_key: workoutKey,
      week_number: Math.max(1, Math.round(toNumber(workoutInput.week_number || workoutInput.weekNumber, 1))),
      day_index: Math.max(1, Math.round(toNumber(workoutInput.day_index || workoutInput.dayIndex, workoutIndex + 1))),
      title: String(workoutInput.title || `День ${workoutIndex + 1}`),
      workout_type: String(workoutInput.workout_type || workoutInput.workoutType || "strength"),
      sort_order: workoutIndex + 1,
      offset_days: Math.max(0, Math.round(toNumber(workoutInput.offset_days || workoutInput.offsetDays, workoutIndex))),
      duration_minutes: Math.max(0, Math.round(toNumber(workoutInput.duration_minutes || workoutInput.durationMinutes, 0))),
      updated_at: new Date().toISOString(),
    });
    const existingWorkoutResult = await supabase
      .from("program_template_workouts")
      .select("*")
      .eq("program_template_id", templateId)
      .eq("template_workout_key", workoutKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingWorkoutResult.error) throw new Error(existingWorkoutResult.error.message);
    const workoutResult = existingWorkoutResult.data?.id
      ? await supabase
        .from("program_template_workouts")
        .update(workoutFields)
        .eq("id", existingWorkoutResult.data.id)
        .select()
        .single()
      : await supabase
        .from("program_template_workouts")
        .insert(workoutFields)
        .select()
        .single();
    if (workoutResult.error) throw new Error(workoutResult.error.message);
    const savedWorkout = workoutResult.data;
    if (!savedWorkout?.id) throw new Error("Не удалось сохранить день программы");
    keptWorkoutIds.add(String(savedWorkout.id));
    createdWorkouts.push(savedWorkout);
    const exercises = Array.isArray(workoutInput.exercises) ? workoutInput.exercises : [];
    for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex += 1) {
      const exerciseInput = exercises[exerciseIndex] || {};
      const exerciseKey = String(exerciseInput.template_exercise_key || exerciseInput.templateExerciseKey || `${templateKey}-day-${workoutIndex + 1}-exercise-${exerciseIndex + 1}`);
      const exerciseFields = compact({
        program_template_workout_id: savedWorkout.id,
        template_exercise_key: exerciseKey,
        exercise_library_id: uuidOrNull(exerciseInput.exercise_library_id || exerciseInput.exerciseLibraryId),
        exercise_name: String(exerciseInput.exercise_name || exerciseInput.exerciseName || exerciseInput.name || "Упражнение"),
        sort_order: exerciseIndex + 1,
        target_sets: Math.max(1, Math.round(toNumber(exerciseInput.target_sets || exerciseInput.targetSets, 3))),
        rep_min: Math.max(1, Math.round(toNumber(exerciseInput.rep_min || exerciseInput.repMin, 8))),
        rep_max: Math.max(1, Math.round(toNumber(exerciseInput.rep_max || exerciseInput.repMax, 12))),
        target_reps: Math.max(0, Math.round(toNumber(exerciseInput.target_reps || exerciseInput.targetReps, 0))) || null,
        target_weight: toNumber(exerciseInput.target_weight || exerciseInput.targetWeight, 0),
        target_duration_seconds: Math.max(0, Math.round(toNumber(exerciseInput.target_duration_seconds || exerciseInput.targetDurationSeconds, 0))) || null,
        target_distance: toNumber(exerciseInput.target_distance || exerciseInput.targetDistance, 0) || null,
        measurement_mode: String(exerciseInput.measurement_mode || exerciseInput.measurementMode || "weight_reps"),
        progression_mode: String(exerciseInput.progression_mode || exerciseInput.progressionMode || "double_progression"),
        progression_weight_step: toNumber(exerciseInput.progression_weight_step || exerciseInput.progressionWeightStep, 2.5),
        progression_rep_step: Math.max(1, Math.round(toNumber(exerciseInput.progression_rep_step || exerciseInput.progressionRepStep, 1))),
        deload_weight_steps: Math.max(0, Math.round(toNumber(exerciseInput.deload_weight_steps || exerciseInput.deloadWeightSteps, 1))),
        regression_threshold_sessions: Math.max(1, Math.round(toNumber(exerciseInput.regression_threshold_sessions || exerciseInput.regressionThresholdSessions, 2))),
        notes: String(exerciseInput.notes || exerciseInput.note || ""),
        muscle_group: String(exerciseInput.muscle_group || exerciseInput.muscleGroup || ""),
        rest_seconds: Math.max(0, Math.round(toNumber(exerciseInput.rest_seconds || exerciseInput.restSeconds, 120))),
        rest_after_seconds: Math.max(0, Math.round(toNumber(exerciseInput.rest_after_seconds || exerciseInput.restAfterSeconds, 0))),
        rir: exerciseInput.rir === "" || exerciseInput.rir === null || exerciseInput.rir === undefined ? null : toNumber(exerciseInput.rir, 0),
        rpe: exerciseInput.rpe === "" || exerciseInput.rpe === null || exerciseInput.rpe === undefined ? null : toNumber(exerciseInput.rpe, 0),
        tempo: String(exerciseInput.tempo || ""),
        double_weight_in_stats: toBoolean(exerciseInput.double_weight_in_stats ?? exerciseInput.doubleWeightInStats ?? exerciseInput.double_count_in_statistics ?? exerciseInput.doubleCountInStatistics, false),
        double_count_in_statistics: toBoolean(exerciseInput.double_count_in_statistics ?? exerciseInput.doubleCountInStatistics ?? exerciseInput.double_weight_in_stats ?? exerciseInput.doubleWeightInStats, false),
        updated_at: new Date().toISOString(),
      });
      const existingExerciseResult = await supabase
        .from("program_template_exercises")
        .select("*")
        .eq("program_template_workout_id", savedWorkout.id)
        .eq("template_exercise_key", exerciseKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingExerciseResult.error) throw new Error(existingExerciseResult.error.message);
      const exerciseResult = existingExerciseResult.data?.id
        ? await supabase
          .from("program_template_exercises")
          .update(exerciseFields)
          .eq("id", existingExerciseResult.data.id)
          .select()
          .single()
        : await supabase
          .from("program_template_exercises")
          .insert(exerciseFields)
          .select()
          .single();
      if (exerciseResult.error) throw new Error(exerciseResult.error.message);
      const savedExercise = exerciseResult.data;
      if (!savedExercise?.id) throw new Error("Не удалось сохранить упражнение программы");
      keptExerciseIds.add(String(savedExercise.id));
      createdExercises.push(savedExercise);
      const alternatives = Array.isArray(exerciseInput.alternatives) ? exerciseInput.alternatives : [];
      const alternativeRows = alternatives.map((alternative: Record<string, unknown> | string, alternativeIndex: number) => {
        const item = typeof alternative === "string" ? { exercise_name: alternative } : alternative;
        return compact({
          program_template_exercise_id: savedExercise.id,
          exercise_library_id: uuidOrNull(item.exercise_library_id || item.exerciseLibraryId),
          exercise_name: String(item.exercise_name || item.exerciseName || item.name || "").trim(),
          sort_order: alternativeIndex + 1,
        });
      }).filter((item: Record<string, unknown>) => String(item.exercise_name || "").trim());
      const deleteAlternativesResult = await supabase
        .from("program_exercise_alternatives")
        .delete()
        .eq("program_template_exercise_id", savedExercise.id);
      if (deleteAlternativesResult.error) throw new Error(deleteAlternativesResult.error.message);
      if (alternativeRows.length) {
        const alternativesResult = await supabase.from("program_exercise_alternatives").insert(alternativeRows).select();
        if (alternativesResult.error) throw new Error(alternativesResult.error.message);
        createdAlternatives.push(...(alternativesResult.data || []));
      }
    }
  }

  if (options.pruneMissing) {
    const existingWorkoutsResult = await supabase
      .from("program_template_workouts")
      .select("id")
      .eq("program_template_id", templateId);
    if (existingWorkoutsResult.error) throw new Error(existingWorkoutsResult.error.message);
    const existingWorkoutIds = (existingWorkoutsResult.data || [])
      .map((item: Record<string, unknown>) => String(item.id || ""))
      .filter(Boolean);
    const staleWorkoutIds = existingWorkoutIds.filter((id) => !keptWorkoutIds.has(id));
    const exerciseRowsResult = existingWorkoutIds.length
      ? await supabase
        .from("program_template_exercises")
        .select("id, program_template_workout_id")
        .in("program_template_workout_id", existingWorkoutIds)
      : { data: [], error: null };
    if (exerciseRowsResult.error) throw new Error(exerciseRowsResult.error.message);
    const staleWorkoutIdSet = new Set(staleWorkoutIds);
    const staleExerciseIds = (exerciseRowsResult.data || [])
      .filter((item: Record<string, unknown>) => {
        const exerciseId = String(item.id || "");
        const workoutId = String(item.program_template_workout_id || "");
        return exerciseId && (!keptExerciseIds.has(exerciseId) || staleWorkoutIdSet.has(workoutId));
      })
      .map((item: Record<string, unknown>) => String(item.id || ""))
      .filter(Boolean);
    if (staleExerciseIds.length) {
      const deleteStaleAlternativesResult = await supabase
        .from("program_exercise_alternatives")
        .delete()
        .in("program_template_exercise_id", staleExerciseIds);
      if (deleteStaleAlternativesResult.error) throw new Error(deleteStaleAlternativesResult.error.message);
      const deleteStaleExercisesResult = await supabase
        .from("program_template_exercises")
        .delete()
        .in("id", staleExerciseIds);
      if (deleteStaleExercisesResult.error) throw new Error(deleteStaleExercisesResult.error.message);
    }
    if (staleWorkoutIds.length) {
      const deleteStaleWorkoutsResult = await supabase
        .from("program_template_workouts")
        .delete()
        .in("id", staleWorkoutIds);
      if (deleteStaleWorkoutsResult.error) throw new Error(deleteStaleWorkoutsResult.error.message);
    }
  }

  return { createdWorkouts, createdExercises, createdAlternatives };
};

const pickField = (item: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(item, key)) return item[key];
  }
  return undefined;
};

const normalizeBooleanField = (value: unknown, fallback?: boolean) => {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

const normalizeWeightUnitField = (value: unknown, fallback?: string) => {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "lb" || normalized === "lbs" || normalized === "pound" || normalized === "pounds" ? "lb" : "kg";
};

const workoutTypes = ["strength", "cardio", "yoga", "pilates", "stretching"];
const measurementModes = ["reps", "time", "distance", "weight_reps", "weight_time", "weight_distance"];

const normalizeWorkoutTypeField = (value: unknown, fallback?: string) => {
  if (value === undefined) return fallback;
  const safeFallback = fallback || "strength";
  const normalized = String(value || safeFallback).trim().toLowerCase();
  return workoutTypes.includes(normalized) ? normalized : safeFallback;
};

const normalizeMeasurementModeField = (value: unknown, fallback?: string) => {
  if (value === undefined) return fallback;
  const safeFallback = fallback || "weight_reps";
  const normalized = String(value || safeFallback).trim().toLowerCase();
  return measurementModes.includes(normalized) ? normalized : safeFallback;
};

const normalizeDistanceUnitField = (value: unknown, fallback?: string) => {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const safeFallback = fallback || "km";
  const normalized = String(value || safeFallback).trim().toLowerCase();
  return ["km", "m", "mi"].includes(normalized) ? normalized : safeFallback;
};

const toTextArray = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(",").map((item) => item.trim()).filter(Boolean);
};

const normalizeExerciseName = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");
const normalizeNameKey = (value: unknown) => normalizeExerciseName(value).toLocaleLowerCase("ru-RU");

const withoutDuration = (record: Record<string, unknown>) => {
  const next = { ...record };
  delete next.duration_seconds;
  return next;
};

const workoutFields = (item: Record<string, unknown>) => compact({
  workout_date: pickField(item, ["workout_date", "workoutDate", "date"]),
  client_workout_id: pickField(item, ["client_workout_id", "clientWorkoutId", "client_id", "clientId"]),
  title: item.title,
  status: item.status,
  workout_type: normalizeWorkoutTypeField(pickField(item, ["workout_type", "workoutType"])),
  notes: item.notes,
  total_sets: item.total_sets,
  total_volume: item.total_volume,
  estimated_calories_burned: item.estimated_calories_burned,
  duration_seconds: item.duration_seconds,
  started_at: pickField(item, ["started_at", "startedAt"]),
  auto_stopped_at: pickField(item, ["auto_stopped_at", "autoStoppedAt"]),
  repeat_group_id: uuidOrNull(pickField(item, ["repeat_group_id", "repeatGroupId"])),
  source_workout_id: uuidOrNull(pickField(item, ["source_workout_id", "sourceWorkoutId"])),
  user_program_id: uuidOrNull(pickField(item, ["user_program_id", "userProgramId"])),
  user_program_client_id: pickField(item, ["user_program_client_id", "userProgramClientId"]),
  program_template_workout_id: uuidOrNull(pickField(item, ["program_template_workout_id", "programTemplateWorkoutId"])),
  program_template_workout_key: pickField(item, ["program_template_workout_key", "programTemplateWorkoutKey"]),
  program_week_number: pickField(item, ["program_week_number", "programWeekNumber"]),
  program_day_index: pickField(item, ["program_day_index", "programDayIndex"]),
  program_name: pickField(item, ["program_name", "programName"]),
  program_plan_mode: pickField(item, ["program_plan_mode", "programPlanMode"]),
  program_difficulty: pickField(item, ["program_difficulty", "programDifficulty"]),
  is_program_generated: normalizeBooleanField(pickField(item, ["is_program_generated", "isProgramGenerated"])),
});

const exerciseFields = (item: Record<string, unknown>, options: { defaults?: boolean } = {}) => {
  const withDefaults = Boolean(options.defaults);
  return compact({
    exercise_name: pickField(item, ["exercise_name", "exerciseName", "name"]),
    muscle_group: pickField(item, ["muscle_group", "muscleGroup"]),
    exercise_order: pickField(item, ["exercise_order", "exerciseOrder", "order"]),
    notes: pickField(item, ["notes", "note"]),
    rest_between_seconds: pickField(item, ["rest_between_seconds", "restBetweenSeconds", "restSeconds"]),
    rest_after_seconds: pickField(item, ["rest_after_seconds", "restAfterSeconds"]),
    superset_group_id: pickField(item, ["superset_group_id", "supersetGroupId", "supersetId"]),
    superset_order: pickField(item, ["superset_order", "supersetOrder"]),
    is_superset: normalizeBooleanField(pickField(item, ["is_superset", "isSuperset"])),
    source_exercise_id: pickField(item, ["source_exercise_id", "sourceExerciseId"]),
    exercise_category: normalizeWorkoutTypeField(pickField(item, ["exercise_category", "exerciseCategory", "category"]), withDefaults ? "strength" : undefined),
    primary_muscles: toTextArray(pickField(item, ["primary_muscles", "primaryMuscles"])),
    secondary_muscles: toTextArray(pickField(item, ["secondary_muscles", "secondaryMuscles"])),
    measurement_mode: normalizeMeasurementModeField(pickField(item, ["measurement_mode", "measurementMode"]), withDefaults ? "weight_reps" : undefined),
    distance_unit: normalizeDistanceUnitField(pickField(item, ["distance_unit", "distanceUnit"]), withDefaults ? "km" : undefined),
    counts_in_muscle_stats: normalizeBooleanField(pickField(item, ["counts_in_muscle_stats", "countsInMuscleStats"]), withDefaults ? true : undefined),
    measure_weight_enabled: normalizeBooleanField(pickField(item, ["measure_weight_enabled", "measureWeightEnabled"]), withDefaults ? true : undefined),
    measure_reps_enabled: normalizeBooleanField(pickField(item, ["measure_reps_enabled", "measureRepsEnabled"]), withDefaults ? true : undefined),
    measure_time_enabled: normalizeBooleanField(pickField(item, ["measure_time_enabled", "measureTimeEnabled"]), withDefaults ? false : undefined),
    measure_rir_enabled: normalizeBooleanField(pickField(item, ["measure_rir_enabled", "measureRirEnabled"]), withDefaults ? false : undefined),
    measure_rpe_enabled: normalizeBooleanField(pickField(item, ["measure_rpe_enabled", "measureRpeEnabled"]), withDefaults ? false : undefined),
    weight_unit: normalizeWeightUnitField(pickField(item, ["weight_unit", "weightUnit"]), withDefaults ? "kg" : undefined),
    double_weight_in_stats: normalizeBooleanField(pickField(item, ["double_weight_in_stats", "doubleWeightInStats"]), withDefaults ? false : undefined),
    double_count_in_statistics: normalizeBooleanField(pickField(item, ["double_count_in_statistics", "doubleCountInStatistics", "doubleWeightInStats"])),
    user_program_exercise_setting_id: uuidOrNull(pickField(item, ["user_program_exercise_setting_id", "userProgramExerciseSettingId"])),
    user_program_exercise_setting_client_id: pickField(item, ["user_program_exercise_setting_client_id", "userProgramExerciseSettingClientId"]),
    program_template_exercise_id: uuidOrNull(pickField(item, ["program_template_exercise_id", "programTemplateExerciseId"])),
    program_template_exercise_key: pickField(item, ["program_template_exercise_key", "programTemplateExerciseKey"]),
    planned_sets: pickField(item, ["planned_sets", "plannedSets"]),
    planned_rep_min: pickField(item, ["planned_rep_min", "plannedRepMin"]),
    planned_rep_max: pickField(item, ["planned_rep_max", "plannedRepMax"]),
    planned_weight: pickField(item, ["planned_weight", "plannedWeight"]),
    planned_reps: pickField(item, ["planned_reps", "plannedReps"]),
    progression_state: pickField(item, ["progression_state", "progressionState"]),
  });
};

const setFields = (item: Record<string, unknown>) => compact({
  set_order: pickField(item, ["set_order", "setOrder", "order"]),
  weight_kg: pickField(item, ["weight_kg", "weightKg", "weight"]),
  reps: pickField(item, ["reps"]),
  weight_value: pickField(item, ["weight_kg", "weightKg", "weight", "weight_value", "weightValue"]),
  reps_value: pickField(item, ["reps", "reps_value", "repsValue"]),
  duration_seconds: pickField(item, ["duration_seconds", "durationSeconds", "work_time_seconds", "workTimeSeconds"]),
  distance_value: pickField(item, ["distance_value", "distanceValue"]),
  manual_calories: pickField(item, ["manual_calories", "manualCalories"]),
  estimated_calories: pickField(item, ["estimated_calories", "estimatedCalories"]),
  rir: pickField(item, ["rir"]),
  rpe: pickField(item, ["rpe"]),
  work_time_seconds: pickField(item, ["work_time_seconds", "workTimeSeconds"]),
  rest_seconds: pickField(item, ["rest_seconds", "restSeconds"]),
  rest_after_seconds: pickField(item, ["rest_after_seconds", "restAfterSeconds"]),
  tempo: pickField(item, ["tempo"]),
  is_completed: pickField(item, ["is_completed", "isCompleted"]),
  notes: pickField(item, ["notes", "note"]),
});

const updateWithOptionalDuration = async (
  supabase: ReturnType<typeof createClient>,
  table: string,
  fields: Record<string, unknown>,
  id: string,
) => {
  let result = await supabase.from(table).update(fields).eq("id", id).select().maybeSingle();
  if (result.error && fields.duration_seconds !== undefined && /duration_seconds/i.test(result.error.message || "")) {
    result = await supabase.from(table).update(withoutDuration(fields)).eq("id", id).select().maybeSingle();
  }
  return result;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const serviceRoleValidation = validateServiceRoleKey(serviceRoleKey);
    if (!serviceRoleValidation.ok) {
      console.error("[WorkoutPersistence] invalid service role secret", serviceRoleValidation);
      return json({
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY is not a service role key",
        error_details: serviceRoleValidation,
      }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await request.json().catch(() => ({}));
    const { initData, action, payload = {} } = body;
    console.log("[WorkoutPersistence] edge request", { action, payload });
    console.log("onlypump-workouts-api request body:", body);
    console.log("onlypump-workouts-api action:", action);
    console.log("onlypump-workouts-api payload:", payload);

    if (!action) throw new Error("action is required");
    const profile = await resolveProfileFromRequest(supabase, request, initData);
    if (!profile?.id) throw new Error("Profile not found");
    console.log("[WorkoutPersistence] edge profile", {
      action,
      profile_id: profile.id,
      telegram_id: profile.telegram_id || null,
      auth_user_id: profile.auth_user_id || null,
      email: profile.email || null,
    });
    console.log("Verified profile:", profile);
    if (!hasProfileAccess(profile)) {
      return accessDeniedResponse(profile);
    }

    const profileId = String(profile.id);
    let linkedProfileIdsCache: string[] | null = null;

    const loadLinkedProfileIds = async () => {
      if (linkedProfileIdsCache) return linkedProfileIdsCache;
      const ids = new Set<string>([profileId]);
      const telegramId = String(profile.telegram_id || "").trim();
      const email = String(profile.email || "").trim().toLowerCase();
      const authUserId = String(profile.auth_user_id || "").trim();

      const addMatches = async (column: string, value: string) => {
        if (!value) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq(column, value);
        if (error) {
          console.warn("Linked profile lookup failed:", { column, error: error.message });
          return;
        }
        (data || []).forEach((item) => {
          if (item?.id) ids.add(String(item.id));
        });
      };

      await addMatches("telegram_id", telegramId);
      await addMatches("email", email);
      await addMatches("auth_user_id", authUserId);
      linkedProfileIdsCache = Array.from(ids);
      console.log("Workout linked profile ids:", linkedProfileIdsCache);
      return linkedProfileIdsCache;
    };

    const claimLinkedWorkoutRows = async (rows: Record<string, unknown>[] = []) => {
      const legacyWorkoutIds = rows
        .filter((item) => String(item.profile_id || "") !== profileId)
        .map((item) => String(item.id || ""))
        .filter(Boolean);
      if (legacyWorkoutIds.length) {
        console.log("Claiming linked workout rows for current profile:", {
          profile_id: profileId,
          workout_ids: legacyWorkoutIds,
        });
        const claim = await supabase
          .from("workouts")
          .update({ profile_id: profileId })
          .in("id", legacyWorkoutIds);
        if (claim.error) throw claim.error;
      }
      return rows.map((item) => ({ ...item, profile_id: profileId }));
    };

    const findWorkoutOwner = async (workoutId: string) => {
      const linkedProfileIds = await loadLinkedProfileIds();
      let query = supabase
        .from("workouts")
        .select("id, profile_id")
        .eq("id", workoutId);
      query = linkedProfileIds.length > 1
        ? query.in("profile_id", linkedProfileIds)
        : query.eq("profile_id", profileId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if (String(data.profile_id || "") !== profileId) {
        const claim = await supabase.from("workouts").update({ profile_id: profileId }).eq("id", workoutId);
        if (claim.error) throw claim.error;
      }
      return data;
    };

    const ensureWorkoutOwner = async (workoutId: string) => {
      const workout = await findWorkoutOwner(workoutId);
      if (!workout) throw new Error(`Workout ownership check failed: ${workoutId}`);
      return workout;
    };

    const findExerciseOwner = async (exerciseId: string) => {
      const { data: exercise, error } = await supabase
        .from("workout_exercises")
        .select("id, workout_id")
        .eq("id", exerciseId)
        .maybeSingle();
      if (error) throw error;
      if (!exercise?.workout_id) return null;
      await ensureWorkoutOwner(exercise.workout_id);
      return exercise;
    };

    const ensureExerciseOwner = async (exerciseId: string) => {
      const exercise = await findExerciseOwner(exerciseId);
      if (!exercise) throw new Error(`Exercise not found: ${exerciseId}`);
      return exercise;
    };

    const findSetOwner = async (setId: string) => {
      const { data: set, error } = await supabase
        .from("workout_sets")
        .select("id, workout_exercise_id")
        .eq("id", setId)
        .maybeSingle();
      if (error) throw error;
      if (!set?.workout_exercise_id) return null;
      await ensureExerciseOwner(set.workout_exercise_id);
      return set;
    };

    const ensureSetOwner = async (setId: string) => {
      const set = await findSetOwner(setId);
      if (!set) throw new Error(`Set not found: ${setId}`);
      return set;
    };

    const toUniqueIdList = (ids: unknown[] = []) => Array.from(new Set(
      ids.map((id) => String(id || "").trim()).filter(Boolean),
    ));

    const chunkRows = <T,>(rows: T[], size = 30) => {
      const chunks: T[][] = [];
      for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
      return chunks;
    };

    const selectRowsInChunks = async (
      table: string,
      column: string,
      ids: unknown[] = [],
      options: {
        select?: string;
        orderColumn?: string;
        filters?: Array<{ column: string; value: unknown }>;
      } = {},
    ) => {
      const rows: Record<string, unknown>[] = [];
      for (const idChunk of chunkRows(toUniqueIdList(ids))) {
        let query: any = supabase.from(table).select(options.select || "*").in(column, idChunk);
        for (const filter of options.filters || []) query = query.eq(filter.column, filter.value);
        const result = options.orderColumn
          ? await query.order(options.orderColumn, { ascending: true })
          : await query;
        if (result.error) throw result.error;
        rows.push(...((result.data || []) as Record<string, unknown>[]));
      }
      return rows;
    };

    const deleteRowsInChunks = async (table: string, column: string, ids: unknown[] = []) => {
      const deletedRows: Record<string, unknown>[] = [];
      for (const idChunk of chunkRows(toUniqueIdList(ids))) {
        const result = await supabase.from(table).delete().in(column, idChunk).select();
        if (result.error) throw result.error;
        deletedRows.push(...((result.data || []) as Record<string, unknown>[]));
      }
      return deletedRows;
    };

    const loadTree = async () => {
      const linkedProfileIds = await loadLinkedProfileIds();
      let workoutsQuery = supabase
        .from("workouts")
        .select("*")
        .order("workout_date", { ascending: false });
      workoutsQuery = linkedProfileIds.length > 1
        ? workoutsQuery.in("profile_id", linkedProfileIds)
        : workoutsQuery.eq("profile_id", profileId);
      const { data: workoutRows, error: workoutsError } = await workoutsQuery;
      if (workoutsError) throw workoutsError;
      const workouts = await claimLinkedWorkoutRows(workoutRows || []);

      const workoutIds = (workouts || []).map((item) => item.id);
      const exercises = workoutIds.length
        ? await selectRowsInChunks("workout_exercises", "workout_id", workoutIds, { orderColumn: "exercise_order" })
        : [];
      console.log("Loaded workout exercises:", exercises.length);

      const exerciseIds = (exercises || []).map((item) => item.id);
      const sets = exerciseIds.length
        ? await selectRowsInChunks("workout_sets", "workout_exercise_id", exerciseIds, { orderColumn: "set_order" })
        : [];
      console.log("Loaded workout sets:", sets.length);

      const setsByExerciseId = (sets || []).reduce((map, set) => {
        const key = String(set.workout_exercise_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(set);
        return map;
      }, new Map<string, Record<string, unknown>[]>());
      const exercisesByWorkoutId = (exercises || []).reduce((map, exercise) => {
        const key = String(exercise.workout_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({
          ...exercise,
          workout_sets: setsByExerciseId.get(String(exercise.id)) || [],
        });
        return map;
      }, new Map<string, Record<string, unknown>[]>());
      const workoutTree = (workouts || []).map((workout) => ({
        ...workout,
        workout_exercises: exercisesByWorkoutId.get(String(workout.id)) || [],
      }));

      return { workouts: workoutTree, workout_exercises: exercises, workout_sets: sets };
    };

    const loadSingleWorkoutTree = async (workoutId: string) => {
      await ensureWorkoutOwner(workoutId);
      const workoutResult = await supabase.from("workouts").select("*").eq("id", workoutId).maybeSingle();
      if (workoutResult.error) throw workoutResult.error;
      if (!workoutResult.data) throw new Error(`Workout not found: ${workoutId}`);
      const exercisesResult = await supabase
        .from("workout_exercises")
        .select("*")
        .eq("workout_id", workoutId)
        .order("exercise_order", { ascending: true });
      if (exercisesResult.error) throw exercisesResult.error;
      const exerciseIds = (exercisesResult.data || []).map((item) => item.id);
      const sets = exerciseIds.length
        ? await selectRowsInChunks("workout_sets", "workout_exercise_id", exerciseIds, { orderColumn: "set_order" })
        : [];
      const setsByExerciseId = (sets || []).reduce((map, set) => {
        const key = String(set.workout_exercise_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(set);
        return map;
      }, new Map<string, Record<string, unknown>[]>());
      const exercises = (exercisesResult.data || []).map((exercise) => ({
        ...exercise,
        workout_sets: setsByExerciseId.get(String(exercise.id)) || [],
      }));
      const workout = { ...workoutResult.data, workout_exercises: exercises };
      return {
        workout,
        workout_id: workout.id,
        exercises,
        workout_exercises: exercises,
        sets,
        workout_sets: sets,
      };
    };

    const loadUserPrograms = async () => {
      const linkedProfileIds = await loadLinkedProfileIds();
      let query = supabase
        .from("user_programs")
        .select("*, user_program_exercise_settings(*)")
        .order("created_at", { ascending: false });
      query = linkedProfileIds.length > 1
        ? query.in("profile_id", linkedProfileIds)
        : query.eq("profile_id", profileId);
      const { data, error } = await query;
      if (error) {
        console.warn("loadUserPrograms skipped:", error);
        return [];
      }
      const legacyProgramIds = (data || [])
        .filter((item) => String(item.profile_id || "") !== profileId)
        .map((item) => String(item.id || ""))
        .filter(Boolean);
      if (legacyProgramIds.length) {
        console.log("Claiming linked user programs for current profile:", {
          profile_id: profileId,
          user_program_ids: legacyProgramIds,
        });
        const claim = await supabase
          .from("user_programs")
          .update({ profile_id: profileId })
          .in("id", legacyProgramIds);
        if (claim.error) {
          console.warn("Claiming linked user programs skipped:", claim.error);
        }
      }
      return (data || []).map((item) => ({ ...item, profile_id: profileId }));
    };

    const normalizeScopeType = (value: unknown, fallback = "only") => {
      const scope = String(value || fallback).trim();
      if (scope === "single" || scope === "only") return "only";
      if (scope === "same_program_workout" || scope === "program_workout" || scope === "program_same" || scope === "all_such") return "program_workout";
      if (scope === "program") return "program";
      if (scope === "repeat_group" || scope === "repeat" || scope === "series") return "repeat";
      return fallback;
    };

    const normalizeTimeScope = (value: unknown, fallback = "all") => {
      const range = String(value || fallback).trim();
      if (range === "single" || range === "only" || range === "all" || range === "full") return "all";
      if (range === "with_previous" || range === "previous") return "previous";
      if (range === "with_future" || range === "future") return "future";
      return fallback;
    };

    const readWorkoutScopeRows = async (workoutId: string, scope = "only", range = "all") => {
      const { data: selected, error: selectedError } = await supabase
        .from("workouts")
        .select("*")
        .eq("id", workoutId)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (selectedError) throw selectedError;
      if (!selected) throw new Error(`Workout ownership check failed: ${workoutId}`);
      if (scope === "only") return [selected];

      const { data: rows, error } = await supabase
        .from("workouts")
        .select("*")
        .eq("profile_id", profileId);
      if (error) throw error;

      const selectedDate = String(selected.workout_date || "").slice(0, 10);
      const rangeMatches = (row: Record<string, unknown>) => {
        const date = String(row.workout_date || "").slice(0, 10);
        if (range === "previous" || range === "with_previous") return date <= selectedDate;
        if (range === "future" || range === "with_future") return date >= selectedDate;
        return true;
      };

      const selectedUserProgramId = selected.user_program_id ? String(selected.user_program_id) : "";
      const selectedTemplateWorkoutId = selected.program_template_workout_id ? String(selected.program_template_workout_id) : "";
      const selectedTemplateWorkoutKey = selected.program_template_workout_key ? String(selected.program_template_workout_key) : "";
      const selectedRepeatGroupId = selected.repeat_group_id ? String(selected.repeat_group_id) : "";

      const related = (rows || []).filter((row: Record<string, unknown>) => {
        if (!rangeMatches(row)) return false;
        if (scope === "program") {
          return Boolean(selectedUserProgramId) && String(row.user_program_id || "") === selectedUserProgramId;
        }
        if (scope === "program_workout" || scope === "program_same") {
          if (!selectedUserProgramId) return false;
          if (String(row.user_program_id || "") !== selectedUserProgramId) return false;
          if (selectedTemplateWorkoutId) return String(row.program_template_workout_id || "") === selectedTemplateWorkoutId;
          if (selectedTemplateWorkoutKey) return String(row.program_template_workout_key || "") === selectedTemplateWorkoutKey;
          return false;
        }
        if (scope === "repeat" || scope === "series") {
          return Boolean(selectedRepeatGroupId) && String(row.repeat_group_id || "") === selectedRepeatGroupId;
        }
        return String(row.id || "") === workoutId;
      });
      return related.length ? related : [selected];
    };

    const deleteWorkoutRows = async (rows: Array<Record<string, unknown>>) => {
      const ids = rows.map((item) => String(item.id)).filter(Boolean);
      if (!ids.length) return [];
      const exercises = await selectRowsInChunks("workout_exercises", "workout_id", ids, { select: "id" });
      const exerciseIds = (exercises || []).map((item) => item.id);
      if (exerciseIds.length) await deleteRowsInChunks("workout_sets", "workout_exercise_id", exerciseIds);
      await deleteRowsInChunks("workout_exercises", "workout_id", ids);
      const deletedWorkouts = await deleteRowsInChunks("workouts", "id", ids);
      return (deletedWorkouts || [])
        .map((item: { id?: unknown }) => String(item.id || ""))
        .filter(Boolean);
    };

    if (action === "load") {
      const tree = await loadTree();
      const userPrograms = await loadUserPrograms();
      return json({ ok: true, profile, ...tree, user_programs: userPrograms, programs: userPrograms });
    }

    if (action === "load_exercise_library") {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("*")
        .or(`profile_id.is.null,profile_id.eq.${profileId}`)
        .order("exercise_category", { ascending: true })
        .order("exercise_name", { ascending: true });
      if (error) return json({ ok: false, error: error.message });
      return json({ ok: true, profile, exercises: data || [], exercise_library: data || [] });
    }

    if (action === "load_program_templates") {
      const linkedProfileIds = await loadLinkedProfileIds();
      const { data, error } = await supabase
        .from("program_templates")
        .select(`
          *,
          program_template_workouts(
            *,
            program_template_exercises(
              *,
              program_exercise_alternatives(*)
            )
          )
        `)
        .order("created_at", { ascending: true });
      if (error) return json({ ok: false, error: error.message });
      const visibleTemplates = (data || []).filter((item: Record<string, unknown>) => {
        const creatorId = String(item.creator_profile_id || "");
        const isLinkedOwnTemplate = toBoolean(item.is_user_created) && linkedProfileIds.includes(creatorId);
        return isLinkedOwnTemplate || isProgramTemplateVisibleToProfile(item, profile as Record<string, unknown>);
      });
      const legacyTemplateIds = visibleTemplates
        .filter((item: Record<string, unknown>) => {
          const creatorId = String(item.creator_profile_id || "");
          return creatorId && creatorId !== profileId && linkedProfileIds.includes(creatorId);
        })
        .map((item: Record<string, unknown>) => String(item.id || ""))
        .filter(Boolean);
      if (legacyTemplateIds.length) {
        const claim = await supabase
          .from("program_templates")
          .update({ creator_profile_id: profileId, updated_at: new Date().toISOString() })
          .in("id", legacyTemplateIds);
        if (claim.error) {
          console.warn("Claiming linked program templates skipped:", claim.error);
        }
      }
      const templates = visibleTemplates.map((item: Record<string, unknown>) => {
        const creatorId = String(item.creator_profile_id || "");
        return creatorId && creatorId !== profileId && linkedProfileIds.includes(creatorId)
          ? { ...item, creator_profile_id: profileId }
          : item;
      });
      return json({ ok: true, profile, program_templates: templates, templates });
    }

    if (action === "load_program_template_details") {
      const templateId = uuidOrNull(payload.id || payload.program_template_id);
      const templateKey = String(payload.template_key || payload.templateKey || "").trim();
      let query = supabase
        .from("program_templates")
        .select(`
          *,
          program_template_workouts(
            *,
            program_template_exercises(
              *,
              program_exercise_alternatives(*)
            )
          )
        `)
        ;
      query = templateId ? query.eq("id", templateId) : query.eq("template_key", templateKey);
      let { data, error } = await query.maybeSingle();
      if (error) return json({ ok: false, error: error.message });
      const linkedProfileIds = await loadLinkedProfileIds();
      const creatorId = data ? String((data as Record<string, unknown>).creator_profile_id || "") : "";
      const isLinkedOwnTemplate = Boolean(data) && toBoolean((data as Record<string, unknown>).is_user_created) && linkedProfileIds.includes(creatorId);
      if (data && isLinkedOwnTemplate && creatorId && creatorId !== profileId) {
        const claim = await supabase
          .from("program_templates")
          .update({ creator_profile_id: profileId, updated_at: new Date().toISOString() })
          .eq("id", (data as Record<string, unknown>).id);
        if (claim.error) console.warn("Claiming linked program template detail skipped:", claim.error);
        data = { ...(data as Record<string, unknown>), creator_profile_id: profileId };
      }
      if (data && !isLinkedOwnTemplate && !isProgramTemplateVisibleToProfile(data as Record<string, unknown>, profile as Record<string, unknown>)) {
        return json({ ok: false, error: "Недостаточно прав" }, 403);
      }
      return json({ ok: true, profile, program_template: data, template: data });
    }

    if (action === "load_user_programs") {
      const userPrograms = await loadUserPrograms();
      return json({ ok: true, profile, user_programs: userPrograms, programs: userPrograms });
    }

    if (action === "save_program_template") {
      if (!profileHasAnyRole(profile as Record<string, unknown>, ["owner", "trainer"])) {
        return json({ ok: false, error: "Недостаточно прав" }, 403);
      }
      const programInput = payload.program || {};
      const workoutInputs = Array.isArray(payload.workouts) ? payload.workouts : [];
      if (!String(programInput.name || programInput.title || "").trim()) return json({ ok: false, error: "Название программы обязательно" });
      if (!workoutInputs.length) return json({ ok: false, error: "Добавь хотя бы один день программы" });
      const isOwner = profileHasRole(profile as Record<string, unknown>, "owner");
      const defaultScope = "private";
      let visibilityScope = normalizeProgramVisibilityScope(programInput.visibility_scope || programInput.visibilityScope, defaultScope);
      if (!isOwner && !["trainer_students", "selected", "private"].includes(visibilityScope)) visibilityScope = "trainer_students";
      let targetProfileIds = visibilityScope === "selected"
        ? toStringArray(programInput.target_profile_ids || programInput.targetProfileIds).map(uuidOrNull).filter(Boolean)
        : [];
      if (visibilityScope === "selected" && !targetProfileIds.length) {
        return json({ ok: false, error: "Выбери хотя бы одного получателя" }, 400);
      }
      if (!isOwner && visibilityScope === "selected" && targetProfileIds.length) {
        const { data: allowedTargets, error: allowedTargetsError } = await supabase
          .from("profiles")
          .select("id")
          .in("id", targetProfileIds)
          .eq("trainer_profile_id", profileId)
          .is("deleted_at", null);
        if (allowedTargetsError) return json({ ok: false, error: allowedTargetsError.message }, 400);
        const allowedIds = new Set((allowedTargets || []).map((item: Record<string, unknown>) => String(item.id || "")));
        targetProfileIds = targetProfileIds.filter((id) => allowedIds.has(String(id)));
        if (!targetProfileIds.length) return json({ ok: false, error: "Тренер может отправлять программу только своим ученикам" }, 403);
      }
      const templateKey = String(programInput.template_key || programInput.templateKey || `custom-program-${crypto.randomUUID()}`).trim();
      const templateFields = compact({
        template_key: templateKey,
        name: String(programInput.name || programInput.title).trim(),
        description: String(programInput.description || "").trim(),
        goal: String(programInput.goal || programInput.focus || "").trim() || null,
        default_duration_weeks: Math.max(1, Math.round(toNumber(programInput.default_duration_weeks || programInput.duration_weeks || programInput.durationWeeks, 8))),
        min_duration_weeks: Math.max(1, Math.round(toNumber(programInput.min_duration_weeks || programInput.minDurationWeeks, 1))),
        max_duration_weeks: Math.max(1, Math.round(toNumber(programInput.max_duration_weeks || programInput.maxDurationWeeks, 52))),
        default_difficulty: String(programInput.default_difficulty || programInput.defaultDifficulty || "intermediate"),
        workouts_per_week: Math.max(1, Math.round(toNumber(programInput.workouts_per_week || programInput.workoutsPerWeek || workoutInputs.length, workoutInputs.length))),
        is_public: visibilityScope !== "private",
        audience: String(programInput.audience || "унисекс"),
        focus: String(programInput.focus || programInput.goal || "").trim() || null,
        schedule_pattern: String(programInput.schedule_pattern || programInput.schedulePattern || "").trim() || null,
        cycle_length_days: Math.max(1, Math.min(20, Math.round(toNumber(programInput.cycle_length_days || programInput.cycleLengthDays, workoutInputs.length || 1)))),
        workout_count: Math.max(1, Math.round(toNumber(programInput.workout_count || programInput.workoutCount, workoutInputs.length || 1))),
        progression_type: String(programInput.progression_type || programInput.progressionType || "double_progression"),
        visibility_scope: visibilityScope,
        target_role: visibilityScope === "students" || visibilityScope === "trainer_students" ? "student" : null,
        target_profile_ids: targetProfileIds,
        is_user_created: true,
        updated_at: new Date().toISOString(),
      });
      const insertTemplate = compact({
        ...templateFields,
        creator_profile_id: profileId,
        created_by_role: isOwner ? "owner" : "trainer",
      });
      const existingResult = await supabase
        .from("program_templates")
        .select("*")
        .eq("template_key", templateKey)
        .maybeSingle();
      if (existingResult.error) return json({ ok: false, error: existingResult.error.message }, 400);
      const existingTemplate = existingResult.data as Record<string, unknown> | null;
      if (existingTemplate?.id) {
        const linkedProfileIds = await loadLinkedProfileIds();
        const creatorId = String(existingTemplate.creator_profile_id || "");
        const canEditExistingTemplate = isOwner || creatorId === profileId || linkedProfileIds.includes(creatorId);
        if (!canEditExistingTemplate) {
          return json({ ok: false, error: "Тренер может редактировать только свои программы" }, 403);
        }
        const updateResult = await supabase
          .from("program_templates")
          .update(compact({
            ...templateFields,
            creator_profile_id: profileId,
          }))
          .eq("id", existingTemplate.id)
          .select()
          .single();
        if (updateResult.error) return json({ ok: false, error: updateResult.error.message }, 400);

        const { createdWorkouts, createdExercises, createdAlternatives } = await saveProgramTemplateWorkouts(
          supabase,
          updateResult.data as Record<string, unknown>,
          templateKey,
          workoutInputs,
          { pruneMissing: toBoolean(payload.replace_missing_children ?? payload.replaceMissingChildren ?? payload.prune_missing_children ?? payload.pruneMissingChildren, false) },
        );

        const detailResult = await supabase
          .from("program_templates")
          .select(`
            *,
            program_template_workouts(
              *,
              program_template_exercises(
                *,
                program_exercise_alternatives(*)
              )
            )
          `)
          .eq("id", updateResult.data.id)
          .single();
        if (detailResult.error) return json({ ok: false, error: detailResult.error.message }, 400);
        return json({
          ok: true,
          profile,
          program_template: detailResult.data,
          template: detailResult.data,
          program_template_workouts: createdWorkouts,
          program_template_exercises: createdExercises,
          program_exercise_alternatives: createdAlternatives,
        });
      }
      const templateResult = await supabase.from("program_templates").insert(insertTemplate).select().single();
      if (templateResult.error) return json({ ok: false, error: templateResult.error.message });
      const template = templateResult.data as Record<string, unknown>;
      const { createdWorkouts, createdExercises, createdAlternatives } = await saveProgramTemplateWorkouts(
        supabase,
        template,
        templateKey,
        workoutInputs,
        { pruneMissing: toBoolean(payload.replace_missing_children ?? payload.replaceMissingChildren ?? payload.prune_missing_children ?? payload.pruneMissingChildren, false) },
      );
      const detailResult = await supabase
        .from("program_templates")
        .select(`
          *,
          program_template_workouts(
            *,
            program_template_exercises(
              *,
              program_exercise_alternatives(*)
            )
          )
        `)
        .eq("id", template.id)
        .single();
      if (detailResult.error) return json({ ok: false, error: detailResult.error.message });
      return json({
        ok: true,
        profile,
        program_template: detailResult.data,
        template: detailResult.data,
        program_template_workouts: createdWorkouts,
        program_template_exercises: createdExercises,
        program_exercise_alternatives: createdAlternatives,
      });
    }

    if (action === "update_program_template") {
      if (!profileHasAnyRole(profile as Record<string, unknown>, ["owner", "trainer"])) {
        return json({ ok: false, error: "Недостаточно прав" }, 403);
      }
      const programInput = payload.program || {};
      const workoutInputs = Array.isArray(payload.workouts) ? payload.workouts as Record<string, unknown>[] : [];
      if (!String(programInput.name || programInput.title || "").trim()) return json({ ok: false, error: "Название программы обязательно" });
      if (!workoutInputs.length) return json({ ok: false, error: "Добавь хотя бы один день программы" });
      const templateId = uuidOrNull(programInput.program_template_id || programInput.programTemplateId || payload.program_template_id || payload.id);
      const templateKey = String(programInput.template_key || programInput.templateKey || payload.template_key || payload.templateKey || "").trim();
      if (!templateId && !templateKey) return json({ ok: false, error: "Не указана программа" }, 400);

      let templateQuery = supabase.from("program_templates").select("*");
      templateQuery = templateId ? templateQuery.eq("id", templateId) : templateQuery.eq("template_key", templateKey);
      const existingResult = await templateQuery.maybeSingle();
      if (existingResult.error) return json({ ok: false, error: existingResult.error.message }, 400);
      const existingTemplate = existingResult.data as Record<string, unknown> | null;
      if (!existingTemplate?.id) return json({ ok: false, error: "Программа не найдена" }, 404);

      const isOwner = profileHasRole(profile as Record<string, unknown>, "owner");
      const creatorId = String(existingTemplate.creator_profile_id || "");
      const linkedProfileIds = await loadLinkedProfileIds();
      const canEditExistingTemplate = isOwner || creatorId === profileId || linkedProfileIds.includes(creatorId);
      if (!canEditExistingTemplate) {
        return json({ ok: false, error: "Тренер может редактировать только свои программы" }, 403);
      }

      const defaultScope = normalizeProgramVisibilityScope(existingTemplate.visibility_scope, "private");
      let visibilityScope = normalizeProgramVisibilityScope(programInput.visibility_scope || programInput.visibilityScope, defaultScope);
      if (!isOwner && !["trainer_students", "selected", "private"].includes(visibilityScope)) visibilityScope = "trainer_students";
      let targetProfileIds = visibilityScope === "selected"
        ? toStringArray(programInput.target_profile_ids || programInput.targetProfileIds).map(uuidOrNull).filter(Boolean)
        : [];
      if (visibilityScope === "selected" && !targetProfileIds.length) {
        return json({ ok: false, error: "Выбери хотя бы одного получателя" }, 400);
      }
      if (!isOwner && visibilityScope === "selected" && targetProfileIds.length) {
        const { data: allowedTargets, error: allowedTargetsError } = await supabase
          .from("profiles")
          .select("id")
          .in("id", targetProfileIds)
          .eq("trainer_profile_id", profileId)
          .is("deleted_at", null);
        if (allowedTargetsError) return json({ ok: false, error: allowedTargetsError.message }, 400);
        const allowedIds = new Set((allowedTargets || []).map((item: Record<string, unknown>) => String(item.id || "")));
        targetProfileIds = targetProfileIds.filter((id) => allowedIds.has(String(id)));
        if (!targetProfileIds.length) return json({ ok: false, error: "Тренер может отправлять программу только своим ученикам" }, 403);
      }

      const stableTemplateKey = String(existingTemplate.template_key || templateKey || `custom-program-${crypto.randomUUID()}`).trim();
      const updateResult = await supabase
        .from("program_templates")
        .update(compact({
          template_key: stableTemplateKey,
          name: String(programInput.name || programInput.title).trim(),
          description: String(programInput.description || "").trim(),
          goal: String(programInput.goal || programInput.focus || "").trim() || null,
          default_duration_weeks: Math.max(1, Math.round(toNumber(programInput.default_duration_weeks || programInput.duration_weeks || programInput.durationWeeks, 8))),
          min_duration_weeks: Math.max(1, Math.round(toNumber(programInput.min_duration_weeks || programInput.minDurationWeeks, 1))),
          max_duration_weeks: Math.max(1, Math.round(toNumber(programInput.max_duration_weeks || programInput.maxDurationWeeks, 52))),
          default_difficulty: String(programInput.default_difficulty || programInput.defaultDifficulty || "intermediate"),
          workouts_per_week: Math.max(1, Math.round(toNumber(programInput.workouts_per_week || programInput.workoutsPerWeek || workoutInputs.length, workoutInputs.length))),
          is_public: visibilityScope !== "private",
          audience: String(programInput.audience || "унисекс"),
          focus: String(programInput.focus || programInput.goal || "").trim() || null,
          schedule_pattern: String(programInput.schedule_pattern || programInput.schedulePattern || "").trim() || null,
          cycle_length_days: Math.max(1, Math.min(20, Math.round(toNumber(programInput.cycle_length_days || programInput.cycleLengthDays, workoutInputs.length || 1)))),
          workout_count: Math.max(1, Math.round(toNumber(programInput.workout_count || programInput.workoutCount, workoutInputs.length || 1))),
          progression_type: String(programInput.progression_type || programInput.progressionType || "double_progression"),
          visibility_scope: visibilityScope,
          target_role: visibilityScope === "students" || visibilityScope === "trainer_students" ? "student" : null,
          target_profile_ids: targetProfileIds,
          is_user_created: true,
          creator_profile_id: profileId,
          updated_at: new Date().toISOString(),
        }))
        .eq("id", existingTemplate.id)
        .select()
        .single();
      if (updateResult.error) return json({ ok: false, error: updateResult.error.message }, 400);

      const { createdWorkouts, createdExercises, createdAlternatives } = await saveProgramTemplateWorkouts(
        supabase,
        updateResult.data as Record<string, unknown>,
        stableTemplateKey,
        workoutInputs,
        { pruneMissing: toBoolean(payload.replace_missing_children ?? payload.replaceMissingChildren ?? payload.prune_missing_children ?? payload.pruneMissingChildren, false) },
      );

      const detailResult = await supabase
        .from("program_templates")
        .select(`
          *,
          program_template_workouts(
            *,
            program_template_exercises(
              *,
              program_exercise_alternatives(*)
            )
          )
        `)
        .eq("id", updateResult.data.id)
        .single();
      if (detailResult.error) return json({ ok: false, error: detailResult.error.message }, 400);
      return json({
        ok: true,
        profile,
        program_template: detailResult.data,
        template: detailResult.data,
        program_template_workouts: createdWorkouts,
        program_template_exercises: createdExercises,
        program_exercise_alternatives: createdAlternatives,
      });
    }

    if (action === "share_program_template") {
      if (!profileHasAnyRole(profile as Record<string, unknown>, ["owner", "trainer"])) {
        return json({ ok: false, error: "Недостаточно прав" }, 403);
      }
      const templateId = uuidOrNull(payload.program_template_id || payload.id);
      const templateKey = String(payload.template_key || payload.templateKey || "").trim();
      if (!templateId && !templateKey) return json({ ok: false, error: "Не указана программа" }, 400);
      let templateQuery = supabase
        .from("program_templates")
        .select("*");
      templateQuery = templateId ? templateQuery.eq("id", templateId) : templateQuery.eq("template_key", templateKey);
      const existingResult = await templateQuery.maybeSingle();
      if (existingResult.error) return json({ ok: false, error: existingResult.error.message }, 400);
      const existingTemplate = existingResult.data as Record<string, unknown> | null;
      if (!existingTemplate?.id) return json({ ok: false, error: "Программа не найдена" }, 404);

      const isOwner = profileHasRole(profile as Record<string, unknown>, "owner");
      const creatorId = String(existingTemplate.creator_profile_id || "");
      const linkedProfileIds = await loadLinkedProfileIds();
      const canShareExistingTemplate = isOwner || creatorId === profileId || linkedProfileIds.includes(creatorId);
      if (!canShareExistingTemplate) {
        return json({ ok: false, error: "Тренер может делиться только своими программами" }, 403);
      }

      let visibilityScope = normalizeProgramVisibilityScope(payload.visibility_scope || payload.visibilityScope, "private");
      if (!isOwner && !["trainer_students", "selected", "private"].includes(visibilityScope)) visibilityScope = "trainer_students";
      let targetProfileIds = visibilityScope === "selected"
        ? toStringArray(payload.target_profile_ids || payload.targetProfileIds).map(uuidOrNull).filter(Boolean)
        : [];
      if (visibilityScope === "selected" && !targetProfileIds.length) {
        return json({ ok: false, error: "Выбери хотя бы одного получателя" }, 400);
      }
      if (!isOwner && visibilityScope === "selected" && targetProfileIds.length) {
        const { data: allowedTargets, error: allowedTargetsError } = await supabase
          .from("profiles")
          .select("id")
          .in("id", targetProfileIds)
          .eq("trainer_profile_id", profileId)
          .is("deleted_at", null);
        if (allowedTargetsError) return json({ ok: false, error: allowedTargetsError.message }, 400);
        const allowedIds = new Set((allowedTargets || []).map((item: Record<string, unknown>) => String(item.id || "")));
        targetProfileIds = targetProfileIds.filter((id) => allowedIds.has(String(id)));
        if (!targetProfileIds.length) return json({ ok: false, error: "Тренер может отправлять программу только своим ученикам" }, 403);
      }

      const updateResult = await supabase
        .from("program_templates")
        .update(compact({
          is_public: visibilityScope !== "private",
          visibility_scope: visibilityScope,
          target_role: visibilityScope === "students" || visibilityScope === "trainer_students" ? "student" : null,
          target_profile_ids: targetProfileIds,
          creator_profile_id: profileId,
          updated_at: new Date().toISOString(),
        }))
        .eq("id", existingTemplate.id)
        .select()
        .single();
      if (updateResult.error) return json({ ok: false, error: updateResult.error.message }, 400);

      const detailResult = await supabase
        .from("program_templates")
        .select(`
          *,
          program_template_workouts(
            *,
            program_template_exercises(
              *,
              program_exercise_alternatives(*)
            )
          )
        `)
        .eq("id", updateResult.data.id)
        .single();
      if (detailResult.error) return json({ ok: false, error: detailResult.error.message }, 400);
      return json({ ok: true, profile, program_template: detailResult.data, template: detailResult.data });
    }

    if (action === "create_user_program") {
      const programInput = payload.program || {};
      const settingsInput = payload.settings || {};
      const startedAt = String(settingsInput.started_at || settingsInput.startedAt || payload.started_at || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const userProgramInsert = compact({
        profile_id: profileId,
        program_template_id: uuidOrNull(settingsInput.program_template_id || settingsInput.programTemplateId || programInput.id),
        template_key: String(settingsInput.template_key || settingsInput.templateKey || programInput.id || "").trim() || undefined,
        client_id: settingsInput.client_id || settingsInput.clientId || payload.client_id || payload.clientId,
        name: settingsInput.name || programInput.name || programInput.title || "Программа",
        started_at: startedAt,
        duration_weeks: settingsInput.duration_weeks || settingsInput.durationWeeks || 8,
        difficulty: settingsInput.difficulty || "intermediate",
        plan_mode: settingsInput.plan_mode || settingsInput.planMode || "flexible",
        status: settingsInput.status || "active",
        settings: settingsInput,
      });
      const userProgramResult = await supabase.from("user_programs").insert(userProgramInsert).select().single();
      if (userProgramResult.error) return json({ ok: false, error: userProgramResult.error.message });
      const userProgram = userProgramResult.data;

      const exerciseSettingInputs = Array.isArray(payload.exercise_settings) ? payload.exercise_settings : [];
      const exerciseSettingRows = exerciseSettingInputs.map((item: Record<string, unknown>) => compact({
        user_program_id: userProgram.id,
        program_template_exercise_id: uuidOrNull(pickField(item, ["program_template_exercise_id", "programTemplateExerciseId"])),
        template_exercise_key: pickField(item, ["template_exercise_key", "templateExerciseKey", "program_template_exercise_key", "programTemplateExerciseKey"]),
        client_id: pickField(item, ["client_id", "clientId"]),
        selected_exercise_library_id: uuidOrNull(pickField(item, ["selected_exercise_library_id", "selectedExerciseLibraryId"])),
        selected_exercise_name: pickField(item, ["selected_exercise_name", "selectedExerciseName", "exercise_name", "name"]) || "Упражнение",
        target_sets: pickField(item, ["target_sets", "targetSets"]) || 3,
        rep_min: pickField(item, ["rep_min", "repMin"]) || 8,
        rep_max: pickField(item, ["rep_max", "repMax"]) || 12,
        progression_weight_step: pickField(item, ["progression_weight_step", "progressionWeightStep"]) || 2.5,
        progression_rep_step: pickField(item, ["progression_rep_step", "progressionRepStep"]) || 1,
        progression_mode: pickField(item, ["progression_mode", "progressionMode"]) || "double_progression",
        deload_weight_steps: pickField(item, ["deload_weight_steps", "deloadWeightSteps"]) || 1,
        regression_threshold_sessions: pickField(item, ["regression_threshold_sessions", "regressionThresholdSessions"]) || 2,
        measurement_mode: normalizeMeasurementModeField(pickField(item, ["measurement_mode", "measurementMode"]), "weight_reps"),
      }));
      const settingsResult = exerciseSettingRows.length
        ? await supabase.from("user_program_exercise_settings").insert(exerciseSettingRows).select()
        : { data: [], error: null };
      if (settingsResult.error) return json({ ok: false, error: settingsResult.error.message });

      const settingsByClient = new Map<string, Record<string, unknown>>();
      const settingsByTemplateKey = new Map<string, Record<string, unknown>>();
      (settingsResult.data || []).forEach((row) => {
        if (row.client_id) settingsByClient.set(String(row.client_id), row);
        if (row.template_exercise_key) settingsByTemplateKey.set(String(row.template_exercise_key), row);
      });

      const createdWorkouts = [];
      const createdExercises = [];
      const createdSets = [];
      const workoutInputs = Array.isArray(payload.workouts) ? payload.workouts : [];
      for (const workoutEnvelope of workoutInputs) {
        const workoutInput = workoutEnvelope.workout || workoutEnvelope;
        const workoutInsert = compact({
          profile_id: profileId,
          workout_date: workoutInput.workout_date,
          ...workoutFields({
            ...workoutInput,
            user_program_id: userProgram.id,
            user_program_client_id: userProgram.client_id,
            program_name: userProgram.name,
            program_plan_mode: userProgram.plan_mode,
            program_difficulty: userProgram.difficulty,
            is_program_generated: true,
          }),
        });
        const workoutResult = await supabase.from("workouts").insert(workoutInsert).select().single();
        if (workoutResult.error) return json({ ok: false, error: workoutResult.error.message });
        createdWorkouts.push({ ...workoutResult.data, client_id: workoutInput.client_id || workoutEnvelope.client_id });

        for (const exerciseInput of workoutEnvelope.exercises || workoutInput.exercises || []) {
          const settingClientId = pickField(exerciseInput, ["user_program_exercise_setting_client_id", "userProgramExerciseSettingClientId"]);
          const templateExerciseKey = pickField(exerciseInput, ["program_template_exercise_key", "programTemplateExerciseKey"]);
          const savedSetting = settingsByClient.get(String(settingClientId || "")) || settingsByTemplateKey.get(String(templateExerciseKey || ""));
          const exerciseInsert = {
            workout_id: workoutResult.data.id,
            ...exerciseFields({
              ...exerciseInput,
              user_program_exercise_setting_id: savedSetting?.id || pickField(exerciseInput, ["user_program_exercise_setting_id", "userProgramExerciseSettingId"]),
            }, { defaults: true }),
          };
          const exerciseResult = await supabase.from("workout_exercises").insert(exerciseInsert).select().single();
          if (exerciseResult.error) return json({ ok: false, error: exerciseResult.error.message });
          createdExercises.push({ ...exerciseResult.data, client_id: exerciseInput.client_id, user_program_exercise_setting_client_id: settingClientId });

          const setInputs = Array.isArray(exerciseInput.sets) ? exerciseInput.sets : [];
          if (setInputs.length) {
            const setRows = setInputs.map((setInput: Record<string, unknown>) => ({
              workout_exercise_id: exerciseResult.data.id,
              ...setFields(setInput),
            }));
            const setsResult = await supabase.from("workout_sets").insert(setRows).select();
            if (setsResult.error) return json({ ok: false, error: setsResult.error.message });
            (setsResult.data || []).forEach((row, index) => {
              createdSets.push({ ...row, client_id: setInputs[index]?.client_id });
            });
          }
        }
      }

      return json({
        ok: true,
        profile,
        user_program: userProgram,
        user_programs: [userProgram],
        exercise_settings: settingsResult.data || [],
        user_program_exercise_settings: settingsResult.data || [],
        workouts: createdWorkouts,
        workout_exercises: createdExercises,
        exercises: createdExercises,
        workout_sets: createdSets,
        sets: createdSets,
      });
    }

    if (action === "pause_user_program" || action === "resume_user_program" || action === "cancel_user_program") {
      const id = String(payload.id || payload.user_program_id || "");
      const status = action === "pause_user_program" ? "paused" : action === "resume_user_program" ? "active" : "cancelled";
      const result = await supabase
        .from("user_programs")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("profile_id", profileId)
        .select()
        .maybeSingle();
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, user_program: result.data });
    }

    if (action === "save_user_program_exercise_settings") {
      const input = payload.setting || payload;
      const id = String(input.id || input.user_program_exercise_setting_id || "");
      const updatePayload = compact({
        selected_exercise_library_id: uuidOrNull(pickField(input, ["selected_exercise_library_id", "selectedExerciseLibraryId"])),
        selected_exercise_name: pickField(input, ["selected_exercise_name", "selectedExerciseName"]),
        target_sets: pickField(input, ["target_sets", "targetSets"]),
        rep_min: pickField(input, ["rep_min", "repMin"]),
        rep_max: pickField(input, ["rep_max", "repMax"]),
        progression_weight_step: pickField(input, ["progression_weight_step", "progressionWeightStep"]),
        progression_rep_step: pickField(input, ["progression_rep_step", "progressionRepStep"]),
        progression_mode: pickField(input, ["progression_mode", "progressionMode"]),
        deload_weight_steps: pickField(input, ["deload_weight_steps", "deloadWeightSteps"]),
        regression_threshold_sessions: pickField(input, ["regression_threshold_sessions", "regressionThresholdSessions"]),
        measurement_mode: normalizeMeasurementModeField(pickField(input, ["measurement_mode", "measurementMode"])),
        updated_at: new Date().toISOString(),
      });
      const result = await supabase
        .from("user_program_exercise_settings")
        .update(updatePayload)
        .eq("id", id)
        .select("*, user_programs!inner(profile_id)")
        .eq("user_programs.profile_id", profileId)
        .maybeSingle();
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, exercise_setting: result.data });
    }

    if (action === "update_user_program_settings") {
      const id = String(payload.id || payload.user_program_id || "");
      const input = payload.settings || payload;
      const result = await supabase
        .from("user_programs")
        .update(compact({
          duration_weeks: input.duration_weeks || input.durationWeeks,
          difficulty: input.difficulty,
          plan_mode: input.plan_mode || input.planMode,
          settings: input,
          updated_at: new Date().toISOString(),
        }))
        .eq("id", id)
        .eq("profile_id", profileId)
        .select()
        .maybeSingle();
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, user_program: result.data });
    }

    if (action === "generate_program_workouts" || action === "recalculate_program_progression") {
      return json({ ok: true, profile, message: "Program workouts are generated and recalculated by the client payload in Sprint 3." });
    }

    if (action === "create_custom_exercise") {
      const input = payload.exercise || payload;
      const baseName = normalizeExerciseName(pickField(input, ["exercise_name", "exerciseName", "name"]));
      if (!baseName) return json({ ok: false, error: "exercise_name is required" }, 400);
      const category = normalizeWorkoutTypeField(pickField(input, ["exercise_category", "exerciseCategory", "category"]), "strength");
      const baseKey = normalizeNameKey(baseName);
      const { data: existing, error: existingError } = await supabase
        .from("exercise_library")
        .select("normalized_name")
        .eq("profile_id", profileId)
        .eq("exercise_category", category);
      if (existingError) return json({ ok: false, error: existingError.message });
      const usedNames = new Set((existing || []).map((item) => String(item.normalized_name || "")));
      let finalName = baseName;
      let normalizedName = baseKey;
      let suffix = 2;
      while (usedNames.has(normalizedName)) {
        finalName = `${baseName} (${suffix})`;
        normalizedName = normalizeNameKey(finalName);
        suffix += 1;
      }
      const insertPayload = compact({
        profile_id: profileId,
        exercise_name: finalName,
        normalized_name: normalizedName,
        exercise_category: category,
        primary_muscles: toTextArray(pickField(input, ["primary_muscles", "primaryMuscles"])) || [],
        secondary_muscles: toTextArray(pickField(input, ["secondary_muscles", "secondaryMuscles"])) || [],
        measurement_mode: normalizeMeasurementModeField(pickField(input, ["measurement_mode", "measurementMode"]), category === "strength" ? "weight_reps" : "time"),
        weight_unit: normalizeWeightUnitField(pickField(input, ["weight_unit", "weightUnit"]), "kg"),
        distance_unit: normalizeDistanceUnitField(pickField(input, ["distance_unit", "distanceUnit"]), "km"),
        counts_in_muscle_stats: normalizeBooleanField(pickField(input, ["counts_in_muscle_stats", "countsInMuscleStats"]), category === "strength"),
        double_weight_in_stats: normalizeBooleanField(pickField(input, ["double_weight_in_stats", "doubleWeightInStats"]), false),
        double_count_in_statistics: normalizeBooleanField(pickField(input, ["double_count_in_statistics", "doubleCountInStatistics", "doubleWeightInStats"]), false),
        is_custom: true,
        notes: pickField(input, ["notes", "note"]) || "",
      });
      const result = await supabase.from("exercise_library").insert(insertPayload).select().single();
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, exercise: result.data, exercise_library_item: result.data });
    }

    if (action === "update_custom_exercise") {
      const input = payload.exercise || payload;
      const id = String(pickField({ ...payload, ...input }, ["id", "exercise_id", "exerciseId"]));
      if (!id || id === "undefined") return json({ ok: false, error: "exercise id is required" }, 400);
      const { data: existing, error: readError } = await supabase
        .from("exercise_library")
        .select("*")
        .eq("id", id)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (readError) return json({ ok: false, error: readError.message });
      if (!existing) return json({ ok: false, error: "Exercise ownership check failed" }, 403);
      const nextName = normalizeExerciseName(pickField(input, ["exercise_name", "exerciseName", "name"]) ?? existing.exercise_name);
      const updatePayload = compact({
        exercise_name: nextName,
        normalized_name: nextName ? normalizeNameKey(nextName) : undefined,
        exercise_category: normalizeWorkoutTypeField(pickField(input, ["exercise_category", "exerciseCategory", "category"])),
        primary_muscles: toTextArray(pickField(input, ["primary_muscles", "primaryMuscles"])),
        secondary_muscles: toTextArray(pickField(input, ["secondary_muscles", "secondaryMuscles"])),
        measurement_mode: normalizeMeasurementModeField(pickField(input, ["measurement_mode", "measurementMode"])),
        weight_unit: normalizeWeightUnitField(pickField(input, ["weight_unit", "weightUnit"])),
        distance_unit: normalizeDistanceUnitField(pickField(input, ["distance_unit", "distanceUnit"])),
        counts_in_muscle_stats: normalizeBooleanField(pickField(input, ["counts_in_muscle_stats", "countsInMuscleStats"])),
        double_weight_in_stats: normalizeBooleanField(pickField(input, ["double_weight_in_stats", "doubleWeightInStats"])),
        double_count_in_statistics: normalizeBooleanField(pickField(input, ["double_count_in_statistics", "doubleCountInStatistics", "doubleWeightInStats"])),
        notes: pickField(input, ["notes", "note"]),
        updated_at: new Date().toISOString(),
      });
      const result = await supabase.from("exercise_library").update(updatePayload).eq("id", id).select().maybeSingle();
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, exercise: result.data, exercise_library_item: result.data });
    }

    if (action === "exercise_history") {
      const exerciseName = String(payload.exercise_name || payload.name || "").trim();
      const muscleGroup = String(payload.muscle_group || payload.muscleGroup || "").trim();
      if (!exerciseName) return json({ ok: false, error: "exercise_name is required" }, 400);

      const { data: workouts, error: workoutsError } = await supabase
        .from("workouts")
        .select("*")
        .eq("profile_id", profileId)
        .order("workout_date", { ascending: false });
      if (workoutsError) return json({ ok: false, error: workoutsError.message });

      const workoutIds = (workouts || []).map((item) => item.id);
      const exerciseFilters = [
        { column: "exercise_name", value: exerciseName },
        ...(muscleGroup ? [{ column: "muscle_group", value: muscleGroup }] : []),
      ];
      const exercises = workoutIds.length
        ? await selectRowsInChunks("workout_exercises", "workout_id", workoutIds, {
          filters: exerciseFilters,
          orderColumn: "exercise_order",
        })
        : [];
      console.log("Loaded exercise history rows:", exercises.length);

      const exerciseIds = (exercises || []).map((item) => item.id);
      const sets = exerciseIds.length
        ? await selectRowsInChunks("workout_sets", "workout_exercise_id", exerciseIds, { orderColumn: "set_order" })
        : [];

      const workoutsById = new Map((workouts || []).map((item) => [String(item.id), item]));
      const setsByExerciseId = (sets || []).reduce((map, set) => {
        const key = String(set.workout_exercise_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(set);
        return map;
      }, new Map<string, Record<string, unknown>[]>());
      const history = (exercises || []).map((exercise) => {
        const workout = workoutsById.get(String(exercise.workout_id)) || {};
        return {
          workout_date: workout.workout_date,
          workout_title: workout.title,
          workout_status: workout.status,
          exercise_name: exercise.exercise_name,
          muscle_group: exercise.muscle_group,
          notes: exercise.notes,
          measure_weight_enabled: exercise.measure_weight_enabled,
          measure_reps_enabled: exercise.measure_reps_enabled,
          measure_time_enabled: exercise.measure_time_enabled,
          measure_rir_enabled: exercise.measure_rir_enabled,
          measure_rpe_enabled: exercise.measure_rpe_enabled,
          weight_unit: exercise.weight_unit,
          double_weight_in_stats: exercise.double_weight_in_stats,
          sets: setsByExerciseId.get(String(exercise.id)) || [],
        };
      });

      return json({ ok: true, profile, history });
    }

    if (action === "create_workout" || action === "create_workout_tree") {
      const workoutInput = payload.workout || payload;
      console.log(`${action} payload:`, payload);
      const clientWorkoutId = String(pickField(workoutInput, ["client_workout_id", "clientWorkoutId", "client_id", "clientId"]) || "").trim();
      const createWorkoutTreeChildren = async (workout: Record<string, unknown>, exerciseInputs: Record<string, unknown>[] = []) => {
        const createdExercises = [];
        const createdSets = [];
        for (const exerciseInput of exerciseInputs || []) {
          const exerciseInsert = {
            workout_id: workout.id,
            ...exerciseFields(exerciseInput, { defaults: true }),
          };
          const exerciseResult = await supabase.from("workout_exercises").insert(exerciseInsert).select().single();
          console.log("create_workout_tree exercise result:", exerciseResult.data, exerciseResult.error);
          if (exerciseResult.error) return { error: exerciseResult.error, createdExercises, createdSets };
          createdExercises.push({ ...exerciseResult.data, client_id: exerciseInput.client_id });

          const setInputs = Array.isArray(exerciseInput.sets) ? exerciseInput.sets : [];
          if (setInputs.length) {
            console.log("Saving set time fields:", setInputs);
            const setRows = setInputs.map((setInput: Record<string, unknown>) => ({
              workout_exercise_id: exerciseResult.data.id,
              ...setFields(setInput),
            }));
            const setsResult = await supabase.from("workout_sets").insert(setRows).select();
            console.log("create_workout_tree sets result:", setsResult.data, setsResult.error);
            if (setsResult.error) return { error: setsResult.error, createdExercises, createdSets };
            (setsResult.data || []).forEach((row, index) => {
              createdSets.push({ ...row, client_id: setInputs[index]?.client_id });
            });
          }
        }
        return { createdExercises, createdSets, error: null };
      };
      if (clientWorkoutId) {
        const existingWorkout = await supabase
          .from("workouts")
          .select("id")
          .eq("profile_id", profileId)
          .eq("client_workout_id", clientWorkoutId)
          .maybeSingle();
        if (existingWorkout.error) return json({ ok: false, error: existingWorkout.error.message });
        if (existingWorkout.data?.id) {
          let existingTree = await loadSingleWorkoutTree(String(existingWorkout.data.id));
          const existingExercises = existingTree.workout_exercises || [];
          const requestedExercises = payload.exercises || [];
          if (action === "create_workout_tree" && !existingExercises.length && requestedExercises.length) {
            const childResult = await createWorkoutTreeChildren(existingTree.workout, requestedExercises);
            if (childResult.error) return json({ ok: false, error: childResult.error.message });
            existingTree = await loadSingleWorkoutTree(String(existingWorkout.data.id));
          }
          console.log(`${action} idempotent existing workout:`, existingTree.workout);
          return json({ ok: true, profile, ...existingTree, idempotent: true });
        }
      }
      const workoutInsert = compact({
        profile_id: profileId,
        client_workout_id: clientWorkoutId || undefined,
        workout_date: workoutInput.workout_date,
        title: workoutInput.title || "Новая тренировка",
        status: workoutInput.status || "completed",
        workout_type: normalizeWorkoutTypeField(pickField(workoutInput, ["workout_type", "workoutType"]), "strength"),
        notes: workoutInput.notes || "",
        total_sets: workoutInput.total_sets || 0,
        total_volume: workoutInput.total_volume || 0,
        estimated_calories_burned: workoutInput.estimated_calories_burned || 0,
        duration_seconds: workoutInput.duration_seconds,
        started_at: pickField(workoutInput, ["started_at", "startedAt"]),
        auto_stopped_at: pickField(workoutInput, ["auto_stopped_at", "autoStoppedAt"]),
        repeat_group_id: uuidOrNull(pickField(workoutInput, ["repeat_group_id", "repeatGroupId"])),
        source_workout_id: uuidOrNull(pickField(workoutInput, ["source_workout_id", "sourceWorkoutId"])),
        user_program_id: uuidOrNull(pickField(workoutInput, ["user_program_id", "userProgramId"])),
        user_program_client_id: pickField(workoutInput, ["user_program_client_id", "userProgramClientId"]),
        program_template_workout_id: uuidOrNull(pickField(workoutInput, ["program_template_workout_id", "programTemplateWorkoutId"])),
        program_template_workout_key: pickField(workoutInput, ["program_template_workout_key", "programTemplateWorkoutKey"]),
        program_week_number: pickField(workoutInput, ["program_week_number", "programWeekNumber"]),
        program_day_index: pickField(workoutInput, ["program_day_index", "programDayIndex"]),
        program_name: pickField(workoutInput, ["program_name", "programName"]),
        program_plan_mode: pickField(workoutInput, ["program_plan_mode", "programPlanMode"]),
        program_difficulty: pickField(workoutInput, ["program_difficulty", "programDifficulty"]),
        is_program_generated: normalizeBooleanField(pickField(workoutInput, ["is_program_generated", "isProgramGenerated"])),
      });
      let workoutResult = await supabase.from("workouts").insert(workoutInsert).select().single();
      if (workoutResult.error && workoutInsert.duration_seconds !== undefined && /duration_seconds/i.test(workoutResult.error.message || "")) {
        workoutResult = await supabase.from("workouts").insert(withoutDuration(workoutInsert)).select().single();
      }
      if (workoutResult.error && clientWorkoutId && String(workoutResult.error.code || "") === "23505") {
        const existingWorkout = await supabase
          .from("workouts")
          .select("id")
          .eq("profile_id", profileId)
          .eq("client_workout_id", clientWorkoutId)
          .maybeSingle();
        if (existingWorkout.error) return json({ ok: false, error: existingWorkout.error.message });
        if (existingWorkout.data?.id) {
          const existingTree = await loadSingleWorkoutTree(String(existingWorkout.data.id));
          return json({ ok: true, profile, ...existingTree, idempotent: true });
        }
      }
      console.log(`${action} workout result:`, workoutResult.data, workoutResult.error);
      if (workoutResult.error) return json({ ok: false, error: workoutResult.error.message });

      const workout = workoutResult.data;
      let createdExercises = [];
      let createdSets = [];

      if (action === "create_workout_tree") {
        console.log("Saving exercise measurement settings:", payload.exercises || []);
        const childResult = await createWorkoutTreeChildren(workout, payload.exercises || []);
        if (childResult.error) return json({ ok: false, error: childResult.error.message });
        createdExercises = childResult.createdExercises;
        createdSets = childResult.createdSets;
      }

      console.log("create_workout_tree result:", { workout, exercises: createdExercises, sets: createdSets });
      return json({ ok: true, profile, workout, workout_id: workout.id, exercises: createdExercises, workout_exercises: createdExercises, sets: createdSets, workout_sets: createdSets });
    }

    if (action === "create_exercise") {
      const exerciseInput = payload.exercise || payload;
      console.log("Saving exercise measurement settings:", [exerciseInput]);
      const workoutId = pickField({ ...payload, ...exerciseInput }, ["workout_id", "workoutId"]);
      await ensureWorkoutOwner(String(workoutId));
      const exercisePayload = exerciseFields(exerciseInput, { defaults: true });
      console.log("create_exercise exercise update payload:", exercisePayload);
      const result = await supabase
        .from("workout_exercises")
        .insert({ workout_id: workoutId, ...exercisePayload })
        .select()
        .single();
      console.log("create_exercise result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, exercise: result.data, exercise_id: result.data.id });
    }

    if (action === "create_set") {
      const setInput = payload.set || payload;
      console.log("Saving set time fields:", [setInput]);
      await ensureExerciseOwner(String(payload.workout_exercise_id || setInput.workout_exercise_id));
      const result = await supabase
        .from("workout_sets")
        .insert({ workout_exercise_id: payload.workout_exercise_id || setInput.workout_exercise_id, ...setFields(setInput) })
        .select()
        .single();
      console.log("create_set result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, set: result.data, set_id: result.data.id });
    }

    if (action === "update_workout") {
      const id = String(payload.id || payload.workout_id);
      await ensureWorkoutOwner(id);
      const result = await updateWithOptionalDuration(supabase, "workouts", workoutFields(payload.workout || payload), id);
      console.log("workout_updates result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, workout: result.data });
    }

    if (action === "update_exercise") {
      const exerciseInput = payload.exercise || payload;
      const id = String(pickField({ ...payload, ...exerciseInput }, ["id", "exercise_id", "exerciseId", "workout_exercise_id", "workoutExerciseId"]));
      console.log("Saving exercise measurement settings:", [exerciseInput]);
      await ensureExerciseOwner(id);
      const exercisePayload = exerciseFields(exerciseInput);
      console.log("update_exercise exercise update payload:", exercisePayload);
      const result = await supabase.from("workout_exercises").update(exercisePayload).eq("id", id).select().maybeSingle();
      console.log("exercise_updates result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, exercise: result.data });
    }

    if (action === "update_set") {
      const id = String(payload.id || payload.set_id || payload.workout_set_id);
      console.log("Saving set time fields:", [payload.set || payload]);
      await ensureSetOwner(id);
      const result = await supabase.from("workout_sets").update(setFields(payload.set || payload)).eq("id", id).select().maybeSingle();
      console.log("set_updates result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, set: result.data });
    }

    if (action === "delete_set") {
      const id = String(payload.id || payload.set_id || payload.workout_set_id);
      const setOwner = await findSetOwner(id);
      if (!setOwner) {
        console.warn("delete_set skipped; set is already deleted:", id);
        return json({ ok: true, profile, deleted_set_ids: [id], skipped: true });
      }
      const result = await supabase.from("workout_sets").delete().eq("id", id).select();
      console.log("deleted ids result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, deleted_set_ids: [id] });
    }

    if (action === "delete_exercise") {
      const id = String(payload.id || payload.exercise_id || payload.workout_exercise_id);
      const exerciseOwner = await findExerciseOwner(id);
      if (!exerciseOwner) {
        console.warn("delete_exercise skipped; exercise is already deleted:", id);
        return json({ ok: true, profile, deleted_exercise_ids: [id], skipped: true });
      }
      const setDelete = await supabase.from("workout_sets").delete().eq("workout_exercise_id", id).select();
      console.log("deleted ids result:", setDelete.data, setDelete.error);
      if (setDelete.error) return json({ ok: false, error: setDelete.error.message });
      const result = await supabase.from("workout_exercises").delete().eq("id", id).select();
      console.log("deleted ids result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, deleted_exercise_ids: [id] });
    }

    if (action === "rename_workout_scope") {
      const id = String(payload.id || payload.workout_id);
      const title = String(payload.title || "").trim();
      if (!title) return json({ ok: false, error: "title is required" }, 400);
      const scope = normalizeScopeType(payload.scope_type || payload.scope, "only");
      const range = normalizeTimeScope(payload.time_scope || payload.range, "all");
      const rows = await readWorkoutScopeRows(id, scope, range);
      const ids = rows.map((item) => String(item.id)).filter(Boolean);
      const result = await supabase
        .from("workouts")
        .update({ title, updated_at: new Date().toISOString() })
        .in("id", ids)
        .eq("profile_id", profileId)
        .select();
      if (result.error) return json({ ok: false, error: result.error.message });
      return json({ ok: true, profile, workouts: result.data || [], workout_updates: result.data || [], updated_workout_ids: ids });
    }

    if (action === "delete_workout_scope" || action === "delete_program_scope") {
      const id = String(payload.id || payload.workout_id);
      const scope = action === "delete_program_scope" ? "program" : normalizeScopeType(payload.scope_type || payload.scope, "only");
      const range = normalizeTimeScope(payload.time_scope || payload.range, "all");
      const rows = await readWorkoutScopeRows(id, scope, range);
      const deletedIds = await deleteWorkoutRows(rows);
      if (action === "delete_program_scope" && (range === "all" || range === "full")) {
        const programIds = Array.from(new Set(rows.map((item) => String(item.user_program_id || "")).filter(Boolean)));
        if (programIds.length) {
          const programUpdate = await supabase
            .from("user_programs")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .in("id", programIds)
            .eq("profile_id", profileId)
            .select();
          if (programUpdate.error) return json({ ok: false, error: programUpdate.error.message });
        }
      }
      return json({ ok: true, profile, deleted_workout_ids: deletedIds, deleted_count: deletedIds.length });
    }

    if (action === "delete_workout") {
      const id = String(payload.id || payload.workout_id);
      const workoutOwner = await findWorkoutOwner(id);
      if (!workoutOwner) {
        console.warn("delete_workout skipped; workout is already deleted:", id);
        return json({ ok: true, profile, deleted_workout_ids: [id], deleted_count: 1, skipped: true });
      }
      const { data: exercises, error: exerciseReadError } = await supabase.from("workout_exercises").select("id").eq("workout_id", id);
      if (exerciseReadError) return json({ ok: false, error: exerciseReadError.message });
      const exerciseIds = (exercises || []).map((item) => item.id);
      if (exerciseIds.length) {
        const deletedSets = await deleteRowsInChunks("workout_sets", "workout_exercise_id", exerciseIds);
        console.log("deleted ids result:", deletedSets, null);
      }
      const exerciseDelete = await supabase.from("workout_exercises").delete().eq("workout_id", id).select();
      console.log("deleted ids result:", exerciseDelete.data, exerciseDelete.error);
      if (exerciseDelete.error) return json({ ok: false, error: exerciseDelete.error.message });
      const result = await supabase.from("workouts").delete().eq("id", id).select();
      console.log("deleted ids result:", result.data, result.error);
      if (result.error) return json({ ok: false, error: result.error.message });
      const deletedIds = (result.data || [])
        .map((item: { id?: unknown }) => String(item.id || ""))
        .filter(Boolean);
      return json({ ok: true, profile, deleted_workout_ids: deletedIds, deleted_count: deletedIds.length });
    }

    if (action === "save_workout_patch" || action === "update_workout_tree") {
      const normalizedPayload = action === "update_workout_tree"
        ? {
          workout_updates: payload.workout ? [payload.workout] : [],
          exercise_updates: (payload.exercises || []).filter((exercise: Record<string, unknown>) => exercise.id || exercise.exercise_id || exercise.workout_exercise_id),
          set_updates: (payload.exercises || []).flatMap((exercise: Record<string, unknown>) => (exercise.sets || [])
            .filter((set: Record<string, unknown>) => set.id || set.set_id || set.workout_set_id)
            .map((set: Record<string, unknown>) => ({ ...set, workout_exercise_id: exercise.id || exercise.exercise_id || exercise.workout_exercise_id }))),
          exercise_creates: [
            ...(payload.exercise_creates || []),
            ...(payload.exercises || [])
              .filter((exercise: Record<string, unknown>) => !(exercise.id || exercise.exercise_id || exercise.workout_exercise_id))
              .map((exercise: Record<string, unknown>) => ({ ...exercise, workout_id: exercise.workout_id || payload.workout?.id })),
          ],
          exercise_upserts: payload.exercise_upserts || [],
          set_creates: [
            ...(payload.set_creates || []),
            ...(payload.exercises || []).flatMap((exercise: Record<string, unknown>) => {
              const exerciseId = exercise.id || exercise.exercise_id || exercise.workout_exercise_id;
              if (!exerciseId) return [];
              return (exercise.sets || [])
                .filter((set: Record<string, unknown>) => !(set.id || set.set_id || set.workout_set_id))
                .map((set: Record<string, unknown>) => ({ ...set, workout_exercise_id: exerciseId, exercise_client_id: exercise.client_id }));
            }),
          ],
          set_upserts: payload.set_upserts || [],
          deleted_workout_ids: payload.deleted_workout_ids || [],
          deleted_exercise_ids: payload.deleted_exercise_ids || [],
          deleted_set_ids: payload.deleted_set_ids || [],
          deleted_set_refs: payload.deleted_set_refs || [],
        }
        : payload;

      console.log(`${action} payload:`, normalizedPayload);
      const workoutUpdates = normalizedPayload.workout_updates || [];
      const exerciseUpdates = normalizedPayload.exercise_updates || [];
      const setUpdates = normalizedPayload.set_updates || [];
      const exerciseCreates = normalizedPayload.exercise_creates || [];
      const setCreates = normalizedPayload.set_creates || [];
      const exerciseUpserts = normalizedPayload.exercise_upserts || [];
      const setUpserts = normalizedPayload.set_upserts || [];
      console.log("Saving exercise measurement settings:", exerciseUpdates);
      console.log("save_workout_patch exercise_updates received:", exerciseUpdates);
      console.log("Saving set time fields:", setUpdates);
      const deletedWorkoutIds = normalizedPayload.deleted_workout_ids || [];
      const deletedExerciseIds = normalizedPayload.deleted_exercise_ids || [];
      const deletedSetIds = normalizedPayload.deleted_set_ids || [];
      const deletedSetRefs = normalizedPayload.deleted_set_refs || [];
      let confirmedDeletedWorkoutIds: string[] = [];

      const workoutResults = [];
      for (const item of workoutUpdates) {
        if (!item?.id) continue;
        const workoutOwner = await findWorkoutOwner(String(item.id));
        if (!workoutOwner) {
          console.warn("workout update skipped; workout is already deleted:", item.id);
          continue;
        }
        const result = await updateWithOptionalDuration(supabase, "workouts", workoutFields(item), String(item.id));
        console.log("workout_updates result:", result.data, result.error);
        if (result.error) return json({ ok: false, error: result.error.message });
        workoutResults.push(result.data);
      }

      const exerciseResults = [];
      const setResults = [];
      for (const item of exerciseCreates) {
        const workoutId = pickField(item, ["workout_id", "workoutId"]);
        if (!workoutId) return json({ ok: false, error: "Missing workout_id for exercise create" }, 400);
        const workoutOwner = await findWorkoutOwner(String(workoutId));
        if (!workoutOwner) {
          console.warn("exercise create skipped; workout is already deleted:", workoutId);
          continue;
        }
        const exercisePayload = exerciseFields(item, { defaults: true });
        console.log("save_workout_patch exercise create payload:", exercisePayload);
        const exerciseResult = await supabase
          .from("workout_exercises")
          .insert({ workout_id: workoutId, ...exercisePayload })
          .select()
          .single();
        console.log("exercise_creates result:", exerciseResult.data, exerciseResult.error);
        if (exerciseResult.error) return json({ ok: false, error: exerciseResult.error.message });
        exerciseResults.push({ ...exerciseResult.data, client_id: item.client_id || item.clientId });

        const setInputs = Array.isArray(item.sets) ? item.sets : [];
        if (setInputs.length) {
          const setRows = setInputs.map((setInput: Record<string, unknown>) => ({
            workout_exercise_id: exerciseResult.data.id,
            ...setFields(setInput),
          }));
          const setsResult = await supabase.from("workout_sets").insert(setRows).select();
          console.log("exercise_creates nested sets result:", setsResult.data, setsResult.error);
          if (setsResult.error) return json({ ok: false, error: setsResult.error.message });
          (setsResult.data || []).forEach((row, index) => {
            setResults.push({ ...row, client_id: setInputs[index]?.client_id || setInputs[index]?.clientId });
          });
        }
      }

      for (const item of exerciseUpserts) {
        const workoutId = pickField(item, ["workout_id", "workoutId"]);
        if (!workoutId) return json({ ok: false, error: "Missing workout_id for exercise upsert" }, 400);
        const workoutOwner = await findWorkoutOwner(String(workoutId));
        if (!workoutOwner) {
          console.warn("exercise upsert skipped; workout is already deleted:", workoutId);
          continue;
        }
        const exercisePayload = exerciseFields(item, { defaults: true });
        const exerciseOrder = pickField(item, ["exercise_order", "exerciseOrder", "order"]);
        const existingExercise = exerciseOrder === undefined || exerciseOrder === null
          ? { data: null, error: null }
          : await supabase
            .from("workout_exercises")
            .select("*")
            .eq("workout_id", workoutId)
            .eq("exercise_order", exerciseOrder)
            .limit(1)
            .maybeSingle();
        if (existingExercise.error) return json({ ok: false, error: existingExercise.error.message });
        const exerciseResult = existingExercise.data?.id
          ? await supabase.from("workout_exercises").update(exercisePayload).eq("id", existingExercise.data.id).select().single()
          : await supabase.from("workout_exercises").insert({ workout_id: workoutId, ...exercisePayload }).select().single();
        console.log("exercise_upserts result:", exerciseResult.data, exerciseResult.error);
        if (exerciseResult.error) return json({ ok: false, error: exerciseResult.error.message });
        exerciseResults.push({ ...exerciseResult.data, client_id: item.client_id || item.clientId });

        const setInputs = Array.isArray(item.sets) ? item.sets : [];
        for (const setInput of setInputs) {
          const setOrder = pickField(setInput, ["set_order", "setOrder", "order"]);
          const setPayload = setFields(setInput);
          const existingSet = setOrder === undefined || setOrder === null
            ? { data: null, error: null }
            : await supabase
              .from("workout_sets")
              .select("*")
              .eq("workout_exercise_id", exerciseResult.data.id)
              .eq("set_order", setOrder)
              .limit(1)
              .maybeSingle();
          if (existingSet.error) return json({ ok: false, error: existingSet.error.message });
          const setResult = existingSet.data?.id
            ? await supabase.from("workout_sets").update(setPayload).eq("id", existingSet.data.id).select().single()
            : await supabase.from("workout_sets").insert({ workout_exercise_id: exerciseResult.data.id, ...setPayload }).select().single();
          console.log("exercise_upserts nested set result:", setResult.data, setResult.error);
          if (setResult.error) return json({ ok: false, error: setResult.error.message });
          setResults.push({ ...setResult.data, client_id: setInput.client_id || setInput.clientId });
        }
      }

      for (const item of exerciseUpdates) {
        if (!item?.id) continue;
        const exerciseOwner = await findExerciseOwner(String(item.id));
        if (!exerciseOwner) {
          console.warn("exercise update skipped; exercise is already deleted:", item.id);
          continue;
        }
        const exercisePayload = exerciseFields(item);
        console.log("save_workout_patch exercise update payload:", exercisePayload);
        const result = await supabase.from("workout_exercises").update(exercisePayload).eq("id", item.id).select().maybeSingle();
        console.log("exercise_updates result:", result.data, result.error);
        if (result.error) return json({ ok: false, error: result.error.message });
        exerciseResults.push(result.data);
      }

      for (const item of setCreates) {
        const workoutExerciseId = pickField(item, ["workout_exercise_id", "workoutExerciseId", "exercise_id", "exerciseId"]);
        if (!workoutExerciseId) return json({ ok: false, error: "Missing workout_exercise_id for set create" }, 400);
        const exerciseOwner = await findExerciseOwner(String(workoutExerciseId));
        if (!exerciseOwner) {
          console.warn("set create skipped; exercise is already deleted:", workoutExerciseId);
          continue;
        }
        const setPayload = setFields(item);
        console.log("save_workout_patch set create payload:", setPayload);
        const result = await supabase
          .from("workout_sets")
          .insert({ workout_exercise_id: workoutExerciseId, ...setPayload })
          .select()
          .single();
        console.log("set_creates result:", result.data, result.error);
        if (result.error) return json({ ok: false, error: result.error.message });
        setResults.push({ ...result.data, client_id: item.client_id || item.clientId });
      }

      for (const item of setUpserts) {
        const workoutExerciseId = pickField(item, ["workout_exercise_id", "workoutExerciseId", "exercise_id", "exerciseId"]);
        const setOrder = pickField(item, ["set_order", "setOrder", "order"]);
        if (!workoutExerciseId) return json({ ok: false, error: "Missing workout_exercise_id for set upsert" }, 400);
        const exerciseOwner = await findExerciseOwner(String(workoutExerciseId));
        if (!exerciseOwner) {
          console.warn("set upsert skipped; exercise is already deleted:", workoutExerciseId);
          continue;
        }
        const setPayload = setFields(item);
        const existingSet = setOrder === undefined || setOrder === null
          ? { data: null, error: null }
          : await supabase
            .from("workout_sets")
            .select("*")
            .eq("workout_exercise_id", workoutExerciseId)
            .eq("set_order", setOrder)
            .limit(1)
            .maybeSingle();
        if (existingSet.error) return json({ ok: false, error: existingSet.error.message });
        const result = existingSet.data?.id
          ? await supabase.from("workout_sets").update(setPayload).eq("id", existingSet.data.id).select().single()
          : await supabase.from("workout_sets").insert({ workout_exercise_id: workoutExerciseId, ...setPayload }).select().single();
        console.log("set_upserts result:", result.data, result.error);
        if (result.error) return json({ ok: false, error: result.error.message });
        setResults.push({ ...result.data, client_id: item.client_id || item.clientId });
      }

      for (const item of setUpdates) {
        if (!item?.id) continue;
        const setOwner = await findSetOwner(String(item.id));
        if (!setOwner) {
          console.warn("set update skipped; set is already deleted:", item.id);
          continue;
        }
        const result = await supabase.from("workout_sets").update(setFields(item)).eq("id", item.id).select().maybeSingle();
        console.log("set_updates result:", result.data, result.error);
        if (result.error) return json({ ok: false, error: result.error.message });
        setResults.push(result.data);
      }

      if (deletedSetIds.length) {
        const ownedDeletedSetIds: string[] = [];
        for (const id of deletedSetIds) {
          const setOwner = await findSetOwner(String(id));
          if (setOwner) ownedDeletedSetIds.push(String(id));
          else console.warn("set delete skipped; set is already deleted:", id);
        }
        const deletedSets = await deleteRowsInChunks("workout_sets", "id", ownedDeletedSetIds);
        console.log("deleted ids result:", deletedSets, null);
      }

      if (deletedSetRefs.length) {
        for (const ref of deletedSetRefs) {
          const workoutExerciseId = pickField(ref, ["workout_exercise_id", "workoutExerciseId", "exercise_id", "exerciseId"]);
          const setOrder = pickField(ref, ["set_order", "setOrder", "order"]);
          if (!workoutExerciseId || setOrder === undefined || setOrder === null) continue;
          const exerciseOwner = await findExerciseOwner(String(workoutExerciseId));
          if (!exerciseOwner) {
            console.warn("set ref delete skipped; exercise is already deleted:", workoutExerciseId);
            continue;
          }
          const result = await supabase
            .from("workout_sets")
            .delete()
            .eq("workout_exercise_id", workoutExerciseId)
            .eq("set_order", setOrder)
            .select();
          console.log("deleted set refs result:", result.data, result.error);
          if (result.error) return json({ ok: false, error: result.error.message });
          (result.data || []).forEach((item: { id?: unknown }) => {
            if (item.id) deletedSetIds.push(String(item.id));
          });
        }
      }

      if (deletedExerciseIds.length) {
        const ownedDeletedExerciseIds: string[] = [];
        for (const id of deletedExerciseIds) {
          const exerciseOwner = await findExerciseOwner(String(id));
          if (exerciseOwner) ownedDeletedExerciseIds.push(String(id));
          else console.warn("exercise delete skipped; exercise is already deleted:", id);
        }
        const deletedSets = await deleteRowsInChunks("workout_sets", "workout_exercise_id", ownedDeletedExerciseIds);
        console.log("deleted ids result:", deletedSets, null);
        const deletedExercises = await deleteRowsInChunks("workout_exercises", "id", ownedDeletedExerciseIds);
        console.log("deleted ids result:", deletedExercises, null);
      }

      if (deletedWorkoutIds.length) {
        const ownedDeletedWorkoutIds: string[] = [];
        for (const id of deletedWorkoutIds) {
          const workoutOwner = await findWorkoutOwner(String(id));
          if (workoutOwner) ownedDeletedWorkoutIds.push(String(id));
          else console.warn("workout delete skipped; workout is already deleted:", id);
        }
        const exercises = await selectRowsInChunks("workout_exercises", "workout_id", ownedDeletedWorkoutIds, { select: "id" });
        const exerciseIds = (exercises || []).map((item) => item.id);
        if (exerciseIds.length) {
          const deletedSets = await deleteRowsInChunks("workout_sets", "workout_exercise_id", exerciseIds);
          console.log("deleted ids result:", deletedSets, null);
        }
        const deletedExercises = await deleteRowsInChunks("workout_exercises", "workout_id", ownedDeletedWorkoutIds);
        console.log("deleted ids result:", deletedExercises, null);
        const deletedWorkouts = await deleteRowsInChunks("workouts", "id", ownedDeletedWorkoutIds);
        console.log("deleted ids result:", deletedWorkouts, null);
        confirmedDeletedWorkoutIds = (deletedWorkouts || [])
          .map((item: { id?: unknown }) => String(item.id || ""))
          .filter(Boolean);
      }

      console.log(`${action} result:`, { workoutResults, exerciseResults, setResults });
      return json({
        ok: true,
        profile,
        workouts: workoutResults,
        workout_updates: workoutResults,
        exercises: exerciseResults,
        workout_exercises: exerciseResults,
        sets: setResults,
        workout_sets: setResults,
        deleted_workout_ids: confirmedDeletedWorkoutIds,
        deleted_count: confirmedDeletedWorkoutIds.length,
        deleted_exercise_ids: deletedExerciseIds,
        deleted_set_ids: deletedSetIds,
      });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return fail(error, 500);
  }
});
