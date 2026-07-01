import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildNutritionFoodUnitPreview,
  buildNutritionScreenSummary,
  buildNutritionScreensViewModel,
  filterNutritionFoodPreviews,
  normalizeNutritionDay
} from "../src/features/nutrition/domain/index.js";

const routesSource = await readFile(new URL("../src/app/previewRoutes.jsx", import.meta.url), "utf8");
const nutritionIndexSource = await readFile(new URL("../src/features/nutrition/index.js", import.meta.url), "utf8");
const nutritionDomainIndexSource = await readFile(new URL("../src/features/nutrition/domain/index.js", import.meta.url), "utf8");
const previewSource = await readFile(new URL("../src/features/nutrition/ui/NutritionScreensPreview.jsx", import.meta.url), "utf8");

const goal = {
  calories: 2000,
  protein: 150,
  fat: 70,
  carbs: 220,
  fiber: 25
};

const day = normalizeNutritionDay({
  nutrition_day: {
    nutrition_date: "2026-07-01",
    calories_target: goal.calories,
    protein_target: goal.protein,
    fat_target: goal.fat,
    carbs_target: goal.carbs
  },
  nutrition_meals: [
    {
      meal_type: "breakfast",
      meal_title: "Завтрак",
      meal_order: 1,
      nutrition_items: [
        {
          food_key: "eggs",
          food_name: "Яйца",
          food_category: "Белковые продукты",
          nutrition_category: "protein",
          calories_total: 150,
          protein_total: 13,
          fat_total: 10,
          carbs_total: 1,
          item_order: 1
        }
      ]
    },
    {
      meal_type: "lunch",
      meal_title: "Обед",
      meal_order: 2,
      nutrition_items: [
        {
          food_key: "rice",
          food_name: "Рис",
          food_category: "Крупы",
          nutrition_category: "carbs",
          calories_total: 270,
          protein_total: 5,
          fat_total: 1,
          carbs_total: 58,
          fiber_total: 2,
          item_order: 1
        }
      ]
    }
  ]
}, "2026-07-01", goal);

const summary = buildNutritionScreenSummary(day, { goal });

assert.equal(summary.date, "2026-07-01");
assert.equal(summary.totals.calories, 420);
assert.equal(summary.totals.protein, 18);
assert.equal(summary.foodItemsCount, 2);
assert.equal(summary.filledMealsCount, 2);
assert.equal(summary.mealRows.length, 4);
assert.equal(summary.mealRows[0].title, "Завтрак");
assert.equal(summary.mealRows[0].subtitle, "Яйца");
assert.equal(summary.mealRows[2].subtitle, "ничего не добавлено");
assert.equal(summary.caloriesProgress, 21);
assert.equal(summary.remainingCalories, 1580);
assert.equal(summary.macroRows.find((row) => row.key === "protein").progress, 12);
assert.equal(summary.trackingModeLabel, "Классика");

const chicken = buildNutritionFoodUnitPreview({
  key: "chicken",
  name: "Куриная грудка",
  nutrition_category: "protein",
  default_grams: 110
});
const rice = buildNutritionFoodUnitPreview({
  key: "rice",
  name: "Рис",
  nutrition_category: "carbs",
  default_grams: 90
});
const oil = buildNutritionFoodUnitPreview({
  key: "oil",
  name: "Оливковое масло",
  nutrition_category: "fats",
  default_grams: 10
});
const burger = buildNutritionFoodUnitPreview({
  key: "burger",
  name: "Бургер",
  nutrition_category: "mixed",
  default_grams: 220
});
const unknown = buildNutritionFoodUnitPreview({
  key: "unknown",
  name: "Неизвестный продукт"
});

assert.equal(chicken.defaultVisualUnit, "palm");
assert.equal(rice.defaultVisualUnit, "cupped_hand");
assert.equal(oil.defaultVisualUnit, "thumb");
assert.equal(burger.defaultVisualUnit, "serving");
assert.equal(unknown.defaultVisualUnit, "gram");
assert.ok(!burger.unitRows.some((row) => row.id === "palm"));
assert.ok(!unknown.unitRows.some((row) => row.id === "palm"));

const screenModel = buildNutritionScreensViewModel({
  day,
  foods: [
    { key: "chicken", name: "Куриная грудка", nutrition_category: "protein", default_grams: 110, isRecent: true },
    { key: "rice", name: "Рис", nutrition_category: "carbs", default_grams: 90, use_count: 5 },
    { key: "salad", name: "Овощной салат", nutrition_category: "vegetables", default_grams: 120, favorite_id: "fav-1" },
    { key: "oil", name: "Оливковое масло", nutrition_category: "fats", default_grams: 10 },
    { key: "burger", name: "Бургер", nutrition_category: "mixed", default_grams: 220 },
    { key: "unknown", name: "Неизвестный продукт" }
  ]
}, { goal });

assert.equal(screenModel.selectedMode, "calories");
assert.equal(screenModel.selectedModeLabel, "Классика");
assert.equal(screenModel.summary.foodItemsCount, 2);
assert.equal(screenModel.visibleFoodPreviews.length, 6);
assert.equal(screenModel.palmRuleFoodsCount, 4);
assert.equal(screenModel.modeTabs.find((tab) => tab.id === "calories").isActive, true);
assert.equal(screenModel.listFilterTabs.find((tab) => tab.id === "all").isActive, true);
assert.equal(screenModel.categoryTabs.find((tab) => tab.id === "protein").count, 1);

const palmScreenModel = buildNutritionScreensViewModel({
  day,
  foods: screenModel.foodPreviews
}, {
  goal,
  selectedMode: "palm_rule",
  selectedCategory: "protein"
});
assert.equal(palmScreenModel.selectedMode, "palms");
assert.equal(palmScreenModel.selectedModeLabel, "Правило ладони");
assert.deepEqual(palmScreenModel.visibleFoodPreviews.map((food) => food.key), ["chicken"]);
assert.ok(!palmScreenModel.visibleFoodPreviews.some((food) => food.defaultVisualUnit === "serving"));
assert.deepEqual(
  filterNutritionFoodPreviews(screenModel.foodPreviews, { selectedMode: "palms", selectedFilter: "favorites" }).map((food) => food.key),
  ["salad"]
);

assert.match(nutritionDomainIndexSource, /nutritionScreenModel\.js/);
assert.doesNotMatch(nutritionIndexSource, /ui\/index\.js/);
assert.match(previewSource, /buildNutritionScreensViewModel/);
assert.match(routesSource, /import \{ NutritionScreensPreview \} from "\.\.\/features\/nutrition\/ui\/index\.js"/);
assert.match(routesSource, /id: "nutrition"/);
assert.match(routesSource, /<NutritionScreensPreview/);

console.log("nutrition screens checks passed");
