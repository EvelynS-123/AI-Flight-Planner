import assert from "node:assert/strict";
import test from "node:test";
import {
  groupFlightResults,
  mapLiveFlightGroupsToRouteOptions,
  maxUsableStopoverMinutesForFlight,
  ticketTypeForFlight,
} from "../app/flights/group-results.ts";
import { scoreScheduledRoutes } from "../app/flight-schedules.ts";

function flight(overrides = {}) {
  const airline = overrides.airline ?? "Cathay Pacific";
  const origin = overrides.origin ?? "LHR";
  const destination = overrides.destination ?? "HKG";
  const departureTime = overrides.departureTime ?? "2026-09-10 12:00";
  const stops = overrides.stops ?? 0;
  const stopAirports = overrides.stopAirports ?? [];
  const segmentAirlines = overrides.segmentAirlines ?? Array(stops + 1).fill(airline);

  return {
    id: overrides.id ?? `${airline}-${departureTime}`,
    airline,
    airlineLogo: "",
    flightNumbers: overrides.flightNumbers ?? ["CX 252"],
    origin,
    destination,
    departureTime,
    arrivalTime: overrides.arrivalTime ?? "2026-09-11 07:00",
    durationMinutes: 720,
    stops,
    stopAirports,
    price: overrides.price ?? 700,
    currency: "USD",
    cabinClass: "Economy",
    bookingUrl: "",
    flights: segmentAirlines.map((segmentAirline) => ({ airline: segmentAirline })),
    ...overrides,
  };
}

test("same airline and path collapse across dates and times", () => {
  const groups = groupFlightResults([
    flight({
      id: "cx-late",
      departureTime: "2026-09-12 18:20",
      flightNumbers: ["CX 250"],
      price: 650,
    }),
    flight({
      id: "cx-early",
      departureTime: "2026-09-10 12:00",
      flightNumbers: ["CX 252"],
      price: 720,
    }),
    flight({
      id: "ba",
      airline: "British Airways",
      segmentAirlines: ["British Airways"],
      flightNumbers: ["BA 31"],
    }),
    flight({
      id: "cx-doha",
      stops: 1,
      stopAirports: ["DOH"],
      segmentAirlines: ["Cathay Pacific", "Cathay Pacific"],
      flightNumbers: ["CX 100", "CX 200"],
    }),
  ]);

  assert.equal(groups.length, 3);
  const cathayDirect = groups.find((group) =>
    group.variants.some((variant) => variant.id === "cx-late")
  );
  assert.deepEqual(
    cathayDirect.variants.map((variant) => variant.id),
    ["cx-early", "cx-late"],
  );
  assert.equal(cathayDirect.defaultVariantId, "cx-late");
});

test("different connection paths stay in separate groups", () => {
  const groups = groupFlightResults([
    flight({ id: "via-doha", stops: 1, stopAirports: ["DOH"] }),
    flight({ id: "via-dubai", stops: 1, stopAirports: ["DXB"] }),
  ]);

  assert.equal(groups.length, 2);
});

test("normal multi-stop itineraries remain connections", () => {
  assert.equal(
    ticketTypeForFlight(flight({ stops: 2, stopAirports: ["DOH", "SIN"] })),
    "connection",
  );
  assert.equal(
    ticketTypeForFlight(flight({ stops: 1, stopAirports: ["NRT"], isSelfTransfer: true })),
    "multi-city",
  );
});

test("a self-transfer combination preserves its two ticket boundaries", () => {
  const rawSegment = ({
    airline,
    flightNumber,
    from,
    departure,
    to,
    arrival,
    duration,
  }) => ({
    airline,
    flight_number: flightNumber,
    duration,
    departure_airport: { id: from, time: departure },
    arrival_airport: { id: to, time: arrival },
  });
  const firstTicketFlights = [
    rawSegment({
      airline: "Condor",
      flightNumber: "DE 4214",
      from: "CDG",
      departure: "2026-09-15 16:45",
      to: "FRA",
      arrival: "2026-09-15 18:15",
      duration: 90,
    }),
    rawSegment({
      airline: "Condor",
      flightNumber: "DE 4349",
      from: "FRA",
      departure: "2026-09-15 19:40",
      to: "VIE",
      arrival: "2026-09-15 21:00",
      duration: 80,
    }),
  ];
  const secondTicketFlights = [
    rawSegment({
      airline: "KLM",
      flightNumber: "KL 1904",
      from: "VIE",
      departure: "2026-09-16 14:20",
      to: "AMS",
      arrival: "2026-09-16 16:10",
      duration: 110,
    }),
    rawSegment({
      airline: "KLM",
      flightNumber: "KL 843",
      from: "AMS",
      departure: "2026-09-16 17:15",
      to: "BKK",
      arrival: "2026-09-17 09:30",
      duration: 675,
    }),
  ];
  const leg1 = flight({
    id: "ticket-1",
    airline: "Condor",
    origin: "CDG",
    destination: "VIE",
    departureTime: "2026-09-15 16:45",
    arrivalTime: "2026-09-15 21:00",
    stops: 1,
    stopAirports: ["FRA"],
    price: 260,
    bookingUrl: "https://www.google.com/travel/flights/first",
    flightNumbers: ["DE 4214", "DE 4349"],
    flights: firstTicketFlights,
  });
  const leg2 = flight({
    id: "ticket-2",
    airline: "KLM",
    origin: "VIE",
    destination: "BKK",
    departureTime: "2026-09-16 14:20",
    arrivalTime: "2026-09-17 09:30",
    stops: 1,
    stopAirports: ["AMS"],
    price: 462,
    bookingUrl: "https://www.google.com/travel/flights/second",
    flightNumbers: ["KL 1904", "KL 843"],
    flights: secondTicketFlights,
  });
  const combined = flight({
    id: "combined",
    airline: "Condor + KLM",
    origin: "CDG",
    destination: "BKK",
    departureTime: "2026-09-15 16:45",
    arrivalTime: "2026-09-17 09:30",
    stops: 3,
    stopAirports: ["FRA", "VIE", "AMS"],
    price: 722,
    bookingUrl: leg1.bookingUrl,
    flightNumbers: ["DE 4214", "DE 4349", "KL 1904", "KL 843"],
    flights: [...firstTicketFlights, ...secondTicketFlights],
    isSelfTransfer: true,
    leg1,
    leg2,
  });

  const [group] = groupFlightResults([combined]);
  const [route] = mapLiveFlightGroupsToRouteOptions(
    [group],
    { [group.id]: combined.id },
  );

  assert.equal(route.ticketType, "multi-city");
  assert.equal(route.total, 722);
  assert.equal(route.segments.length, 2);
  assert.deepEqual(route.segments.map((segment) => segment.price), [260, 462]);
  assert.equal(route.liveTickets.length, 2);

  const [ranked] = scoreScheduledRoutes(
    [route],
    { price: 30, interest: 35, directness: 35 },
  );
  assert.equal(ranked.scheduledTickets.length, 2);
  assert.deepEqual(
    ranked.scheduledTickets.map((ticket) => ticket.price),
    [260, 462],
  );
  assert.deepEqual(
    ranked.scheduledStops.map((stop) => [stop.airport, stop.kind]),
    [
      ["FRA", "connection"],
      ["VIE", "multi-city"],
      ["AMS", "connection"],
    ],
  );
  assert.equal(
    ranked.scheduledStops.find((stop) => stop.airport === "VIE").usableMinutes,
    740,
  );
  assert.equal(maxUsableStopoverMinutesForFlight(combined), 740);
});
