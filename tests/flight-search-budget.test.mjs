import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/flights/search/route.ts";

function serpPayload(urlString) {
  const url = new URL(urlString);
  const origin = url.searchParams.get("departure_id");
  const destination = url.searchParams.get("arrival_id");
  const date = url.searchParams.get("outbound_date");

  return {
    search_metadata: {
      google_flights_url: "https://www.google.com/travel/flights/example",
    },
    best_flights: [{
      price: 200,
      total_duration: 240,
      flights: [{
        departure_airport: { id: origin, time: `${date} 08:00` },
        arrival_airport: { id: destination, time: `${date} 12:00` },
        airline: "Test Air",
        airline_logo: "https://example.com/test-air.png",
        flight_number: "TA 100",
        duration: 240,
        travel_class: "Economy",
      }],
    }],
  };
}

test("initial search uses one regular request plus two per selected hub", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.SERPAPI_API_KEY;
  const calls = [];
  process.env.SERPAPI_API_KEY = "budget-test-key";
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json(serpPayload(String(url)));
  };

  try {
    const response = await POST(new Request("http://local/api/flights/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legs: [{ origins: ["LHR"], destinations: ["HKG"] }],
        dateRangeStart: "2026-09-01",
        dateRangeEnd: "2026-09-30",
        tripType: "one_way",
        cabinClass: "economy",
        maxStops: null,
        adults: 1,
        explorationHubs: ["NRT", "HNL", "DOH", "DXB"],
      }),
    }));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(calls.length, 7);
    assert.equal(data.meta.providerRequests, 7);
    assert.equal(data.meta.requestLimit, 7);
    assert.ok(data.results.some((flight) => flight.explorationHub === "NRT"));
    assert.ok(data.results.some((flight) => flight.explorationHub === "HNL"));
    assert.ok(data.results.some((flight) => flight.explorationHub === "DOH"));
    assert.ok(!data.results.some((flight) => flight.explorationHub === "DXB"));

    const direct = data.results.find((flight) =>
      !flight.isSelfTransfer && flight.origin === "LHR" && flight.destination === "HKG"
    );
    const directCallsBefore = calls.length;
    const directVariantResponse = await POST(new Request("http://local/api/flights/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRangeStart: "2026-09-01",
        dateRangeEnd: "2026-09-30",
        tripType: "one_way",
        cabinClass: "economy",
        adults: 1,
        variantRequest: {
          date: "2026-09-20",
          groupKey: "direct|test air|lhr>hkg",
          representative: direct,
        },
      }),
    }));
    const directVariantData = await directVariantResponse.json();

    assert.equal(calls.length - directCallsBefore, 1);
    assert.equal(directVariantData.meta.providerRequests, 1);
    assert.ok(directVariantData.results.every((flight) =>
      flight.departureTime.startsWith("2026-09-20")
    ));

    const multiCity = data.results.find((flight) => flight.explorationHub === "NRT");
    const multiCallsBefore = calls.length;
    const multiVariantResponse = await POST(new Request("http://local/api/flights/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRangeStart: "2026-09-01",
        dateRangeEnd: "2026-09-30",
        tripType: "one_way",
        cabinClass: "economy",
        adults: 1,
        variantRequest: {
          date: "2026-09-22",
          groupKey: "multi-city|test air>test air|lhr>nrt>hkg",
          representative: multiCity,
        },
      }),
    }));
    const multiVariantData = await multiVariantResponse.json();

    assert.equal(calls.length - multiCallsBefore, 2);
    assert.equal(multiVariantData.meta.providerRequests, 2);
    assert.ok(multiVariantData.results.every((flight) => flight.isSelfTransfer));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.SERPAPI_API_KEY;
    else process.env.SERPAPI_API_KEY = originalApiKey;
  }
});
