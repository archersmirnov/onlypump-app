import {
  DEFAULT_NUTRITION_GOAL,
  NUTRITION_EMPTY_TOTALS,
  NUTRITION_MEAL_TYPES,
  buildLocalNutritionDay,
  normalizeNutritionDay,
  normalizeNutritionTrackingMode,
  nutritionDayHasFood,
  roundNutritionCalories,
  roundNutritionMacro
} from "./nutritionDay.js";
import {
  NUTRITION_VISUAL_UNITS,
  PALM_RULE_CATEGORY_IDS,
  getAllowedFoodUnits,
  getDefaultVisualUnit,
  getValidatedVisualUnitGrams,
  getVisualUnitAmountOptions,
  inferNutritionCategory,
  isPalmRuleFood,
  normalizeNutritionCategory
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

export const NUTRITION_LIST_FILTER_LABELS = Object.freeze({
  all: "Все",
  recent: "Недавние",
  frequent: "Частые",
  favorites: "Избранные"
});

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

export function normalizeNutritionScreenMode(value = "", fallback = "calories") {
  if (value === "palm_rule" || value === "hand_rule") return "palms";
  return normalizeNutritionTrackingMode(value, fallback);
}

export function normalizeNutritionListFilter(value = "all") {
  const normalized = String(value || "all").trim();
  return NUTRITION_LIST_FILTER_LABELS[normalized] ? normalized : "all";
}

export function normalizeNutritionScreenCategory(value = "all") {
  const normalized = String(value || "all").trim();
  if (normalized === "all") return "all";
  const category = normalizeNutritionCategory(normalized);
  return NUTRITION_CATEGORY_LABELS[category] ? category : "all";
}

export function buildNutritionModeTabs(selectedMode = "calories") {
  const mode = normalizeNutritionScreenMode(selectedMode);
  return Object.entries(NUTRITION_SCREEN_MODE_LABELS).map(([id, label]) => ({
    id,
    label,
    isActive: id === mode
  }));
}

export function buildNutritionListFilterTabs(selectedFilter = "all") {
  const filter = normalizeNutritionListFilter(selectedFilter);
  return Object.entries(NUTRITION_LIST_FILTER_LABELS).map(([id, label]) => ({
    id,
    label,
    isActive: id === filter
  }));
}

export function buildNutritionCategoryTabs(foodPreviews = [], selectedCategory = "all") {
  const category = normalizeNutritionScreenCategory(selectedCategory);
  const counts = foodPreviews.reduce((acc, food) => {
    acc[food.category] = Number(acc[food.category] || 0) + 1;
    return acc;
  }, {});

  return [
    {
      id: "all",
      label: "Все",
      count: foodPreviews.length,
      isActive: category === "all"
    },
    ...PALM_RULE_CATEGORY_IDS.map((id) => ({
      id,
      label: NUTRITION_CATEGORY_LABELS[id] || id,
      count: Number(counts[id] || 0),
      isActive: category === id
    }))
  ];
}

function normalizeNutritionScreenDay(source = {}, options = {}) {
  const fallbackGoal = options.goal || DEFAULT_NUTRITION_GOAL;
  const rawDay = source.day || source.nutritionDay || (
    source.nutrition_day || source.nutrition_meals || source.meals ? source : null
  );

  if (rawDay?.totals && Array.isArray(rawDay?.meals)) return rawDay;
  if (rawDay) return normalizeNutritionDay(rawDay, options.date || source.date || "", fallbackGoal);

  return buildLocalNutritionDay(options.date || source.date || "", fallbackGoal);
}

function getNutritionScreenFoods(source = {}, options = {}) {
  const candidates = [
    options.foods,
    source.foods,
    source.foodItems,
    source.food_items
  ];

  return candidates.find((items) => Array.isArray(items)) || [];
}

function getNutritionFoodSourceTypes(foodItem = {}) {
  const sourceTypes = new Set(Array.isArray(foodItem.sourceTypes) ? foodItem.sourceTypes : []);
  if (Array.isArray(foodItem.source_types)) foodItem.source_types.forEach((type) => sourceTypes.add(type));
  if (foodItem.isRecent || foodItem.recent) sourceTypes.add("recent");
  if (foodItem.isFrequent || foodItem.frequent || Number(foodItem.use_count || foodItem.useCount || 0) > 0) {
    sourceTypes.add("frequent");
  }
  if (foodItem.isFavorite || foodItem.favorite || foodItem.favorite_id || foodItem.favoriteId) {
    sourceTypes.add("favorites");
  }
  return [...sourceTypes];
}

function buildNutritionFoodPreviewForScreen(foodItem = {}, profile = {}) {
  const preview = buildNutritionFoodUnitPreview(foodItem, profile);
  const sourceTypes = getNutritionFoodSourceTypes(foodItem);
  return {
    ...preview,
    sourceTypes,
    isRecent: sourceTypes.includes("recent"),
    isFrequent: sourceTypes.includes("frequent"),
    isFavorite: sourceTypes.includes("favorites")
  };
}

function nutritionFoodMatchesListFilter(foodPreview = {}, selectedFilter = "all") {
  if (selectedFilter === "all") return true;
  return Array.isArray(foodPreview.sourceTypes) && foodPreview.sourceTypes.includes(selectedFilter);
}

export function filterNutritionFoodPreviews(foodPreviews = [], options = {}) {
  const selectedMode = normalizeNutritionScreenMode(options.selectedMode || options.mode || "calories");
  const selectedCategory = normalizeNutritionScreenCategory(options.selectedCategory || options.category || "all");
  const selectedFilter = normalizeNutritionListFilter(options.selectedFilter || options.filter || "all");

  return foodPreviews.filter((food) => {
    if (selectedMode === "palms" && !food.isPalmRuleFood) return false;
    if (selectedCategory !== "all" && food.category !== selectedCategory) return false;
    if (!nutritionFoodMatchesListFilter(food, selectedFilter)) return false;
    return true;
  });
}

export function buildNutritionScreensViewModel(source = {}, options = {}) {
  const goal = options.goal || source.goal || DEFAULT_NUTRITION_GOAL;
  const day = normalizeNutritionScreenDay(source, { ...options, goal });
  const summary = buildNutritionScreenSummary(day, { goal });
  const selectedMode = normalizeNutritionScreenMode(
    options.selectedMode || options.mode || source.selectedMode || source.mode || summary.trackingMode,
    summary.trackingMode
  );
  const selectedCategory = normalizeNutritionScreenCategory(options.selectedCategory || source.selectedCategory || "all");
  const selectedFilter = normalizeNutritionListFilter(options.selectedFilter || source.selectedFilter || "all");
  const foodPreviews = getNutritionScreenFoods(source, options)
    .map((food) => buildNutritionFoodPreviewForScreen(food, options.profile || source.profile || {}));
  const categorySource = selectedMode === "palms"
    ? foodPreviews.filter((food) => food.isPalmRuleFood)
    : foodPreviews;

  return {
    day,
    summary,
    goal,
    selectedMode,
    selectedModeLabel: NUTRITION_SCREEN_MODE_LABELS[selectedMode] || NUTRITION_SCREEN_MODE_LABELS.calories,
    selectedCategory,
    selectedFilter,
    modeTabs: buildNutritionModeTabs(selectedMode),
    categoryTabs: buildNutritionCategoryTabs(categorySource, selectedCategory),
    listFilterTabs: buildNutritionListFilterTabs(selectedFilter),
    foodPreviews,
    visibleFoodPreviews: filterNutritionFoodPreviews(foodPreviews, {
      selectedMode,
      selectedCategory,
      selectedFilter
    }),
    classicFoodsCount: foodPreviews.length,
    palmRuleFoodsCount: foodPreviews.filter((food) => food.isPalmRuleFood).length
  };
}
