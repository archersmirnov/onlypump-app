import { normalizeNutritionDateKey } from "../cache/index.js";
import {
  DEFAULT_NUTRITION_GOAL,
  getNutritionFilledDateKeys,
  normalizeNutritionDay,
  nutritionDayHasFood
} from "../domain/index.js";

export const NUTRITION_REPOSITORY_ACTIONS = Object.freeze({
  load: "load",
  addItem: "add_item",
  updateItem: "update_item",
  deleteItem: "delete_item",
  copyRecentItem: "copy_recent_item",
  toggleFavorite: "toggle_favorite",
  saveManualDayTotals: "save_manual_day_totals"
});

export function requireNutritionApiCaller(callNutritionApi) {
  if (typeof callNutritionApi !== "function") {
    throw new TypeError("createNutritionRepository requires callNutritionApi");
  }
  return callNutritionApi;
}

export function resolveNutritionPayloadDateKey(input = {}, fallbackDateKey = "") {
  const source = typeof input === "string"
    ? input
    : input?.date || input?.nutrition_date || input?.nutritionDate || fallbackDateKey;
  return normalizeNutritionDateKey(source, "");
}

export function buildNutritionActionPayload(input = {}, fallbackDateKey = "", label = "nutrition request") {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const date = resolveNutritionPayloadDateKey(input, fallbackDateKey);
  if (!date) throw new Error(`date is required for ${label}`);
  return {
    ...source,
    date
  };
}

export function buildNutritionDeleteItemPayload(itemOrId, fallbackDateKey = "") {
  const source = itemOrId && typeof itemOrId === "object" ? itemOrId : {};
  const id = typeof itemOrId === "string"
    ? itemOrId
    : source.id || source.item_id || source.itemId || source.nutrition_item_id || source.nutritionItemId;
  if (!id) throw new Error("item id is required to delete nutrition item");
  return {
    ...buildNutritionActionPayload(source, fallbackDateKey, "delete nutrition item"),
    id,
    item_id: id
  };
}

export function isNutritionMutationResponseOk(result) {
  return Boolean(result) && result.ok !== false && result.success !== false && !result.error;
}

export function normalizeNutritionRepositoryResult(result = {}, dateKey = "", goal = DEFAULT_NUTRITION_GOAL) {
  const day = normalizeNutritionDay(result, dateKey, goal);
  const markedDateKeys = getNutritionFilledDateKeys(result, day.markedDateKeys || []);
  return {
    result,
    day,
    nutritionDay: day,
    markedDateKeys,
    hasFood: nutritionDayHasFood(day)
  };
}

export function createNutritionRepository({
  callNutritionApi,
  dateKey = "",
  goal = DEFAULT_NUTRITION_GOAL
} = {}) {
  const callApi = requireNutritionApiCaller(callNutritionApi);

  const call = (action, payload = {}) => callApi(action, payload);

  const runAndNormalize = async (action, input = {}, options = {}) => {
    const payload = buildNutritionActionPayload(input, options.dateKey || dateKey, `nutrition ${action}`);
    const result = await call(action, payload);
    const normalized = normalizeNutritionRepositoryResult(result, payload.date, options.goal || goal);
    return {
      payload,
      ...normalized,
      confirmed: isNutritionMutationResponseOk(result)
    };
  };

  return {
    call,

    async loadDay(input = {}, options = {}) {
      const payload = buildNutritionActionPayload(input, options.dateKey || dateKey, "load nutrition day");
      const result = await call(NUTRITION_REPOSITORY_ACTIONS.load, payload);
      return {
        payload,
        ...normalizeNutritionRepositoryResult(result, payload.date, options.goal || goal)
      };
    },

    async addItem(input = {}, options = {}) {
      return runAndNormalize(NUTRITION_REPOSITORY_ACTIONS.addItem, input, options);
    },

    async updateItem(input = {}, options = {}) {
      return runAndNormalize(NUTRITION_REPOSITORY_ACTIONS.updateItem, input, options);
    },

    async copyRecentItem(input = {}, options = {}) {
      return runAndNormalize(NUTRITION_REPOSITORY_ACTIONS.copyRecentItem, input, options);
    },

    async deleteItem(itemOrId, options = {}) {
      const payload = buildNutritionDeleteItemPayload(itemOrId, options.dateKey || dateKey);
      const result = await call(NUTRITION_REPOSITORY_ACTIONS.deleteItem, payload);
      const normalized = normalizeNutritionRepositoryResult(result, payload.date, options.goal || goal);
      return {
        payload,
        ...normalized,
        confirmed: isNutritionMutationResponseOk(result)
      };
    },

    async toggleFavorite(input = {}, options = {}) {
      return runAndNormalize(NUTRITION_REPOSITORY_ACTIONS.toggleFavorite, input, options);
    },

    async saveManualDayTotals(input = {}, options = {}) {
      return runAndNormalize(NUTRITION_REPOSITORY_ACTIONS.saveManualDayTotals, input, options);
    }
  };
}
