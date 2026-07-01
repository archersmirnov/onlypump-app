import {
  DEFAULT_NUTRITION_GOAL,
  NUTRITION_EMPTY_TOTALS,
  NUTRITION_MEAL_TYPES,
  buildLocalNutritionDay,
  normalizeNutritionTrackingMode,
  nutritionDayHasFood,
  roundNutritionCalories,
  roundNutritionMacro
} from "./nutritionDay.js";
import {
  NUTRITION_VISUAL_UNITS,
  getAllowedFoodUnits,
  getDefaultVisualUnit,
  getValidatedVisualUnitGrams,
  getVisualUnitAmountOptions,
  inferNutritionCategory,
  isPalmRuleFood
} from "./nutritionFood.js";

export const NUTRITION_SCREEN_MODE_LABELS = Object.freeze({
  calories: "Классика",
  palms: "Правило ладони"
});

export const NUTRITION_CATEGORY_LABELS = Object.freeze({
  protein: "Белки",
  carbs: "Углеводы",
  vegetables: "Овощи",
  fats: "Жиры",
  drinks: "Напитки",
  mixed: "Смешанное",
  other: "Другое"
});

export const NUTRITION_MACRO_DEFINITIONS = Object.freeze([
  { key: "protein", label: "Белки", unit: "г" },
  { key: "fat", label: "Жиры", unit: "г" },
  { key: "carbs", label: "Углеводы", unit: "г" },
  { key: "fiber", label: "Клетчатка", unit: "г" }
]);

function clampPercent(value = 0) {
  return Math.min(100, Math.max(0, Math.round(Number(value || 0))));
}

export function getNutritionProgressPercent(current = 0, target = 0) {
  const numericTarget = Number(target || 0);
  if (!Number.isFinite(numericTarget) || numericTarget <= 0) return 0;
  return clampPercent((Number(current || 0) / numericTarget) * 100);
}

export function formatNutritionNumber(value = 0, fractionDigits = 1) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return "0";
  const rounded = Math.round(numericValue * (10 ** fractionDigits)) / (10 ** fractionDigits);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(fractionDigits);
}

export function getNutritionGoal(day = {}, fallbackGoal = DEFAULT_NUTRITION_GOAL) {
  return {
    calories: Number(day?.goal?.calories ?? day?.calories_target ?? fallbackGoal.calories),
    protein: Number(day?.goal?.protein ?? fallbackGoal.protein),
    fat: Number(day?.goal?.fat ?? fallbackGoal.fat),
    carbs: Number(day?.goal?.carbs ?? fallbackGoal.carbs),
    fiber: Number(day?.goal?.fiber ?? fallbackGoal.fiber ?? 0)
  };
}

export function buildNutritionMacroRows(day = {}, fallbackGoal = DEFAULT_NUTRITION_GOAL) {
  const totals = day?.totals || NUTRITION_EMPTY_TOTALS;
  const goal = getNutritionGoal(day, fallbackGoal);

  return NUTRITION_MACRO_DEFINITIONS.map((definition) => {
    const current = roundNutritionMacro(totals[definition.key]);
    const target = roundNutritionMacro(goal[definition.key]);
    return {
      ...definition,
      current,
      target,
      progress: target > 0 ? getNutritionProgressPercent(current, target) : 0,
      valueLabel: target > 0
        ? `${formatNutritionNumber(current)} / ${formatNutritionNumber(target)} ${definition.unit}`
        : `${formatNutritionNumber(current)} ${definition.unit}`
    };
  });
}

export function buildNutritionMealRows(day = {}) {
  const sourceMeals = Array.isArray(day?.meals) && day.meals.length
    ? day.meals
    : buildLocalNutritionDay(day?.date || "", day?.goal || DEFAULT_NUTRITION_GOAL).meals;

  return sourceMeals
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((meal) => {
      const items = Array.isArray(meal.items) ? meal.items : [];
      return {
        id: meal.id || meal.type,
        type: meal.type,
        title: meal.title || NUTRITION_MEAL_TYPES.find((item) => item.type === meal.type)?.title || "Прием пищи",
        order: Number(meal.order || 0),
        itemCount: items.length,
        itemNames: items.map((item) => item.foodName).filter(Boolean),
        calories: roundNutritionCalories(meal.calories),
        protein: roundNutritionMacro(meal.protein),
        fat: roundNutritionMacro(meal.fat),
        carbs: roundNutritionMacro(meal.carbs),
        fiber: roundNutritionMacro(meal.fiber),
        hasItems: items.length > 0,
        subtitle: items.length ? items.map((item) => item.foodName).join(", ") : "ничего не добавлено"
      };
    });
}

export function buildNutritionPalmUnitRows(day = {}) {
  const units = day?.manual_palm_units || day?.manualPalmUnits || {};
  return [
    { key: "protein", label: "Белки", unit: NUTRITION_VISUAL_UNITS.palm },
    { key: "carbs", label: "Углеводы", unit: NUTRITION_VISUAL_UNITS.cupped_hand },
    { key: "vegetables", label: "Овощи", unit: NUTRITION_VISUAL_UNITS.fist },
    { key: "fat", label: "Жиры", unit: NUTRITION_VISUAL_UNITS.thumb }
  ].map((item) => ({
    ...item,
    amount: roundNutritionMacro(units[item.key]),
    valueLabel: `${formatNutritionNumber(units[item.key])} ${item.unit.unitLabel}`
  }));
}

export function buildNutritionScreenSummary(day = {}, options = {}) {
  const fallbackGoal = options.goal || DEFAULT_NUTRITION_GOAL;
  const goal = getNutritionGoal(day, fallbackGoal);
  const totals = day?.totals || NUTRITION_EMPTY_TOTALS;
  const trackingMode = normalizeNutritionTrackingMode(
    day?.manual_entry_mode || day?.manualEntryMode,
    day?.manualEntryEnabled ? "palms" : "calories"
  );
  const meals = buildNutritionMealRows(day);
  const foodItemsCount = meals.reduce((sum, meal) => sum + meal.itemCount, 0);

  return {
    date: day?.date || options.date || "",
    totals: {
      calories: roundNutritionCalories(totals.calories),
      protein: roundNutritionMacro(totals.protein),
      fat: roundNutritionMacro(totals.fat),
      carbs: roundNutritionMacro(totals.carbs),
      fiber: roundNutritionMacro(totals.fiber)
    },
    goal,
    caloriesProgress: getNutritionProgressPercent(totals.calories, goal.calories),
    remainingCalories: Math.max(0, roundNutritionCalories(goal.calories - Number(totals.calories || 0))),
    trackingMode,
    trackingModeLabel: NUTRITION_SCREEN_MODE_LABELS[trackingMode] || NUTRITION_SCREEN_MODE_LABELS.calories,
    manualEntryEnabled: Boolean(day?.manualEntryEnabled || day?.manual_entry_enabled),
    hasFood: nutritionDayHasFood(day),
    foodItemsCount,
    filledMealsCount: meals.filter((meal) => meal.hasItems).length,
    mealRows: meals,
    macroRows: buildNutritionMacroRows(day, fallbackGoal),
    palmUnitRows: buildNutritionPalmUnitRows(day)
  };
}

export function buildNutritionFoodUnitPreview(foodItem = {}, profile = {}) {
  const category = inferNutritionCategory(foodItem);
  const allowedUnits = getAllowedFoodUnits(foodItem);
  const defaultVisualUnit = getDefaultVisualUnit(foodItem);

  return {
    key: foodItem.key || foodItem.id || foodItem.name,
    name: foodItem.name || foodItem.foodName || foodItem.food_name || "Продукт",
    category,
    categoryLabel: NUTRITION_CATEGORY_LABELS[category] || NUTRITION_CATEGORY_LABELS.other,
    isPalmRuleFood: isPalmRuleFood(foodItem),
    defaultVisualUnit,
    defaultVisualUnitLabel: NUTRITION_VISUAL_UNITS[defaultVisualUnit]?.label || "Граммы",
    unitRows: allowedUnits.map((unit) => {
      const amountOptions = getVisualUnitAmountOptions(unit.id);
      const previewAmount = amountOptions.includes(1) ? 1 : amountOptions[0];
      const grams = getValidatedVisualUnitGrams(foodItem, unit.id, previewAmount, profile);
      return {
        id: unit.id,
        label: unit.label,
        unitLabel: unit.unitLabel,
        amountOptions,
        previewAmount,
        grams,
        isDefault: unit.id === defaultVisualUnit
      };
    })
  };
}
