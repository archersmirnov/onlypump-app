export const SUPABASE_PROJECT_URL =
  globalThis.ONLYPUMP_SUPABASE_URL ||
  globalThis.SUPABASE_URL ||
  "https://qehbgwnblebjahmytqca.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  globalThis.ONLYPUMP_SUPABASE_PUBLISHABLE_KEY ||
  globalThis.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_rZgTF88Cp6PGhKUpoD_O8A_aQi-1o_K";

export const EDGE_FUNCTION_ENDPOINTS = Object.freeze({
  profile: `${SUPABASE_PROJECT_URL}/functions/v1/onlypump-profile-api`,
  workouts: `${SUPABASE_PROJECT_URL}/functions/v1/onlypump-workouts-api`,
  nutrition: `${SUPABASE_PROJECT_URL}/functions/v1/onlypump-nutrition-api`
});

export const EDGE_FUNCTION_NAMES = Object.freeze({
  profile: "onlypump-profile-api",
  workouts: "onlypump-workouts-api",
  nutrition: "onlypump-nutrition-api"
});
