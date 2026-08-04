import { createTravelAIProvider } from "../../../ai-travel/providers.ts";
import {
  buildFlightAssessmentCandidates,
  fallbackFlightAssessments,
  normalizeModelFlightAssessments,
  sanitizeFlightAssessmentRoutes,
} from "../../../flight-assessment.ts";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You choose the most decision-useful grounded pro and con for each flight route.
The supplied facts were computed from the displayed route data. Select facts only by their exact IDs.
Do not write prose, alter a value, add a fact, or infer anything outside the supplied facts.
Prefer concrete price, duration, transfer, directness, and stopover facts over generic score facts.
Return exactly one selection for every routeId.

Return only JSON:
{
  "assessments": [{
    "routeId": "exact supplied routeId",
    "proId": "one exact ID from that route's pros",
    "conId": "one exact ID from that route's cons"
  }]
}`;

export async function POST(request: Request) {
  let candidates = [] as ReturnType<typeof buildFlightAssessmentCandidates>;
  try {
    const body = await request.json() as Record<string, unknown>;
    const routes = sanitizeFlightAssessmentRoutes(body.routes);
    if (!routes.length) {
      return Response.json({ error: "Flight routes are required." }, { status: 400 });
    }
    candidates = buildFlightAssessmentCandidates(routes);
    const provider = createTravelAIProvider();
    if (!provider) {
      return Response.json({ assessments: fallbackFlightAssessments(candidates) });
    }
    const result = await provider.generateJson({
      purpose: "audit",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({ candidates }),
    }) as Record<string, unknown>;
    return Response.json({
      assessments: normalizeModelFlightAssessments(result.assessments, candidates),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flight assessment failed.";
    console.error(`[flight-assess] ${message}`);
    if (candidates.length) {
      return Response.json({ assessments: fallbackFlightAssessments(candidates) });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
