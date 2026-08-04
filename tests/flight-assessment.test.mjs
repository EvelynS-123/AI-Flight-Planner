import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFlightAssessmentCandidates,
  fallbackFlightAssessments,
  flightAssessmentView,
  normalizeModelFlightAssessments,
  parseFlightAssessmentResponse,
  sanitizeFlightAssessmentRoutes,
} from "../app/flight-assessment.ts";

const routes = [
  {
    routeId: "cheap-stopover",
    ticketType: "multi-city",
    totalPrice: 400,
    totalDurationMinutes: 10_000,
    stopCount: 1,
    priceScore: 100,
    durationScore: 0,
    directnessScore: 20,
    interestScore: 100,
    stops: [{
      airport: "ICN",
      kind: "multi-city",
      durationMinutes: 8_640,
      usableMinutes: 8_000,
    }],
  },
  {
    routeId: "fast-direct",
    ticketType: "direct",
    totalPrice: 800,
    totalDurationMinutes: 600,
    stopCount: 0,
    priceScore: 0,
    durationScore: 100,
    directnessScore: 100,
    interestScore: 0,
    stops: [],
  },
  {
    routeId: "balanced-connection",
    ticketType: "connection",
    totalPrice: 520,
    totalDurationMinutes: 900,
    stopCount: 1,
    priceScore: 70,
    durationScore: 70,
    directnessScore: 65,
    interestScore: 55,
    stops: [{
      airport: "NRT",
      kind: "connection",
      durationMinutes: 150,
      usableMinutes: 0,
    }],
  },
];

test("assessment candidates contain only claims supported by route comparisons", () => {
  const candidates = buildFlightAssessmentCandidates(routes);
  const cheap = candidates.find((candidate) => candidate.routeId === "cheap-stopover");
  const direct = candidates.find((candidate) => candidate.routeId === "fast-direct");

  assert.ok(cheap.pros.some((fact) => fact.type === "lowest-price" && fact.value === 400));
  assert.ok(cheap.cons.some((fact) => fact.type === "self-transfer"));
  assert.ok(cheap.cons.some((fact) => (
    fact.type === "very-long-stopover"
    && fact.value === 8_640
    && fact.airport === "ICN"
  )));
  assert.ok(direct.pros.some((fact) => fact.type === "nonstop"));
  assert.ok(direct.pros.some((fact) => fact.type === "shortest-duration" && fact.value === 600));
  assert.ok(direct.cons.some((fact) => (
    fact.type === "highest-price"
    && fact.value === 800
    && fact.comparisonValue === 400
  )));
});

test("model output can select exact fact IDs but cannot add a new fact", () => {
  const candidates = buildFlightAssessmentCandidates(routes);
  const cheap = candidates[0];
  const selections = normalizeModelFlightAssessments([
    {
      routeId: cheap.routeId,
      proId: cheap.pros.find((fact) => fact.type === "lowest-price").id,
      conId: cheap.cons.find((fact) => fact.type === "very-long-stopover").id,
    },
    {
      routeId: "fast-direct",
      proId: "invented-pro",
      conId: "invented-con",
    },
  ], candidates);

  assert.equal(selections[0].generatedBy, "ai");
  assert.equal(selections[1].generatedBy, "rules");
  for (const selection of selections) {
    const candidate = candidates.find((item) => item.routeId === selection.routeId);
    assert.ok(candidate.pros.some((fact) => fact.id === selection.proId));
    assert.ok(candidate.cons.some((fact) => fact.id === selection.conId));
  }
});

test("Korean assessment copy states the selected facts and a matching verdict", () => {
  const candidate = buildFlightAssessmentCandidates(routes)[0];
  const selection = {
    routeId: candidate.routeId,
    proId: candidate.pros.find((fact) => fact.type === "lowest-price").id,
    conId: candidate.cons.find((fact) => fact.type === "very-long-stopover").id,
    generatedBy: "ai",
  };
  const view = flightAssessmentView(candidate, selection, "ko");

  assert.equal(view.title, "AI 한줄 평가");
  assert.match(view.pro, /최저가.*\$400/);
  assert.match(view.con, /ICN.*6일.*지나치게 긴/);
  assert.match(view.verdict, /가격이 최우선/);
});

test("fallback and response parsing keep the data-based label honest", () => {
  const candidates = buildFlightAssessmentCandidates(routes);
  const fallback = fallbackFlightAssessments(candidates);
  const parsed = parseFlightAssessmentResponse(fallback, candidates);

  assert.ok(parsed.every((selection) => selection.generatedBy === "rules"));
  assert.equal(
    flightAssessmentView(candidates[0], parsed[0], "ko").title,
    "데이터 기반 평가",
  );
});

test("assessment route input sanitization clamps metrics and removes duplicates", () => {
  const sanitized = sanitizeFlightAssessmentRoutes([
    { ...routes[0], directnessScore: 150, stops: routes[0].stops },
    { ...routes[0], totalPrice: 999 },
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].directnessScore, 100);
  assert.equal(sanitized[0].stops[0].airport, "ICN");
});
