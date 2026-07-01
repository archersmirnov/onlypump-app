import {
  buildNutritionScreensViewModel,
  normalizeNutritionDay
} from "../domain/index.js";

const previewGoal = {
  calories: 2450,
  protein: 170,
  fat: 75,
  carbs: 270,
  fiber: 30
};

const previewDay = normalizeNutritionDay({
  nutrition_day: {
    nutrition_date: "2026-07-01",
    calories_target: previewGoal.calories,
    protein_target: previewGoal.protein,
    fat_target: previewGoal.fat,
    carbs_target: previewGoal.carbs
  },
  nutrition_meals: [
    {
      meal_type: "breakfast",
      meal_title: "Завтрак",
      meal_order: 1,
      nutrition_items: [
        {
          food_key: "oats",
          food_name: "Овсянка",
          food_category: "Крупы",
          nutrition_category: "carbs",
          serving_grams: 90,
          calories_total: 337,
          protein_total: 11.7,
          fat_total: 6.2,
          carbs_total: 54.5,
          fiber_total: 8.8,
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
          food_key: "chicken-breast",
          food_name: "Куриная грудка",
          food_category: "Белковые продукты",
          nutrition_category: "protein",
          serving_grams: 165,
          calories_total: 273,
          protein_total: 51.2,
          fat_total: 5.9,
          carbs_total: 0,
          fiber_total: 0,
          item_order: 1
        },
        {
          food_key: "vegetable-salad",
          food_name: "Овощной салат",
          food_category: "Овощи",
          nutrition_category: "vegetables",
          serving_grams: 240,
          calories_total: 72,
          protein_total: 3.4,
          fat_total: 0.8,
          carbs_total: 13.6,
          fiber_total: 5.8,
          item_order: 2
        }
      ]
    }
  ]
}, "2026-07-01", previewGoal);

const previewFoods = [
  {
    key: "chicken-breast",
    name: "Куриная грудка",
    category: "Белковые продукты",
    nutrition_category: "protein",
    calories_per_100: 165,
    protein_per_100: 31,
    fat_per_100: 3.6,
    carbs_per_100: 0,
    default_grams: 110
  },
  {
    key: "rice",
    name: "Рис",
    category: "Крупы",
    nutrition_category: "carbs",
    calories_per_100: 130,
    protein_per_100: 2.7,
    fat_per_100: 0.3,
    carbs_per_100: 28,
    default_grams: 90
  },
  {
    key: "olive-oil",
    name: "Оливковое масло",
    category: "Жиры",
    nutrition_category: "fats",
    calories_per_100: 884,
    protein_per_100: 0,
    fat_per_100: 100,
    carbs_per_100: 0,
    default_grams: 10
  },
  {
    key: "burger",
    name: "Бургер",
    category: "Смешанные блюда",
    nutrition_category: "mixed",
    calories_per_100: 260,
    protein_per_100: 13,
    fat_per_100: 12,
    carbs_per_100: 25,
    default_grams: 220
  }
];

function NutritionProgressBar({ value }) {
  return (
    <span className="nutrition-progress" aria-hidden="true">
      <span className="nutrition-progress__fill" style={{ width: `${value}%` }} />
    </span>
  );
}

export function NutritionScreensPreview({
  day = previewDay,
  foods = previewFoods,
  title = "Nutrition screens"
}) {
  const viewModel = buildNutritionScreensViewModel({ day, foods }, { goal: previewGoal });
  const summary = viewModel.summary;
  const foodPreviews = viewModel.visibleFoodPreviews;

  return (
    <section className="nutrition-preview" aria-labelledby="nutrition-preview-title">
      <div className="nutrition-preview__header">
        <div>
          <p className="nutrition-preview__eyebrow">UI Extraction</p>
          <h2 id="nutrition-preview-title">{title}</h2>
          <p>
            Экран питания получает готовую view model из domain helpers: итоги дня,
            приемы пищи, макросы и разрешенные меры продукта.
          </p>
        </div>
        <span className="nutrition-preview__mode">{viewModel.selectedModeLabel}</span>
      </div>

      <div className="nutrition-preview__grid">
        <article className="nutrition-preview-card nutrition-preview-card--summary">
          <div className="nutrition-preview-card__topline">
            <span>Дневник питания</span>
            <strong>{summary.foodItemsCount} продукта</strong>
          </div>
          <div className="nutrition-preview__calories">
            <strong>{summary.totals.calories}</strong>
            <span>/ {summary.goal.calories} ккал</span>
          </div>
          <NutritionProgressBar value={summary.caloriesProgress} />
          <p>{summary.remainingCalories} ккал осталось</p>
        </article>

        <article className="nutrition-preview-card">
          <div className="nutrition-preview-card__topline">
            <span>Макросы</span>
            <strong>{summary.filledMealsCount}/{summary.mealRows.length}</strong>
          </div>
          <div className="nutrition-preview__macros">
            {summary.macroRows.map((row) => (
              <div key={row.key} className="nutrition-preview__macro-row">
                <span>{row.label}</span>
                <strong>{row.valueLabel}</strong>
                <NutritionProgressBar value={row.progress} />
              </div>
            ))}
          </div>
        </article>

        <article className="nutrition-preview-card">
          <div className="nutrition-preview-card__topline">
            <span>Приемы пищи</span>
            <strong>{summary.hasFood ? "есть данные" : "пусто"}</strong>
          </div>
          <div className="nutrition-preview__meals">
            {summary.mealRows.map((meal) => (
              <div key={meal.type} className="nutrition-preview__meal-row">
                <div>
                  <strong>{meal.title}</strong>
                  <span>{meal.subtitle}</span>
                </div>
                <b>{meal.calories} ккал</b>
              </div>
            ))}
          </div>
        </article>

        <article className="nutrition-preview-card">
          <div className="nutrition-preview-card__topline">
            <span>Добавить продукт</span>
            <strong>категории и меры</strong>
          </div>
          <div className="nutrition-preview__foods">
            {foodPreviews.map((food) => (
              <div key={food.key} className="nutrition-preview__food-row">
                <div>
                  <strong>{food.name}</strong>
                  <span>{food.categoryLabel}</span>
                </div>
                <b>{food.defaultVisualUnitLabel}</b>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
