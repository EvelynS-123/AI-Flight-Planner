export const PREFERENCE_CATEGORIES = ["food", "culture", "nature", "urban"] as const;

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number];
export type PreferenceLevels = Record<PreferenceCategory, number>;

export type TravelPreferenceState = {
  version: 1;
  mode: "default" | "personalized";
  categories: PreferenceLevels;
  favoriteCities: string[];
};

export const PREFERENCE_STORAGE_KEY = "via.travel-preferences.v1";
export const FAVORITE_CITY_LIMIT = 3;
export const DEFAULT_PREFERENCE_LEVELS: PreferenceLevels = {
  food: 3,
  culture: 3,
  nature: 3,
  urban: 3,
};

export const DEFAULT_CITY_ATTRACTIVENESS: Record<string, number> = {
  HNL: 98,
  NRT: 88,
  HKG: 86,
  KIX: 86,
  TPE: 84,
  ICN: 82,
  YVR: 82,
  PEK: 80,
  MNL: 78,
  CAN: 76,
  WUH: 74,
};

// These profiles describe what each city offers. They are not final
// attractiveness scores: every row sums to 100 so the user's four answers
// determine the result without giving any city an automatic advantage.
const CITY_TRAITS: Record<string, PreferenceLevels> = {
  HNL: { food: 20, culture: 15, nature: 55, urban: 10 },
  NRT: { food: 25, culture: 25, nature: 10, urban: 40 },
  HKG: { food: 30, culture: 15, nature: 10, urban: 45 },
  KIX: { food: 30, culture: 35, nature: 15, urban: 20 },
  TPE: { food: 30, culture: 25, nature: 20, urban: 25 },
  ICN: { food: 25, culture: 20, nature: 15, urban: 40 },
  YVR: { food: 20, culture: 15, nature: 40, urban: 25 },
  PEK: { food: 20, culture: 45, nature: 10, urban: 25 },
  MNL: { food: 25, culture: 25, nature: 30, urban: 20 },
  CAN: { food: 35, culture: 20, nature: 15, urban: 30 },
  WUH: { food: 25, culture: 35, nature: 20, urban: 20 },
};

export const QUIZ_CITY_CODES = Object.keys(CITY_TRAITS);

function clampLevel(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(5, Math.round(numeric))) : 3;
}

export function sanitizeTravelPreferences(value: unknown): TravelPreferenceState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TravelPreferenceState>;
  if (candidate.version !== 1 || (candidate.mode !== "default" && candidate.mode !== "personalized")) return null;

  const source = candidate.categories && typeof candidate.categories === "object" ? candidate.categories : DEFAULT_PREFERENCE_LEVELS;
  const categories = Object.fromEntries(
    PREFERENCE_CATEGORIES.map((category) => [category, clampLevel((source as Partial<PreferenceLevels>)[category])]),
  ) as PreferenceLevels;
  const favoriteCities = Array.isArray(candidate.favoriteCities)
    ? [...new Set(candidate.favoriteCities.filter((city): city is string => typeof city === "string" && QUIZ_CITY_CODES.includes(city)))].slice(0, FAVORITE_CITY_LIMIT)
    : [];

  return { version: 1, mode: candidate.mode, categories, favoriteCities };
}

export function defaultTravelPreferences(): TravelPreferenceState {
  return { version: 1, mode: "default", categories: { ...DEFAULT_PREFERENCE_LEVELS }, favoriteCities: [] };
}

export function personalizedTravelPreferences(
  categories: PreferenceLevels,
  favoriteCities: string[],
): TravelPreferenceState {
  return sanitizeTravelPreferences({ version: 1, mode: "personalized", categories, favoriteCities })!;
}

export function buildPersonalizedAttractiveness(preferences: TravelPreferenceState) {
  if (preferences.mode === "default") return { ...DEFAULT_CITY_ATTRACTIVENESS };

  const baseScores = Object.fromEntries(Object.entries(CITY_TRAITS).map(([city, traits]) => {
    const score = PREFERENCE_CATEGORIES.reduce(
      (sum, category) => sum + preferences.categories[category] * 20 * traits[category],
      0,
    ) / 100;
    return [city, score];
  })) as Record<string, number>;

  const favorites = new Set(preferences.favoriteCities);
  const highestUnselected = Math.max(
    0,
    ...Object.entries(baseScores).filter(([city]) => !favorites.has(city)).map(([, score]) => score),
  );
  const favoriteFloor = Math.max(110, highestUnselected + 20);
  const rawScores = Object.fromEntries(Object.entries(baseScores).map(([city, score]) => [
    city,
    favorites.has(city) ? favoriteFloor + score * 0.05 : score,
  ])) as Record<string, number>;

  const highestRaw = Math.max(...Object.values(rawScores));
  const normalization = highestRaw > 100 ? 100 / highestRaw : 1;
  return Object.fromEntries(Object.entries(rawScores).map(([city, score]) => [
    city,
    Math.max(0, Math.min(100, score * normalization)),
  ]));
}
