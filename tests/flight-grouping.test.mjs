import assert from "node:assert/strict";
import test from "node:test";
import {
  groupFlightResults,
  ticketTypeForFlight,
} from "../app/flights/group-results.ts";

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
