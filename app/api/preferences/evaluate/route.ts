import { createTravelAIProvider } from "../../../ai-travel/providers.ts";
import type {
  PreferenceRouteCandidate,
  RoutePreferenceEvaluation,
  ScoreComponent,
} from "../../../preference-evaluation.ts";
import { sanitizeTravelPreferences } from "../../../travel-preferences.ts";

export const runtime = "nodejs";

const EVALUATION_BATCH_SIZE = 8;
const EVALUATION_CONCURRENCY = 3;

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximumLength)
    : "";
}

function cleanCandidates(value: unknown): PreferenceRouteCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<PreferenceRouteCandidate>;
    const routeId = cleanText(candidate.routeId, 120);
    if (!routeId) return [];
    const ticketType = candidate.ticketType === "direct"
      || candidate.ticketType === "connection"
      || candidate.ticketType === "multi-city"
      ? candidate.ticketType
      : "connection";
    return [{
      routeId,
      origin: cleanText(candidate.origin, 8),
      destination: cleanText(candidate.destination, 8),
      ticketType,
      stopCount: Number.isFinite(candidate.stopCount) ? Number(candidate.stopCount) : 0,
      totalPrice: Number.isFinite(candidate.totalPrice) ? Number(candidate.totalPrice) : 0,
      totalDurationMinutes: Number.isFinite(candidate.totalDurationMinutes)
        ? Number(candidate.totalDurationMinutes)
        : 0,
      airlines: Array.isArray(candidate.airlines)
        ? candidate.airlines.slice(0, 12).flatMap((airline) => (
          airline && typeof airline === "object"
            ? [{
              code: cleanText(airline.code, 12),
              name: cleanText(airline.name, 100),
            }]
            : []
        ))
        : [],
      departureLocal: cleanText(candidate.departureLocal, 40),
      arrivalLocal: cleanText(candidate.arrivalLocal, 40),
      stopovers: Array.isArray(candidate.stopovers)
        ? candidate.stopovers.slice(0, 8).flatMap((stop) => (
          stop && typeof stop === "object"
            ? [{
              airport: cleanText(stop.airport, 8),
              cityName: cleanText(stop.cityName, 120),
              kind: stop.kind === "multi-city" ? "multi-city" as const : "connection" as const,
              durationMinutes: Number.isFinite(stop.durationMinutes)
                ? Number(stop.durationMinutes)
                : 0,
              usableMinutes: Number.isFinite(stop.usableMinutes)
                ? Number(stop.usableMinutes)
                : 0,
            }]
            : []
        ))
        : [],
    }];
  });
}

function cleanEvaluations(
  value: unknown,
  candidateIds: Set<string>,
): RoutePreferenceEvaluation[] {
  if (!Array.isArray(value)) return [];
  const byRoute = new Map<string, RoutePreferenceEvaluation>();
  const cleanComponents = (value: unknown): ScoreComponent[] => {
    if (!Array.isArray(value)) return [];
    const cleaned = value.slice(0, 12).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<ScoreComponent>;
      const label = cleanText(candidate.label, 120);
      if (!label) return [];
      const score = Number(candidate.score);
      const weight = Number(candidate.weight);
      return [{
        label,
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 50,
        weight: Number.isFinite(weight) ? Math.max(0, Math.min(100, weight)) : 0,
        reason: cleanText(candidate.reason, 240),
      }];
    });
    const totalWeight = cleaned.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return cleaned;
    let assigned = 0;
    return cleaned.map((item, index) => {
      const weight = index === cleaned.length - 1
        ? Math.max(0, 100 - assigned)
        : Math.floor(item.weight * 10_000 / totalWeight) / 100;
      assigned += weight;
      return { ...item, weight };
    });
  };
  const weightedScore = (components: ScoreComponent[], fallback: unknown) => {
    const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight > 0) {
      return components.reduce(
        (sum, item) => sum + item.score * item.weight,
        0,
      ) / totalWeight;
    }
    const number = Number(fallback);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
  };
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<RoutePreferenceEvaluation>;
    const routeId = cleanText(candidate.routeId, 120);
    if (!candidateIds.has(routeId)) continue;
    const interestComponents = cleanComponents(candidate.interestComponents);
    const directnessComponents = cleanComponents(candidate.directnessComponents);
    const strongPreferencePenalty = Number(candidate.strongPreferencePenalty);
    byRoute.set(routeId, {
      routeId,
      interest: weightedScore(interestComponents, candidate.interest),
      directness: weightedScore(directnessComponents, candidate.directness),
      interestComponents,
      directnessComponents,
      strongPreferencePenalty: Number.isFinite(strongPreferencePenalty)
        ? Math.max(0, Math.min(30, strongPreferencePenalty))
        : 0,
      hardConstraintViolated: candidate.hardConstraintViolated === true,
      matchedPreferences: Array.isArray(candidate.matchedPreferences)
        ? candidate.matchedPreferences
          .map((entry) => cleanText(entry, 160))
          .filter(Boolean)
          .slice(0, 8)
        : [],
      explanation: cleanText(candidate.explanation, 360),
    });
  }
  return [...byRoute.values()];
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const memory = sanitizeTravelPreferences(body.memory);
    const candidates = cleanCandidates(body.candidates);
    if (!memory || memory.mode !== "personalized" || !memory.facts.length) {
      return Response.json({ evaluations: [] });
    }
    if (!candidates.length) {
      return Response.json({ error: "Route candidates are required." }, { status: 400 });
    }
    const provider = createTravelAIProvider();
    if (!provider) {
      return Response.json(
        { error: "Travel preference AI is not configured." },
        { status: 503 },
      );
    }

    const systemPrompt = `You evaluate a batch of candidate flight routes against structured user preference memory.
Do not browse or request web data. Use your own stable geographic and travel knowledge for destination character, and use the supplied candidate facts as authoritative for airlines, schedules, stops, durations, and prices.

Apply every preference fact semantically. Do not rely on a fixed tag list or predefined preference rules. This includes unusual rules such as disliking airlines whose names contain a certain word.
- interest measures match with destination-experience and airline facts.
- directness measures route simplicity, duration, connection burden, schedule, and comfort fit. Do not include price.
- Use the same absolute scoring standard for every route. Do not change the scale based on which candidates appear in this batch.
- Break interest and directness into understandable components. Give each component its own score and percentage weight.
- Component weights within each axis must sum to 100. The weighted component average must equal the axis score.
- Choose component labels from the actual preference facts and route qualities instead of a fixed component list.
- Write component labels, reasons, and explanations in the requested responseLanguage.
- A direct route has no stopover experience, but its airline may still affect interest.
- Mark hardConstraintViolated true only when an explicit hardConstraint fact is clearly violated.
- Soft dislikes lower the relevant score but never filter a route.
- Strong soft dislikes and avoids must also remain meaningful outside the manual axis sliders. For each clearly violated non-hard dislike or avoid fact, add 10 points to strongPreferencePenalty when its strength is 4 and 15 points when its strength is 5. Sum multiple violations, capped at 30. Use 0 when no such fact is clearly violated.
- Do not invent airline names, flight times, stops, or route mechanics.
- Keep explanations concise and grounded in the memory and supplied facts.

Return only JSON:
{
  "evaluations": [{
    "routeId": "exact supplied routeId",
    "interest": 0,
    "directness": 0,
    "strongPreferencePenalty": 0,
    "interestComponents": [{
      "label": "specific preference or route quality",
      "score": 0,
      "weight": 0,
      "reason": "brief reason"
    }],
    "directnessComponents": [{
      "label": "specific preference or route quality",
      "score": 0,
      "weight": 0,
      "reason": "brief reason"
    }],
    "hardConstraintViolated": false,
    "matchedPreferences": ["short preference statement"],
    "explanation": "brief reason"
  }]
}
Return exactly one evaluation for every supplied routeId. Scores range from 0 to 100.`;

    const batches = Array.from(
      { length: Math.ceil(candidates.length / EVALUATION_BATCH_SIZE) },
      (_, index) => candidates.slice(
        index * EVALUATION_BATCH_SIZE,
        (index + 1) * EVALUATION_BATCH_SIZE,
      ),
    );
    const evaluatedBatches: RoutePreferenceEvaluation[][] = Array.from(
      { length: batches.length },
      () => [],
    );
    let nextBatchIndex = 0;
    const evaluateNextBatch = async () => {
      while (nextBatchIndex < batches.length) {
        const batchIndex = nextBatchIndex;
        nextBatchIndex += 1;
        const batch = batches[batchIndex];
        const result = await provider.generateJson({
          purpose: "planning",
          systemPrompt,
          userPrompt: JSON.stringify({
            memory: {
              summary: memory.summary,
              facts: memory.facts,
            },
            candidates: batch,
            responseLanguage: cleanText(body.locale, 12) || "en",
          }),
        }) as Record<string, unknown>;
        const evaluations = cleanEvaluations(
          result.evaluations,
          new Set(batch.map((candidate) => candidate.routeId)),
        );
        if (evaluations.length !== batch.length) {
          throw new Error(`Preference AI did not evaluate every route in batch ${batchIndex + 1}.`);
        }
        evaluatedBatches[batchIndex] = evaluations;
      }
    };
    await Promise.all(Array.from(
      { length: Math.min(EVALUATION_CONCURRENCY, batches.length) },
      () => evaluateNextBatch(),
    ));
    const evaluations = evaluatedBatches.flat();
    return Response.json({ evaluations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preference evaluation failed.";
    console.error(`[preference-evaluate] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
