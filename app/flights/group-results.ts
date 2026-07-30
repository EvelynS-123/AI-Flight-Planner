import type { FlightResult } from "../flight-results";
import type { AirportCode, RouteOption } from "../route-data";
import { estimateUsableStopoverMinutes } from "../flight-schedules.ts";

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

function ticketsForFlight(flight: FlightResult): FlightResult[] {
  if (flight.isSelfTransfer && flight.leg1 && flight.leg2) {
    return [flight.leg1, flight.leg2];
  }
  return [flight];
}

function sourceName(flight: FlightResult): string {
  return flight.bookingUrl ? "Google Flights" : "Live search";
}

export function mapLiveFlightGroupsToRouteOptions(
  groups: FlightResultGroup[],
  selections: Record<string, string>,
): RouteOption[] {
  return groups.map((group) => {
    const flight = group.variants.find((variant) => variant.id === selections[group.id])
      ?? group.variants.find((variant) => variant.id === group.defaultVariantId)
      ?? group.variants[0];
    const date = flight.departureTime.split(" ")[0];
    const [year, month] = date.split("-");
    const tickets = ticketsForFlight(flight);

    return {
      id: group.id,
      origin: flight.origin as AirportCode,
      destination: flight.destination as AirportCode,
      hubs: flight.stopAirports,
      ticketType: ticketTypeForFlight(flight),
      stopCount: flight.stops,
      months: [`${year}-${month}`],
      segments: tickets.map((ticket) => ({
        from: ticket.origin,
        to: ticket.destination,
        price: ticket.price,
        date: ticket.departureTime.split(" ")[0],
        airline: ticket.airline,
        source: sourceName(ticket),
        url: ticket.bookingUrl,
        stops: ticket.stops,
      })),
      total: tickets.reduce((sum, ticket) => sum + ticket.price, 0),
      liveFlights: flight.flights,
      liveTickets: tickets.map((ticket) => ({
        price: ticket.price,
        fareDate: ticket.departureTime.split(" ")[0],
        fareSource: sourceName(ticket),
        fareUrl: ticket.bookingUrl,
        flights: ticket.flights ?? [],
      })),
      airportNames: flight.airportNames,
    };
  });
}

function localTimestampMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  ) / 60_000;
}

export function maxUsableStopoverMinutesForFlight(flight: FlightResult): number {
  const segments = Array.isArray(flight.flights) ? flight.flights : [];
  let maximum = 0;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const current = segments[index];
    const next = segments[index + 1];
    const airport = String(current?.arrival_airport?.id || "").toUpperCase();
    if (!airport || airport !== String(next?.departure_airport?.id || "").toUpperCase()) {
      continue;
    }
    const arrival = localTimestampMinutes(current?.arrival_airport?.time);
    const departure = localTimestampMinutes(next?.departure_airport?.time);
    if (arrival === null || departure === null || departure < arrival) continue;
    maximum = Math.max(
      maximum,
      estimateUsableStopoverMinutes(departure - arrival, airport),
    );
  }
  return maximum;
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
