import { createTravelAIProvider } from "../../../ai-travel/providers";
import { generateSelectionArrangement } from "../../../ai-travel/selection-arranger";
import type {
  TravelPace,
  TravelSelectionArrangementRequest,
} from "../../../ai-travel/types";

export const runtime = "nodejs";

function isPace(value: unknown): value is TravelPace {
  return value === "relaxed" || value === "balanced" || value === "tight";
}

function validateRequest(value: unknown): TravelSelectionArrangementRequest | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TravelSelectionArrangementRequest>;
  if (
    !candidate.route
    || !candidate.plan
    || candidate.plan.version !== 7
    || !isPace(candidate.pace)
    || !candidate.selectedByStopover
    || typeof candidate.selectedByStopover !== "object"
    || candidate.route.stopovers.length !== candidate.plan.stopovers.length
  ) return null;
  const stopoversValid = candidate.route.stopovers.every((stopover, index) => (
    /^[A-Z]{3}$/.test(stopover.airport)
    && stopover.airport === candidate.plan!.stopovers[index]?.airport
    && Number.isFinite(stopover.arrival?.utc)
    && Number.isFinite(stopover.departure?.utc)
    && stopover.departure.utc > stopover.arrival.utc
  ));
  if (!stopoversValid) return null;
  const selectedByStopover = Object.fromEntries(
    candidate.plan.stopovers.map((stopover, index) => {
      const validIds = new Set(stopover.recommendations.map((item) => item.id));
      const selected = candidate.selectedByStopover?.[index];
      return [
        index,
        Array.isArray(selected)
          ? [...new Set(selected.filter((id): id is string => (
            typeof id === "string" && validIds.has(id)
          )))]
          : [],
      ];
    }),
  );
  if (!Object.values(selectedByStopover).some((ids) => ids.length > 0)) return null;
  return {
    route: candidate.route,
    plan: candidate.plan,
    pace: candidate.pace,
    locale: candidate.locale === "en" || candidate.locale === "ko" || candidate.locale === "ja"
      ? candidate.locale
      : "zh",
    selectedByStopover,
  };
}

export async function POST(request: Request) {
  try {
    const body = validateRequest(await request.json());
    if (!body) {
      return Response.json({ error: "Invalid selection arrangement request." }, { status: 400 });
    }
    const provider = createTravelAIProvider();
    if (!provider) {
      return Response.json({ error: "Live AI must be configured." }, { status: 503 });
    }
    const arrangement = await generateSelectionArrangement(body, provider);
    return Response.json({ arrangement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Selection arrangement failed.";
    console.error(`[travel-plan/arrange] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
