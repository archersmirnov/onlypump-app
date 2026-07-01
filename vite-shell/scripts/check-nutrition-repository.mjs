import assert from "node:assert/strict";
import {
  buildNutritionActionPayload,
  buildNutritionDeleteItemPayload,
  createNutritionRepository,
  isNutritionMutationResponseOk,
  normalizeNutritionRepositoryResult,
  NUTRITION_REPOSITORY_ACTIONS,
  requireNutritionApiCaller,
  resolveNutritionPayloadDateKey
} from "../src/features/nutrition/index.js";

assert.equal(NUTRITION_REPOSITORY_ACTIONS.load, "load");
assert.equal(NUTRITION_REPOSITORY_ACTIONS.addItem, "add_item");
assert.equal(NUTRITION_REPOSITORY_ACTIONS.updateItem, "update_item");
assert.equal(NUTRITION_REPOSITORY_ACTIONS.deleteItem, "delete_item");
assert.equal(NUTRITION_REPOSITORY_ACTIONS.copyRecentItem, "copy_recent_item");
assert.equal(NUTRITION_REPOSITORY_ACTIONS.toggleFavorite, "toggle_favorite");
assert.equal(NUTRITION_REPOSITORY_ACTIONS.saveManualDayTotals, "save_manual_day_totals");

assert.throws(() => requireNutritionApiCaller(null), /requires callNutritionApi/);
assert.equal(resolveNutritionPayloadDateKey({ date: "2026-07-01" }), "2026-07-01");
assert.equal(resolveNutritionPayloadDateKey({ nutrition_date: "2026-07-02T00:00:00Z" }), "2026-07-02");
assert.equal(resolveNutritionPayloadDateKey({}, "2026-07-03"), "2026-07-03");
assert.equal(resolveNutritionPayloadDateKey("2026-07-04"), "2026-07-04");
assert.deepEqual(buildNutritionActionPayload({ meal_type: "breakfast" }, "2026-07-01", "add food"), {
  meal_type: "breakfast",
  date: "2026-07-01"
});
assert.throws(() => buildNutritionActionPayload({}, "", "add food"), /date is required for add food/);
assert.deepEqual(buildNutritionDeleteItemPayload({ id: "item-1", date: "2026-07-01" }), {
  id: "item-1",
  date: "2026-07-01",
  item_id: "item-1"
});
assert.deepEqual(buildNutritionDeleteItemPayload("item-2", "2026-07-01"), {
  date: "2026-07-01",
  id: "item-2",
  item_id: "item-2"
});
assert.throws(() => buildNutritionDeleteItemPayload({ date: "2026-07-01" }), /item id is required/);
assert.equal(isNutritionMutationResponseOk({ ok: true }), true);
assert.equal(isNutritionMutationResponseOk({ success: false }), false);
assert.equal(isNutritionMutationResponseOk({ error: "bad" }), false);

const normalized = normalizeNutritionRepositoryResult({
  nutrition_day: {
    nutrition_date: "2026-07-01",
    calories_total: 500,
    protein_total: 40,
    fat_total: 10,
    carbs_total: 60
  },
  filled_dates: ["2026-07-01", "bad"]
}, "2026-07-01");
assert.equal(normalized.day.date, "2026-07-01");
assert.equal(normalized.nutritionDay.totals.calories, 500);
assert.deepEqual(normalized.markedDateKeys, ["2026-07-01"]);
assert.equal(normalized.hasFood, false);

const calls = [];
const callNutritionApi = async (action, payload) => {
  calls.push({ action, payload });
  if (action === "load") {
    return {
      nutrition_day: {
        id: "day-1",
        nutrition_date: payload.date,
        calories_total: 506,
        protein_total: 56.1,
        fat_total: 6.4,
        carbs_total: 50.4
      },
      nutrition_meals: [{
        id: "meal-1",
        meal_type: "breakfast",
        meal_title: "Завтрак",
        nutrition_items: [{
          id: "item-1",
          food_key: "protein-chicken",
          food_name: "Куриная грудка",
          calories_total: 506,
          protein_total: 56.1,
          fat_total: 6.4,
          carbs_total: 50.4
        }]
      }],
      filled_dates: [payload.date]
    };
  }
  if (action === "delete_item") {
    return {
      ok: true,
      nutrition_day: {
        nutrition_date: payload.date
      },
      nutrition_meals: []
    };
  }
  return {
    ok: true,
    nutrition_day: {
      nutrition_date: payload.date,
      manual_entry_enabled: true,
      manual_calories_total: payload.manual_calories_total || 0,
      manual_protein_total: payload.manual_protein_total || 0,
      manual_fat_total: payload.manual_fat_total || 0,
      manual_carbs_total: payload.manual_carbs_total || 0
    }
  };
};

const repository = createNutritionRepository({
  callNutritionApi,
  dateKey: "2026-07-01"
});

const loaded = await repository.loadDay();
assert.equal(calls[0].action, "load");
assert.deepEqual(calls[0].payload, { date: "2026-07-01" });
assert.equal(loaded.day.id, "day-1");
assert.equal(loaded.day.meals[0].items[0].foodName, "Куриная грудка");
assert.equal(loaded.hasFood, true);

const manual = await repository.saveManualDayTotals({
  manual_calories_total: 2200,
  manual_protein_total: 170,
  manual_fat_total: 70,
  manual_carbs_total: 240
});
assert.equal(calls[1].action, "save_manual_day_totals");
assert.equal(calls[1].payload.date, "2026-07-01");
assert.equal(manual.confirmed, true);
assert.equal(manual.day.totals.calories, 2200);

const added = await repository.addItem({
  date: "2026-07-02",
  meal_type: "breakfast",
  item: { food_name: "Рис" }
});
assert.equal(calls[2].action, "add_item");
assert.equal(calls[2].payload.date, "2026-07-02");
assert.equal(added.confirmed, true);

const updated = await repository.updateItem({
  date: "2026-07-03",
  id: "item-1",
  item: { food_name: "Рис" }
});
assert.equal(calls[3].action, "update_item");
assert.equal(calls[3].payload.id, "item-1");
assert.equal(updated.confirmed, true);

const copied = await repository.copyRecentItem({
  date: "2026-07-04",
  id: "item-1",
  meal_type: "snack"
});
assert.equal(calls[4].action, "copy_recent_item");
assert.equal(copied.payload.meal_type, "snack");

const deleted = await repository.deleteItem({ id: "item-1" });
assert.equal(calls[5].action, "delete_item");
assert.deepEqual(calls[5].payload, { id: "item-1", date: "2026-07-01", item_id: "item-1" });
assert.equal(deleted.confirmed, true);
assert.equal(deleted.hasFood, false);

const favorite = await repository.toggleFavorite({
  food_key: "protein-chicken",
  food_snapshot: { name: "Куриная грудка" }
});
assert.equal(calls[6].action, "toggle_favorite");
assert.equal(favorite.payload.food_key, "protein-chicken");
assert.equal(favorite.confirmed, true);

console.log("nutrition repository checks passed");
