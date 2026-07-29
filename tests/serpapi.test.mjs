import assert from "node:assert/strict";
import test from "node:test";
import {
  FlightSearchProviderError,
  createSerpApiFlightProvider,
  normalizeSerpApiResponse,
} from "../app/flights/serpapi.ts";
import { liveRouteOptions } from "../app/flights/route-options.ts";
import { scoreRoutes } from "../app/route-data.ts";

const REQUEST = {
  origin: "PVG",
  destination: "LAX",
  departureDate: "2026-09-15",
  adults: 1,
  currency: "USD",
};

const FIXTURE = {
  search_metadata: {
    google_flights_url: "https://www.google.com/travel/flights/example",
  },
  search_parameters: { currency: "USD" },
  best_flights: [{
    price: 512,
    total_duration: 810,
    type: "Economy",
    flights: [{
      departure_airport: {
        name: "Shanghai Pudong International Airport",
        id: "PVG",
        time: "2026-09-15 13:00",
      },
      arrival_airport: {
        name: "San Francisco International Airport",
        id: "SFO",
        time: "2026-09-15 09:40",
      },
      duration: 700,
      airline: "Example Air",
      flight_number: "EA 100",
      airline_logo: "https://example.com/ea.png",
      travel_class: "Economy",
    }, {
      departure_airport: {
        name: "San Francisco International Airport",
        id: "SFO",
        time: "2026-09-15 11:10",
      },
      arrival_airport: {
        name: "Los Angeles International Airport",
        id: "LAX",
        time: "2026-09-15 12:40",
      },
      duration: 90,
      airline: "Example Air",
      flight_number: "EA 200",
      airline_logo: "https://example.com/ea.png",
      travel_class: "Economy",
    }],
    layovers: [{
      id: "SFO",
      name: "San Francisco International Airport",
      duration: 90,
    }],
    departure_token: "token",
  }],
};

test("normalizes SerpApi Google Flights payloads", () => {
  const result = normalizeSerpApiResponse(FIXTURE, REQUEST, "2026-07-29T12:00:00.000Z");
  assert.equal(result.provider, "serpapi-google-flights");
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].price, 512);
  assert.equal(result.offers[0].segments.length, 2);
  assert.equal(result.offers[0].layovers[0].airport, "SFO");
});

test("converts live offers into scoreable route options", () => {
  const result = normalizeSerpApiResponse(FIXTURE, REQUEST);
  const routes = liveRouteOptions(result, "Sep");
  const scored = scoreRoutes(routes);
  assert.equal(scored.length, 1);
  assert.equal(scored[0].ticketType, "connection");
  assert.equal(scored[0].scheduledTickets[0].flights[0].flightNumber, "EA 100");
  assert.equal(scored[0].total, 512);
  assert.equal(scored[0].liveSchedule?.currency, "USD");
});

test("provider keeps the API key server-side and caches repeated searches", async () => {
  const calls = [];
  const provider = createSerpApiFlightProvider(
    { SERPAPI_API_KEY: "test-secret", FLIGHT_SEARCH_CACHE_TTL_MS: "60000" },
    async (url) => {
      calls.push(String(url));
      return Response.json(FIXTURE);
    },
  );
  assert.ok(provider);
  const first = await provider.search(REQUEST);
  const second = await provider.search(REQUEST);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api_key=test-secret/);
  assert.doesNotMatch(JSON.stringify(first), /test-secret/);
});

test("provider rejects malformed searches before calling SerpApi", async () => {
  const provider = createSerpApiFlightProvider(
    { SERPAPI_API_KEY: "test-secret" },
    async () => {
      throw new Error("fetch must not run");
    },
  );
  await assert.rejects(
    () => provider.search({ ...REQUEST, origin: "XX" }),
    (error) => error instanceof FlightSearchProviderError
      && error.code === "invalid_airport",
  );
});
