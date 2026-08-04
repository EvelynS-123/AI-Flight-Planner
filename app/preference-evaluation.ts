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
  interestBonus?: number;
  preferredCityAirports?: string[];
  directness: number;
  strongPreferencePenalty?: number;
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

const SELECTED_STOPOVER_INTEREST_BONUS = 15;
const AIRPORT_ONLY_STOPOVER_INTEREST_BONUS = 5;

export function applyPreferenceEvaluations(
  routes: RankedRouteOption[],
  weights: RouteWeights,
  evaluations: RoutePreferenceEvaluation[] | null,
  personalized: boolean,
  selectedStopoverAirports: readonly string[] = [],
): PreferenceRankedRoute[] {
  if (!personalized || !evaluations?.length) return routes;
  const byRoute = new Map(evaluations.map((item) => [item.routeId, item]));
  const selectedAirports = new Set(
    selectedStopoverAirports.map((airport) => airport.trim().toUpperCase()),
  );
  const totalWeights = weights.price + weights.interest + weights.directness || 1;

  return routes.flatMap((route) => {
    const evaluation = byRoute.get(route.id);
    if (!evaluation) return [route];
    if (evaluation.hardConstraintViolated) return [];
    const baseInterest = clampScore(evaluation.interest);
    const preferredCityAirports = new Set(
      (evaluation.preferredCityAirports ?? []).map(
        (airport) => airport.trim().toUpperCase(),
      ),
    );
    const cityMatchBonus = route.scheduledStops.reduce((bonus, stop) => {
      const airport = stop.airport.trim().toUpperCase();
      if (!selectedAirports.has(airport) && !preferredCityAirports.has(airport)) {
        return bonus;
      }
      return Math.max(
        bonus,
        stop.usableMinutes > 0
          ? SELECTED_STOPOVER_INTEREST_BONUS
          : AIRPORT_ONLY_STOPOVER_INTEREST_BONUS,
      );
    }, 0);
    const interest = clampScore(
      baseInterest + cityMatchBonus,
    );
    const interestBonus = interest - baseInterest;
    const directness = clampScore(evaluation.directness);
    const strongPreferencePenalty = Math.max(
      0,
      Math.min(30, Number(evaluation.strongPreferencePenalty) || 0),
    );
    const weightedTotal = (
      route.scores.price * weights.price
      + interest * weights.interest
      + directness * weights.directness
    ) / totalWeights;
    const total = clampScore(weightedTotal - strongPreferencePenalty);
    return [{
      ...route,
      preferenceEvaluation: {
        ...evaluation,
        interest,
        interestBonus,
        strongPreferencePenalty,
      },
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
