import { generateTravelRecommendations } from "../../ai-travel/recommendation-planner";
import {
  createTravelAIProvider,
  createTravelSearchProvider,
} from "../../ai-travel/providers";
import { checkTravelRevision } from "../../ai-travel/security";
import type {
  TravelPace,
  TravelRecommendationRequest,
} from "../../ai-travel/types";
import { sanitizeTravelPreferences } from "../../travel-preferences";

export const runtime = "nodejs";

function isPace(value: unknown): value is TravelPace {
  return value === "relaxed" || value === "balanced" || value === "tight";
}

function validateRequest(value: unknown): TravelRecommendationRequest | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TravelRecommendationRequest>;
  const route = candidate.route;
  const preferences = sanitizeTravelPreferences(candidate.preferences);
  if (!route || typeof route !== "object" || !preferences || !isPace(candidate.pace)) return null;
  if (
    !route.id
    || !/^[A-Z]{3}$/.test(route.origin)
    || !/^[A-Z]{3}$/.test(route.destination)
    || !Array.isArray(route.stopovers)
    || !route.stopovers.length
    || route.stopovers.length > 3
  ) return null;

  const stopovers = route.stopovers.filter((stopover) => (
    stopover
    && typeof stopover.airport === "string"
    && /^[A-Z]{3}$/.test(stopover.airport)
    && Number.isFinite(stopover.arrival?.utc)
    && Number.isFinite(stopover.departure?.utc)
    && stopover.departure.utc > stopover.arrival.utc
  ));
  if (stopovers.length !== route.stopovers.length) return null;

  return {
    route: { ...route, stopovers },
    preferences,
    pace: candidate.pace,
    locale: candidate.locale === "en" || candidate.locale === "ko" || candidate.locale === "ja"
      ? candidate.locale
      : "zh",
    message: typeof candidate.message === "string" ? candidate.message.slice(0, 1000) : undefined,
    revisionHistory: Array.isArray(candidate.revisionHistory)
      ? candidate.revisionHistory.filter((item): item is string => typeof item === "string").slice(-12)
      : [],
    previousPlan: candidate.previousPlan?.version === 7
      ? candidate.previousPlan
      : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = validateRequest(await request.json());
    if (!body) {
      return Response.json({ error: "Invalid travel-plan request." }, { status: 400 });
    }
    if (body.message) {
      const check = checkTravelRevision(body.message);
      if (!check.allowed) {
        return Response.json({
          error: "I can only help adjust this stopover itinerary.",
          code: check.reason,
        }, { status: 422 });
      }
      body.message = check.value;
    }
    if (body.revisionHistory?.length) {
      const safeHistory: string[] = [];
      for (const revision of body.revisionHistory) {
        const check = checkTravelRevision(revision);
        if (!check.allowed) {
          return Response.json({
            error: "I can only help adjust this stopover itinerary.",
            code: check.reason,
          }, { status: 422 });
        }
        safeHistory.push(check.value);
      }
      body.revisionHistory = safeHistory;
    }

    const provider = createTravelAIProvider();
    const searchProvider = createTravelSearchProvider();
    if (!provider || !searchProvider) {
      return Response.json({
        error: "Live AI and web search must both be configured. Local itinerary fallback is disabled.",
      }, { status: 503 });
    }
    const plan = await generateTravelRecommendations(body, provider, searchProvider);
    return Response.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Travel planning failed.";
    console.error(`[travel-plan] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
