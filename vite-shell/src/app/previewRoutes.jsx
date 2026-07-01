import { AnalyticsChartsPreview } from "../features/analytics/ui/index.js";
import { HomeWidgetsPreview } from "../features/home/index.js";
import { NutritionScreensPreview } from "../features/nutrition/ui/index.js";
import { StudentsTrainerPreview } from "../features/students/ui/index.js";
import { WorkoutsPreview } from "../features/workouts/ui/index.js";

export const ALL_PREVIEW_ROUTE_ID = "all";

const HOME_WIDGETS_READ_ONLY_PREVIEW_SOURCE = {
  measurement: {
    weight: 82.4,
    body_fat_percent: 18.6,
  },
  training: {
    totalVolume: 128400,
    completedSets: 190,
  },
  nutrition: {
    totals: {
      calories: 2130,
      protein: 164,
    },
  },
  health: {
    recovery_score: 76,
  },
};

export const PREVIEW_ROUTES = [
  {
    id: "home",
    label: "Home",
    title: "Home widgets",
    render: () => <HomeWidgetsPreview source={HOME_WIDGETS_READ_ONLY_PREVIEW_SOURCE} />
  },
  {
    id: "nutrition",
    label: "Nutrition",
    title: "Nutrition screens",
    render: () => <NutritionScreensPreview />
  },
  {
    id: "analytics",
    label: "Analytics",
    title: "Analytics charts",
    render: () => <AnalyticsChartsPreview />
  },
  {
    id: "workouts",
    label: "Workouts",
    title: "Workouts UI",
    render: () => <WorkoutsPreview />
  },
  {
    id: "students",
    label: "Students",
    title: "Students dashboards",
    render: () => <StudentsTrainerPreview />
  }
];

export function getVisiblePreviewRoutes(activeRouteId) {
  if (activeRouteId === ALL_PREVIEW_ROUTE_ID) return PREVIEW_ROUTES;

  return PREVIEW_ROUTES.filter((route) => route.id === activeRouteId);
}
