import assert from "node:assert/strict";
import {
  NUTRITION_ENTRY_META_ID,
  buildFoodDraftEntryMeta,
  buildNutritionPayloadFromFood,
  calculateNutritionItemTotals,
  canUseVisualUnitForFood,
  createFoodUnitOption,
  createFoodUnitsConfig,
  formatFoodDefaultServing,
  getAllowedFoodUnits,
  getBodySizeFactor,
  getDefaultVisualUnit,
  getFoodDraftServingGrams,
  getFoodPalmKind,
  getFoodSearchText,
  getFoodUnitOption,
  getFoodUnitOptions,
  getNutritionEntryMeta,
  getPalmGramsForFood,
  getPalmRuleFoodUnit,
  getValidatedVisualUnitGrams,
  getVisualUnitAmountOptions,
  getVisualUnitGrams,
  gramsToPalmAmount,
  inferNutritionCategory,
  isPalmRuleFood,
  normalizeFoodKey,
  normalizeFoodUnitOptions,
  normalizeNutritionCategory,
  palmAmountToGrams,
  snapshotFoodFromPayload
} from "../src/features/nutrition/index.js";

const chicken = {
  key: "protein-chicken",
  name: "Куриная грудка",
  category: "Белковые продукты",
  calories_per_100: 165,
  protein_per_100: 31,
  fat_per_100: 3.6,
  carbs_per_100: 0,
  default_grams: 180,
  unit_options: normalizeFoodUnitOptions({}, 180),
  modifiers: []
};

const rice = {
  key: "carbs-rice",
  name: "Рис белый готовый",
  category: "Гарниры",
  calories_per_100: 130,
  protein_per_100: 2.7,
  fat_per_100: 0.3,
  carbs_per_100: 28,
  default_grams: 180,
  unit_options: normalizeFoodUnitOptions({}, 180)
};

const salad = {
  key: "veg-salad",
  name: "Овощной салат",
  category: "Овощи",
  calories_per_100: 55,
  protein_per_100: 1.5,
  fat_per_100: 3,
  carbs_per_100: 6,
  fiber_per_100: 2,
  default_grams: 220,
  unit_options: normalizeFoodUnitOptions({}, 220),
  modifiers: [{ id: "oil", label: "Масло", calories: 90, protein: 0, fat: 10, carbs: 0, fiber: 0 }]
};

const oil = {
  key: "fat-oil",
  name: "Оливковое масло",
  category: "Соусы",
  calories_per_100: 884,
  protein_per_100: 0,
  fat_per_100: 100,
  carbs_per_100: 0,
  default_grams: 10,
  unit_options: normalizeFoodUnitOptions({}, 10)
};

const burger = {
  key: "mixed-burger",
  name: "Бургер",
  category: "Фастфуд",
  calories_per_100: 260,
  protein_per_100: 13,
  fat_per_100: 13,
  carbs_per_100: 24,
  default_grams: 220,
  unit_options: normalizeFoodUnitOptions({}, 220)
};

assert.equal(NUTRITION_ENTRY_META_ID, "onlypump_nutrition_entry_meta");
assert.equal(normalizeFoodKey("Белковые продукты / Куриная грудка"), "белковые-продукты-куриная-грудка");
assert.equal(normalizeNutritionCategory("protein"), "protein");
assert.equal(normalizeNutritionCategory("unknown"), "other");
assert.equal(inferNutritionCategory(chicken), "protein");
assert.equal(inferNutritionCategory(rice), "carbs");
assert.equal(inferNutritionCategory(salad), "vegetables");
assert.equal(inferNutritionCategory(oil), "fats");
assert.equal(inferNutritionCategory(burger), "mixed");
assert.equal(inferNutritionCategory({ name: "Новый продукт", category: "Свое" }), "other");

assert.deepEqual(getAllowedFoodUnits(chicken).map((unit) => unit.id), ["palm", "gram", "serving"]);
assert.deepEqual(getAllowedFoodUnits({
  ...chicken,
  unit_options: createFoodUnitsConfig(createFoodUnitOption("piece", "Штуки", "шт", 60)).unitOptions
}).map((unit) => unit.id), ["palm", "gram", "serving", "piece"]);
assert.equal(getDefaultVisualUnit(chicken), "palm");
assert.equal(getDefaultVisualUnit(rice), "cupped_hand");
assert.equal(getDefaultVisualUnit(salad), "fist");
assert.equal(getDefaultVisualUnit(oil), "thumb");
assert.equal(getDefaultVisualUnit(burger), "serving");
assert.equal(getDefaultVisualUnit({ name: "Новый продукт", category: "Свое" }), "gram");
assert.equal(getPalmRuleFoodUnit(chicken).id, "palm");
assert.equal(getPalmRuleFoodUnit(rice).id, "cupped_hand");
assert.equal(getPalmRuleFoodUnit(salad).id, "fist");
assert.equal(getPalmRuleFoodUnit(oil).id, "thumb");
assert.equal(getPalmRuleFoodUnit(burger), null);
assert.equal(isPalmRuleFood(chicken), true);
assert.equal(isPalmRuleFood(burger), false);

assert.equal(getVisualUnitGrams(chicken, "palm", 1), 110);
assert.equal(getVisualUnitGrams(chicken, "palm", 1.5), 165);
assert.equal(getVisualUnitGrams(rice, "cupped_hand", 1), 90);
assert.equal(getVisualUnitGrams(salad, "fist", 2), 240);
assert.equal(getVisualUnitGrams(oil, "thumb", 1), 10);
assert.equal(getVisualUnitGrams(oil, "tbsp", 1), 15);
assert.equal(getVisualUnitGrams({ ...chicken, visual_unit_grams: { palm: 125 } }, "palm", 2), 250);
assert.equal(getValidatedVisualUnitGrams(chicken, "palm", 1.5), 165);
assert.equal(getValidatedVisualUnitGrams(burger, "palm", 1), null);
assert.equal(canUseVisualUnitForFood(burger, "palm"), false);
assert.deepEqual(getVisualUnitAmountOptions("palm"), [0.5, 1, 1.5, 2]);
assert.deepEqual(getVisualUnitAmountOptions("ml"), [100, 250, 330, 500]);

assert.equal(getBodySizeFactor({ sex: "female", height_cm: 162, weight_kg: 60 }), 1);
assert.equal(getBodySizeFactor({ sex: "male", height_cm: 175, weight_kg: 75 }), 1);
assert.equal(getBodySizeFactor({ sex: "male", height_cm: 220, weight_kg: 150 }), 1.25);
assert.equal(getBodySizeFactor({ sex: "female", height_cm: 130, weight_kg: 35 }), 0.8);
assert.equal(getFoodPalmKind(oil), "fat");
assert.equal(getFoodPalmKind(chicken), "protein");
assert.equal(getPalmGramsForFood(chicken, { sex: "male", height_cm: 175, weight_kg: 75 }), 110);
assert.equal(palmAmountToGrams(1.5, chicken), 165);
assert.equal(gramsToPalmAmount(165, chicken), 1.5);

assert.equal(formatFoodDefaultServing(chicken), "180 г");
assert.equal(formatFoodDefaultServing({
  ...chicken,
  default_unit: "piece",
  unit_options: createFoodUnitsConfig(createFoodUnitOption("piece", "Штуки", "шт", 60)).unitOptions
}), "1 шт");
assert.equal(getFoodUnitOption(oil, "tsp").grams, 5);
assert.equal(getFoodUnitOption(oil, "tbsp").grams, 15);
assert.equal(getFoodUnitOptions({ name: "Молоко", category: "Напитки", default_grams: 250 }).some((unit) => unit.id === "ml"), true);

const preciseDraft = {
  entryMode: "calories",
  food: chicken,
  unitId: "grams",
  unitAmount: 165,
  selectedModifierIds: []
};
assert.equal(getFoodDraftServingGrams(preciseDraft), 165);
const palmDraft = {
  entryMode: "palms",
  food: chicken,
  visualUnitId: "palm",
  palms: 1.5,
  selectedModifierIds: []
};
assert.equal(getFoodDraftServingGrams(palmDraft), 165);
assert.deepEqual(calculateNutritionItemTotals(chicken, 165), {
  calories: 272,
  protein: 51.2,
  fat: 5.9,
  carbs: 0,
  fiber: 0
});
assert.deepEqual(calculateNutritionItemTotals(salad, 220, ["oil"]), {
  calories: 211,
  protein: 3.3,
  fat: 16.6,
  carbs: 13.2,
  fiber: 4.4
});

const palmMeta = buildFoodDraftEntryMeta(palmDraft, { sex: "male", height_cm: 175, weight_kg: 75 });
assert.equal(palmMeta.entry_mode, "palms");
assert.equal(palmMeta.inputMode, "visual");
assert.equal(palmMeta.unit_id, "palm");
assert.equal(palmMeta.amount, 1.5);
assert.equal(palmMeta.grams, 165);
assert.equal(palmMeta.calories, 272);
assert.equal(palmMeta.protein, 51.2);
assert.equal(palmMeta.palm_kind, "protein");
assert.equal(palmMeta.palm_grams, 110);

const preciseMeta = buildFoodDraftEntryMeta(preciseDraft);
assert.equal(preciseMeta.entry_mode, "calories");
assert.equal(preciseMeta.inputMode, "precise");
assert.equal(preciseMeta.unit_id, "grams");
assert.equal(preciseMeta.amount, 165);
assert.equal(preciseMeta.grams, 165);

const payload = buildNutritionPayloadFromFood(chicken, palmMeta.grams, [], "notes", palmMeta);
assert.equal(payload.food_key, "protein-chicken");
assert.equal(payload.serving_grams, 165);
assert.equal(payload.calories_total, 272);
assert.equal(payload.protein_total, 51.2);
assert.equal(payload.notes, "notes");
assert.equal(payload.selected_modifiers.at(-1).id, NUTRITION_ENTRY_META_ID);
assert.equal(getNutritionEntryMeta(payload.selected_modifiers).visual_unit, "palm");

const snapshot = snapshotFoodFromPayload({
  ...payload,
  base_fiber_per_100: 0,
  selected_modifiers: payload.selected_modifiers
});
assert.equal(snapshot.key, "protein-chicken");
assert.equal(snapshot.name, "Куриная грудка");
assert.deepEqual(snapshot.defaultSelectedModifierIds, []);
assert.equal(snapshot.modifiers.length, 0);
assert.equal(snapshot.nutrition_category, "protein");
assert.equal(getFoodSearchText({ name: "Ёгурт", category: "Белковые", synonyms: ["protein"] }), "егурт белковые protein");

console.log("nutrition food checks passed");
