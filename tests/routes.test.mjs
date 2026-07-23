import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_DESTINATIONS, DEMO_ORIGINS, ROUTES, moveWeightBoundary, scoreRoutes } from "../app/route-data.ts";
import { AIRPORT_CITIES, COPY, LOCALE_OPTIONS } from "../app/i18n.ts";
import {
  DEFAULT_CITY_ATTRACTIVENESS,
  FAVORITE_CITY_LIMIT,
  QUIZ_CITY_CODES,
  buildPersonalizedAttractiveness,
  defaultTravelPreferences,
  personalizedTravelPreferences,
  sanitizeTravelPreferences,
} from "../app/travel-preferences.ts";

test("demo includes a broad set of all three ticket types", () => {
  assert.ok(ROUTES.length >= 90);
  assert.ok(ROUTES.filter((route) => route.ticketType === "direct").length >= 15);
  assert.ok(ROUTES.filter((route) => route.ticketType === "connection").length >= 15);
  assert.ok(ROUTES.some((route) => route.ticketType === "multi-city"));
});

test("every connection names at least one transfer airport", () => {
  for (const route of ROUTES.filter((item) => item.ticketType === "connection")) {
    assert.ok(route.hubs.length > 0, `${route.id} is missing its transfer airport`);
  }
});

test("all four locales cover the complete interface and airport list", () => {
  assert.deepEqual(LOCALE_OPTIONS.map((item) => item.code), ["zh", "en", "ko", "ja"]);
  const airportCodes = new Set(ROUTES.flatMap((route) => [route.origin, route.destination, ...route.hubs]));
  for (const { code } of LOCALE_OPTIONS) {
    assert.ok(COPY[code].search.length > 0);
    assert.ok(COPY[code].footer.length > 0);
    assert.ok(COPY[code].quizTitle.length > 0);
    assert.ok(COPY[code].quizFavoritesTitle.length > 0);
    for (const airportCode of airportCodes) assert.ok(AIRPORT_CITIES[code][airportCode], `${code} is missing ${airportCode}`);
  }
});

test("skipping the quiz preserves the current default city attractiveness", () => {
  assert.deepEqual(buildPersonalizedAttractiveness(defaultTravelPreferences()), DEFAULT_CITY_ATTRACTIVENESS);
});

test("the four quiz dimensions produce different personalized city orders", () => {
  const nature = buildPersonalizedAttractiveness(personalizedTravelPreferences(
    { food: 1, culture: 1, nature: 5, urban: 1 },
    [],
  ));
  const urban = buildPersonalizedAttractiveness(personalizedTravelPreferences(
    { food: 1, culture: 1, nature: 1, urban: 5 },
    [],
  ));
  assert.ok(nature.HNL > nature.HKG);
  assert.ok(urban.HKG > urban.HNL);
  assert.notDeepEqual(nature, urban);
  for (const score of [...Object.values(nature), ...Object.values(urban)]) assert.ok(score >= 0 && score <= 100);
});

test("up to three favorite cities receive the highest internal priority", () => {
  const preferences = sanitizeTravelPreferences({
    version: 1,
    mode: "personalized",
    categories: { food: 5, culture: 1, nature: 1, urban: 1 },
    favoriteCities: ["WUH", "MNL", "PEK", "HNL"],
  });
  assert.ok(preferences);
  assert.equal(preferences.favoriteCities.length, FAVORITE_CITY_LIMIT);
  const scores = buildPersonalizedAttractiveness(preferences);
  const favorites = new Set(preferences.favoriteCities);
  const lowestFavorite = Math.min(...preferences.favoriteCities.map((city) => scores[city]));
  const highestUnselected = Math.max(...QUIZ_CITY_CODES.filter((city) => !favorites.has(city)).map((city) => scores[city]));
  assert.ok(lowestFavorite > highestUnselected);
  assert.ok(Math.max(...Object.values(scores)) <= 100);
});

test("personalized attractiveness changes route interest without breaking score bounds", () => {
  const routes = ROUTES.filter((route) => route.origin === "PVG" && route.destination === "LAX" && route.months.includes("Sep"));
  const attractiveness = buildPersonalizedAttractiveness(personalizedTravelPreferences(
    { food: 1, culture: 1, nature: 5, urban: 1 },
    ["HNL"],
  ));
  const scored = scoreRoutes(routes, { price: 30, interest: 35, directness: 35 }, {}, attractiveness);
  const honolulu = scored.find((route) => route.hubs.includes("HNL"));
  const tokyo = scored.find((route) => route.hubs.includes("NRT"));
  assert.ok(honolulu && tokyo);
  assert.ok(honolulu.scores.attractiveness > tokyo.scores.attractiveness);
  for (const route of scored) {
    assert.ok(route.scores.interest >= 0 && route.scores.interest <= 100);
    assert.ok(route.scores.total >= 0 && route.scores.total <= 100);
  }
});

test("default September search shows direct, connection, and multi-city choices", () => {
  const routes = ROUTES.filter((route) => route.origin === "PVG" && route.destination === "LAX" && route.months.includes("Sep"));
  assert.deepEqual(new Set(routes.map((route) => route.ticketType)), new Set(["direct", "connection", "multi-city"]));
});

test("every visible airport pair has enough September choices to compare", () => {
  for (const origin of DEMO_ORIGINS) {
    for (const destination of DEMO_DESTINATIONS) {
      const routes = ROUTES.filter((route) => route.origin === origin && route.destination === destination && route.months.includes("Sep"));
      assert.ok(routes.length >= 3, `${origin}-${destination} only has ${routes.length} routes`);
    }
  }
});

test("NRT to SEA now compares direct, connection, and multi-city choices", () => {
  const routes = ROUTES.filter((route) => route.origin === "NRT" && route.destination === "SEA" && route.months.includes("Sep"));
  assert.deepEqual(new Set(routes.map((route) => route.ticketType)), new Set(["direct", "connection", "multi-city"]));
  assert.ok(routes.length >= 5);
});

test("both shared-bar boundaries preserve a 100 percent total", () => {
  const first = moveWeightBoundary({ price: 30, interest: 35, directness: 35 }, "price-interest", 50);
  const second = moveWeightBoundary(first, "interest-directness", 80);
  assert.deepEqual(first, { price: 50, interest: 15, directness: 35 });
  assert.deepEqual(second, { price: 50, interest: 30, directness: 20 });
  assert.equal(second.price + second.interest + second.directness, 100);
});

test("either boundary can reopen a collapsed middle weight", () => {
  const collapsed = { price: 50, interest: 0, directness: 50 };
  assert.deepEqual(moveWeightBoundary(collapsed, "price-interest", 40), { price: 40, interest: 10, directness: 50 });
  assert.deepEqual(moveWeightBoundary(collapsed, "interest-directness", 60), { price: 50, interest: 10, directness: 40 });
});

test("changing weights changes the winner according to the selected priority", () => {
  const routes = ROUTES.filter((route) => route.origin === "PVG" && route.destination === "LAX" && route.months.includes("Sep"));
  const cheapest = scoreRoutes(routes, { price: 100, interest: 0, directness: 0 }).sort((a, b) => b.scores.total - a.scores.total)[0];
  const mostDirect = scoreRoutes(routes, { price: 0, interest: 0, directness: 100 }).sort((a, b) => b.scores.total - a.scores.total)[0];
  assert.equal(cheapest.total, Math.min(...routes.map((route) => route.total)));
  assert.equal(mostDirect.ticketType, "direct");
});

test("every demo itinerary has complete weekly timetable metadata", () => {
  const scored = scoreRoutes(ROUTES);
  assert.equal(scored.length, ROUTES.length);
  for (const route of scored) {
    assert.ok(route.totalDurationMinutes >= 0, `${route.id} has a negative total duration`);
    assert.ok(route.scheduledTickets.length > 0, `${route.id} has no scheduled ticket`);
    for (const stop of route.scheduledStops) assert.ok(stop.durationMinutes >= 0, `${route.id} has a negative layover`);
    for (const flight of route.scheduledTickets.flatMap((ticket) => ticket.flights)) {
      assert.ok(flight.airlineName.length > 0, `${route.id} is missing an airline`);
      assert.match(flight.flightNumber, /^[A-Z0-9]{2,3}\d+$/);
      assert.match(flight.logoUrl, /^https:\/\/images\.kiwi\.com\/airlines\/64\/[A-Z0-9]+\.png$/);
      assert.match(flight.departureTime, /^\d{2}:\d{2}$/);
      assert.match(flight.arrivalTime, /^\d{2}:\d{2}$/);
      assert.ok(flight.arrivalUtc > flight.departureUtc);
      const departureDay = new Date(`${flight.departureDate}T00:00:00Z`).getUTCDay();
      assert.ok(flight.operatingDays.includes(departureDay), `${flight.flightNumber} departs outside its weekly schedule`);
    }
  }
});

test("multi-city stay choices only expose dates served by the onward flight", () => {
  const route = ROUTES.find((item) => item.id === "graph-pvg-hnl-lax");
  assert.ok(route);
  const baseline = scoreRoutes([route])[0];
  const stop = baseline.scheduledStops.find((item) => item.kind === "multi-city");
  assert.ok(stop);
  assert.ok(stop.options.length >= 3);
  for (const days of stop.options) {
    const result = scoreRoutes([route], { price: 30, interest: 35, directness: 35 }, { [route.id]: [days] })[0];
    const selected = result.scheduledStops.find((item) => item.kind === "multi-city");
    assert.equal(selected.playDays, days);
    assert.ok(selected.durationMinutes >= 0);
    const onward = result.scheduledTickets[1].flights[0];
    const departureDay = new Date(`${onward.departureDate}T00:00:00Z`).getUTCDay();
    assert.ok(onward.operatingDays.includes(departureDay));
  }
});

test("longer stopover stays raise experience toward a ceiling while lowering directness", () => {
  const route = ROUTES.find((item) => item.id === "graph-pvg-hnl-lax");
  assert.ok(route);
  const comparisonSet = ROUTES.filter((item) => item.origin === route.origin && item.destination === route.destination && item.months.includes("Sep"));
  const oneDay = scoreRoutes(comparisonSet, { price: 0, interest: 100, directness: 0 }, { [route.id]: [1] }).find((item) => item.id === route.id);
  const fourDays = scoreRoutes(comparisonSet, { price: 0, interest: 100, directness: 0 }, { [route.id]: [4] }).find((item) => item.id === route.id);
  assert.ok(oneDay && fourDays);
  assert.notEqual(oneDay.scheduledTickets[1].flights[0].departureDate, fourDays.scheduledTickets[1].flights[0].departureDate);
  assert.ok(fourDays.scores.interest > oneDay.scores.interest);
  assert.ok(fourDays.scores.directness < oneDay.scores.directness);
  assert.equal(oneDay.scores.total, oneDay.scores.interest);
  assert.equal(fourDays.scores.total, fourDays.scores.interest);
});

test("sigmoid stopover experience approaches its ceiling by two to three days", () => {
  const route = ROUTES.find((item) => item.id === "graph-pvg-nrt-lax");
  assert.ok(route);
  const values = [2, 3, 5, 7].map((days) => scoreRoutes([route], { price: 0, interest: 100, directness: 0 }, { [route.id]: [days] })[0].scores.usableTime);
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]));
  assert.ok(values[1] > values[0]);
  assert.ok(values[1] > 98);
  assert.ok(values[values.length - 1] <= 100);
});

test("component and final scores follow the Ranking Algorithm PDF formulas", () => {
  const routes = ROUTES.filter((route) => route.origin === "PVG" && route.destination === "LAX" && route.months.includes("Sep"));
  const weights = { price: 30, interest: 35, directness: 35 };
  const scored = scoreRoutes(routes, weights);
  assert.equal(Math.round(Math.max(...scored.map((route) => route.scores.price))), 100);
  assert.equal(Math.round(Math.min(...scored.map((route) => route.scores.price))), 0);
  for (const route of scored) {
    const expectedDirectness = 0.4 * route.scores.stops + 0.4 * route.scores.duration + 0.2 * route.scores.convenience;
    const expectedInterest = route.scheduledStops.length
      ? 0.4 * route.scores.attractiveness + 0.3 * route.scores.usableTime + 0.2 * route.scores.airportAccess + 0.1 * route.scores.timeWindow
      : 0;
    const expectedTotal = (route.scores.price * weights.price + route.scores.interest * weights.interest + route.scores.directness * weights.directness) / 100;
    assert.ok(Math.abs(route.scores.directness - expectedDirectness) < 1e-9);
    assert.ok(Math.abs(route.scores.interest - expectedInterest) < 1e-9);
    assert.ok(Math.abs(route.scores.total - expectedTotal) < 1e-9);
  }
});
