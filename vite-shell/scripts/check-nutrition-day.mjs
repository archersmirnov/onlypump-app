import assert from "node:assert/strict";
import {
  buildLocalNutritionDay,
  deriveHomeMealsFromNutritionDay,
  getNutritionDayTotalsFromMeals,
  normalizeNutritionDay,
  normalizeNutritionItem,
  normalizeNutritionMeal,
  nutritionDayHasFood
} from "../src/features/nutrition/index.js";

const rawDay = {
  nutrition_day: {
    id: "day-1",
    nutrition_date: "2026-07-01",
    calories_target: 2800,
    protein_target: 180,
    fat_target: 80,
    carbs_target: 320
  },
  nutrition_meals: [
    {
      id: "meal-1",
      meal_type: "breakfast",
      meal_title: "Завтрак",
      meal_order: 1,
      nutrition_items: [
        {
          id: "item-1",
          food_key: "protein-chicken",
          food_name: "Куриная грудка",
          food_category: "Белковые продукты",
          serving_grams: 165,
          calories_total: 272.25,
          protein_total: 51.15,
          fat_total: 5.94,
          carbs_total: 0,
          fiber_total: 0,
          item_order: 1
        },
        {
          id: "item-2",
          food_key: "carbs-rice",
          food_name: "Рис",
          food_category: "Гарниры",
          serving_grams: 180,
          calories_total: 234,
          protein_total: 4.86,
          fat_total: 0.54,
          carbs_total: 50.4,
          fiber_total: 1.8,
          item_order: 2
        }
      ]
    }
  ],
  favorites: [{ id: "fav-1", food_key: "protein-chicken", food_snapshot: { name: "Куриная грудка" } }],
  recent_foods: [{ food_key: "protein-chicken", food_name: "Куриная грудка", calories_total: 100 }],
  frequent_foods: [{ food_key: "carbs-rice", food_name: "Рис", calories_total: 120, use_count: 3 }],
  filled_dates: ["2026-07-01", "bad", "2026-07-01"]
};

const day = normalizeNutritionDay(rawDay, "2026-07-01");

assert.equal(day.id, "day-1");
assert.equal(day.date, "2026-07-01");
assert.equal(day.meals.length, 4);
assert.equal(day.meals[0].type, "breakfast");
assert.equal(day.meals[0].items.length, 2);
assert.deepEqual(day.totals, {
  calories: 506,
  protein: 56.1,
  fat: 6.4,
  carbs: 50.4,
  fiber: 1.8
});
assert.equal(day.favorites[0].foodKey, "protein-chicken");
assert.equal(day.recentFoods[0].foodName, "Куриная грудка");
assert.equal(day.frequentFoods[0].useCount, 3);
assert.deepEqual(day.markedDateKeys, ["2026-07-01"]);
assert.equal(nutritionDayHasFood(day), true);

const manualDay = normalizeNutritionDay({
  nutrition_day: {
    nutrition_date: "2026-07-02",
    manual_entry_enabled: true,
    manual_calories_total: 2200,
    manual_protein_total: 170,
    manual_fat_total: 70,
    manual_carbs_total: 240,
    manual_palm_units: JSON.stringify({ protein: 5.5, fat: 3, carbs: 6, vegetables: 2 })
  }
}, "2026-07-02");

assert.equal(manualDay.manualEntryEnabled, true);
assert.deepEqual(manualDay.totals, {
  calories: 2200,
  protein: 170,
  fat: 70,
  carbs: 240,
  fiber: 0
});
assert.deepEqual(manualDay.manual_palm_units, {
  protein: 5.5,
  fat: 3,
  carbs: 6,
  vegetables: 2
});
assert.equal(nutritionDayHasFood(manualDay), true);

const normalizedItem = normalizeNutritionItem({
  food_name: "Овощной салат",
  calories_total: 55,
  protein_total: 1.5,
  fat_total: 3,
  carbs_total: 6,
  selected_modifiers: [{ id: "__nutrition_entry_meta__", entry_meta: { fiber: 2.4 } }]
});
assert.equal(normalizedItem.foodName, "Овощной салат");
assert.equal(normalizedItem.fiber, 2.4);

const normalizedMeal = normalizeNutritionMeal({
  meal_type: "snack",
  nutrition_items: [
    { food_name: "Яблоко", calories_total: 52, item_order: 2 },
    { food_name: "Творог", calories_total: 121, item_order: 1 }
  ]
});
assert.deepEqual(normalizedMeal.items.map((item) => item.foodName), ["Творог", "Яблоко"]);
assert.equal(normalizedMeal.calories, 173);

assert.deepEqual(getNutritionDayTotalsFromMeals([normalizedMeal]), {
  calories: 173,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0
});

const localDay = buildLocalNutritionDay("2026-07-03", {
  calories: 2500,
  protein: 160,
  fat: 70,
  carbs: 300
});
assert.equal(localDay.date, "2026-07-03");
assert.equal(localDay.goal.calories, 2500);
assert.equal(localDay.meals.length, 4);
assert.equal(nutritionDayHasFood(localDay), false);

assert.deepEqual(deriveHomeMealsFromNutritionDay(day)[0], {
  id: "meal-1",
  name: "Завтрак",
  food: "Куриная грудка, Рис",
  calories: 506,
  protein: 56.1,
  fat: 6.4,
  carbs: 50.4,
  fiber: 1.8
});

console.log("nutrition day checks passed");
