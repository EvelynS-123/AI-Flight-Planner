import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES, moveWeightBoundary, scoreRoutes } from "../app/route-data.ts";

test("demo includes a broad set of all three ticket types", () => {
  assert.ok(ROUTES.length >= 90);
  assert.ok(ROUTES.some((route) => route.ticketType === "direct"));
  assert.ok(ROUTES.some((route) => route.ticketType === "connection"));
  assert.ok(ROUTES.some((route) => route.ticketType === "multi-city"));
});

test("default September search shows direct, connection, and multi-city choices", () => {
  const routes = ROUTES.filter((route) => route.origin === "PVG" && route.destination === "LAX" && route.months.includes("Sep"));
  assert.deepEqual(new Set(routes.map((route) => route.ticketType)), new Set(["direct", "connection", "multi-city"]));
});

test("both shared-bar boundaries preserve a 100 percent total", () => {
  const first = moveWeightBoundary({ price: 30, interest: 35, directness: 35 }, "price-interest", 50);
  const second = moveWeightBoundary(first, "interest-directness", 80);
  assert.deepEqual(first, { price: 50, interest: 15, directness: 35 });
  assert.deepEqual(second, { price: 50, interest: 30, directness: 20 });
  assert.equal(second.price + second.interest + second.directness, 100);
});

test("changing weights changes the winner according to the selected priority", () => {
  const routes = ROUTES.filter((route) => route.origin === "PVG" && route.destination === "LAX" && route.months.includes("Sep"));
  const cheapest = scoreRoutes(routes, { price: 100, interest: 0, directness: 0 }).sort((a, b) => b.scores.total - a.scores.total)[0];
  const mostDirect = scoreRoutes(routes, { price: 0, interest: 0, directness: 100 }).sort((a, b) => b.scores.total - a.scores.total)[0];
  assert.equal(cheapest.total, Math.min(...routes.map((route) => route.total)));
  assert.equal(mostDirect.ticketType, "direct");
});
