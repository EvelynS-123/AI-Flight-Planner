import type { RankedRouteOption } from "./flight-schedules.ts";
import type { RouteWeights } from "./route-data.ts";

export type PreferenceRouteCandidate = {
  routeId: string;
  origin: string;
  destination: string;
  ticketType: "direct" | "connection" | "multi-city";
  stopCount: number;
  totalPrice: number;
  totalDurationMinutes: number;
  airlines: Array<{ code: string; name: string }>;
  departureLocal: string;
  arrivalLocal: string;
  stopovers: Array<{
    airport: string;
    cityName: string;
    kind: "connection" | "multi-city";
    durationMinutes: number;
    usableMinutes: number;
  }>;
};

export type RoutePreferenceEvaluation = {
  routeId: string;
  interest: number;
  directness: number;
  interestComponents: ScoreComponent[];
  directnessComponents: ScoreComponent[];
  hardConstraintViolated: boolean;
  matchedPreferences: string[];
  explanation: string;
};

export type ScoreComponent = {
  label: string;
  score: number;
  weight: number;
  reason: string;
};

export type PreferenceRankedRoute = RankedRouteOption & {
  preferenceEvaluation?: RoutePreferenceEvaluation;
};

function uniqueAirlines(route: RankedRouteOption) {
  const values = new Map<string, { code: string; name: string }>();
  for (const flight of route.scheduledTickets.flatMap((ticket) => ticket.flights)) {
    const code = flight.airlineCode.trim().toUpperCase();
    const name = flight.airlineName.trim();
    const key = `${code}:${name.toLocaleLowerCase()}`;
    if (code || name) values.set(key, { code, name });
  }
  return [...values.values()];
}

export function preferenceCandidateForRoute(
  route: RankedRouteOption,
): PreferenceRouteCandidate {
  const flights = route.scheduledTickets.flatMap((ticket) => ticket.flights);
  return {
    routeId: route.id,
    origin: route.origin,
    destination: route.destination,
    ticketType: route.ticketType,
    stopCount: route.stopCount,
    totalPrice: route.total,
    totalDurationMinutes: route.totalDurationMinutes,
    airlines: uniqueAirlines(route),
    departureLocal: flights[0]?.departureTime ?? "",
    arrivalLocal: flights.at(-1)?.arrivalTime ?? "",
    stopovers: route.scheduledStops.map((stop) => ({
      airport: stop.airport,
      cityName: route.airportNames?.[stop.airport] ?? stop.airport,
      kind: stop.kind,
      durationMinutes: stop.durationMinutes,
      usableMinutes: stop.usableMinutes,
    })),
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function applyPreferenceEvaluations(
  routes: RankedRouteOption[],
  weights: RouteWeights,
  evaluations: RoutePreferenceEvaluation[] | null,
  personalized: boolean,
): PreferenceRankedRoute[] {
  if (!personalized) return routes;
  const byRoute = new Map((evaluations ?? []).map((item) => [item.routeId, item]));
  const totalWeights = weights.price + weights.interest + weights.directness || 1;

  return routes.flatMap((route) => {
    const evaluation = byRoute.get(route.id);
    if (evaluation?.hardConstraintViolated) return [];
    const interest = clampScore(evaluation?.interest ?? 50);
    const directness = clampScore(evaluation?.directness ?? route.scores.directness);
    const total = (
      route.scores.price * weights.price
      + interest * weights.interest
      + directness * weights.directness
    ) / totalWeights;
    return [{
      ...route,
      ...(evaluation ? { preferenceEvaluation: evaluation } : {}),
      scores: {
        ...route.scores,
        interest,
        directness,
        total,
        scheduleMatch: null,
        comfortMatch: null,
        airlineMatch: null,
      },
    }];
  });
}
