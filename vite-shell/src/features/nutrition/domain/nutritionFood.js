import {
  NUTRITION_ENTRY_META_ID,
  getNutritionEntryMeta,
  normalizeNutritionTrackingMode,
  roundNutritionCalories,
  roundNutritionMacro
} from "./nutritionDay.js";

export const DEFAULT_FOOD_UNIT_OPTION = Object.freeze({
  id: "grams",
  label: "Граммы",
  unitLabel: "г",
  grams: 1,
  amountStep: 10,
  inputLabel: "граммы"
});

export const NUTRITION_VISUAL_UNITS = Object.freeze({
  palm: { id: "palm", label: "Ладонь", unitLabel: "лад.", amounts: [0.5, 1, 1.5, 2] },
  cupped_hand: { id: "cupped_hand", label: "Пригоршня", unitLabel: "приг.", amounts: [0.5, 1, 1.5, 2] },
  fist: { id: "fist", label: "Кулак", unitLabel: "кул.", amounts: [0.5, 1, 2] },
  thumb: { id: "thumb", label: "Большой палец", unitLabel: "пал.", amounts: [0.5, 1, 1.5, 2] },
  gram: { id: "gram", label: "Граммы", unitLabel: "г" },
  ml: { id: "ml", label: "Миллилитры", unitLabel: "мл" },
  piece: { id: "piece", label: "Штуки", unitLabel: "шт" },
  serving: { id: "serving", label: "Порция", unitLabel: "порц.", amounts: [0.5, 1, 1.5] },
  tsp: { id: "tsp", label: "Чайная ложка", unitLabel: "ч.л." },
  tbsp: { id: "tbsp", label: "Столовая ложка", unitLabel: "ст.л." },
  cup: { id: "cup", label: "Чашка", unitLabel: "чаш." },
  half_cup: { id: "half_cup", label: "Половина чашки", unitLabel: "1/2 чаш." },
  glass: { id: "glass", label: "Стакан", unitLabel: "стак." }
});

export const NUTRITION_CATEGORY_ALLOWED_UNITS = Object.freeze({
  protein: ["palm", "gram", "serving", "piece"],
  carbs: ["cupped_hand", "gram", "serving", "piece"],
  vegetables: ["fist", "gram", "serving", "piece"],
  fats: ["thumb", "tsp", "tbsp", "gram", "serving"],
  drinks: ["ml", "cup", "half_cup", "glass", "serving"],
  mixed: ["serving", "gram"],
  other: ["gram", "serving", "piece"]
});

export const NUTRITION_DEFAULT_VISUAL_UNIT_BY_CATEGORY = Object.freeze({
  protein: "palm",
  carbs: "cupped_hand",
  vegetables: "fist",
  fats: "thumb",
  drinks: "ml",
  mixed: "serving",
  other: "gram"
});

export const NUTRITION_VISUAL_UNIT_FALLBACK_GRAMS = Object.freeze({
  palm: 110,
  cupped_hand: 90,
  fist: 120,
  thumb: 10,
  cup: 250,
  half_cup: 125,
  glass: 250,
  tsp: 5,
  tbsp: 15,
  serving: 100
});

export const PALM_RULE_CATEGORY_IDS = Object.freeze(["protein", "carbs", "fats", "vegetables"]);
export const PALM_RULE_VISUAL_UNIT_IDS = Object.freeze(["palm", "cupped_hand", "fist", "thumb"]);

const PALM_RULE_CATEGORY_SET = new Set(PALM_RULE_CATEGORY_IDS);
const PALM_RULE_VISUAL_UNIT_SET = new Set(PALM_RULE_VISUAL_UNIT_IDS);

export function normalizeFoodKey(name = "") {
  return String(name || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

export function createFoodUnitOption(id, label, unitLabel, grams, amountStep = 1) {
  return {
    id,
    label,
    unitLabel,
    grams,
    amountStep,
    inputLabel: String(label || "").toLowerCase()
  };
}

export function createFoodUnitsConfig(...units) {
  return {
    unitOptions: [DEFAULT_FOOD_UNIT_OPTION, ...units],
    defaultUnit: units[0]?.id || "grams"
  };
}

export function normalizeNutritionCategory(category = "") {
  const normalized = String(category || "").trim().toLowerCase();
  return NUTRITION_CATEGORY_ALLOWED_UNITS[normalized] ? normalized : "other";
}

export function inferNutritionCategory(foodItem = {}) {
  if (foodItem.nutrition_category || foodItem.nutritionCategory) {
    return normalizeNutritionCategory(foodItem.nutrition_category || foodItem.nutritionCategory);
  }

  const name = String(foodItem.name || foodItem.food_name || foodItem.foodName || "").toLowerCase();
  const category = String(foodItem.category || foodItem.food_category || foodItem.foodCategory || "").toLowerCase();
  const text = `${category} ${name}`;

  if (/бургер|чизбургер|биг мак|шаурм|кебаб|хот-дог|наггетс|тако|пицц|ролл|суши|поке|боул|завтрак|сырник|круассан|авокадо-тост|блин|панкейк|паста с соусом|паста карбонара|паста болоньезе|плов|рамен|цезарь|греческий салат/.test(text)) return "mixed";
  if (/суп|том-ям|борщ|солянк|капучино|латте|американо|напит|(^|\s)кола|coca cola|cola|сок|смузи|шейк|энергетик|кефир|айран|молоко|питьевой йогурт|йогурт питьевой|чай/.test(text)) return "drinks";
  if (/масло|майонез|соус|орех|миндаль|фисташ|семеч|семен|паста арахис|арахисовая паста|нутел|авокадо|сыр твердый|легкий сыр|моцарелла|сыр\b/.test(text)) return "fats";
  if (/овощ|огурц|помид|томат|брокколи|салат листовой|овощной салат|капуст|зелень|клубник|черник|ягод|морковь/.test(text)) return "vegetables";
  if (/белков|куриц|курин|крылышк|индей|говя|рыб|тунец|лосось|кревет|кальмар|морепродукт|творог|йогурт|яйц|омлет|тофу|свинин|стейк|фарш|колбас|сосиск|котлет/.test(text)) return "protein";
  if (/гарнир|круп|рис|гречк|греча|макарон|овсян|геркулес|хлеб|лаваш|хлебц|картоф|пюре|булгур|киноа|перлов|пшено|кускус|манка|кукурузная крупа|лапша|фрукт|банан|яблок|апельсин|манго|арбуз|виноград|груша|ананас|слад|шоколад|печенье|торт|чизкейк|морожен|джем|варенье|сироп|гранола|попкорн|чипс|буэно/.test(text)) return "carbs";

  return "other";
}

export function normalizeFoodUnitOptions(options = {}, defaultGrams = 100) {
  const source = Array.isArray(options.unitOptions || options.unit_options)
    ? (options.unitOptions || options.unit_options)
    : [];
  const merged = source.length ? source : [DEFAULT_FOOD_UNIT_OPTION];
  const hasGrams = merged.some((unit) => unit.id === "grams");

  return (hasGrams ? merged : [DEFAULT_FOOD_UNIT_OPTION, ...merged]).map((unit) => ({
    ...unit,
    grams: unit.id === "grams" ? 1 : Math.max(1, Number(unit.grams || defaultGrams || 100)),
    amountStep: Math.max(0.1, Number(unit.amountStep || unit.step || (unit.id === "grams" ? 10 : 1))),
    unitLabel: unit.unitLabel || (unit.id === "grams" ? "г" : "шт")
  }));
}

export function hasFoodUnitOption(foodItem = {}, unitId = "") {
  return normalizeFoodUnitOptions(
    { unitOptions: foodItem.unit_options || foodItem.unitOptions },
    foodItem.default_grams
  ).some((unit) => unit.id === unitId);
}

export function getAllowedFoodUnits(foodItem = {}) {
  const category = inferNutritionCategory(foodItem);
  const unitIds = foodItem.allowed_visual_units ||
    foodItem.allowedVisualUnits ||
    NUTRITION_CATEGORY_ALLOWED_UNITS[category] ||
    NUTRITION_CATEGORY_ALLOWED_UNITS.other;

  return unitIds
    .filter((unitId) => unitId !== "piece" || hasFoodUnitOption(foodItem, "piece"))
    .map((unitId) => NUTRITION_VISUAL_UNITS[unitId])
    .filter(Boolean);
}

export function getDefaultVisualUnit(foodItem = {}) {
  const allowedUnits = getAllowedFoodUnits(foodItem);
  const allowedIds = allowedUnits.map((unit) => unit.id);
  const configuredUnit = foodItem.default_visual_unit || foodItem.defaultVisualUnit;
  if (configuredUnit && allowedIds.includes(configuredUnit)) return configuredUnit;
  const categoryDefault = NUTRITION_DEFAULT_VISUAL_UNIT_BY_CATEGORY[inferNutritionCategory(foodItem)] || "gram";
  return allowedIds.includes(categoryDefault) ? categoryDefault : (allowedIds[0] || "gram");
}

export function getPalmRuleFoodUnit(foodItem = {}) {
  const category = inferNutritionCategory(foodItem);
  if (!PALM_RULE_CATEGORY_SET.has(category)) return null;
  const unitId = NUTRITION_DEFAULT_VISUAL_UNIT_BY_CATEGORY[category];
  return NUTRITION_VISUAL_UNITS[unitId] || null;
}

export function getPalmRuleFoodUnits(foodItem = {}) {
  const unit = getPalmRuleFoodUnit(foodItem);
  return unit ? [unit] : [];
}

export function isPalmRuleFood(foodItem = {}) {
  return PALM_RULE_CATEGORY_SET.has(inferNutritionCategory(foodItem));
}

export function getBodySizeFactor(profile = {}) {
  const sex = (profile.sex || profile.gender || "male") === "female" ? "female" : "male";
  const heightCm = Number(profile.height_cm || profile.heightCm || 175);
  const weightKg = Number(profile.weight_kg || profile.weightKg || 75);
  const referenceHeight = sex === "female" ? 162 : 175;
  const referenceWeight = sex === "female" ? 60 : 75;
  const heightFactor = heightCm / referenceHeight;
  const weightFactor = Math.sqrt(weightKg / referenceWeight);
  const rawFactor = heightFactor * 0.75 + weightFactor * 0.25;
  return Math.min(1.25, Math.max(0.8, rawFactor));
}

export function getVisualUnitGrams(foodItem = {}, unitId = "gram", amount = 1, profile = {}) {
  const numericAmount = Math.max(0, Number(amount || 0));
  const normalizedUnitId = unitId === "grams" ? "gram" : unitId;
  const visualUnitGrams = foodItem.visualUnitGrams || foodItem.visual_unit_grams || {};
  const productUnitGrams = Number(visualUnitGrams[normalizedUnitId]);
  if (Number.isFinite(productUnitGrams) && productUnitGrams > 0) return Math.round(numericAmount * productUnitGrams);
  if (normalizedUnitId === "gram") return numericAmount;
  if (normalizedUnitId === "ml") return numericAmount;
  if (normalizedUnitId === "piece") {
    const pieceUnit = normalizeFoodUnitOptions(
      { unitOptions: foodItem.unit_options || foodItem.unitOptions },
      foodItem.default_grams
    ).find((unit) => unit.id === "piece");
    return Math.round(numericAmount * Math.max(1, Number(pieceUnit?.grams || foodItem.default_grams || 100)));
  }
  if (normalizedUnitId === "serving") {
    return Math.round(numericAmount * Math.max(1, Number(foodItem.default_grams || NUTRITION_VISUAL_UNIT_FALLBACK_GRAMS.serving)));
  }
  const fallbackGrams = Math.max(1, Number(NUTRITION_VISUAL_UNIT_FALLBACK_GRAMS[normalizedUnitId] || foodItem.default_grams || 100));
  const bodyFactor = PALM_RULE_VISUAL_UNIT_SET.has(normalizedUnitId) ? getBodySizeFactor(profile) : 1;
  return Math.round(numericAmount * fallbackGrams * bodyFactor);
}

export function canUseVisualUnitForFood(foodItem = {}, unitId = "") {
  return getAllowedFoodUnits(foodItem).some((unit) => unit.id === unitId);
}

export function getValidatedVisualUnitGrams(foodItem = {}, unitId = "gram", amount = 1, profile = {}) {
  const normalizedUnitId = unitId === "grams" ? "gram" : unitId;
  if (!canUseVisualUnitForFood(foodItem, normalizedUnitId)) return null;
  const grams = getVisualUnitGrams(foodItem, normalizedUnitId, amount, profile);
  return Number.isFinite(Number(grams)) && Number(grams) > 0 ? Number(grams) : null;
}

export function getVisualUnitAmountOptions(unitId = "") {
  const unit = NUTRITION_VISUAL_UNITS[unitId];
  if (unit?.amounts?.length) return unit.amounts;
  if (unitId === "gram") return [50, 100, 150, 200];
  if (unitId === "ml") return [100, 250, 330, 500];
  if (unitId === "tsp" || unitId === "tbsp") return [1, 2, 3];
  if (unitId === "piece") return [1, 2, 3];
  if (unitId === "cup" || unitId === "half_cup" || unitId === "glass") return [1, 2];
  return [1];
}

export function getPalmGramConfig(profile = {}) {
  const factor = getBodySizeFactor(profile);
  const scale = (base) => Math.max(5, Math.round(base * factor));
  return {
    protein: scale(110),
    carbs: scale(90),
    fat: scale(10),
    vegetables: scale(120),
    mixed: scale(100)
  };
}

export function getFoodPalmKind(foodItem = {}) {
  if (foodItem.palm_kind) return foodItem.palm_kind;
  const category = inferNutritionCategory(foodItem);
  if (category === "fats") return "fat";
  if (category === "protein" || category === "carbs" || category === "vegetables") return category;
  return "mixed";
}

export function getPalmGramsForFood(foodItem = {}, profile = {}) {
  const config = getPalmGramConfig(profile);
  return config[getFoodPalmKind(foodItem)] || config.mixed;
}

export function gramsToPalmAmount(grams = 0, foodItem = {}, profile = {}) {
  return roundNutritionMacro(Number(grams || 0) / Math.max(1, getPalmGramsForFood(foodItem, profile)));
}

export function palmAmountToGrams(amount = 0, foodItem = {}, profile = {}) {
  return Math.max(0, Math.round(Number(amount || 0) * getPalmGramsForFood(foodItem, profile)));
}

export function buildNutritionEntryMetaModifier(meta = {}) {
  return {
    id: NUTRITION_ENTRY_META_ID,
    label: "Единица ввода",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    entry_meta: meta
  };
}

export function getFoodUnitOptions(foodItem = {}) {
  const baseUnits = normalizeFoodUnitOptions(
    { unitOptions: foodItem.unit_options || foodItem.unitOptions },
    foodItem.default_grams
  );
  const category = inferNutritionCategory(foodItem);
  const extras = [createFoodUnitOption("serving", "Порции", "порц.", Math.max(1, Number(foodItem.default_grams || 100)))];

  if (category === "drinks") {
    extras.push(
      createFoodUnitOption("ml", "Миллилитры", "мл", 1, 50),
      createFoodUnitOption("cup", "Чашка", "чаш.", 250),
      createFoodUnitOption("glass", "Стакан", "стак.", 250)
    );
  }

  if (category === "fats" || /соус|масло|майонез|паста|сироп|джем|варенье/i.test(`${foodItem.category || ""} ${foodItem.name || ""}`)) {
    extras.push(
      createFoodUnitOption("tsp", "Чайные ложки", "ч.л.", 5),
      createFoodUnitOption("tbsp", "Столовые ложки", "ст.л.", 15)
    );
  }

  const seen = new Set();
  return [...baseUnits, ...extras].filter((unit) => {
    if (seen.has(unit.id)) return false;
    seen.add(unit.id);
    return true;
  });
}

export function getFoodUnitOption(foodItem = {}, unitId = "grams") {
  return getFoodUnitOptions(foodItem).find((unit) => unit.id === unitId) || DEFAULT_FOOD_UNIT_OPTION;
}

export function formatFoodDefaultServing(foodItem = {}) {
  const option = getFoodUnitOption(foodItem, foodItem.default_unit || "grams");
  if (option.id === "grams") return `${foodItem.default_grams || 100} г`;
  return `1 ${option.unitLabel}`;
}

export function getFoodDraftServingGrams(draft = {}, profile = {}) {
  if (draft.entryMode === "palms") {
    return getValidatedVisualUnitGrams(
      draft.food,
      draft.visualUnitId || getDefaultVisualUnit(draft.food),
      draft.palms,
      profile
    ) || 0;
  }
  const unit = getFoodUnitOption(draft.food, draft.unitId || "grams");
  const amount = Math.max(0, Number(draft.unitAmount ?? draft.grams ?? 0));
  return unit.id === "grams" ? amount : Math.round(amount * unit.grams);
}

export function calculateNutritionItemTotals(foodItem = {}, grams = foodItem?.default_grams || 100, selectedModifierIds = []) {
  const ratio = Math.max(0, Number(grams || 0)) / 100;
  const selected = new Set(selectedModifierIds || []);
  const modifierTotals = (foodItem?.modifiers || [])
    .filter((modifier) => selected.has(modifier.id))
    .reduce((acc, modifier) => ({
      calories: acc.calories + Number(modifier.calories || 0),
      protein: acc.protein + Number(modifier.protein || 0),
      fat: acc.fat + Number(modifier.fat || 0),
      carbs: acc.carbs + Number(modifier.carbs || 0),
      fiber: acc.fiber + Number(modifier.fiber || 0)
    }), { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 });

  return {
    calories: Math.max(0, roundNutritionCalories(Number(foodItem?.calories_per_100 || 0) * ratio + modifierTotals.calories)),
    protein: Math.max(0, roundNutritionMacro(Number(foodItem?.protein_per_100 || 0) * ratio + modifierTotals.protein)),
    fat: Math.max(0, roundNutritionMacro(Number(foodItem?.fat_per_100 || 0) * ratio + modifierTotals.fat)),
    carbs: Math.max(0, roundNutritionMacro(Number(foodItem?.carbs_per_100 || 0) * ratio + modifierTotals.carbs)),
    fiber: Math.max(0, roundNutritionMacro(Number(foodItem?.fiber_per_100 || foodItem?.fiberPer100 || 0) * ratio + modifierTotals.fiber))
  };
}

export function buildFoodDraftEntryMeta(draft = {}, profile = {}, totals = null) {
  const grams = getFoodDraftServingGrams(draft, profile);
  const unit = getFoodUnitOption(draft.food, draft.unitId || "grams");
  const amount = draft.entryMode === "palms"
    ? Math.max(0, Number(draft.palms || 0))
    : Math.max(0, Number(draft.unitAmount ?? grams));
  const visualUnitId = draft.visualUnitId || getDefaultVisualUnit(draft.food);
  const visualUnit = NUTRITION_VISUAL_UNITS[visualUnitId] || NUTRITION_VISUAL_UNITS.gram;
  const inputMode = draft.entryMode === "palms" ? "visual" : "precise";
  const macroTotals = totals || calculateNutritionItemTotals(draft.food, grams, draft.selectedModifierIds || []);

  return {
    entry_mode: draft.entryMode === "palms" ? "palms" : "calories",
    inputMode,
    input_mode: inputMode,
    unit_id: draft.entryMode === "palms" ? visualUnit.id : unit.id,
    unit_label: draft.entryMode === "palms" ? visualUnit.unitLabel : unit.unitLabel,
    amount: roundNutritionMacro(amount),
    grams,
    visualUnit: draft.entryMode === "palms" ? visualUnit.id : null,
    visual_unit: draft.entryMode === "palms" ? visualUnit.id : null,
    visualAmount: draft.entryMode === "palms" ? roundNutritionMacro(amount) : null,
    visual_amount: draft.entryMode === "palms" ? roundNutritionMacro(amount) : null,
    estimatedGrams: draft.entryMode === "palms" ? grams : null,
    estimated_grams: draft.entryMode === "palms" ? grams : null,
    originalUnit: draft.entryMode === "palms" ? visualUnit.id : unit.id,
    original_unit: draft.entryMode === "palms" ? visualUnit.id : unit.id,
    calories: macroTotals.calories,
    protein: macroTotals.protein,
    fat: macroTotals.fat,
    carbs: macroTotals.carbs,
    fiber: macroTotals.fiber || 0,
    palm_kind: getFoodPalmKind(draft.food),
    palm_grams: getPalmGramsForFood(draft.food, profile)
  };
}

export function buildNutritionPayloadFromFood(foodItem = {}, grams = 0, selectedModifierIds = [], notes = "", entryMeta = null) {
  const totals = calculateNutritionItemTotals(foodItem, grams, selectedModifierIds);
  const selectedModifiers = (foodItem.modifiers || []).filter((modifier) => selectedModifierIds.includes(modifier.id));

  return {
    food_key: foodItem.key,
    food_name: foodItem.name,
    food_category: foodItem.category,
    serving_grams: Number(grams || 0),
    base_calories_per_100: Number(foodItem.calories_per_100 || 0),
    base_protein_per_100: Number(foodItem.protein_per_100 || 0),
    base_fat_per_100: Number(foodItem.fat_per_100 || 0),
    base_carbs_per_100: Number(foodItem.carbs_per_100 || 0),
    selected_modifiers: entryMeta ? [...selectedModifiers, buildNutritionEntryMetaModifier(entryMeta)] : selectedModifiers,
    calories_total: totals.calories,
    protein_total: totals.protein,
    fat_total: totals.fat,
    carbs_total: totals.carbs,
    notes
  };
}

export function snapshotFoodFromPayload(item = {}) {
  return {
    key: item.food_key || item.foodKey || item.key || normalizeFoodKey(item.food_name || item.foodName || item.name || "product"),
    name: item.food_name || item.foodName || item.name || "Продукт",
    category: item.food_category || item.foodCategory || item.category || "На глаз",
    calories_per_100: Number(item.base_calories_per_100 ?? item.baseCaloriesPer100 ?? item.calories_per_100 ?? 0),
    protein_per_100: Number(item.base_protein_per_100 ?? item.baseProteinPer100 ?? item.protein_per_100 ?? 0),
    fat_per_100: Number(item.base_fat_per_100 ?? item.baseFatPer100 ?? item.fat_per_100 ?? 0),
    carbs_per_100: Number(item.base_carbs_per_100 ?? item.baseCarbsPer100 ?? item.carbs_per_100 ?? 0),
    fiber_per_100: Number(item.base_fiber_per_100 ?? item.baseFiberPer100 ?? item.fiber_per_100 ?? item.fiberPer100 ?? 0),
    default_grams: Number(item.serving_grams ?? item.servingGrams ?? item.default_grams ?? 100),
    modifiers: (Array.isArray(item.modifiers) ? item.modifiers : (item.selected_modifiers || item.selectedModifiers || []))
      .filter((modifier) => (modifier?.id || modifier) !== NUTRITION_ENTRY_META_ID),
    defaultSelectedModifierIds: item.defaultSelectedModifierIds ||
      (item.selected_modifiers || item.selectedModifiers || [])
        .map((modifier) => modifier.id || modifier)
        .filter((id) => id && id !== NUTRITION_ENTRY_META_ID),
    unit_options: normalizeFoodUnitOptions(
      { unitOptions: item.unit_options || item.unitOptions },
      item.default_grams ?? item.serving_grams ?? item.servingGrams ?? 100
    ),
    default_unit: item.default_unit || item.defaultUnit || "grams",
    nutrition_category: normalizeNutritionCategory(item.nutrition_category || item.nutritionCategory || inferNutritionCategory(item)),
    allowed_visual_units: item.allowed_visual_units || item.allowedVisualUnits || null,
    default_visual_unit: item.default_visual_unit || item.defaultVisualUnit || null,
    visual_unit_grams: item.visual_unit_grams || item.visualUnitGrams || null,
    palm_kind: item.palm_kind || item.palmKind || null,
    synonyms: Array.isArray(item.synonyms) ? item.synonyms : []
  };
}

export function getFoodSearchText(foodItem = {}) {
  return [foodItem.name, foodItem.category, ...(foodItem.synonyms || [])]
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е");
}
