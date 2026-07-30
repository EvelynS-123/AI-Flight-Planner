import type { FlightResult } from "../flight-results";
import type { RouteOption } from "../route-data";

export type FlightResultGroup = {
  id: string;
  key: string;
  defaultVariantId: string;
  variants: FlightResult[];
};

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function ticketTypeForFlight(flight: FlightResult): RouteOption["ticketType"] {
  if (flight.isSelfTransfer || flight.leg1 || flight.leg2) return "multi-city";
  return flight.stops === 0 ? "direct" : "connection";
}

export function flightGroupingKey(flight: FlightResult): string {
  const operatingAirlines = Array.isArray(flight.flights)
    ? flight.flights
        .map((segment) => normalized(segment?.airline))
        .filter(Boolean)
    : [];
  const airlineSignature = operatingAirlines.length
    ? operatingAirlines.join(">")
    : normalized(flight.airline);
  const path = [flight.origin, ...(flight.stopAirports || []), flight.destination]
    .map(normalized)
    .join(">");

  return [
    ticketTypeForFlight(flight),
    airlineSignature,
    path,
  ].join("|");
}

export function groupFlightResults(flights: FlightResult[]): FlightResultGroup[] {
  const groups = new Map<string, FlightResult[]>();

  for (const flight of flights) {
    const key = flightGroupingKey(flight);
    const variants = groups.get(key);
    if (variants) variants.push(flight);
    else groups.set(key, [flight]);
  }

  return Array.from(groups, ([key, variants]) => {
    const chronological = [...variants].sort(
      (left, right) =>
        left.departureTime.localeCompare(right.departureTime)
        || left.price - right.price
        || left.id.localeCompare(right.id),
    );
    const cheapest = variants.reduce((best, candidate) =>
      candidate.price < best.price ? candidate : best
    );

    return {
      id: `flight-group-${hashKey(key)}`,
      key,
      defaultVariantId: cheapest.id,
      variants: chronological,
    };
  });
}
