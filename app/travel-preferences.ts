export const PREFERENCE_CATEGORIES = ["food", "culture", "nature", "urban"] as const;

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number];
export type PreferenceLevels = Record<PreferenceCategory, number>;

export const INTEREST_TAGS = [
  "street-food",
  "local-food",
  "fine-dining",
  "cafes",
  "museums",
  "history",
  "architecture",
  "local-life",
  "shopping",
  "nightlife",
  "live-music",
  "nature",
  "beaches",
  "hiking",
  "technology",
  "family",
] as const;

export type InterestTag = (typeof INTEREST_TAGS)[number];

export type WeightedInterest = {
  tag: InterestTag;
  strength: number;
};

export type WeightedTextPreference = {
  value: string;
  strength: number;
};

export const PREFERENCE_FACT_SCOPES = [
  "destination-experience",
  "airline",
  "schedule",
  "connection",
  "comfort",
  "other",
] as const;

export type PreferenceFactScope = (typeof PREFERENCE_FACT_SCOPES)[number];

export type PreferenceFact = {
  statement: string;
  scope: PreferenceFactScope;
  axis: "interest" | "directness";
  polarity: "like" | "dislike" | "require" | "avoid";
  strength: number;
  hardConstraint: boolean;
  evidence: string;
};

export type PreferenceTimeWindow = {
  startHour: number;
  endHour: number;
  strength: number;
};

export type TravelHardConstraints = {
  departureWindows: PreferenceTimeWindow[];
  arrivalWindows: PreferenceTimeWindow[];
  avoidOvernight: boolean;
  avoidSelfTransfer: boolean;
  maxStops: number | null;
  maxLayoverHours: number | null;
  maxTotalDurationHours: number | null;
  requiredAirlines: string[];
  excludedAirlines: string[];
};

export type TravelPreferenceState = {
  version: 3;
  mode: "default" | "personalized";
  facts: PreferenceFact[];
  categories: PreferenceLevels;
  favoriteCities: string[];
  summary: string;
  interests: WeightedInterest[];
  dislikedInterests: WeightedInterest[];
  departureWindows: PreferenceTimeWindow[];
  arrivalWindows: PreferenceTimeWindow[];
  preferredLayoverHours: {
    minHours: number;
    maxHours: number;
    strength: number;
  } | null;
  overnightPreference: "avoid" | "neutral" | "prefer";
  selfTransferPreference: "avoid" | "neutral" | "accept";
  preferredAirlines: WeightedTextPreference[];
  avoidedAirlines: WeightedTextPreference[];
  preferredAlliances: WeightedTextPreference[];
  hardConstraints: TravelHardConstraints;
  updatedAt: string;
};

export const PREFERENCE_STORAGE_KEY = "via.travel-memory.v3";
export const LEGACY_PREFERENCE_STORAGE_KEY = "via.travel-memory.v2";
export const ORIGINAL_PREFERENCE_STORAGE_KEY = "via.travel-preferences.v1";
export const FAVORITE_CITY_LIMIT = 3;
export const DEFAULT_PREFERENCE_LEVELS: PreferenceLevels = {
  food: 3,
  culture: 3,
  nature: 3,
  urban: 3,
};

export const DEFAULT_CITY_ATTRACTIVENESS: Record<string, number> = {
  HNL: 100,
  SIN: 90,
  NRT: 88,
  HKG: 86,
  KIX: 86,
  TPE: 85,
  BKK: 85,
  CDG: 85,
  LHR: 85,
  ICN: 82,
  YVR: 82,
  SFO: 80,
  SEA: 80,
  LAX: 80,
  AMS: 80,
  KUL: 80,
  PEK: 80,
  MNL: 78,
  CAN: 76,
  WUH: 74,
  FRA: 70,
};

// Every row sums to 100 so the user's category preferences determine the
// relative city score without adding a hidden city-size advantage.
const CITY_TRAITS: Record<string, PreferenceLevels> = {
  HNL: { food: 20, culture: 15, nature: 55, urban: 10 },
  SIN: { food: 35, culture: 20, nature: 20, urban: 25 },
  NRT: { food: 25, culture: 25, nature: 10, urban: 40 },
  HKG: { food: 30, culture: 15, nature: 10, urban: 45 },
  KIX: { food: 30, culture: 35, nature: 15, urban: 20 },
  TPE: { food: 30, culture: 25, nature: 20, urban: 25 },
  BKK: { food: 40, culture: 30, nature: 10, urban: 20 },
  CDG: { food: 30, culture: 40, nature: 10, urban: 20 },
  LHR: { food: 20, culture: 35, nature: 15, urban: 30 },
  ICN: { food: 25, culture: 20, nature: 15, urban: 40 },
  YVR: { food: 20, culture: 15, nature: 40, urban: 25 },
  SFO: { food: 25, culture: 25, nature: 20, urban: 30 },
  SEA: { food: 22, culture: 18, nature: 35, urban: 25 },
  LAX: { food: 20, culture: 25, nature: 25, urban: 30 },
  AMS: { food: 25, culture: 30, nature: 25, urban: 20 },
  KUL: { food: 35, culture: 25, nature: 15, urban: 25 },
  PEK: { food: 20, culture: 45, nature: 10, urban: 25 },
  MNL: { food: 25, culture: 25, nature: 30, urban: 20 },
  CAN: { food: 35, culture: 20, nature: 15, urban: 30 },
  WUH: { food: 25, culture: 35, nature: 20, urban: 20 },
  FRA: { food: 20, culture: 30, nature: 15, urban: 35 },
};

const CITY_INTEREST_TAGS: Record<string, InterestTag[]> = {
  HNL: ["beaches", "nature", "hiking", "local-food", "family"],
  SIN: ["local-food", "street-food", "fine-dining", "shopping", "architecture", "family"],
  NRT: ["local-food", "fine-dining", "technology", "shopping", "museums"],
  HKG: ["local-food", "fine-dining", "shopping", "nightlife", "hiking", "local-life"],
  KIX: ["street-food", "local-food", "history", "architecture", "nightlife"],
  TPE: ["street-food", "local-food", "cafes", "local-life", "hiking", "nightlife"],
  BKK: ["street-food", "local-food", "history", "nightlife", "shopping"],
  CDG: ["fine-dining", "cafes", "museums", "history", "architecture", "shopping"],
  LHR: ["museums", "history", "architecture", "fine-dining", "live-music"],
  ICN: ["local-food", "cafes", "shopping", "nightlife", "technology", "history"],
  YVR: ["nature", "hiking", "local-food", "family", "local-life"],
  SFO: ["local-food", "technology", "architecture", "nature", "local-life"],
  SEA: ["cafes", "technology", "nature", "live-music", "local-life"],
  LAX: ["local-food", "beaches", "museums", "nightlife", "shopping"],
  AMS: ["museums", "history", "architecture", "nightlife", "local-life"],
  KUL: ["street-food", "local-food", "shopping", "architecture", "local-life"],
  PEK: ["history", "architecture", "museums", "local-food", "technology"],
  MNL: ["local-food", "history", "nightlife", "beaches", "local-life"],
  CAN: ["local-food", "fine-dining", "shopping", "history", "local-life"],
  WUH: ["local-food", "history", "architecture", "local-life", "nature"],
  FRA: ["history", "architecture", "museums", "local-food", "technology"],
};

export const QUIZ_CITY_CODES = Object.keys(CITY_TRAITS);

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, numeric)) : fallback;
}

function clampLevel(value: unknown) {
  return Math.round(clampNumber(value, 1, 5, 3));
}

function cleanText(value: unknown, maximumLength = 80) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximumLength)
    : "";
}

function sanitizeWeightedInterests(value: unknown): WeightedInterest[] {
  if (!Array.isArray(value)) return [];
  const validTags = new Set<string>(INTEREST_TAGS);
  const byTag = new Map<InterestTag, WeightedInterest>();
  for (const item of value.slice(0, 16)) {
    if (!item || typeof item !== "object") continue;
    const tag = cleanText((item as Partial<WeightedInterest>).tag, 40) as InterestTag;
    if (!validTags.has(tag)) continue;
    byTag.set(tag, { tag, strength: clampLevel((item as Partial<WeightedInterest>).strength) });
  }
  return [...byTag.values()];
}

function sanitizeWeightedTextPreferences(value: unknown): WeightedTextPreference[] {
  if (!Array.isArray(value)) return [];
  const byValue = new Map<string, WeightedTextPreference>();
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const cleaned = cleanText((item as Partial<WeightedTextPreference>).value, 60);
    if (!cleaned) continue;
    byValue.set(cleaned.toLocaleLowerCase(), {
      value: cleaned,
      strength: clampLevel((item as Partial<WeightedTextPreference>).strength),
    });
  }
  return [...byValue.values()];
}

function sanitizePreferenceFacts(value: unknown): PreferenceFact[] {
  if (!Array.isArray(value)) return [];
  const validScopes = new Set<string>(PREFERENCE_FACT_SCOPES);
  const byStatement = new Map<string, PreferenceFact>();
  for (const item of value.slice(0, 32)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<PreferenceFact>;
    const statement = cleanText(candidate.statement, 240);
    if (!statement) continue;
    const scope = validScopes.has(String(candidate.scope))
      ? candidate.scope as PreferenceFactScope
      : "other";
    const axis = candidate.axis === "directness" ? "directness" : "interest";
    const polarity = candidate.polarity === "dislike"
      || candidate.polarity === "require"
      || candidate.polarity === "avoid"
      ? candidate.polarity
      : "like";
    byStatement.set(`${axis}:${statement.toLocaleLowerCase()}`, {
      statement,
      scope,
      axis,
      polarity,
      strength: clampLevel(candidate.strength),
      hardConstraint: candidate.hardConstraint === true,
      evidence: cleanText(candidate.evidence, 240),
    });
  }
  return [...byStatement.values()];
}

function sanitizeTimeWindows(value: unknown): PreferenceTimeWindow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<PreferenceTimeWindow>;
    const startHour = clampNumber(candidate.startHour, 0, 23.99, Number.NaN);
    const endHour = clampNumber(candidate.endHour, 0.01, 24, Number.NaN);
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || startHour === endHour) return [];
    return [{
      startHour: Number(startHour.toFixed(2)),
      endHour: Number(endHour.toFixed(2)),
      strength: clampLevel(candidate.strength),
    }];
  });
}

function optionalLimit(value: unknown, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(Math.max(0, Math.min(maximum, numeric)).toFixed(2)) : null;
}

function sanitizeAirlineList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 60)).filter(Boolean))].slice(0, 12);
}

function defaultHardConstraints(): TravelHardConstraints {
  return {
    departureWindows: [],
    arrivalWindows: [],
    avoidOvernight: false,
    avoidSelfTransfer: false,
    maxStops: null,
    maxLayoverHours: null,
    maxTotalDurationHours: null,
    requiredAirlines: [],
    excludedAirlines: [],
  };
}

export function defaultTravelPreferences(): TravelPreferenceState {
  return {
    version: 3,
    mode: "default",
    facts: [],
    categories: { ...DEFAULT_PREFERENCE_LEVELS },
    favoriteCities: [],
    summary: "",
    interests: [],
    dislikedInterests: [],
    departureWindows: [],
    arrivalWindows: [],
    preferredLayoverHours: null,
    overnightPreference: "neutral",
    selfTransferPreference: "neutral",
    preferredAirlines: [],
    avoidedAirlines: [],
    preferredAlliances: [],
    hardConstraints: defaultHardConstraints(),
    updatedAt: "",
  };
}

export function sanitizeTravelPreferences(value: unknown): TravelPreferenceState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3) return null;
  if (candidate.mode !== "default" && candidate.mode !== "personalized") return null;

  const fallback = defaultTravelPreferences();
  const source = candidate.categories && typeof candidate.categories === "object"
    ? candidate.categories as Partial<PreferenceLevels>
    : DEFAULT_PREFERENCE_LEVELS;
  const categories = Object.fromEntries(
    PREFERENCE_CATEGORIES.map((category) => [category, clampLevel(source[category])]),
  ) as PreferenceLevels;
  const favoriteCities = Array.isArray(candidate.favoriteCities)
    ? [...new Set(candidate.favoriteCities.filter(
      (city): city is string => typeof city === "string" && QUIZ_CITY_CODES.includes(city),
    ))].slice(0, FAVORITE_CITY_LIMIT)
    : [];

  if (candidate.version === 1) {
    return {
      ...fallback,
      mode: candidate.mode,
      categories,
      favoriteCities,
    };
  }

  const hardCandidate = candidate.hardConstraints && typeof candidate.hardConstraints === "object"
    ? candidate.hardConstraints as Record<string, unknown>
    : {};
  const layoverCandidate = candidate.preferredLayoverHours && typeof candidate.preferredLayoverHours === "object"
    ? candidate.preferredLayoverHours as Record<string, unknown>
    : null;
  const minLayover = layoverCandidate ? optionalLimit(layoverCandidate.minHours, 72) : null;
  const maxLayover = layoverCandidate ? optionalLimit(layoverCandidate.maxHours, 72) : null;
  const preferredLayoverHours = minLayover !== null && maxLayover !== null
    ? {
      minHours: Math.min(minLayover, maxLayover),
      maxHours: Math.max(minLayover, maxLayover),
      strength: clampLevel(layoverCandidate?.strength),
    }
    : null;

  return {
    version: 3,
    mode: candidate.mode,
    facts: sanitizePreferenceFacts(candidate.facts),
    categories,
    favoriteCities,
    summary: cleanText(candidate.summary, 600),
    interests: sanitizeWeightedInterests(candidate.interests),
    dislikedInterests: sanitizeWeightedInterests(candidate.dislikedInterests),
    departureWindows: sanitizeTimeWindows(candidate.departureWindows),
    arrivalWindows: sanitizeTimeWindows(candidate.arrivalWindows),
    preferredLayoverHours,
    overnightPreference: candidate.overnightPreference === "avoid" || candidate.overnightPreference === "prefer"
      ? candidate.overnightPreference
      : "neutral",
    selfTransferPreference: candidate.selfTransferPreference === "avoid" || candidate.selfTransferPreference === "accept"
      ? candidate.selfTransferPreference
      : "neutral",
    preferredAirlines: sanitizeWeightedTextPreferences(candidate.preferredAirlines),
    avoidedAirlines: sanitizeWeightedTextPreferences(candidate.avoidedAirlines),
    preferredAlliances: sanitizeWeightedTextPreferences(candidate.preferredAlliances),
    hardConstraints: {
      departureWindows: sanitizeTimeWindows(hardCandidate.departureWindows),
      arrivalWindows: sanitizeTimeWindows(hardCandidate.arrivalWindows),
      avoidOvernight: hardCandidate.avoidOvernight === true,
      avoidSelfTransfer: hardCandidate.avoidSelfTransfer === true,
      maxStops: optionalLimit(hardCandidate.maxStops, 8),
      maxLayoverHours: optionalLimit(hardCandidate.maxLayoverHours, 168),
      maxTotalDurationHours: optionalLimit(hardCandidate.maxTotalDurationHours, 336),
      requiredAirlines: sanitizeAirlineList(hardCandidate.requiredAirlines),
      excludedAirlines: sanitizeAirlineList(hardCandidate.excludedAirlines),
    },
    updatedAt: cleanText(candidate.updatedAt, 40),
  };
}

export function personalizedTravelPreferences(
  categories: PreferenceLevels,
  favoriteCities: string[],
): TravelPreferenceState {
  return sanitizeTravelPreferences({
    ...defaultTravelPreferences(),
    version: 3,
    mode: "personalized",
    categories,
    favoriteCities,
  })!;
}

export function buildPersonalizedAttractiveness(preferences: TravelPreferenceState) {
  if (preferences.mode === "default") return { ...DEFAULT_CITY_ATTRACTIVENESS };

  const baseScores = Object.fromEntries(Object.entries(CITY_TRAITS).map(([city, traits]) => {
    const categoryScore = PREFERENCE_CATEGORIES.reduce(
      (sum, category) => sum + preferences.categories[category] * 20 * traits[category],
      0,
    ) / 100;
    const tags = new Set(CITY_INTEREST_TAGS[city] ?? []);
    const totalInterestStrength = preferences.interests.reduce((sum, item) => sum + item.strength, 0);
    const tagScore = totalInterestStrength
      ? 100 * preferences.interests.reduce(
        (sum, item) => sum + (tags.has(item.tag) ? item.strength : 0),
        0,
      ) / totalInterestStrength
      : categoryScore;
    const dislikedPenalty = preferences.dislikedInterests.reduce(
      (sum, item) => sum + (tags.has(item.tag) ? item.strength * 5 : 0),
      0,
    );
    const score = totalInterestStrength
      ? categoryScore * 0.55 + tagScore * 0.45
      : categoryScore;
    return [city, Math.max(0, score - dislikedPenalty)];
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
