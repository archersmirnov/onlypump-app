import {
  normalizeNutritionDateKey,
  normalizeNutritionFilledDateKeys
} from "../cache/index.js";

export const NUTRITION_ENTRY_META_ID = "onlypump_nutrition_entry_meta";

export const DEFAULT_NUTRITION_GOAL = {
  calories: 2800,
  protein: 180,
  fat: 80,
  carbs: 320
};

export const NUTRITION_EMPTY_TOTALS = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0
};

export const NUTRITION_MEAL_TYPES = [
  { type: "breakfast", title: "Завтрак", order: 1 },
  { type: "lunch", title: "Обед", order: 2 },
  { type: "dinner", title: "Ужин", order: 3 },
  { type: "snack", title: "Перекус", order: 4 }
];

export function roundNutritionCalories(value = 0) {
  return Math.round(Math.max(0, Number(value || 0)));
}

export function roundNutritionMacro(value = 0) {
  return Math.round(Math.max(0, Number(value || 0)) * 10) / 10;
}

export function normalizeNutritionTrackingMode(value = "", fallback = "calories") {
  return value === "palms" || value === "visual" ? "palms" : fallback;
}

export function getNutritionEntryMeta(modifiers = []) {
  return (Array.isArray(modifiers) ? modifiers : [])
    .find((modifier) => (modifier?.id || modifier) === NUTRITION_ENTRY_META_ID)
    ?.entry_meta || null;
}

export function normalizeManualPalmUnits(value = {}) {
  const source = typeof value === "string"
    ? (() => {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    })()
    : (value || {});

  return {
    protein: roundNutritionMacro(source.protein),
    fat: roundNutritionMacro(source.fat),
    carbs: roundNutritionMacro(source.carbs),
    vegetables: roundNutritionMacro(source.vegetables)
  };
}

export function getNutritionManualTotals(day = {}) {
  return {
    calories: roundNutritionCalories(day.manual_calories_total ?? day.manualCaloriesTotal),
    protein: roundNutritionMacro(day.manual_protein_total ?? day.manualProteinTotal),
    fat: roundNutritionMacro(day.manual_fat_total ?? day.manualFatTotal),
    carbs: roundNutritionMacro(day.manual_carbs_total ?? day.manualCarbsTotal),
    fiber: roundNutritionMacro(day.manual_fiber_total ?? day.manualFiberTotal)
  };
}

export function nutritionDayHasManualEntry(day = {}) {
  if (!day) return false;
  if (Boolean(day.manual_entry_enabled ?? day.manualEntryEnabled)) return true;
  return Object.values(getNutritionManualTotals(day)).some((value) => Number(value || 0) > 0);
}

export function createNutritionTotals(source = {}) {
  return {
    calories: roundNutritionCalories(source.calories_total ?? source.caloriesTotal ?? source.calories),
    protein: roundNutritionMacro(source.protein_total ?? source.proteinTotal ?? source.protein),
    fat: roundNutritionMacro(source.fat_total ?? source.fatTotal ?? source.fat),
    carbs: roundNutritionMacro(source.carbs_total ?? source.carbsTotal ?? source.carbs),
    fiber: roundNutritionMacro(source.fiber_total ?? source.fiberTotal ?? source.fiber)
  };
}

export function sumNutritionTotals(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => ({
    calories: acc.calories + Number(item.calories || item.calories_total || 0),
    protein: acc.protein + Number(item.protein || item.protein_total || 0),
    fat: acc.fat + Number(item.fat || item.fat_total || 0),
    carbs: acc.carbs + Number(item.carbs || item.carbs_total || 0),
    fiber: acc.fiber + Number(item.fiber || item.fiber_total || 0)
  }), { ...NUTRITION_EMPTY_TOTALS });
}

function makeLocalNutritionId(prefix, parts = []) {
  const value = parts.filter(Boolean).join("-");
  return value ? `local-${prefix}-${value}` : `local-${prefix}`;
}

export function normalizeNutritionItem(row = {}, options = {}) {
  const selectedModifiers = Array.isArray(row.selected_modifiers)
    ? row.selected_modifiers
    : (Array.isArray(row.selectedModifiers) ? row.selectedModifiers : []);
  const entryMeta = getNutritionEntryMeta(selectedModifiers);
  const foodKey = row.food_key || row.foodKey || row.key || "";
  const itemOrder = Number(row.item_order ?? row.itemOrder ?? 0);

  return {
    id: row.id || makeLocalNutritionId("item", [foodKey, itemOrder, options.fallbackMealType]),
    foodKey,
    foodName: row.food_name || row.foodName || row.name || "Продукт",
    foodCategory: row.food_category || row.foodCategory || row.category || "На глаз",
    servingGrams: Number(row.serving_grams ?? row.servingGrams ?? 100),
    baseCaloriesPer100: Number(row.base_calories_per_100 ?? row.baseCaloriesPer100 ?? row.calories_per_100 ?? 0),
    baseProteinPer100: Number(row.base_protein_per_100 ?? row.baseProteinPer100 ?? row.protein_per_100 ?? 0),
    baseFatPer100: Number(row.base_fat_per_100 ?? row.baseFatPer100 ?? row.fat_per_100 ?? 0),
    baseCarbsPer100: Number(row.base_carbs_per_100 ?? row.baseCarbsPer100 ?? row.carbs_per_100 ?? 0),
    selectedModifiers,
    entryMeta,
    calories: roundNutritionCalories(row.calories_total ?? row.caloriesTotal ?? row.calories),
    protein: roundNutritionMacro(row.protein_total ?? row.proteinTotal ?? row.protein),
    fat: roundNutritionMacro(row.fat_total ?? row.fatTotal ?? row.fat),
    carbs: roundNutritionMacro(row.carbs_total ?? row.carbsTotal ?? row.carbs),
    fiber: roundNutritionMacro(row.fiber_total ?? row.fiberTotal ?? row.fiber ?? entryMeta?.fiber),
    itemOrder,
    notes: row.notes || "",
    createdAt: row.created_at || row.createdAt || null
  };
}

export function normalizeNutritionMeal(row = {}, options = {}) {
  const type = row.meal_type || row.type || "snack";
  const defaultMeal = (options.mealTypes || NUTRITION_MEAL_TYPES).find((item) => item.type === type);
  const items = (Array.isArray(row.nutrition_items) ? row.nutrition_items : (Array.isArray(row.items) ? row.items : []))
    .map((item) => normalizeNutritionItem(item, { fallbackMealType: type }))
    .sort((a, b) => a.itemOrder - b.itemOrder);
  const itemTotals = sumNutritionTotals(items);

  return {
    id: row.id || makeLocalNutritionId("meal", [type]),
    type,
    title: row.meal_title || row.title || row.name || defaultMeal?.title || "Прием пищи",
    order: Number(row.meal_order ?? row.order ?? defaultMeal?.order ?? 0),
    calories: roundNutritionCalories(row.calories_total ?? row.calories ?? itemTotals.calories),
    protein: roundNutritionMacro(row.protein_total ?? row.protein ?? itemTotals.protein),
    fat: roundNutritionMacro(row.fat_total ?? row.fat ?? itemTotals.fat),
    carbs: roundNutritionMacro(row.carbs_total ?? row.carbs ?? itemTotals.carbs),
    fiber: roundNutritionMacro(row.fiber_total ?? row.fiber ?? itemTotals.fiber),
    items
  };
}

export function getNutritionDayTotalsFromMeals(meals = []) {
  const totals = sumNutritionTotals(meals);
  return {
    calories: roundNutritionCalories(totals.calories),
    protein: roundNutritionMacro(totals.protein),
    fat: roundNutritionMacro(totals.fat),
    carbs: roundNutritionMacro(totals.carbs),
    fiber: roundNutritionMacro(totals.fiber)
  };
}

export function getNutritionFilledDateKeys(source = {}, fallback = []) {
  const fields = ["filled_dates", "nutrition_marked_dates", "markedDateKeys"];
  const values = [];
  let hasExplicitDates = false;

  for (const field of fields) {
    if (Array.isArray(source?.[field])) {
      hasExplicitDates = true;
      values.push(...source[field]);
    }
  }

  return normalizeNutritionFilledDateKeys(hasExplicitDates ? values : fallback);
}

export function normalizeNutritionDay(result = {}, fallbackDate = "", fallbackGoal = DEFAULT_NUTRITION_GOAL, options = {}) {
  const day = result.nutrition_day || result.day || result || {};
  const mealTypes = options.mealTypes || NUTRITION_MEAL_TYPES;
  const date = normalizeNutritionDateKey(day.nutrition_date || day.date || fallbackDate, fallbackDate);
  const rawMeals = Array.isArray(result.nutrition_meals) ? result.nutrition_meals : (Array.isArray(result.meals) ? result.meals : []);
  const mealsByType = new Map(rawMeals.map((meal) => [meal.meal_type || meal.type, normalizeNutritionMeal(meal, { mealTypes })]));
  const meals = mealTypes.map((definition) => mealsByType.get(definition.type) || normalizeNutritionMeal({
    meal_type: definition.type,
    meal_title: definition.title,
    meal_order: definition.order,
    nutrition_items: []
  }, { mealTypes }));
  const computedTotals = getNutritionDayTotalsFromMeals(meals);
  const hasMealItems = meals.some((meal) => (meal.items || []).length > 0);
  const manualEntryEnabled = nutritionDayHasManualEntry(day) && !hasMealItems;
  const manualTotals = getNutritionManualTotals(day);
  const displayTotals = manualEntryEnabled ? manualTotals : {
    calories: roundNutritionCalories(day.calories_total ?? day.totals?.calories ?? computedTotals.calories),
    protein: roundNutritionMacro(day.protein_total ?? day.totals?.protein ?? computedTotals.protein),
    fat: roundNutritionMacro(day.fat_total ?? day.totals?.fat ?? computedTotals.fat),
    carbs: roundNutritionMacro(day.carbs_total ?? day.totals?.carbs ?? computedTotals.carbs),
    fiber: roundNutritionMacro(day.fiber_total ?? day.totals?.fiber ?? computedTotals.fiber)
  };
  const explicitCaloriesTarget = day.calories_target ?? day.goal?.calories;
  const caloriesTarget = Number(explicitCaloriesTarget ?? fallbackGoal.calories ?? DEFAULT_NUTRITION_GOAL.calories);

  return {
    id: day.id || null,
    date,
    manual_entry_enabled: manualEntryEnabled,
    manualEntryEnabled,
    manual_calories_total: manualTotals.calories,
    manual_protein_total: manualTotals.protein,
    manual_fat_total: manualTotals.fat,
    manual_carbs_total: manualTotals.carbs,
    manual_fiber_total: manualTotals.fiber,
    manual_entry_mode: normalizeNutritionTrackingMode(day.manual_entry_mode ?? day.manualEntryMode, "calories"),
    manual_palm_units: normalizeManualPalmUnits(day.manual_palm_units ?? day.manualPalmUnits),
    manual_entry_updated_at: day.manual_entry_updated_at || day.manualEntryUpdatedAt || null,
    calories_target: explicitCaloriesTarget != null ? Number(explicitCaloriesTarget) : null,
    goal: {
      calories: caloriesTarget,
      protein: Number(day.protein_target ?? day.goal?.protein ?? fallbackGoal.protein ?? DEFAULT_NUTRITION_GOAL.protein),
      fat: Number(day.fat_target ?? day.goal?.fat ?? fallbackGoal.fat ?? DEFAULT_NUTRITION_GOAL.fat),
      carbs: Number(day.carbs_target ?? day.goal?.carbs ?? fallbackGoal.carbs ?? DEFAULT_NUTRITION_GOAL.carbs)
    },
    totals: displayTotals,
    meals,
    favorites: (Array.isArray(result.favorites) ? result.favorites : []).map((favorite) => ({
      id: favorite.id,
      foodKey: favorite.food_key || favorite.foodKey,
      foodSnapshot: favorite.food_snapshot || favorite.foodSnapshot || {}
    })),
    recentFoods: (Array.isArray(result.recent_foods) ? result.recent_foods : (Array.isArray(result.recentFoods) ? result.recentFoods : [])).map(normalizeNutritionItem),
    frequentFoods: (Array.isArray(result.frequent_foods) ? result.frequent_foods : (Array.isArray(result.frequentFoods) ? result.frequentFoods : [])).map((item) => ({
      ...normalizeNutritionItem(item),
      useCount: item.use_count || item.useCount || 0
    })),
    markedDateKeys: getNutritionFilledDateKeys(result)
  };
}

export function buildLocalNutritionDay(dateKey = "", goal = DEFAULT_NUTRITION_GOAL, options = {}) {
  const safeDateKey = normalizeNutritionDateKey(dateKey, dateKey);
  const mealTypes = options.mealTypes || NUTRITION_MEAL_TYPES;
  return normalizeNutritionDay({
    nutrition_day: {
      nutrition_date: safeDateKey,
      calories_target: goal.calories,
      protein_target: goal.protein,
      fat_target: goal.fat,
      carbs_target: goal.carbs
    },
    nutrition_meals: mealTypes.map((definition) => ({
      meal_type: definition.type,
      meal_title: definition.title,
      meal_order: definition.order,
      nutrition_items: []
    }))
  }, safeDateKey, goal, { mealTypes });
}

export function nutritionDayHasFood(day = {}) {
  const hasItems = (day?.meals || []).some((meal) => (meal.items || []).length > 0);
  const hasManualEntry = nutritionDayHasManualEntry(day);
  const hasCalories = Number(day?.totals?.calories || day?.calories_total || 0) > 0;
  return hasItems || (hasManualEntry && hasCalories);
}

export function deriveHomeMealsFromNutritionDay(day = {}) {
  return (day?.meals || []).map((meal) => ({
    id: meal.id,
    name: meal.title,
    food: meal.items?.length ? meal.items.map((item) => item.foodName).join(", ") : "ничего не добавлено",
    calories: meal.calories,
    protein: meal.protein,
    fat: meal.fat,
    carbs: meal.carbs,
    fiber: meal.fiber
  }));
}
