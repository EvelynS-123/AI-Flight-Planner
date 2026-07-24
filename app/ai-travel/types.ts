import type { TravelPreferenceState } from "../travel-preferences";

export type TravelPace = "relaxed" | "balanced" | "tight";
export type TravelRisk = "low" | "medium" | "high";
export type TravelLocale = "zh" | "en" | "ko" | "ja";
export type TravelProviderId = "deepseek" | "glm" | "kimi";
export type TravelRevisionMode = "adjust" | "replan";

export type TravelRevisionReceipt = {
  mode: TravelRevisionMode;
  status: "applied" | "not-applied";
  message: string;
  changedPaths: string[];
};

export type TravelPlanFlight = {
  airlineName: string;
  flightNumber: string;
  airport: string;
  utc: number;
};

export type TravelPlanStopoverInput = {
  airport: string;
  arrival: TravelPlanFlight;
  departure: TravelPlanFlight;
};

export type TravelPlanRouteInput = {
  id: string;
  origin: string;
  destination: string;
  stopovers: TravelPlanStopoverInput[];
};

export type TravelPlanRequest = {
  route: TravelPlanRouteInput;
  preferences: TravelPreferenceState;
  pace: TravelPace;
  locale: TravelLocale;
  message?: string;
  revisionHistory?: string[];
  previousPlan?: TravelPlan;
};

export type TravelRecommendationCategory =
  | "attraction"
  | "meal"
  | "hotel"
  | "nightlife"
  | "shopping";

export type TravelRecommendation = {
  id: string;
  category: TravelRecommendationCategory;
  title: string;
  area: string;
  address: string;
  visitType: string;
  details: string;
  suggestedDurationMinutes: number;
  durationRationale: string;
  openingHours: string;
  openingStartMinute: number | null;
  openingEndMinute: number | null;
  hoursConfidence: "verified" | "typical" | "unknown";
  sourceId: string;
  sourceUrl: string;
  sourceTitle: string;
};

export type StopoverSafetyBudget = {
  totalStopoverMinutes: number;
  arrivalProcessingMinutes: number;
  outboundTransitMinutes: number;
  returnTransitMinutes: number;
  airportBufferMinutes: number;
  cityWindowStartOffsetMinutes: number;
  cityWindowEndOffsetMinutes: number;
  protectedRestMinutes: number;
  flexibleMinutes: number;
  requiresHotel: boolean;
};

export type StopoverRecommendationPool = {
  airport: string;
  city: string;
  timeZone: string;
  summary: string;
  riskLevel: TravelRisk;
  safety: StopoverSafetyBudget;
  outboundTransitMode: string;
  outboundTransitSourceUrl: string;
  returnTransitMode: string;
  returnTransitSourceUrl: string;
  recommendations: TravelRecommendation[];
  assumptions: string[];
};

export type TravelRecommendationPlan = {
  version: 7;
  provider: TravelProviderId;
  model: string;
  generatedAt: string;
  pace: TravelPace;
  summary: string;
  stopovers: StopoverRecommendationPool[];
  disclaimer: string;
  grounding: {
    provider: string;
    searchedAt: string;
    queryCount: number;
  };
  audit: {
    provider: TravelProviderId | "server";
    model: string;
    status: "passed";
    rejectedRecommendationCount: number;
  };
  revisionMessage?: string;
};

export type TravelRecommendationRequest = Omit<TravelPlanRequest, "previousPlan"> & {
  previousPlan?: TravelRecommendationPlan;
};

export type TravelSelectionTransportLeg = {
  fromRecommendationId: string;
  toRecommendationId: string;
  mode: string;
  estimatedMinutes: number;
  congestionBufferMinutes: number;
  details: string;
};

export type StopoverSelectionArrangement = {
  airport: string;
  summary: string;
  orderedRecommendationIds: string[];
  legs: TravelSelectionTransportLeg[];
  estimatedVisitMinutes: number;
  estimatedLocalTransitMinutes: number;
  remainingFlexibleMinutes: number;
  status: "comfortable" | "tight" | "over-capacity";
};

export type TravelSelectionArrangement = {
  version: 1;
  provider: TravelProviderId;
  model: string;
  generatedAt: string;
  stopovers: StopoverSelectionArrangement[];
};

export type TravelSelectionArrangementRequest = {
  route: TravelPlanRouteInput;
  pace: TravelPace;
  locale: TravelLocale;
  plan: TravelRecommendationPlan;
  selectedByStopover: Record<number, string[]>;
};

export type RecommendationSelectionFeasibility = {
  status: "feasible" | "conflict";
  selectedMinutes: number;
  localTransitMinutes: number;
  remainingMinutes: number;
  suggestedOrder: string[];
  missingHotel: boolean;
  conflicts: Array<"capacity" | "opening-hours" | "hotel-required">;
};

export type TravelPlanItemType =
  | "arrival"
  | "transport"
  | "attraction"
  | "meal"
  | "hotel"
  | "buffer"
  | "departure";

export type TravelPlanItem = {
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  type: TravelPlanItemType;
  title: string;
  location: string;
  details: string;
  openingHours?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  travelFromPreviousMinutes?: number;
  travelFromPreviousMode?: string;
  travelSourceId?: string;
};

export type TravelPlanDay = {
  label: string;
  items: TravelPlanItem[];
};

export type StopoverTravelPlan = {
  airport: string;
  city: string;
  summary: string;
  riskLevel: TravelRisk;
  arrivalProcessingMinutes: number;
  outboundTransitMinutes: number;
  returnTransitMinutes: number;
  airportBufferMinutes: number;
  cityWindowStartOffsetMinutes: number;
  cityWindowEndOffsetMinutes: number;
  requiresHotel: boolean;
  hotelArea: string | null;
  hotelName: string | null;
  hotelSourceId?: string;
  hotelSourceUrl?: string;
  outboundTransitMode: string;
  outboundTransitSourceId?: string;
  outboundTransitSourceUrl?: string;
  returnTransitMode: string;
  returnTransitSourceId?: string;
  returnTransitSourceUrl?: string;
  assumptions: string[];
  days: TravelPlanDay[];
  journey: TravelPlanItem[];
};

export type TravelPlan = {
  version: 6;
  provider: TravelProviderId;
  model: string;
  generatedAt: string;
  pace: TravelPace;
  summary: string;
  stopovers: StopoverTravelPlan[];
  disclaimer: string;
  grounding: {
    provider: string;
    searchedAt: string;
    queryCount: number;
  };
  audit: {
    provider: TravelProviderId;
    model: string;
    status: "passed";
    repairedItemCount: number;
  };
  revision?: TravelRevisionReceipt;
};

export type AirportOperationalProfile = {
  airport: string;
  city: string;
  timeZone: string;
  busyness: "moderate" | "busy" | "very-busy";
  arrivalProcessingMinutes: [number, number];
  airportBufferMinutes: [number, number];
};

export type ProviderGenerationInput = {
  systemPrompt: string;
  userPrompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  purpose?: "planning" | "query-discovery" | "audit";
};

export interface TravelAIProvider {
  readonly id: TravelProviderId;
  readonly model: string;
  modelForPurpose?(purpose?: ProviderGenerationInput["purpose"]): string;
  generateJson(input: ProviderGenerationInput): Promise<unknown>;
}

export interface TravelSearchProvider {
  readonly id: string;
  search(query: string, count?: number): Promise<TravelSearchResult[]>;
}

export type TravelSearchResult = {
  id: string;
  query: string;
  category?:
    | "transport"
    | "attraction"
    | "meal"
    | "hotel"
    | "nightlife"
    | "shopping"
    | "revision";
  candidateTitle?: string;
  title: string;
  url: string;
  snippet: string;
  siteName?: string;
};

export type TravelSearchEvidence = {
  provider: string;
  searchedAt: string;
  stopovers: Array<{
    airport: string;
    city: string;
    queries: string[];
    results: TravelSearchResult[];
  }>;
};
