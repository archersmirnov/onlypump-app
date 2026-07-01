import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    "Content-Type": "application/json",
  },
});

const fail = (error: unknown, status = 400) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  console.error("onlypump-profile-api error:", error);
  return json({ ok: false, error: message }, status);
};

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const compact = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null));

const toNumber = (value: unknown, fallback: number | null = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const number = toNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
};

const toNonNegativeNumber = (value: unknown, fallback: number) => {
  const number = toNumber(value, fallback);
  return number !== null && number >= 0 ? number : fallback;
};

const toBoolean = (value: unknown, fallback = false) => {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
};

const toOptionalBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true" || value === 1 || value === "1" || value === "yes" || value === "да") return true;
  if (value === false || value === "false" || value === 0 || value === "0" || value === "no" || value === "нет") return false;
  return Boolean(value);
};

const normalizeAccessStatus = (value: unknown) => {
  const status = String(value || "pending").trim().toLowerCase();
  return ["allowed", "blocked", "pending"].includes(status) ? status : "pending";
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

const assignableRoles = ["admin", "trainer", "student", "user"];

const normalizeAssignableRole = (value: unknown, fallback = "user") => {
  const role = String(value || fallback || "user").trim().toLowerCase();
  return assignableRoles.includes(role) ? role : "user";
};

const normalizeWeightUnit = (value: unknown) => {
  const unit = String(value || "kg").trim().toLowerCase();
  return ["lb", "lbs", "pound", "pounds"].includes(unit) ? "lb" : "kg";
};

const normalizeNutritionTrackingMode = (value: unknown, fallback = "calories") => {
  const mode = String(value || fallback || "calories").trim().toLowerCase();
  return mode === "palms" ? "palms" : "calories";
};

const rolePatchForAssignableRole = (value: unknown) => {
  const memberRole = normalizeAssignableRole(value);
  return {
    member_role: memberRole,
    roles: memberRole === "admin" || memberRole === "trainer" ? [memberRole] : memberRole === "student" ? ["student"] : [],
    is_admin: memberRole === "admin",
    is_trainer: memberRole === "trainer",
  };
};

const normalizeAssignableRoleList = (value: unknown) => {
  const rawRoles = toStringArray(value).map((role) => normalizeAssignableRole(role)).filter(Boolean);
  const unique = [...new Set(rawRoles)];
  const withoutUser = unique.filter((role) => role !== "user");
  return withoutUser.length ? withoutUser : ["user"];
};

const rolePatchForAssignableRoles = (value: unknown) => {
  const roles = normalizeAssignableRoleList(value);
  const memberRole = roles.includes("admin")
    ? "admin"
    : roles.includes("trainer")
      ? "trainer"
      : roles.includes("student")
        ? "student"
        : "user";
  return {
    member_role: memberRole,
    roles: roles.filter((role) => role !== "user"),
    is_admin: roles.includes("admin"),
    is_trainer: roles.includes("trainer"),
  };
};

const normalizeRoles = (profile: Record<string, unknown>) => {
  const roles = new Set(toStringArray(profile.roles).map((role) => role.toLowerCase()));
  if (isArcherOwnerProfile(profile)) {
    roles.add("owner");
    roles.add("admin");
    roles.add("trainer");
  }
  if (toBoolean(profile.is_owner)) roles.add("owner");
  if (toBoolean(profile.is_admin)) roles.add("admin");
  if (toBoolean(profile.is_trainer)) roles.add("trainer");
  const memberRole = normalizeAssignableRole(profile.member_role, "");
  if (assignableRoles.includes(memberRole)) roles.add(memberRole);
  return [...roles].filter((role) => ["owner", "admin", "trainer", "student", "user"].includes(role));
};

const hasRole = (profile: Record<string, unknown>, role: string) => normalizeRoles(profile).includes(role);
const hasAnyRole = (profile: Record<string, unknown>, roles: string[]) => roles.some((role) => hasRole(profile, role));

const isArcherOwnerProfile = (profile: Record<string, unknown>) => String(profile.telegram_username || "").replace(/^@/, "").trim().toLowerCase() === "archer_ss";
const isProtectedOwnerProfile = (profile: Record<string, unknown>) => isArcherOwnerProfile(profile) || toBoolean(profile.is_owner) || hasRole(profile, "owner");

const hasProfileAccess = (profile: Record<string, unknown>) => {
  if (profile?.deleted_at) return false;
  if (hasAnyRole(profile, ["owner", "admin", "trainer"])) return true;
  if (profile?.access_expires_at && new Date(String(profile.access_expires_at)).getTime() <= Date.now()) return false;
  return normalizeAccessStatus(profile?.access_status) === "allowed";
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
  is_owner: toBoolean(profile.is_owner),
  is_trainer: toBoolean(profile.is_trainer),
  member_role: normalizeAssignableRole(profile.member_role, hasRole(profile, "admin") ? "admin" : hasRole(profile, "trainer") ? "trainer" : "user"),
  roles: normalizeRoles(profile),
  trainer_profile_id: profile.trainer_profile_id,
  access_expires_at: profile.access_expires_at,
  invited_by_profile_id: profile.invited_by_profile_id,
  invite_code: profile.invite_code,
  deleted_at: profile.deleted_at,
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

const round = (value: number, precision = 0) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toDateKey = (value: unknown) => {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
};

const toJsonArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }
  return [];
};

const toHomeWidgetsArray = (value: unknown) => toJsonArray(value)
  .map((item) => String(item || "").trim())
  .filter(Boolean)
  .slice(0, 80);

const toHomeWidgetsValue = (value: unknown) => {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch (_error) {
      source = [];
    }
  }

  if (Array.isArray(source)) return toHomeWidgetsArray(source);

  if (source && typeof source === "object") {
    const record = source as Record<string, unknown>;
    return {
      mobile: toHomeWidgetsArray(record.mobile),
      desktop: toHomeWidgetsArray(record.desktop),
    };
  }

  return [];
};

const toPersonalTrackersArray = (value: unknown) => toJsonArray(value)
  .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
  .slice(0, 10);

const tutorialScreens = ["home", "nutrition", "workouts", "progress", "analytics", "education", "lectures", "calculators", "community", "profile"];

const tutorialAwardCatalog: Record<string, { id: string; title: string; xp: number }> = {
  "home-tour-completed": { id: "home-tour-completed", title: "Обучение на главной", xp: 5 },
  "full-tour-completed": { id: "full-tour-completed", title: "Полное обучение ONLYPUMP", xp: 10 },
  "onboarding-required-completed": { id: "onboarding-required-completed", title: "Анкета: обязательные пункты", xp: 40 },
  "onboarding-without-measurements": { id: "onboarding-without-measurements", title: "Анкета: без замеров", xp: 60 },
  "onboarding-full-completed": { id: "onboarding-full-completed", title: "Анкета: полное заполнение", xp: 100 },
};

const onboardingQuestionnaireAwardIds = new Set([
  "onboarding-required-completed",
  "onboarding-without-measurements",
  "onboarding-full-completed",
]);

const toTutorialScreensArray = (value: unknown) => {
  const source = toJsonArray(value).length ? toJsonArray(value) : toStringArray(value);
  const unique = new Set<string>();
  source.forEach((item) => {
    const screen = String(item || "").trim();
    if (tutorialScreens.includes(screen)) unique.add(screen);
  });
  return [...unique];
};

const toTutorialAwardsArray = (value: unknown) => {
  const seen = new Set<string>();
  const normalized = toJsonArray(value)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const id = String(item.id || "").trim();
      const award = tutorialAwardCatalog[id];
      if (!award || seen.has(id)) return null;
      seen.add(id);
      return {
        ...award,
        earnedAt: item.earnedAt || item.earned_at || new Date().toISOString(),
      };
    })
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const onboardingAwards = normalized.filter((item) => onboardingQuestionnaireAwardIds.has(String(item.id || "")));
  if (!onboardingAwards.length) return normalized;
  const bestOnboardingAward = [...onboardingAwards].sort((first, second) => Number(second.xp || 0) - Number(first.xp || 0))[0];
  return [
    ...normalized.filter((item) => !onboardingQuestionnaireAwardIds.has(String(item.id || ""))),
    bestOnboardingAward,
  ];
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
  return {
    user: user as Record<string, unknown>,
    startParam: String(params.get("start_param") || params.get("startapp") || "").trim(),
  };
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

const cleanInviteCode = (value: unknown) => String(value || "")
  .trim()
  .replace(/^invite[_:-]/i, "")
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 64);

const createInviteCode = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `op_${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const inviteUrlForCode = (code: string) => {
  const botUsername = String(Deno.env.get("TELEGRAM_BOT_USERNAME") || "onlypump_app_bot").replace(/^@/, "").trim();
  const appShortName = String(Deno.env.get("TELEGRAM_APP_SHORT_NAME") || "app").replace(/^\/+|\/+$/g, "").trim();
  if (!botUsername) return null;
  return appShortName ? `https://t.me/${botUsername}/${appShortName}?startapp=${code}` : `https://t.me/${botUsername}?startapp=${code}`;
};

const accessExpiresAtFromDays = (days: unknown) => {
  const value = toNumber(days);
  if (!value || value <= 0) return null;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + Math.round(value));
  return date.toISOString();
};

const serializeInvite = (invite: Record<string, unknown>) => ({
  ...invite,
  issued_role: normalizeAssignableRole(invite.issued_role),
  invite_url: invite.code ? inviteUrlForCode(String(invite.code)) : null,
});

const isInviteUsable = (invite: Record<string, unknown> | null) => {
  if (!invite || !invite.id) return false;
  if (!toBoolean(invite.is_active, true)) return false;
  if (invite.revoked_at) return false;
  if (invite.access_expires_at && new Date(String(invite.access_expires_at)).getTime() <= Date.now()) return false;
  const maxUses = toNumber(invite.max_uses);
  const usesCount = toNonNegativeNumber(invite.uses_count, 0);
  if (maxUses !== null && maxUses > 0 && usesCount >= maxUses) return false;
  return true;
};

const loadUsableInvite = async (supabase: ReturnType<typeof createClient>, rawCode: unknown) => {
  const code = cleanInviteCode(rawCode);
  if (!code) return null;
  const { data, error } = await supabase
    .from("profile_invite_links")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return isInviteUsable(data as Record<string, unknown> | null) ? data as Record<string, unknown> : null;
};

const inviteProfilePatch = (invite: Record<string, unknown> | null) => {
  if (!invite?.id) return {};
  const issuedRole = normalizeAssignableRole(invite.issued_role);
  const rolePatch = rolePatchForAssignableRole(issuedRole);
  return {
    access_status: "allowed",
    access_granted_at: new Date().toISOString(),
    access_expires_at: accessExpiresAtFromDays(invite.access_days),
    invited_by_profile_id: invite.created_by_profile_id || null,
    trainer_profile_id: issuedRole === "student" ? (invite.trainer_profile_id || invite.created_by_profile_id || null) : null,
    invite_code: invite.code || null,
    deleted_at: null,
    ...rolePatch,
  };
};

const calculateAgeFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return null;
  const date = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age > 0 ? age : null;
};

const calculateBodyFat = (input: Record<string, unknown>) => {
  const sex = String(input.sex || "");
  const height = toNumber(input.height_cm);
  const neck = toNumber(input.neck_cm);
  const waist = toNumber(input.waist_cm);
  const hips = toNumber(input.hips_cm);
  if (!height || !neck || !waist) return null;
  let value: number | null = null;
  if (sex === "male" && waist > neck) {
    value = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
  }
  if (sex === "female" && hips && waist + hips > neck) {
    value = 495 / (1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(height)) - 450;
  }
  if (!Number.isFinite(value)) return null;
  return round(clamp(value as number, 3, 60), 1);
};

const getActivityMultiplier = (stepsPerDay: unknown, workoutsPerWeek: unknown) => {
  const steps = toNonNegativeNumber(stepsPerDay, 8000);
  const workouts = toNonNegativeNumber(workoutsPerWeek, 3);
  let base = 1.25;
  if (steps < 5000) base = 1.25;
  else if (steps < 8000) base = 1.35;
  else if (steps < 12000) base = 1.45;
  else if (steps < 16000) base = 1.55;
  else base = 1.65;
  const workoutBonus = Math.min(workouts * 0.04, 0.25);
  return Math.min(base + workoutBonus, 1.9);
};

const normalizeDeficitPercent = (value: unknown, fallback = 10) => clamp(toNumber(value, fallback) || fallback, 5, 30);

const getGoalIntensityRange = (_goalType: string) => ({ min: 0, max: 50, fallback: 10 });

const normalizeGoalIntensityPercent = (goalType: unknown, value: unknown, fallback = 10) => {
  const safeGoalType = String(goalType || "recomposition");
  const range = getGoalIntensityRange(safeGoalType);
  const parsed = toNumber(value);
  const fallbackNumber = toNumber(fallback, range.fallback);
  return clamp(parsed ?? fallbackNumber ?? range.fallback, range.min, range.max);
};

const calculateNutritionTargets = (input: Record<string, unknown>) => {
  const sex = String(input.sex || "male");
  const age = calculateAgeFromBirthDate(String(input.birth_date || "")) || toPositiveNumber(input.age, 30);
  const height = toPositiveNumber(input.height_cm, 180);
  const weight = toPositiveNumber(input.weight_kg, 80);
  const activityMultiplier = getActivityMultiplier(input.steps_per_day, input.workouts_per_week);
  const goalType = String(input.goal_type || "recomposition");
  const bmr = sex === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  const maintenance = bmr * activityMultiplier;
  const goalIntensityPercent = normalizeGoalIntensityPercent(goalType, input.goal_intensity_percent ?? input.deficit_percent);
  const goalMultiplier = goalType === "fat_loss" ? (1 - goalIntensityPercent / 100) : goalType === "muscle_gain" ? (1 + goalIntensityPercent / 100) : goalType === "maintenance" ? 1 : 0.95;
  let calories = Math.round((maintenance * goalMultiplier) / 10) * 10;
  const proteinRate = toBoolean(input.high_protein_enabled) ? 2.5 : (goalType === "fat_loss" || goalType === "recomposition" ? 2.2 : 2.0);
  const protein = Math.round(weight * proteinRate);
  let fat = Math.round(toBoolean(input.higher_fat_enabled) ? weight * 1.0 : Math.max(weight * 0.8, 45));
  let carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  if (carbs < 50) {
    carbs = 50;
    fat = Math.max(45, Math.round((calories - protein * 4 - carbs * 4) / 9));
    calories = Math.round((protein * 4 + fat * 9 + carbs * 4) / 10) * 10;
  }
  return {
    calories_target: calories,
    protein_target: protein,
    fat_target: fat,
    carbs_target: carbs,
  };
};

const calculateSleepDurationMinutes = (startValue: unknown, endValue: unknown, fallback: unknown = 0) => {
  const start = new Date(String(startValue || ""));
  const end = new Date(String(endValue || ""));
  const fallbackMinutes = toNonNegativeNumber(fallback, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return fallbackMinutes;
  let diff = Math.round((end.getTime() - start.getTime()) / 60000);
  if (diff < 0) diff += 24 * 60;
  return clamp(diff, 0, 24 * 60);
};

const calculateRecoveryScore = (record: Record<string, unknown>) => {
  const duration = toNonNegativeNumber(record.sleep_duration_minutes, 0);
  const latency = toNonNegativeNumber(record.sleep_latency_minutes, 0);
  const awakenings = toNonNegativeNumber(record.sleep_awakenings, 0);
  if (!duration) return null;
  const sleepScore = Math.min(duration / 480, 1) * 100;
  const latencyPenalty = latency <= 20 ? 0 : clamp((latency - 20) / 4, 5, 15);
  const awakeningsPenalty = awakenings * 5;
  return round(clamp(sleepScore - latencyPenalty - awakeningsPenalty, 0, 100), 0);
};

const healthLogFieldsFrom = (record: Record<string, unknown>) => {
  const sleepDuration = calculateSleepDurationMinutes(
    record.sleep_started_at,
    record.sleep_ended_at,
    record.sleep_duration_minutes,
  );
  const base = compact({
    steps_count: toNonNegativeNumber(record.steps_count, 0),
    water_ml: toNonNegativeNumber(record.water_ml, 0),
    water_target_ml: toNonNegativeNumber(record.water_target_ml, 2500),
    sleep_started_at: record.sleep_started_at || undefined,
    sleep_ended_at: record.sleep_ended_at || undefined,
    sleep_duration_minutes: sleepDuration,
    sleep_latency_minutes: toNonNegativeNumber(record.sleep_latency_minutes, 0),
    sleep_awakenings: toNonNegativeNumber(record.sleep_awakenings, 0),
    sleep_quality_score: toNumber(record.sleep_quality_score),
    mood_key: record.mood_key !== undefined || record.mood !== undefined ? String(record.mood_key || record.mood || "") : undefined,
    wellbeing_key: record.wellbeing_key !== undefined || record.wellbeing !== undefined ? String(record.wellbeing_key || record.wellbeing || "") : undefined,
    cardio_completed: toOptionalBoolean(record.cardio_completed ?? record.cardio),
    extra_activity_completed: toOptionalBoolean(record.extra_activity_completed ?? record.extra_activity),
    measurements_done: toOptionalBoolean(record.measurements_done),
    photo_done: toOptionalBoolean(record.photo_done),
    tdee_kcal: toNonNegativeNumber(record.tdee_kcal, 0),
    bmr_kcal: toNonNegativeNumber(record.bmr_kcal, 0),
    neat_kcal: toNonNegativeNumber(record.neat_kcal, 0),
    tef_kcal: toNonNegativeNumber(record.tef_kcal, 0),
    eat_kcal: toNonNegativeNumber(record.eat_kcal, 0),
    bmr_percent: toNonNegativeNumber(record.bmr_percent, 0),
    neat_percent: toNonNegativeNumber(record.neat_percent, 0),
    tef_percent: toNonNegativeNumber(record.tef_percent, 0),
    eat_percent: toNonNegativeNumber(record.eat_percent, 0),
    tef_needs_review: toOptionalBoolean(record.tef_needs_review),
    neat_needs_review: toOptionalBoolean(record.neat_needs_review),
    eat_needs_review: toOptionalBoolean(record.eat_needs_review),
    tdee_formula_version: record.tdee_formula_version !== undefined ? String(record.tdee_formula_version || "") : undefined,
    notes: record.notes !== undefined ? String(record.notes || "") : undefined,
  });
  return {
    ...base,
    recovery_score: calculateRecoveryScore({ ...record, sleep_duration_minutes: sleepDuration }),
  };
};

const dateDaysAgo = (dateKey: string, days: number) => {
  const date = new Date(`${toDateKey(dateKey)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const manualTargetsFrom = (payload: Record<string, unknown>) => compact({
  calories_target: toNumber(payload.calories_target),
  protein_target: toNumber(payload.protein_target),
  fat_target: toNumber(payload.fat_target),
  carbs_target: toNumber(payload.carbs_target),
});

const assertTargetsFitCalories = (targets: Record<string, unknown>) => {
  const calories = toPositiveNumber(targets.calories_target, 0);
  const protein = toPositiveNumber(targets.protein_target, 0);
  const fat = toPositiveNumber(targets.fat_target, 0);
  const carbs = toPositiveNumber(targets.carbs_target, 0);
  if (protein * 4 + fat * 9 > calories || protein * 4 + carbs * 4 > calories) {
    throw new Error("Эти значения не помещаются в заданные калории");
  }
};

const profileActivityFieldsFrom = (record: Record<string, unknown>) => compact({
  steps_per_day: toNonNegativeNumber(record.steps_per_day, 8000),
  workouts_per_week: toNonNegativeNumber(record.workouts_per_week, 3),
  high_protein_enabled: toBoolean(record.high_protein_enabled),
  higher_fat_enabled: toBoolean(record.higher_fat_enabled),
  manual_nutrition_targets_enabled: toBoolean(record.manual_nutrition_targets_enabled),
  nutrition_tracking_mode: normalizeNutritionTrackingMode(record.nutrition_tracking_mode),
});

const normalizeThemeTime = (value: unknown, fallback = "06:00") => {
  const source = String(value ?? "").trim();
  const match = source.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const themeSettingsFieldsFrom = (record: Record<string, unknown>) => {
  const enabled = toBoolean(record.light_theme_enabled);
  const always = enabled && toBoolean(record.light_theme_always);
  return compact({
    light_theme_enabled: enabled,
    light_theme_always: always,
    light_theme_start_time: always ? "00:00" : normalizeThemeTime(record.light_theme_start_time, "06:00"),
    light_theme_end_time: always ? "00:00" : normalizeThemeTime(record.light_theme_end_time, "20:00"),
    theme_updated_at: new Date().toISOString(),
  });
};

const measurementFieldsFrom = (record: Record<string, unknown>) => compact({
  weight_kg: toNumber(record.weight_kg),
  neck_cm: toNumber(record.neck_cm),
  waist_cm: toNumber(record.waist_cm),
  hips_cm: toNumber(record.hips_cm),
  body_fat_percent: toNumber(record.body_fat_percent),
  height_cm: toNumber(record.height_cm),
  shoulders_cm: toNumber(record.shoulders_cm),
  chest_cm: toNumber(record.chest_cm),
  biceps_cm: toNumber(record.biceps_cm),
  abdomen_cm: toNumber(record.abdomen_cm),
  glutes_cm: toNumber(record.glutes_cm),
  thigh_cm: toNumber(record.thigh_cm),
  calf_cm: toNumber(record.calf_cm),
});

const fieldsChanged = (before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]) => fields.some((field) => {
  const previous = before[field] ?? "";
  const next = after[field] ?? "";
  return String(previous) !== String(next);
});

const missingProfilesColumnFromError = (error: unknown) => {
  const message = String((error as { message?: unknown })?.message || "");
  const match = message.match(/'([^']+)'\s+column\s+of\s+'profiles'/i);
  return String(match?.[1] || "").trim();
};

const missingNutritionGoalHistoryColumnFromError = (error: unknown) => {
  const message = String((error as { message?: unknown })?.message || "");
  const match = message.match(/'([^']+)'\s+column\s+of\s+'nutrition_goal_history'/i);
  return String(match?.[1] || "").trim();
};

const skippableProfilesUpdateColumns = new Set(["nutrition_tracking_mode"]);
const skippableNutritionGoalHistoryColumns = new Set(["nutrition_tracking_mode"]);

const isMissingColumnError = (error: unknown, column: string) => {
  const message = String((error as { message?: unknown })?.message || "");
  return message.includes(column) && /column/i.test(message);
};

const updateProfileRecord = async (
  supabase: ReturnType<typeof createClient>,
  profileId: unknown,
  patch: Record<string, unknown>,
  context = "profile",
) => {
  const safePatch = { ...patch };
  const skippedColumns: string[] = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .update(safePatch)
      .eq("id", profileId)
      .select()
      .single();
    if (!error) {
      if (skippedColumns.length) console.warn("profiles update skipped missing columns", { context, skippedColumns });
      return data;
    }
    const missingColumn = missingProfilesColumnFromError(error);
    if (missingColumn && skippableProfilesUpdateColumns.has(missingColumn) && Object.prototype.hasOwnProperty.call(safePatch, missingColumn)) {
      console.warn("profiles update retry without missing column", { context, missingColumn, message: error.message });
      delete safePatch[missingColumn];
      skippedColumns.push(missingColumn);
      continue;
    }
    throw error;
  }
  throw new Error(`profiles update failed after removing missing columns: ${skippedColumns.join(", ")}`);
};

const ensureProfile = async (supabase: ReturnType<typeof createClient>, user: Record<string, unknown>, inviteCode: unknown = "") => {
  const telegramId = String(user.id);
  const invite = await loadUsableInvite(supabase, inviteCode);
  const invitePatch = inviteProfilePatch(invite);
  const ownerPatch = isArcherOwnerProfile({ telegram_username: user.username })
    ? {
      access_status: "allowed",
      access_granted_at: new Date().toISOString(),
      access_expires_at: null,
      deleted_at: null,
      is_owner: true,
      is_admin: true,
      is_trainer: true,
      member_role: "admin",
      roles: ["owner", "admin", "trainer"],
    }
    : {};
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
    const canApplyInvite = Boolean(invite?.id && !existing.deleted_at && normalizeAccessStatus(existing.access_status) !== "blocked");
    const { data, error } = await supabase
      .from("profiles")
      .update({
        telegram_username: user.username || null,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        ...displayNamePatch,
        ...(canApplyInvite ? invitePatch : {}),
        ...ownerPatch,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    if (canApplyInvite && invite?.id) {
      await supabase
        .from("profile_invite_links")
        .update({ uses_count: toNonNegativeNumber(invite.uses_count, 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
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
      ...invitePatch,
      ...ownerPatch,
    })
    .select()
    .single();
  if (error) throw error;
  if (invite?.id) {
    await supabase
      .from("profile_invite_links")
      .update({ uses_count: toNonNegativeNumber(invite.uses_count, 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", invite.id);
  }
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
      .update(compact({
        email,
        ...displayNamePatch,
      }))
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
    const telegramContext = await parseTelegramInitData(String(initData));
    return ensureProfile(supabase, telegramContext.user, telegramContext.startParam);
  }

  const token = getRequestAccessToken(request);
  if (!token) throw new Error("Telegram initData or Supabase session is required");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw error || new Error("Supabase session verification failed");
  return ensureWebProfile(supabase, data.user as unknown as Record<string, unknown>);
};

const touchProfileActivity = async (supabase: ReturnType<typeof createClient>, profileId: unknown) => {
  if (!profileId) return;
  const { error } = await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error && !isMissingColumnError(error, "last_active_at")) throw error;
  if (error) console.warn("last_active_at skipped; migration is not applied yet", error.message);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await request.json().catch(() => ({}));
    const { initData, action, payload = {} } = body as { initData?: string; action?: string; payload?: Record<string, unknown> };
    console.log("profile action", action);
    if (!action) throw new Error("action is required");

    const profile = await resolveProfileFromRequest(supabase, request, initData);
    const profileId = profile.id;
    const profileAccessAllowed = hasProfileAccess(profile);
    await touchProfileActivity(supabase, profileId);

    const loadProfile = async () => {
      const { data: freshProfile, error: profileError } = await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle();
      if (profileError || !freshProfile) throw profileError || new Error("Profile not found");
      const { data: latestMeasurement, error: measurementError } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("profile_id", profileId)
        .order("measurement_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (measurementError) throw measurementError;
      const { data: latestGoal, error: goalError } = await supabase
        .from("nutrition_goal_history")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (goalError) throw goalError;
      return { ok: true, profile: freshProfile, latest_measurement: latestMeasurement, latest_nutrition_goal: latestGoal };
    };

    const saveMeasurement = async (source: string, record: Record<string, unknown>) => {
      const measurementPayload = compact({
        profile_id: profileId,
        measurement_date: toDateKey(record.measurement_date),
        ...measurementFieldsFrom(record),
        sex: record.sex || null,
        age: toNumber(record.age),
        source,
        notes: record.notes || null,
      });
      console.log("body_measurements upsert payload", measurementPayload);
      const { data: existingMeasurement, error: existingMeasurementError } = await supabase
        .from("body_measurements")
        .select("id")
        .eq("profile_id", profileId)
        .eq("measurement_date", measurementPayload.measurement_date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingMeasurementError) throw existingMeasurementError;
      if (existingMeasurement?.id) {
        const { data, error } = await supabase.from("body_measurements").update(measurementPayload).eq("id", existingMeasurement.id).select().maybeSingle();
        console.log("body_measurements upsert result", { mode: "update", data, error });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("body_measurements").insert(measurementPayload).select().maybeSingle();
        console.log("body_measurements upsert result", { mode: "insert", data, error });
        if (error) throw error;
      }
    };

    const saveGoal = async (source: string, record: Record<string, unknown>) => {
      const goalPayload = compact({
        profile_id: profileId,
        goal_type: record.goal_type || null,
        calories_target: toNumber(record.calories_target),
        protein_target: toNumber(record.protein_target),
        fat_target: toNumber(record.fat_target),
        carbs_target: toNumber(record.carbs_target),
        target_weight_kg: toNumber(record.target_weight_kg),
        steps_per_day: toNonNegativeNumber(record.steps_per_day, 8000),
        workouts_per_week: toNonNegativeNumber(record.workouts_per_week, 3),
        high_protein_enabled: toBoolean(record.high_protein_enabled),
        higher_fat_enabled: toBoolean(record.higher_fat_enabled),
        manual_nutrition_targets_enabled: toBoolean(record.manual_nutrition_targets_enabled),
        nutrition_tracking_mode: normalizeNutritionTrackingMode(record.nutrition_tracking_mode),
        deficit_percent: normalizeDeficitPercent(record.deficit_percent),
        goal_intensity_percent: normalizeGoalIntensityPercent(record.goal_type, record.goal_intensity_percent ?? record.deficit_percent),
        source,
        notes: record.notes || null,
      });
      const safePayload = { ...goalPayload };
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { error } = await supabase.from("nutrition_goal_history").insert(safePayload);
        if (!error) return;
        const missingColumn = missingNutritionGoalHistoryColumnFromError(error);
        if (missingColumn && skippableNutritionGoalHistoryColumns.has(missingColumn) && Object.prototype.hasOwnProperty.call(safePayload, missingColumn)) {
          console.warn("nutrition_goal_history insert retry without missing column", { source, missingColumn, message: error.message });
          delete safePayload[missingColumn];
          continue;
        }
        throw error;
      }
      throw new Error("nutrition_goal_history insert failed after removing missing columns");
    };

    const updateCurrentAndFutureNutritionDays = async (record: Record<string, unknown>) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("nutrition_days")
        .update(compact({
          calories_target: toNumber(record.calories_target),
          protein_target: toNumber(record.protein_target),
          fat_target: toNumber(record.fat_target),
          carbs_target: toNumber(record.carbs_target),
        }))
        .eq("profile_id", profileId)
        .gte("nutrition_date", today);
      if (error) throw error;
    };

    const loadHealthLog = async (dateValue: unknown) => {
      const date = toDateKey(dateValue);
      const { data: log, error } = await supabase
        .from("daily_health_logs")
        .select("*")
        .eq("profile_id", profileId)
        .eq("log_date", date)
        .maybeSingle();
      if (error) throw error;
      const { data: recentLogs, error: recentError } = await supabase
        .from("daily_health_logs")
        .select("*")
        .eq("profile_id", profileId)
        .lte("log_date", date)
        .gte("log_date", dateDaysAgo(date, 365))
        .order("log_date", { ascending: true });
      if (recentError) throw recentError;
      return { ok: true, log, health_log: log, health_logs: recentLogs || [] };
    };

    const saveHealthLog = async (record: Record<string, unknown>) => {
      const date = toDateKey(record.date || record.log_date);
      const { data: existingLog, error: existingError } = await supabase
        .from("daily_health_logs")
        .select("*")
        .eq("profile_id", profileId)
        .eq("log_date", date)
        .maybeSingle();
      if (existingError) throw existingError;
      const mergedRecord = {
        ...(existingLog || {}),
        ...record,
        date,
        log_date: date,
      };
      const logPayload = compact({
        profile_id: profileId,
        log_date: date,
        ...healthLogFieldsFrom(mergedRecord),
        updated_at: new Date().toISOString(),
      });
      console.log("daily_health_logs upsert payload", logPayload);
      const { data, error } = await supabase
        .from("daily_health_logs")
        .upsert(logPayload, { onConflict: "profile_id,log_date" })
        .select()
        .maybeSingle();
      console.log("daily_health_logs upsert result", { data, error });
      if (error) throw error;
      return { ...(await loadHealthLog(date)), log: data, health_log: data };
    };

    const loadAnalytics = async (record: Record<string, unknown>) => {
      const endDate = toDateKey(record.end_date || record.date || new Date().toISOString().slice(0, 10));
      const startDate = toDateKey(record.start_date || dateDaysAgo(endDate, 365));
      const { data: measurements, error: measurementsError } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("profile_id", profileId)
        .gte("measurement_date", startDate)
        .lte("measurement_date", endDate)
        .order("measurement_date", { ascending: true });
      if (measurementsError) throw measurementsError;
      const { data: healthLogs, error: healthError } = await supabase
        .from("daily_health_logs")
        .select("*")
        .eq("profile_id", profileId)
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .order("log_date", { ascending: true });
      if (healthError) throw healthError;
      const { data: nutritionDays, error: nutritionError } = await supabase
        .from("nutrition_days")
        .select("*")
        .eq("profile_id", profileId)
        .gte("nutrition_date", startDate)
        .lte("nutrition_date", endDate)
        .order("nutrition_date", { ascending: true });
      if (nutritionError) throw nutritionError;
      return {
        ok: true,
        start_date: startDate,
        end_date: endDate,
        measurements: measurements || [],
        health_logs: healthLogs || [],
        nutrition_days: nutritionDays || [],
      };
    };

    const serializeManagedProfile = (item: Record<string, unknown>) => ({
      id: item.id,
      auth_user_id: item.auth_user_id,
      email: item.email,
      telegram_id: item.telegram_id,
      telegram_username: item.telegram_username,
      first_name: item.first_name,
      last_name: item.last_name,
      display_name: item.display_name,
      member_role: normalizeAssignableRole(item.member_role, hasRole(item, "admin") ? "admin" : hasRole(item, "trainer") ? "trainer" : "user"),
      roles: normalizeRoles(item),
      is_owner: toBoolean(item.is_owner),
      is_admin: toBoolean(item.is_admin),
      is_trainer: toBoolean(item.is_trainer),
      access_status: normalizeAccessStatus(item.access_status),
      access_requested_at: item.access_requested_at,
      access_granted_at: item.access_granted_at,
      access_expires_at: item.access_expires_at,
      trainer_profile_id: item.trainer_profile_id,
      invited_by_profile_id: item.invited_by_profile_id,
      invite_code: item.invite_code,
      deleted_at: item.deleted_at,
      last_active_at: item.last_active_at,
      last_seen_at: item.last_seen_at,
    });

    const emptyTodayActivity = () => ({
      opened_app: false,
      entered_data: false,
      logged_nutrition: false,
      logged_steps: false,
      logged_workout: false,
    });

    const isTimestampInRange = (value: unknown, start: string, end: string) => {
      const time = new Date(String(value || "")).getTime();
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      return Number.isFinite(time) && Number.isFinite(startTime) && Number.isFinite(endTime) && time >= startTime && time < endTime;
    };

    const healthLogHasDataEntry = (log: Record<string, unknown> = {}) => {
      return toNonNegativeNumber(log.sleep_duration_minutes, 0) > 0
        || toNonNegativeNumber(log.sleep_latency_minutes, 0) > 0
        || toNonNegativeNumber(log.sleep_awakenings, 0) > 0
        || toNonNegativeNumber(log.sleep_quality_score, 0) > 0
        || toNonNegativeNumber(log.recovery_score, 0) > 0
        || String(log.sleep_started_at || "").trim().length > 0
        || String(log.sleep_ended_at || "").trim().length > 0
        || String(log.mood_key || log.mood || "").trim().length > 0
        || String(log.wellbeing_key || log.wellbeing || "").trim().length > 0
        || String(log.notes || "").trim().length > 0
        || log.measurements_done === true
        || log.photo_done === true;
    };

    const loadStudentTodayActivity = async (students: Record<string, unknown>[], record: Record<string, unknown> = {}) => {
      const ids = students.map((student) => String(student.id || "")).filter(Boolean);
      const today = toDateKey(record.today_date || new Date().toISOString().slice(0, 10));
      const todayStart = String(record.today_start_at || `${today}T00:00:00.000Z`);
      const tomorrowStart = String(record.tomorrow_start_at || `${today}T23:59:59.999Z`);
      const map = new Map(ids.map((id) => [id, emptyTodayActivity()]));
      if (!ids.length) return map;

      students.forEach((student) => {
        const key = String(student.id || "");
        const activeAt = String(student.last_active_at || student.last_seen_at || "");
        const current = map.get(key);
        if (!current) return;
        if (activeAt) current.opened_app = isTimestampInRange(activeAt, todayStart, tomorrowStart);
      });

      const { data: healthLogs, error: healthError } = await supabase
        .from("daily_health_logs")
        .select("profile_id,steps_count,log_date,notes,sleep_started_at,sleep_ended_at,sleep_duration_minutes,sleep_latency_minutes,sleep_awakenings,sleep_quality_score,recovery_score,mood_key,wellbeing_key,measurements_done,photo_done")
        .in("profile_id", ids)
        .eq("log_date", today);
      if (healthError) throw healthError;
      (healthLogs || []).forEach((log: Record<string, unknown>) => {
        const current = map.get(String(log.profile_id || ""));
        if (!current) return;
        current.logged_steps = toNonNegativeNumber(log.steps_count, 0) > 0;
        if (healthLogHasDataEntry(log)) current.entered_data = true;
      });

      const { data: measurements, error: measurementError } = await supabase
        .from("body_measurements")
        .select("profile_id,measurement_date")
        .in("profile_id", ids)
        .eq("measurement_date", today);
      if (measurementError) throw measurementError;
      (measurements || []).forEach((measurement: Record<string, unknown>) => {
        const current = map.get(String(measurement.profile_id || ""));
        if (current) current.entered_data = true;
      });

      const { data: nutritionDays, error: nutritionError } = await supabase
        .from("nutrition_days")
        .select("id,profile_id,nutrition_date,calories_total,protein_total,fat_total,carbs_total")
        .in("profile_id", ids)
        .eq("nutrition_date", today);
      if (nutritionError) throw nutritionError;
      const nutritionProfilesByDayId = new Map<string, string>();
      const nutritionLoggedProfileIds = new Set<string>();
      (nutritionDays || []).forEach((day: Record<string, unknown>) => {
        const dayId = String(day.id || "");
        const profileId = String(day.profile_id || "");
        if (dayId && profileId) nutritionProfilesByDayId.set(dayId, profileId);
        const total = toNonNegativeNumber(day.calories_total, 0)
          + toNonNegativeNumber(day.protein_total, 0)
          + toNonNegativeNumber(day.fat_total, 0)
          + toNonNegativeNumber(day.carbs_total, 0);
        if (profileId && total > 0) nutritionLoggedProfileIds.add(profileId);
      });
      const nutritionDayIds = Array.from(nutritionProfilesByDayId.keys());
      if (nutritionDayIds.length) {
        const { data: nutritionMeals, error: mealsError } = await supabase
          .from("nutrition_meals")
          .select("id,nutrition_day_id,calories_total,protein_total,fat_total,carbs_total")
          .in("nutrition_day_id", nutritionDayIds);
        if (mealsError) throw mealsError;
        const nutritionDayByMealId = new Map<string, string>();
        (nutritionMeals || []).forEach((meal: Record<string, unknown>) => {
          const mealId = String(meal.id || "");
          const dayId = String(meal.nutrition_day_id || "");
          const profileId = nutritionProfilesByDayId.get(dayId);
          if (mealId && dayId) nutritionDayByMealId.set(mealId, dayId);
          const total = toNonNegativeNumber(meal.calories_total, 0)
            + toNonNegativeNumber(meal.protein_total, 0)
            + toNonNegativeNumber(meal.fat_total, 0)
            + toNonNegativeNumber(meal.carbs_total, 0);
          if (profileId && total > 0) nutritionLoggedProfileIds.add(profileId);
        });
        const nutritionMealIds = Array.from(nutritionDayByMealId.keys());
        if (nutritionMealIds.length) {
          const { data: nutritionItems, error: itemsError } = await supabase
            .from("nutrition_items")
            .select("nutrition_meal_id,calories_total,protein_total,fat_total,carbs_total")
            .in("nutrition_meal_id", nutritionMealIds);
          if (itemsError) throw itemsError;
          (nutritionItems || []).forEach((item: Record<string, unknown>) => {
            const dayId = nutritionDayByMealId.get(String(item.nutrition_meal_id || ""));
            const profileId = nutritionProfilesByDayId.get(String(dayId || ""));
            if (profileId) nutritionLoggedProfileIds.add(profileId);
          });
        }
      }
      nutritionLoggedProfileIds.forEach((profileId) => {
        const current = map.get(profileId);
        if (current) current.logged_nutrition = true;
      });

      const { data: workouts, error: workoutsError } = await supabase
        .from("workouts")
        .select("profile_id,workout_date,status,total_sets,total_volume")
        .in("profile_id", ids)
        .eq("workout_date", today);
      if (workoutsError) throw workoutsError;
      (workouts || []).forEach((workout: Record<string, unknown>) => {
        if (String(workout.status || "") !== "completed") return;
        const current = map.get(String(workout.profile_id || ""));
        if (current) current.logged_workout = true;
      });

      map.forEach((activity) => {
        if (activity.entered_data || activity.logged_nutrition || activity.logged_steps || activity.logged_workout) {
          activity.opened_app = true;
        }
      });

      return map;
    };

    const loadStudentSummaries = async (students: Record<string, unknown>[]) => {
      const ids = students.map((student) => String(student.id || "")).filter(Boolean);
      const map = new Map(ids.map((id) => [id, {
        workouts_count: 0,
        completed_workouts_count: 0,
        total_sets: 0,
        total_volume: 0,
        steps_average: 0,
      }]));
      if (!ids.length) return [];
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = dateDaysAgo(endDate, 30);
      const { data: workouts, error: workoutsError } = await supabase
        .from("workouts")
        .select("profile_id,status,total_sets,total_volume,workout_date")
        .in("profile_id", ids)
        .gte("workout_date", startDate);
      if (workoutsError) throw workoutsError;
      (workouts || []).forEach((workout: Record<string, unknown>) => {
        const key = String(workout.profile_id || "");
        const current = map.get(key);
        if (!current) return;
        current.workouts_count += 1;
        if (String(workout.status || "") === "completed") current.completed_workouts_count += 1;
        current.total_sets += toNonNegativeNumber(workout.total_sets, 0);
        current.total_volume += toNonNegativeNumber(workout.total_volume, 0);
      });
      const { data: healthLogs, error: healthError } = await supabase
        .from("daily_health_logs")
        .select("profile_id,steps_count,log_date")
        .in("profile_id", ids)
        .gte("log_date", startDate);
      if (healthError) throw healthError;
      const steps = new Map<string, number[]>();
      (healthLogs || []).forEach((log: Record<string, unknown>) => {
        const key = String(log.profile_id || "");
        const value = toNonNegativeNumber(log.steps_count, 0);
        if (!value) return;
        steps.set(key, [...(steps.get(key) || []), value]);
      });
      steps.forEach((values, key) => {
        const current = map.get(key);
        if (!current || !values.length) return;
        current.steps_average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      });
      return students.map((student) => ({
        ...serializeManagedProfile(student),
        analytics_30d: map.get(String(student.id)) || map.get(String(student.id || "")),
      }));
    };

    const loadAccessPanel = async () => {
      const canManage = hasAnyRole(profile, ["owner", "admin"]);
      const canCreateInvites = hasAnyRole(profile, ["owner", "admin", "trainer"]);
      const canCoach = hasRole(profile, "trainer");
      const canAssignStudents = canCoach;
      if (!canManage && !canCoach) throw new Error("Недостаточно прав");
      let users: Record<string, unknown>[] = [];
      let invites: Record<string, unknown>[] = [];
      let students: Record<string, unknown>[] = [];
      if (canManage) {
        const { data: userRows, error: usersError } = await supabase
          .from("profiles")
          .select("*")
          .is("deleted_at", null);
        if (usersError) throw usersError;
        const profilesById = new Map<string, Record<string, unknown>>();
        (userRows || []).forEach((item: Record<string, unknown>) => {
          const serialized = serializeManagedProfile(item);
          profilesById.set(String(serialized.id || ""), serialized);
        });
        users = (userRows || []).map((item: Record<string, unknown>) => serializeManagedProfile(item))
          .sort((a, b) => String(a.display_name || a.telegram_username || "").localeCompare(String(b.display_name || b.telegram_username || "")));
        const activationsByCode = new Map<string, Record<string, unknown>[]>();
        (userRows || []).forEach((item: Record<string, unknown>) => {
          const code = String(item.invite_code || "").trim();
          if (!code) return;
          activationsByCode.set(code, [...(activationsByCode.get(code) || []), serializeManagedProfile(item)]);
        });

        const { data: inviteRows, error: invitesError } = await supabase
          .from("profile_invite_links")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (invitesError) throw invitesError;
        invites = (inviteRows || []).map((item: Record<string, unknown>) => {
          const code = String(item.code || "").trim();
          const activations = activationsByCode.get(code) || [];
          return {
            ...serializeInvite(item),
            activation_count: activations.length,
            activations,
            created_by_profile: profilesById.get(String(item.created_by_profile_id || "")) || null,
          };
        });
      }
      if (canCoach) {
        const { data: studentRows, error: studentsError } = await supabase
          .from("profiles")
          .select("*")
          .eq("trainer_profile_id", profileId)
          .is("deleted_at", null);
        if (studentsError) throw studentsError;
        const todayActivity = await loadStudentTodayActivity(studentRows || [], payload);
        students = (await loadStudentSummaries(studentRows || [])).map((student: Record<string, unknown>) => ({
          ...student,
          today_activity: todayActivity.get(String(student.id || "")) || emptyTodayActivity(),
        }));

        if (!canManage && canCreateInvites) {
          const activationsByCode = new Map<string, Record<string, unknown>[]>();
          (studentRows || []).forEach((item: Record<string, unknown>) => {
            const code = String(item.invite_code || "").trim();
            if (!code) return;
            activationsByCode.set(code, [...(activationsByCode.get(code) || []), serializeManagedProfile(item)]);
          });
          const { data: inviteRows, error: invitesError } = await supabase
            .from("profile_invite_links")
            .select("*")
            .eq("created_by_profile_id", profileId)
            .order("created_at", { ascending: false })
            .limit(50);
          if (invitesError) throw invitesError;
          invites = (inviteRows || []).map((item: Record<string, unknown>) => {
            const code = String(item.code || "").trim();
            const activations = activationsByCode.get(code) || [];
            return {
              ...serializeInvite(item),
              activation_count: activations.length,
              activations,
              created_by_profile: serializeManagedProfile(profile),
            };
          });
        }
        if (!canManage) {
          const { data: candidateRows, error: candidatesError } = await supabase
            .from("profiles")
            .select("*")
            .is("deleted_at", null);
          if (candidatesError) throw candidatesError;
          users = (candidateRows || [])
            .filter((item: Record<string, unknown>) => {
              const itemId = String(item.id || "");
              if (!itemId || itemId === profileId || isProtectedOwnerProfile(item)) return false;
              if (hasAnyRole(item, ["owner", "admin", "trainer"])) return false;
              const trainerId = String(item.trainer_profile_id || "");
              return !trainerId || trainerId === profileId || normalizeAccessStatus(item.access_status) === "pending";
            })
            .map((item: Record<string, unknown>) => serializeManagedProfile(item))
            .sort((a, b) => String(a.display_name || a.telegram_username || "").localeCompare(String(b.display_name || b.telegram_username || "")));
        }
      }
      return {
        ok: true,
        current_profile: serializeManagedProfile(profile),
        permissions: { can_manage_users: canManage, can_assign_students: canAssignStudents, can_create_invites: canCreateInvites, can_view_students: canCoach },
        users,
        invites,
        students,
      };
    };

    const updateManagedUserAccess = async (record: Record<string, unknown>) => {
      if (!hasAnyRole(profile, ["owner", "admin"])) throw new Error("Недостаточно прав");
      const targetId = String(record.target_profile_id || record.profile_id || "");
      if (!targetId) throw new Error("Не выбран пользователь");
      const { data: target, error: targetError } = await supabase.from("profiles").select("*").eq("id", targetId).maybeSingle();
      if (targetError || !target) throw targetError || new Error("Пользователь не найден");
      const operation = String(record.operation || "");
      if (["block", "delete"].includes(operation) && (targetId === profileId || isProtectedOwnerProfile(target as Record<string, unknown>))) {
        throw new Error("Владельца нельзя заблокировать или удалить");
      }
      if (isProtectedOwnerProfile(target as Record<string, unknown>) && !hasRole(profile, "owner")) throw new Error("Только владелец может менять владельца");
      const patch = operation === "block"
        ? { access_status: "blocked", access_note: record.note || "blocked_by_admin", profile_updated_at: new Date().toISOString() }
        : operation === "unblock"
          ? { access_status: "allowed", access_granted_at: new Date().toISOString(), deleted_at: null, access_note: record.note || null, profile_updated_at: new Date().toISOString() }
          : operation === "delete"
            ? { access_status: "blocked", deleted_at: new Date().toISOString(), access_note: record.note || "deleted_by_admin", profile_updated_at: new Date().toISOString() }
            : null;
      if (!patch) throw new Error("Неизвестное действие пользователя");
      const { data: updated, error: updateError } = await supabase.from("profiles").update(patch).eq("id", targetId).select().single();
      if (updateError) throw updateError;
      return { ok: true, profile: serializeManagedProfile(updated as Record<string, unknown>) };
    };

    const updateManagedUserRole = async (record: Record<string, unknown>) => {
      const trainerOnly = hasRole(profile, "trainer") && !hasAnyRole(profile, ["owner", "admin"]);
      if (!hasAnyRole(profile, ["owner", "admin"]) && !trainerOnly) throw new Error("Недостаточно прав");
      const targetId = String(record.target_profile_id || record.profile_id || "");
      if (!targetId) throw new Error("Не выбран пользователь");
      const { data: target, error: targetError } = await supabase.from("profiles").select("*").eq("id", targetId).maybeSingle();
      if (targetError || !target) throw targetError || new Error("Пользователь не найден");
      if (isProtectedOwnerProfile(target as Record<string, unknown>)) throw new Error("Роль владельца нельзя менять через панель");
      const nextRole = normalizeAssignableRole(record.role || record.member_role);
      if (trainerOnly) {
        if (nextRole !== "student") throw new Error("Тренер может назначать только роль ученика");
        if (hasAnyRole(target as Record<string, unknown>, ["owner", "admin", "trainer"])) throw new Error("Тренер не может менять эту роль");
        const currentTrainerId = String((target as Record<string, unknown>).trainer_profile_id || "");
        if (currentTrainerId && currentTrainerId !== profileId) throw new Error("Пользователь уже привязан к другому тренеру");
      } else if (!hasRole(profile, "owner") && !["user", "trainer", "student"].includes(nextRole)) {
        throw new Error("Админ может назначать пользователя, тренера или ученика");
      }
      const rolePatch = rolePatchForAssignableRole(nextRole);
      const requestedTrainerId = String(record.trainer_profile_id || record.trainer_id || "").trim();
      const existingTrainerId = String((target as Record<string, unknown>).trainer_profile_id || "").trim();
      const assignedTrainerId = nextRole === "student"
        ? trainerOnly
          ? profileId
          : requestedTrainerId || (hasRole(profile, "trainer") ? profileId : existingTrainerId) || null
        : null;
      const patch = {
        ...rolePatch,
        trainer_profile_id: assignedTrainerId,
        access_status: normalizeAccessStatus(target.access_status) === "pending" ? "allowed" : normalizeAccessStatus(target.access_status),
        access_granted_at: normalizeAccessStatus(target.access_status) === "pending" ? new Date().toISOString() : target.access_granted_at,
        profile_updated_at: new Date().toISOString(),
      };
      const { data: updated, error: updateError } = await supabase.from("profiles").update(patch).eq("id", targetId).select().single();
      if (updateError) throw updateError;
      return { ok: true, profile: serializeManagedProfile(updated as Record<string, unknown>) };
    };

    const loadStudentDashboard = async (record: Record<string, unknown>) => {
      const targetId = String(record.target_profile_id || record.profile_id || "");
      if (!targetId) throw new Error("Не выбран ученик");
      const { data: target, error: targetError } = await supabase.from("profiles").select("*").eq("id", targetId).maybeSingle();
      if (targetError || !target) throw targetError || new Error("Ученик не найден");
      const isOwnDashboard = targetId === profileId;
      const canViewTarget = isOwnDashboard || hasAnyRole(profile, ["owner", "admin"]) || (hasRole(profile, "trainer") && String((target as Record<string, unknown>).trainer_profile_id || "") === profileId);
      if (!canViewTarget) throw new Error("Недостаточно прав для просмотра ученика");
      const requestedStartDate = record.start_date ? toDateKey(record.start_date) : "";
      const requestedEndDate = record.end_date ? toDateKey(record.end_date) : "";
      const monthValue = toDateKey(record.month || record.date || new Date().toISOString().slice(0, 10));
      const monthDate = new Date(`${monthValue.slice(0, 7)}-01T00:00:00Z`);
      const monthStartDate = Number.isNaN(monthDate.getTime()) ? new Date().toISOString().slice(0, 8) + "01" : monthDate.toISOString().slice(0, 10);
      const end = new Date(`${monthStartDate}T00:00:00Z`);
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCDate(0);
      const monthEndDate = end.toISOString().slice(0, 10);
      const startDate = requestedStartDate && requestedEndDate ? requestedStartDate : monthStartDate;
      const endDate = requestedStartDate && requestedEndDate ? requestedEndDate : monthEndDate;
      if (startDate > endDate) throw new Error("Некорректный диапазон аналитики");

      const { data: workouts, error: workoutsError } = await supabase
        .from("workouts")
        .select("*")
        .eq("profile_id", targetId)
        .gte("workout_date", startDate)
        .lte("workout_date", endDate)
        .order("workout_date", { ascending: true });
      if (workoutsError) throw workoutsError;
      const workoutIds = (workouts || []).map((item: Record<string, unknown>) => String(item.id || "")).filter(Boolean);
      let exercises: Record<string, unknown>[] = [];
      let sets: Record<string, unknown>[] = [];
      if (workoutIds.length) {
        const { data: exerciseRows, error: exercisesError } = await supabase
          .from("workout_exercises")
          .select("*")
          .in("workout_id", workoutIds)
          .order("exercise_order", { ascending: true });
        if (exercisesError) throw exercisesError;
        exercises = exerciseRows || [];
        const exerciseIds = exercises.map((item) => String(item.id || "")).filter(Boolean);
        if (exerciseIds.length) {
          const { data: setRows, error: setsError } = await supabase
            .from("workout_sets")
            .select("*")
            .in("workout_exercise_id", exerciseIds)
            .order("set_order", { ascending: true });
          if (setsError) throw setsError;
          sets = setRows || [];
        }
      }
      const setsByExerciseId = new Map<string, Record<string, unknown>[]>();
      sets.forEach((set) => {
        const key = String(set.workout_exercise_id || "");
        setsByExerciseId.set(key, [...(setsByExerciseId.get(key) || []), set]);
      });
      const exercisesByWorkoutId = new Map<string, Record<string, unknown>[]>();
      exercises.forEach((exercise) => {
        const key = String(exercise.workout_id || "");
        exercisesByWorkoutId.set(key, [...(exercisesByWorkoutId.get(key) || []), {
          ...exercise,
          workout_sets: setsByExerciseId.get(String(exercise.id || "")) || [],
        }]);
      });
      const nestedWorkouts = (workouts || []).map((workout: Record<string, unknown>) => ({
        ...workout,
        workout_exercises: exercisesByWorkoutId.get(String(workout.id || "")) || [],
      }));

      const { data: healthLogs, error: healthError } = await supabase
        .from("daily_health_logs")
        .select("*")
        .eq("profile_id", targetId)
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .order("log_date", { ascending: true });
      if (healthError) throw healthError;
      const { data: nutritionDays, error: nutritionError } = await supabase
        .from("nutrition_days")
        .select("*")
        .eq("profile_id", targetId)
        .gte("nutrition_date", startDate)
        .lte("nutrition_date", endDate)
        .order("nutrition_date", { ascending: true });
      if (nutritionError) throw nutritionError;
      const { data: measurements, error: measurementError } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("profile_id", targetId)
        .gte("measurement_date", startDate)
        .lte("measurement_date", endDate)
        .order("measurement_date", { ascending: true });
      if (measurementError) throw measurementError;

      return {
        ok: true,
        student: serializeManagedProfile(target as Record<string, unknown>),
        month_start: startDate,
        month_end: endDate,
        workouts: nestedWorkouts,
        health_logs: healthLogs || [],
        nutrition_days: nutritionDays || [],
        measurements: measurements || [],
      };
    };

    const updateManagedUserRoles = async (record: Record<string, unknown>) => {
      if (!hasRole(profile, "owner")) throw new Error("Только владелец может назначать несколько ролей");
      const targetId = String(record.target_profile_id || record.profile_id || "");
      if (!targetId) throw new Error("Не выбран пользователь");
      const { data: target, error: targetError } = await supabase.from("profiles").select("*").eq("id", targetId).maybeSingle();
      if (targetError || !target) throw targetError || new Error("Пользователь не найден");
      if (isProtectedOwnerProfile(target as Record<string, unknown>)) throw new Error("Роль владельца нельзя менять через панель");
      const rolePatch = rolePatchForAssignableRoles(record.roles || record.member_roles || record.role || record.member_role);
      const nextRoles = toStringArray(rolePatch.roles);
      const requestedTrainerId = String(record.trainer_profile_id || record.trainer_id || "").trim();
      const existingTrainerId = String((target as Record<string, unknown>).trainer_profile_id || "").trim();
      const assignedTrainerId = nextRoles.includes("student")
        ? requestedTrainerId || (hasRole(profile, "trainer") ? profileId : existingTrainerId) || null
        : null;
      const patch = {
        ...rolePatch,
        trainer_profile_id: assignedTrainerId,
        access_status: normalizeAccessStatus(target.access_status) === "pending" ? "allowed" : normalizeAccessStatus(target.access_status),
        access_granted_at: normalizeAccessStatus(target.access_status) === "pending" ? new Date().toISOString() : target.access_granted_at,
        profile_updated_at: new Date().toISOString(),
      };
      const { data: updated, error: updateError } = await supabase.from("profiles").update(patch).eq("id", targetId).select().single();
      if (updateError) throw updateError;
      return { ok: true, profile: serializeManagedProfile(updated as Record<string, unknown>) };
    };

    const createInviteLink = async (record: Record<string, unknown>) => {
      if (!hasAnyRole(profile, ["owner", "admin", "trainer"])) throw new Error("Недостаточно прав для создания инвайт-ссылки");
      const trainerOnly = hasRole(profile, "trainer") && !hasAnyRole(profile, ["owner", "admin"]);
      const accessDays = trainerOnly ? null : toNumber(record.access_days);
      const maxUses = toNumber(record.max_uses);
      const issuedRole = trainerOnly ? "student" : normalizeAssignableRole(record.issued_role);
      const trainerId = issuedRole === "student" ? (String(record.trainer_profile_id || (hasRole(profile, "trainer") ? profileId : "") || "").trim() || null) : null;
      const code = cleanInviteCode(record.code) || createInviteCode();
      const { data, error } = await supabase
        .from("profile_invite_links")
        .insert(compact({
          code,
          title: String(record.title || "").trim() || null,
          created_by_profile_id: profileId,
          trainer_profile_id: trainerId,
          issued_role: issuedRole,
          access_days: accessDays && accessDays > 0 ? Math.round(accessDays) : null,
          max_uses: maxUses && maxUses > 0 ? Math.min(100, Math.max(1, Math.round(maxUses))) : null,
          is_active: true,
        }))
        .select()
        .single();
      if (error) throw error;
      return { ok: true, invite: serializeInvite(data as Record<string, unknown>) };
    };

    const revokeInviteLink = async (record: Record<string, unknown>) => {
      if (!hasAnyRole(profile, ["owner", "admin", "trainer"])) throw new Error("Недостаточно прав");
      const inviteId = String(record.invite_id || record.id || "");
      if (!inviteId) throw new Error("Не выбрана ссылка");
      let query = supabase
        .from("profile_invite_links")
        .update({ is_active: false, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", inviteId);
      if (!hasAnyRole(profile, ["owner", "admin"])) query = query.eq("created_by_profile_id", profileId);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return { ok: true, invite: serializeInvite(data as Record<string, unknown>) };
    };

    const deleteInviteLink = async (record: Record<string, unknown>) => {
      if (!hasAnyRole(profile, ["owner", "admin", "trainer"])) throw new Error("Недостаточно прав");
      const inviteId = String(record.invite_id || record.id || "");
      if (!inviteId) throw new Error("Не выбрана ссылка");
      let selectQuery = supabase
        .from("profile_invite_links")
        .select("*")
        .eq("id", inviteId);
      if (!hasAnyRole(profile, ["owner", "admin"])) selectQuery = selectQuery.eq("created_by_profile_id", profileId);
      const { data: invite, error: inviteError } = await selectQuery.maybeSingle();
      if (inviteError) throw inviteError;
      if (!invite) throw new Error("Ссылка не найдена или недоступна");
      let deleteQuery = supabase
        .from("profile_invite_links")
        .delete()
        .eq("id", inviteId);
      if (!hasAnyRole(profile, ["owner", "admin"])) deleteQuery = deleteQuery.eq("created_by_profile_id", profileId);
      const { error } = await deleteQuery;
      if (error) throw error;
      return { ok: true, invite: invite ? serializeInvite(invite as Record<string, unknown>) : null };
    };

    if (action === "load_profile") {
      if (!profileAccessAllowed) {
        return json({
          ok: true,
          access_denied: true,
          access_status: normalizeAccessStatus(profile.access_status),
          profile: minimalProfileForAccess(profile),
        });
      }
      return json(await loadProfile());
    }

    if (!profileAccessAllowed) {
      return accessDeniedResponse(profile);
    }

    if (action === "load_health_log") {
      return json(await loadHealthLog(payload.date || payload.log_date || new Date().toISOString().slice(0, 10)));
    }

    if (action === "save_health_log") {
      return json(await saveHealthLog(payload));
    }

    if (action === "load_analytics") {
      return json(await loadAnalytics(payload));
    }

    if (action === "load_access_panel") {
      return json(await loadAccessPanel());
    }

    if (action === "load_student_dashboard") {
      return json(await loadStudentDashboard(payload));
    }

    if (action === "create_invite_link") {
      return json(await createInviteLink(payload));
    }

    if (action === "revoke_invite_link") {
      return json(await revokeInviteLink(payload));
    }

    if (action === "delete_invite_link") {
      return json(await deleteInviteLink(payload));
    }

    if (action === "update_user_access") {
      return json(await updateManagedUserAccess(payload));
    }

    if (action === "update_user_role") {
      return json(await updateManagedUserRole(payload));
    }

    if (action === "update_user_roles") {
      return json(await updateManagedUserRoles(payload));
    }

    const loadProgress = async (dateValue: unknown) => {
      const date = toDateKey(dateValue);
      const { data: freshProfile, error: profileError } = await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle();
      if (profileError || !freshProfile) throw profileError || new Error("Profile not found");
      const { data: measurement, error: measurementError } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("profile_id", profileId)
        .eq("measurement_date", date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (measurementError) throw measurementError;
      const { data: effectiveMeasurement, error: effectiveError } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("profile_id", profileId)
        .lte("measurement_date", date)
        .order("measurement_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (effectiveError) throw effectiveError;
      const { data: previousMeasurement, error: previousError } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("profile_id", profileId)
        .lt("measurement_date", date)
        .order("measurement_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previousError) throw previousError;
      const { data: measurementDates, error: datesError } = await supabase
        .from("body_measurements")
        .select("measurement_date")
        .eq("profile_id", profileId)
        .order("measurement_date", { ascending: true });
      if (datesError) throw datesError;
      const { data: latestGoal, error: goalError } = await supabase
        .from("nutrition_goal_history")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (goalError) throw goalError;
      return {
        ok: true,
        profile: freshProfile,
        measurement,
        effective_measurement: effectiveMeasurement,
        previous_measurement: previousMeasurement,
        measurement_dates: [...new Set((measurementDates || []).map((item) => String(item.measurement_date || "").slice(0, 10)).filter(Boolean))],
        latest_nutrition_goal: latestGoal,
        goal: {
          goal_type: freshProfile.goal_type,
          target_weight_kg: freshProfile.target_weight_kg,
          waist_cm: freshProfile.waist_cm,
          deficit_percent: normalizeDeficitPercent(freshProfile.deficit_percent),
          goal_intensity_percent: normalizeGoalIntensityPercent(freshProfile.goal_type, freshProfile.goal_intensity_percent ?? freshProfile.deficit_percent),
          calories_target: freshProfile.calories_target,
          protein_target: freshProfile.protein_target,
          fat_target: freshProfile.fat_target,
          carbs_target: freshProfile.carbs_target,
        },
      };
    };

    if (action === "load_progress") {
      return json(await loadProgress(payload.date || new Date().toISOString().slice(0, 10)));
    }

    if (action === "save_progress_measurement") {
      console.log("save_progress_measurement payload", payload);
      const date = toDateKey(payload.date || payload.measurement_date);
      const age = calculateAgeFromBirthDate(String(profile.birth_date || "")) || toNumber(profile.age);
      const nextGoalType = String(payload.goal_type || profile.goal_type || "recomposition");
      const nextGoalIntensity = normalizeGoalIntensityPercent(nextGoalType, payload.goal_intensity_percent ?? payload.deficit_percent ?? profile.goal_intensity_percent ?? profile.deficit_percent);
      const base = {
        ...profile,
        ...payload,
        age,
        sex: profile.sex || payload.sex || "male",
        goal_type: nextGoalType,
        steps_per_day: toNonNegativeNumber(profile.steps_per_day, 8000),
        workouts_per_week: toNonNegativeNumber(profile.workouts_per_week, 3),
        high_protein_enabled: toBoolean(profile.high_protein_enabled),
        higher_fat_enabled: toBoolean(profile.higher_fat_enabled),
        manual_nutrition_targets_enabled: toBoolean(profile.manual_nutrition_targets_enabled),
        nutrition_tracking_mode: normalizeNutritionTrackingMode(profile.nutrition_tracking_mode),
        deficit_percent: nextGoalType === "fat_loss" ? normalizeDeficitPercent(nextGoalIntensity) : normalizeDeficitPercent(profile.deficit_percent),
        goal_intensity_percent: nextGoalIntensity,
      };
      const calculatedBodyFat = toNumber(payload.body_fat_percent, calculateBodyFat(base));
      const measurementRecord = compact({
        profile_id: profileId,
        measurement_date: date,
        ...measurementFieldsFrom({ ...base, body_fat_percent: calculatedBodyFat }),
        sex: base.sex || null,
        age,
        source: "progress",
        notes: payload.notes || null,
      });
      console.log("body_measurements upsert payload", measurementRecord);
      const { data: existingMeasurement, error: existingMeasurementError } = await supabase
        .from("body_measurements")
        .select("id")
        .eq("profile_id", profileId)
        .eq("measurement_date", date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingMeasurementError) throw existingMeasurementError;
      if (existingMeasurement?.id) {
        const { data, error } = await supabase.from("body_measurements").update(measurementRecord).eq("id", existingMeasurement.id).select().maybeSingle();
        console.log("body_measurements upsert result", { mode: "update", data, error });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("body_measurements").insert(measurementRecord).select().maybeSingle();
        console.log("body_measurements upsert result", { mode: "insert", data, error });
        if (error) throw error;
      }

      const calculatedTargets = calculateNutritionTargets(base);
      const targets = toBoolean(base.manual_nutrition_targets_enabled) ? { ...calculatedTargets, ...manualTargetsFrom(profile) } : calculatedTargets;
      const profileUpdate = compact({
        ...measurementFieldsFrom({ ...base, body_fat_percent: calculatedBodyFat }),
        age,
        deficit_percent: normalizeDeficitPercent(base.deficit_percent),
        goal_type: base.goal_type,
        goal_intensity_percent: normalizeGoalIntensityPercent(base.goal_type, base.goal_intensity_percent ?? base.deficit_percent),
        ...targets,
        nutrition_targets_updated_at: new Date().toISOString(),
        profile_updated_at: new Date().toISOString(),
      });
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", profileId)
        .select()
        .single();
      if (updateError) throw updateError;
      await saveGoal("progress", updatedProfile);
      await updateCurrentAndFutureNutritionDays(updatedProfile);
      return json(await loadProgress(date));
    }

    if (action === "complete_onboarding" || action === "update_profile") {
      console.log("update_profile payload", payload);
      const source = action === "complete_onboarding" ? "onboarding" : "profile_update";
      const age = calculateAgeFromBirthDate(String(payload.birth_date || "")) || toNumber(payload.age);
      const manualTargetsEnabled = toBoolean(payload.manual_nutrition_targets_enabled);
      const nutritionTrackingMode = normalizeNutritionTrackingMode(payload.nutrition_tracking_mode ?? profile.nutrition_tracking_mode);
      const nextGoalType = String(payload.goal_type || "recomposition");
      const nextGoalIntensity = normalizeGoalIntensityPercent(nextGoalType, payload.goal_intensity_percent ?? payload.deficit_percent ?? profile.goal_intensity_percent ?? profile.deficit_percent);
      const hasManualDisplayName = typeof payload.display_name === "string" && payload.display_name.trim().length > 0;
      const submittedDisplayName = String(payload.display_name || profile.display_name || profile.telegram_username || profile.email || profile.telegram_id || "Пользователь").trim();
      const submittedEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : profile.email;
      const previousDisplayName = String(profile.display_name || "").trim();
      const displayNameWasManual = toBoolean(profile.display_name_locked) || String(profile.display_name_source || "") === "manual";
      const displayNameChanged = Boolean(submittedDisplayName && submittedDisplayName !== previousDisplayName);
      const shouldLockDisplayName = displayNameWasManual || hasManualDisplayName;
      const hasThemeSettingsPayload =
        Object.prototype.hasOwnProperty.call(payload, "light_theme_enabled") ||
        Object.prototype.hasOwnProperty.call(payload, "light_theme_always") ||
        Object.prototype.hasOwnProperty.call(payload, "light_theme_start_time") ||
        Object.prototype.hasOwnProperty.call(payload, "light_theme_end_time");
      const base = {
        ...payload,
        age,
        sex: payload.sex === "female" ? "female" : "male",
        goal_type: nextGoalType,
        steps_per_day: toNonNegativeNumber(payload.steps_per_day, 8000),
        workouts_per_week: toNonNegativeNumber(payload.workouts_per_week, 3),
        high_protein_enabled: toBoolean(payload.high_protein_enabled),
        higher_fat_enabled: toBoolean(payload.higher_fat_enabled),
        manual_nutrition_targets_enabled: manualTargetsEnabled,
        nutrition_tracking_mode: nutritionTrackingMode,
        deficit_percent: nextGoalType === "fat_loss" ? normalizeDeficitPercent(nextGoalIntensity) : normalizeDeficitPercent(profile.deficit_percent),
        goal_intensity_percent: nextGoalIntensity,
      };
      const calculatedBodyFat = calculateBodyFat(base);
      const calculatedTargets = calculateNutritionTargets(base);
      const targets = manualTargetsEnabled ? { ...calculatedTargets, ...manualTargetsFrom(payload) } : calculatedTargets;
      if (manualTargetsEnabled) assertTargetsFitCalories(targets);
      const profileUpdate = compact({
        email: submittedEmail || null,
        display_name: submittedDisplayName,
        display_name_locked: shouldLockDisplayName,
        display_name_source: shouldLockDisplayName ? "manual" : (profile.display_name_source || "telegram"),
        display_name_updated_at: hasManualDisplayName ? new Date().toISOString() : (displayNameChanged ? new Date().toISOString() : (profile.display_name_updated_at || undefined)),
        sex: base.sex,
        birth_date: payload.birth_date || null,
        age,
        ...measurementFieldsFrom(payload),
        body_fat_percent: calculatedBodyFat,
        ...profileActivityFieldsFrom(base),
        goal_type: base.goal_type,
        goal_description: payload.goal_description || null,
        target_weight_kg: toNumber(payload.target_weight_kg),
        deficit_percent: normalizeDeficitPercent(base.deficit_percent),
        goal_intensity_percent: normalizeGoalIntensityPercent(base.goal_type, base.goal_intensity_percent ?? base.deficit_percent),
        default_weight_unit: normalizeWeightUnit(payload.default_weight_unit || profile.default_weight_unit),
        ...(hasThemeSettingsPayload ? themeSettingsFieldsFrom(payload) : {}),
        ...targets,
        nutrition_targets_updated_at: new Date().toISOString(),
        onboarding_completed: action === "complete_onboarding" ? true : profile.onboarding_completed,
        onboarding_completed_at: action === "complete_onboarding" ? new Date().toISOString() : (profile.onboarding_completed_at || undefined),
        profile_updated_at: new Date().toISOString(),
      });

      const updatedProfile = await updateProfileRecord(supabase, profileId, profileUpdate, "update_profile");

      const measurementChanged = action === "complete_onboarding" || fieldsChanged(profile, updatedProfile, [
        "weight_kg",
        "height_cm",
        "neck_cm",
        "waist_cm",
        "hips_cm",
        "shoulders_cm",
        "chest_cm",
        "biceps_cm",
        "abdomen_cm",
        "glutes_cm",
        "thigh_cm",
        "calf_cm",
        "body_fat_percent",
        "sex",
        "age",
      ]);
      const goalChanged = action === "complete_onboarding" || fieldsChanged(profile, updatedProfile, [
        "goal_type",
        "calories_target",
        "protein_target",
        "fat_target",
        "carbs_target",
        "target_weight_kg",
        "steps_per_day",
        "workouts_per_week",
        "high_protein_enabled",
        "higher_fat_enabled",
        "manual_nutrition_targets_enabled",
        "nutrition_tracking_mode",
        "deficit_percent",
        "goal_intensity_percent",
      ]);
      if (measurementChanged) await saveMeasurement(source, { ...updatedProfile, measurement_date: payload.measurement_date || new Date().toISOString().slice(0, 10) });
      if (goalChanged) await saveGoal(source === "onboarding" ? "onboarding" : "profile", updatedProfile);
      await updateCurrentAndFutureNutritionDays(updatedProfile);
      const loaded = await loadProfile();
      return json({ ...loaded, body_fat_percent: calculatedBodyFat, nutrition_targets: targets });
    }

    if (action === "update_nutrition_targets") {
      const targets = manualTargetsFrom(payload);
      assertTargetsFitCalories(targets);
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          ...targets,
          manual_nutrition_targets_enabled: true,
          nutrition_targets_updated_at: new Date().toISOString(),
          profile_updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .select()
        .single();
      if (updateError) throw updateError;
      await saveGoal("manual", updatedProfile);
      await updateCurrentAndFutureNutritionDays(updatedProfile);
      const loaded = await loadProfile();
      return json(loaded);
    }

    if (action === "update_theme_settings") {
      const themePayload = themeSettingsFieldsFrom(payload);
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(themePayload)
        .eq("id", profileId)
        .select()
        .single();
      if (updateError) throw updateError;
      return json({ ok: true, profile: updatedProfile });
    }

    if (action === "update_analytics_card_settings") {
      const analyticsPayload = {
        analytics_cards_order: toStringArray(payload.analytics_cards_order || payload.order),
        analytics_cards_hidden: toStringArray(payload.analytics_cards_hidden || payload.hidden),
        profile_updated_at: new Date().toISOString(),
      };
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(analyticsPayload)
        .eq("id", profileId)
        .select()
        .single();
      if (updateError) throw updateError;
      return json({ ok: true, profile: updatedProfile });
    }

    if (action === "update_home_state") {
      const homeStatePayload = {
        home_widgets_order: toHomeWidgetsValue(payload.home_widgets_order || payload.widgets || payload.order),
        personal_trackers: toPersonalTrackersArray(payload.personal_trackers || payload.trackers),
        home_state_updated_at: new Date().toISOString(),
        profile_updated_at: new Date().toISOString(),
      };
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(homeStatePayload)
        .eq("id", profileId)
        .select()
        .single();
      if (updateError) throw updateError;
      return json({ ok: true, profile: updatedProfile });
    }

    if (action === "update_tutorial_state") {
      const event = String(payload.event || "").trim();
      const screen = String(payload.screen || "").trim();
      const now = new Date().toISOString();
      const completedSet = new Set(toTutorialScreensArray(profile.tutorial_completed_screens));
      const skippedSet = new Set(toTutorialScreensArray(profile.tutorial_skipped_screens));
      const incomingCompleted = toTutorialScreensArray(payload.completed_screens);
      const incomingSkipped = toTutorialScreensArray(payload.skipped_screens);
      incomingCompleted.forEach((item) => completedSet.add(item));
      incomingSkipped.forEach((item) => skippedSet.add(item));

      if (event === "complete_screen" && tutorialScreens.includes(screen)) {
        completedSet.add(screen);
        skippedSet.delete(screen);
      }
      if (event === "skip_screen" && tutorialScreens.includes(screen) && !completedSet.has(screen)) {
        skippedSet.add(screen);
      }
      if (event === "complete_full") {
        tutorialScreens.forEach((item) => completedSet.add(item));
        skippedSet.clear();
      }

      const existingAwards = toTutorialAwardsArray(profile.tutorial_awards);
      const incomingAwards = toTutorialAwardsArray(payload.tutorial_awards || payload.awards);
      const awardsById = new Map<string, Record<string, unknown>>();
      [...existingAwards, ...incomingAwards].forEach((award) => awardsById.set(String(award?.id || ""), award as Record<string, unknown>));
      const mergedAwards = toTutorialAwardsArray([...awardsById.values()]);

      const patch = {
        tutorial_completed_screens: [...completedSet],
        tutorial_skipped_screens: [...skippedSet].filter((item) => !completedSet.has(item)),
        tutorial_awards: mergedAwards,
        tutorial_completed_at: event === "complete_full" ? now : (profile.tutorial_completed_at || null),
        tutorial_skipped_at: event === "dismiss" || event === "skip_screen" ? (profile.tutorial_skipped_at || now) : (profile.tutorial_skipped_at || null),
        tutorial_state_updated_at: now,
        profile_updated_at: now,
      };

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", profileId)
        .select()
        .single();
      if (updateError) throw updateError;
      return json({ ok: true, profile: updatedProfile });
    }

    if (action === "reset_profile_settings" || action === "reset_profile") {
      const resetPayload = {
        onboarding_completed: false,
        onboarding_completed_at: null,
        goal_type: "recomposition",
        goal_description: null,
        target_weight_kg: null,
        manual_nutrition_targets_enabled: false,
        high_protein_enabled: false,
        higher_fat_enabled: false,
        deficit_percent: 10,
        goal_intensity_percent: 10,
        profile_updated_at: new Date().toISOString(),
      };
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(resetPayload)
        .eq("id", profileId)
        .select()
        .single();
      if (updateError) throw updateError;
      return json({ ok: true, profile: updatedProfile });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return fail(error, 500);
  }
});
