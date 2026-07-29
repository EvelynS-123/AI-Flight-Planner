import type { RouteOption } from "../route-data.ts";
import type { ScheduledFlight, ScheduledStop } from "../flight-schedules.ts";
import type { LiveFlightOffer, LiveFlightSearchResult, LiveFlightSegment } from "./types.ts";

type DemoMonth = "Aug" | "Sep";
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function parseLocal(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/,
  );
  if (!match) {
    return {
      utc: 0,
      date: value.slice(0, 10),
      time: value.slice(11, 16),
    };
  }
  const [, year, month, day, hours, minutes] = match;
  return {
    utc: Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
    ),
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}
function dayNumber(value: string) {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
}

function scheduledFlight(segment: LiveFlightSegment, sourceUrl: string): ScheduledFlight {
  const departure = parseLocal(segment.departureLocal);
  const arrival = parseLocal(segment.arrivalLocal);
  const operatingDay = new Date(`${departure.date}T00:00:00Z`).getUTCDay() as Weekday;
  return {
    id: segment.id,
    from: segment.from,
    to: segment.to,
    airlineCode: segment.airlineCode,
    airlineName: segment.airlineName,
    flightNumber: segment.flightNumber,
    departureTime: departure.time,
    durationMinutes: segment.durationMinutes,
    operatingDays: [operatingDay],
    scheduleSource: sourceUrl,
    logoUrl: segment.logoUrl,
    departureUtc: departure.utc,
    arrivalUtc: arrival.utc,
    departureDate: departure.date,
    arrivalDate: arrival.date,
    arrivalTime: arrival.time,
    arrivalDayOffset: Math.max(0, dayNumber(arrival.date) - dayNumber(departure.date)),
  };
}

function offerHubs(offer: LiveFlightOffer) {
  if (offer.layovers.length) return offer.layovers.map((layover) => layover.airport);
  return offer.segments.slice(0, -1).map((flight) => flight.to);
}

function scheduledStops(offer: LiveFlightOffer, flights: ScheduledFlight[]): ScheduledStop[] {
  const hubs = offerHubs(offer);
  return hubs.map((airport, index) => {
    const layover = offer.layovers[index];
    const arrival = flights[index]?.arrivalUtc || 0;
    const departure = flights[index + 1]?.departureUtc || arrival;
    return {
      airport,
      kind: "connection",
      durationMinutes: layover?.durationMinutes
        || Math.max(0, Math.round((departure - arrival) / 60_000)),
      usableMinutes: 0,
      playDays: 0,
      options: [],
      arrivalUtc: arrival,
      departureUtc: departure,
    };
  });
}

export function liveRouteOptions(
  result: LiveFlightSearchResult,
  month: DemoMonth,
): RouteOption[] {
  return result.offers.map((offer) => {
    const hubs = offerHubs(offer);
    const flights = offer.segments.map((segment) => (
      scheduledFlight(segment, offer.sourceUrl)
    ));
    const airlines = [...new Set(flights.map((flight) => flight.airlineName))];
    const first = flights[0];
    const last = flights.at(-1)!;
    return {
      id: `live-${offer.id}`,
      origin: result.request.origin as RouteOption["origin"],
      destination: result.request.destination as RouteOption["destination"],
      hubs,
      ticketType: hubs.length ? "connection" : "direct",
      stopCount: hubs.length,
      months: [month],
      segments: [{
        from: result.request.origin,
        to: result.request.destination,
        price: offer.price,
        date: result.request.departureDate,
        airline: airlines.join(" + "),
        source: offer.source,
        url: offer.sourceUrl,
        stops: hubs.length,
      }],
      total: offer.price,
      liveSchedule: {
        searchedAt: result.searchedAt,
        currency: offer.currency,
        scheduledTickets: [{
          ticketIndex: 0,
          price: offer.price,
          fareDate: result.request.departureDate,
          fareSource: offer.source,
          fareUrl: offer.sourceUrl,
          flights,
        }],
        scheduledStops: scheduledStops(offer, flights),
        totalDurationMinutes: offer.totalDurationMinutes,
        selectedStopoverDays: [],
        dataValid: Boolean(first && last && offer.totalDurationMinutes > 0),
      },
    };
  });
}
