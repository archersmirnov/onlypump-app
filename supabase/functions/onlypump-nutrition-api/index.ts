import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_TARGETS = {
  calories_target: 2500,
  protein_target: 180,
  fat_target: 70,
  carbs_target: 250,
};

const mealDefaults = [
  { meal_type: "breakfast", meal_title: "Завтрак", meal_order: 1 },
  { meal_type: "lunch", meal_title: "Обед", meal_order: 2 },
  { meal_type: "dinner", meal_title: "Ужин", meal_order: 3 },
  { meal_type: "snack", meal_title: "Перекус", meal_order: 4 },
];

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    "Content-Type": "application/json",
  },
});

const fail = (error: unknown, status = 400) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  console.error("onlypump-nutrition-api error:", error);
  return json({ ok: false, error: message }, status);
};

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const compact = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

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

const toDateKey = (value: unknown) => {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
};

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeNutritionTrackingMode = (value: unknown, fallback = "calories") => {
  const mode = String(value || fallback || "calories").trim().toLowerCase();
  return mode === "palms" ? "palms" : "calories";
};

const profileTargets = (profile: Record<string, unknown>) => ({
  calories_target: toNumber(profile.calories_target, DEFAULT_TARGETS.calories_target),
  protein_target: toNumber(profile.protein_target, DEFAULT_TARGETS.protein_target),
  fat_target: toNumber(profile.fat_target, DEFAULT_TARGETS.fat_target),
  carbs_target: toNumber(profile.carbs_target, DEFAULT_TARGETS.carbs_target),
});

const itemFields = (item: Record<string, unknown>, order?: number) => compact({
  food_key: item.food_key || item.foodKey || item.key,
  food_name: item.food_name || item.foodName || item.name,
  food_category: item.food_category || item.foodCategory || item.category || null,
  serving_grams: toNumber(item.serving_grams ?? item.servingGrams ?? item.grams, 100),
  base_calories_per_100: toNumber(item.base_calories_per_100 ?? item.baseCaloriesPer100 ?? item.calories_per_100, 0),
  base_protein_per_100: toNumber(item.base_protein_per_100 ?? item.baseProteinPer100 ?? item.protein_per_100, 0),
  base_fat_per_100: toNumber(item.base_fat_per_100 ?? item.baseFatPer100 ?? item.fat_per_100, 0),
  base_carbs_per_100: toNumber(item.base_carbs_per_100 ?? item.baseCarbsPer100 ?? item.carbs_per_100, 0),
  selected_modifiers: item.selected_modifiers ?? item.selectedModifiers ?? [],
  calories_total: toNumber(item.calories_total ?? item.caloriesTotal ?? item.calories, 0),
  protein_total: toNumber(item.protein_total ?? item.proteinTotal ?? item.protein, 0),
  fat_total: toNumber(item.fat_total ?? item.fatTotal ?? item.fat, 0),
  carbs_total: toNumber(item.carbs_total ?? item.carbsTotal ?? item.carbs, 0),
  item_order: item.item_order !== undefined || item.itemOrder !== undefined || order !== undefined
    ? toNumber(item.item_order ?? item.itemOrder, order || 0)
    : undefined,
  notes: item.notes || null,
});

const getOwnerDayFromItem = (itemOwner: Record<string, unknown> | null) => {
  const meal = itemOwner?.nutrition_meals as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const safeMeal = Array.isArray(meal) ? meal[0] : meal;
  const day = safeMeal?.nutrition_days as Record<string, unknown> | Record<string, unknown>[] | undefined;
  return Array.isArray(day) ? day[0] : day;
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
    const { initData, action, payload = {} } = body;
    console.log("onlypump-nutrition-api action:", action);

    if (!action) throw new Error("action is required");
    const profile = await resolveProfileFromRequest(supabase, request, initData);
    if (!profile?.id) throw new Error("Profile not found");
    if (!hasProfileAccess(profile)) {
      return accessDeniedResponse(profile);
    }

    const profileId = profile.id;

    const ensureDefaultMeals = async (dayId: string) => {
      const { data: existingMeals, error: existingMealsError } = await supabase
        .from("nutrition_meals")
        .select("meal_type")
        .eq("nutrition_day_id", dayId);
      if (existingMealsError) throw existingMealsError;
      const existingTypes = new Set((existingMeals || []).map((meal) => meal.meal_type));
      const mealRows = mealDefaults
        .filter((meal) => !existingTypes.has(meal.meal_type))
        .map((meal) => ({ ...meal, nutrition_day_id: dayId }));
      if (mealRows.length) {
        const { error: mealsError } = await supabase.from("nutrition_meals").insert(mealRows);
        if (mealsError && mealsError.code !== "23505") throw mealsError;
      }
    };

    const ensureDay = async (date: string) => {
      const { data: existing, error: existingError } = await supabase
        .from("nutrition_days")
        .select("*")
        .eq("profile_id", profileId)
        .eq("nutrition_date", date)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.id) {
        await ensureDefaultMeals(existing.id);
        return existing;
      }

      const { data: created, error: createError } = await supabase
        .from("nutrition_days")
        .insert({ profile_id: profileId, nutrition_date: date, ...profileTargets(profile) })
        .select()
        .single();
      let dayRecord = created;
      if (createError) {
        if (createError.code === "23505") {
          const { data: createdByParallelRequest, error: retryError } = await supabase
            .from("nutrition_days")
            .select("*")
            .eq("profile_id", profileId)
            .eq("nutrition_date", date)
            .maybeSingle();
          if (retryError || !createdByParallelRequest?.id) throw retryError || createError;
          dayRecord = createdByParallelRequest;
        } else {
          throw createError;
        }
      }
      if (!dayRecord?.id) throw new Error("Nutrition day create failed");

      await ensureDefaultMeals(dayRecord.id);
      return dayRecord;
    };

    const recalculateDay = async (dayId: string) => {
      const { data: meals, error: mealsError } = await supabase
        .from("nutrition_meals")
        .select("id")
        .eq("nutrition_day_id", dayId);
      if (mealsError) throw mealsError;

      const mealIds = (meals || []).map((meal) => meal.id);
      const { data: items, error: itemsError } = mealIds.length
        ? await supabase.from("nutrition_items").select("*").in("nutrition_meal_id", mealIds)
        : { data: [], error: null };
      if (itemsError) throw itemsError;

      const { data: dayRecord, error: dayReadError } = await supabase
        .from("nutrition_days")
        .select("manual_entry_enabled, manual_entry_mode, manual_palm_units, manual_calories_total, manual_protein_total, manual_fat_total, manual_carbs_total")
        .eq("id", dayId)
        .maybeSingle();
      if (dayReadError) throw dayReadError;

      for (const meal of meals || []) {
        const mealItems = (items || []).filter((item) => item.nutrition_meal_id === meal.id);
        const totals = mealItems.reduce((acc, item) => ({
          calories_total: acc.calories_total + toNumber(item.calories_total),
          protein_total: acc.protein_total + toNumber(item.protein_total),
          fat_total: acc.fat_total + toNumber(item.fat_total),
          carbs_total: acc.carbs_total + toNumber(item.carbs_total),
        }), { calories_total: 0, protein_total: 0, fat_total: 0, carbs_total: 0 });
        const { error } = await supabase.from("nutrition_meals").update(totals).eq("id", meal.id);
        if (error) throw error;
      }

      const itemCount = (items || []).length;
      const itemTotals = (items || []).reduce((acc, item) => ({
        calories_total: acc.calories_total + toNumber(item.calories_total),
        protein_total: acc.protein_total + toNumber(item.protein_total),
        fat_total: acc.fat_total + toNumber(item.fat_total),
        carbs_total: acc.carbs_total + toNumber(item.carbs_total),
      }), { calories_total: 0, protein_total: 0, fat_total: 0, carbs_total: 0 });
      const manualTotals = {
        calories_total: toNumber(dayRecord?.manual_calories_total),
        protein_total: toNumber(dayRecord?.manual_protein_total),
        fat_total: toNumber(dayRecord?.manual_fat_total),
        carbs_total: toNumber(dayRecord?.manual_carbs_total),
      };
      const manualEntryEnabled = Boolean(dayRecord?.manual_entry_enabled) && itemCount === 0;
      const dayTotals = manualEntryEnabled ? manualTotals : itemTotals;
      const dayUpdate = itemCount > 0
        ? { ...dayTotals, manual_entry_enabled: false }
        : dayTotals;
      const { error: dayError } = await supabase.from("nutrition_days").update(dayUpdate).eq("id", dayId);
      if (dayError) throw dayError;
    };

    const loadTree = async (dateValue: unknown) => {
      const date = toDateKey(dateValue);
      const day = await ensureDay(date);
      await recalculateDay(day.id);

      const { data: freshDay, error: dayError } = await supabase.from("nutrition_days").select("*").eq("id", day.id).maybeSingle();
      if (dayError) throw dayError;

      const { data: meals, error: mealsError } = await supabase
        .from("nutrition_meals")
        .select("*")
        .eq("nutrition_day_id", day.id)
        .order("meal_order", { ascending: true });
      if (mealsError) throw mealsError;

      const mealIds = (meals || []).map((meal) => meal.id);
      const { data: items, error: itemsError } = mealIds.length
        ? await supabase.from("nutrition_items").select("*").in("nutrition_meal_id", mealIds).order("item_order", { ascending: true })
        : { data: [], error: null };
      if (itemsError) throw itemsError;

      const itemsByMealId = (items || []).reduce((map, item) => {
        const key = String(item.nutrition_meal_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
        return map;
      }, new Map<string, Record<string, unknown>[]>());

      const mealTree = (meals || []).map((meal) => ({
        ...meal,
        nutrition_items: itemsByMealId.get(String(meal.id)) || [],
      }));

      const { data: favorites, error: favoritesError } = await supabase
        .from("nutrition_favorites")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (favoritesError) throw favoritesError;

      const { data: recentRows, error: recentError } = await supabase
        .from("nutrition_items")
        .select("*, nutrition_meals!inner(nutrition_days!inner(profile_id))")
        .eq("nutrition_meals.nutrition_days.profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(120);
      if (recentError) throw recentError;

      const recentMap = new Map<string, Record<string, unknown>>();
      const frequencyMap = new Map<string, { count: number; item: Record<string, unknown> }>();
      for (const item of recentRows || []) {
        const key = String(item.food_key || "");
        if (!key) continue;
        if (!recentMap.has(key)) recentMap.set(key, item);
        const current = frequencyMap.get(key);
        frequencyMap.set(key, { count: (current?.count || 0) + 1, item: current?.item || item });
      }

      const { data: markerItems, error: markerItemsError } = await supabase
        .from("nutrition_items")
        .select("nutrition_meals!inner(nutrition_days!inner(profile_id, nutrition_date))")
        .eq("nutrition_meals.nutrition_days.profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (markerItemsError) throw markerItemsError;

      const { data: markerDays, error: markerDaysError } = await supabase
        .from("nutrition_days")
        .select("nutrition_date")
        .eq("profile_id", profileId)
        .gt("calories_total", 0)
        .order("nutrition_date", { ascending: false })
        .limit(365);
      if (markerDaysError) throw markerDaysError;

      const nutritionMarkedDates = new Set<string>();
      for (const item of (markerItems || []) as Array<Record<string, unknown>>) {
        const meal = Array.isArray(item.nutrition_meals) ? item.nutrition_meals[0] : item.nutrition_meals;
        const safeMeal = meal as Record<string, unknown> | undefined;
        const day = Array.isArray(safeMeal?.nutrition_days) ? safeMeal?.nutrition_days[0] : safeMeal?.nutrition_days;
        const safeDay = day as Record<string, unknown> | undefined;
        const dateKey = String(safeDay?.nutrition_date || "").slice(0, 10);
        if (dateKey) nutritionMarkedDates.add(dateKey);
      }
      for (const day of (markerDays || []) as Array<Record<string, unknown>>) {
        const dateKey = String(day.nutrition_date || "").slice(0, 10);
        if (dateKey) nutritionMarkedDates.add(dateKey);
      }

      return {
        ok: true,
        profile,
        nutrition_day: freshDay,
        nutrition_meals: mealTree,
        nutrition_items: items || [],
        favorites: favorites || [],
        recent_foods: [...recentMap.values()].slice(0, 20),
        frequent_foods: [...frequencyMap.values()].sort((a, b) => b.count - a.count).slice(0, 20).map((entry) => ({ ...entry.item, use_count: entry.count })),
        filled_dates: [...nutritionMarkedDates].sort(),
        nutrition_marked_dates: [...nutritionMarkedDates].sort(),
      };
    };

    const date = toDateKey((payload as Record<string, unknown>).date);
    if (action === "load" || action === "recalculate_day") {
      return json(await loadTree(date));
    }

    if (action === "save_manual_day_totals") {
      const day = await ensureDay(date);
      const { data: meals, error: mealsError } = await supabase
        .from("nutrition_meals")
        .select("id")
        .eq("nutrition_day_id", day.id);
      if (mealsError) throw mealsError;
      const mealIds = (meals || []).map((meal) => meal.id);
      const { data: existingItems, error: existingItemsError } = mealIds.length
        ? await supabase.from("nutrition_items").select("id").in("nutrition_meal_id", mealIds).limit(1)
        : { data: [], error: null };
      if (existingItemsError) throw existingItemsError;
      if ((existingItems || []).length) {
        return json({ ok: false, error: "Manual totals are only available for empty nutrition days" }, 409);
      }

      const manualTotals = {
        manual_entry_enabled: true,
        manual_entry_mode: normalizeNutritionTrackingMode((payload as Record<string, unknown>).manual_entry_mode ?? (payload as Record<string, unknown>).manualEntryMode),
        manual_palm_units: (payload as Record<string, unknown>).manual_palm_units ?? (payload as Record<string, unknown>).manualPalmUnits ?? {},
        manual_calories_total: toNumber((payload as Record<string, unknown>).manual_calories_total ?? (payload as Record<string, unknown>).calories_total ?? (payload as Record<string, unknown>).calories),
        manual_protein_total: toNumber((payload as Record<string, unknown>).manual_protein_total ?? (payload as Record<string, unknown>).protein_total ?? (payload as Record<string, unknown>).protein),
        manual_fat_total: toNumber((payload as Record<string, unknown>).manual_fat_total ?? (payload as Record<string, unknown>).fat_total ?? (payload as Record<string, unknown>).fat),
        manual_carbs_total: toNumber((payload as Record<string, unknown>).manual_carbs_total ?? (payload as Record<string, unknown>).carbs_total ?? (payload as Record<string, unknown>).carbs),
        manual_entry_updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("nutrition_days").update({
        ...manualTotals,
        calories_total: manualTotals.manual_calories_total,
        protein_total: manualTotals.manual_protein_total,
        fat_total: manualTotals.manual_fat_total,
        carbs_total: manualTotals.manual_carbs_total,
      }).eq("id", day.id);
      if (error) throw error;
      return json(await loadTree(date));
    }

    if (action === "add_item") {
      const dayTree = await loadTree(date);
      const mealType = String((payload as Record<string, unknown>).meal_type || "snack");
      const meal = (dayTree.nutrition_meals as Record<string, unknown>[]).find((item) => item.meal_type === mealType);
      if (!meal?.id) throw new Error("Meal not found");
      const item = ((payload as Record<string, unknown>).item || {}) as Record<string, unknown>;
      const itemOrder = (((meal.nutrition_items as unknown[]) || []).length || 0) + 1;
      const { error } = await supabase
        .from("nutrition_items")
        .insert({ nutrition_meal_id: meal.id, ...itemFields(item, itemOrder) });
      if (error) throw error;
      return json(await loadTree(date));
    }

    if (action === "update_item") {
      const id = String((payload as Record<string, unknown>).id || (payload as Record<string, unknown>).item_id || "");
      if (!id) throw new Error("item id is required");
      const { data: itemOwner, error: ownerError } = await supabase
        .from("nutrition_items")
        .select("id, nutrition_meal_id, nutrition_meals!inner(nutrition_day_id, nutrition_days!inner(profile_id, nutrition_date))")
        .eq("id", id)
        .maybeSingle();
      if (ownerError) throw ownerError;
      const ownerDay = getOwnerDayFromItem(itemOwner as Record<string, unknown> | null);
      if (!itemOwner || ownerDay?.profile_id !== profileId) throw new Error("Nutrition item ownership check failed");
      const item = ((payload as Record<string, unknown>).item || payload) as Record<string, unknown>;
      const { error } = await supabase.from("nutrition_items").update(itemFields(item)).eq("id", id);
      if (error) throw error;
      return json(await loadTree(ownerDay?.nutrition_date));
    }

    if (action === "delete_item") {
      const id = String((payload as Record<string, unknown>).id || (payload as Record<string, unknown>).item_id || "");
      if (!id) throw new Error("item id is required");
      const { data: itemOwner, error: ownerError } = await supabase
        .from("nutrition_items")
        .select("id, nutrition_meal_id, nutrition_meals!inner(nutrition_day_id, nutrition_days!inner(profile_id, nutrition_date))")
        .eq("id", id)
        .maybeSingle();
      if (ownerError) throw ownerError;
      const ownerDay = getOwnerDayFromItem(itemOwner as Record<string, unknown> | null);
      if (!itemOwner || ownerDay?.profile_id !== profileId) throw new Error("Nutrition item ownership check failed");
      const { error } = await supabase.from("nutrition_items").delete().eq("id", id);
      if (error) throw error;
      return json(await loadTree(ownerDay?.nutrition_date));
    }

    if (action === "toggle_favorite") {
      const foodKey = String((payload as Record<string, unknown>).food_key || (payload as Record<string, unknown>).foodKey || "");
      const foodSnapshot = (payload as Record<string, unknown>).food_snapshot || (payload as Record<string, unknown>).foodSnapshot || null;
      if (!foodKey) throw new Error("food_key is required");
      const { data: existing, error: existingError } = await supabase
        .from("nutrition_favorites")
        .select("id")
        .eq("profile_id", profileId)
        .eq("food_key", foodKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.id) {
        const { error } = await supabase.from("nutrition_favorites").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("nutrition_favorites").insert({ profile_id: profileId, food_key: foodKey, food_snapshot: foodSnapshot || {} });
        if (error) throw error;
      }
      return json(await loadTree(date));
    }

    if (action === "copy_recent_item") {
      const source = ((payload as Record<string, unknown>).item || {}) as Record<string, unknown>;
      const mealType = String((payload as Record<string, unknown>).meal_type || "snack");
      const dayTree = await loadTree(date);
      const meal = (dayTree.nutrition_meals as Record<string, unknown>[]).find((item) => item.meal_type === mealType);
      if (!meal?.id) throw new Error("Meal not found");
      const itemOrder = (((meal.nutrition_items as unknown[]) || []).length || 0) + 1;
      const { error } = await supabase.from("nutrition_items").insert({ nutrition_meal_id: meal.id, ...itemFields(source, itemOrder) });
      if (error) throw error;
      return json(await loadTree(date));
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return fail(error, 500);
  }
});
