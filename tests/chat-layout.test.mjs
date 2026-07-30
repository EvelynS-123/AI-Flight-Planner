import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeFinderSource = await readFile(new URL("../app/route-finder.tsx", import.meta.url), "utf8");
const flightChatSource = await readFile(new URL("../app/flight-chat.tsx", import.meta.url), "utf8");
const chatApiSource = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const flightSearchApiSource = await readFile(new URL("../app/api/flights/search/route.ts", import.meta.url), "utf8");

test("chatbot replaces the legacy origin destination and month search form", () => {
  assert.doesNotMatch(routeFinderSource, /className="search-card"/);
  assert.doesNotMatch(routeFinderSource, /POPULAR_AIRPORTS|draftOrigin|draftDestination/);
  assert.match(routeFinderSource, /const \[searched, setSearched\] = useState\(false\)/);
  assert.match(routeFinderSource, /className="assistant-search-panel" hidden=\{!isChatOpen\}/);
  assert.match(routeFinderSource, /<FlightChat[\s\S]*onSearchStart=\{beginChatSearch\}/);
});

test("chat search skips the weight refinement step and collapses before searching", () => {
  assert.doesNotMatch(flightChatSource, /WeightPanel|\/api\/chat\/analyze/);
  assert.match(flightChatSource, /setPhase\("searching"\);[\s\S]*onSearchStart\(\);[\s\S]*searchFlights\(submittedParams\)/);
  assert.match(routeFinderSource, /function beginChatSearch\(\)[\s\S]*setIsChatOpen\(false\)/);
});

test("chat component remains mounted while its interface is collapsed", () => {
  assert.match(routeFinderSource, /<div className="assistant-search-panel" hidden=\{!isChatOpen\}>[\s\S]*<FlightChat/);
  assert.match(routeFinderSource, /!isChatOpen && !isLoading && \([\s\S]*className="assistant-reopen"/);
  assert.doesNotMatch(routeFinderSource, /\{isChatOpen && \(\s*<FlightChat/);
});

test("loading state hides stale route metadata and controls", () => {
  assert.match(routeFinderSource, /!isLoading && \(\s*<div className="results-heading">/);
  assert.match(routeFinderSource, /!isLoading && results\.length > 0 && \(\s*<div className=\{`weight-panel/);
});

test("grouped live results expose one inline date and time selector", () => {
  assert.match(routeFinderSource, /const groups = groupFlightResults\(flights\)/);
  assert.match(routeFinderSource, /className="live-variant-picker"/);
  assert.match(routeFinderSource, /type="date"/);
  assert.match(routeFinderSource, /variantRequest:/);
  assert.match(routeFinderSource, /selectLiveFlightVariant\(route\.id, event\.target\.value\)/);
  assert.match(flightChatSource, /chatResultsTitle\(groupFlightResults\(flights\)\.length\)/);
});

test("route exploration stays generalized, diverse, and preference-grounded", () => {
  assert.match(chatApiSource, /match each hub's real travel character to them semantically/);
  assert.match(chatApiSource, /rather than a fixed route table/);
  assert.match(chatApiSource, /8–12 grounded candidates/);
  assert.match(chatApiSource, /Maximize diversity across countries, regions, and city character/);
  assert.match(chatApiSource, /do not target a fixed number of direct, connecting, or multi-city results/);
  assert.match(flightSearchApiSource, /normalizeExplorationHubs/);
  assert.match(flightSearchApiSource, /combineTwoLegResults/);
});

test("users explicitly limit stopover exploration before search", () => {
  assert.match(flightChatSource, /selectedHubs\.length >= 3/);
  assert.match(flightChatSource, /explorationHubs: selectedHubs/);
  assert.match(flightChatSource, /1 \+ count \* 2/);
  assert.match(flightSearchApiSource, /MAX_PROVIDER_REQUESTS = 1 \+ MAX_EXPLORATION_HUBS \* 2/);
});

test("stopover choices are extracted from one verified regular search", () => {
  assert.match(flightChatSource, /verifiedHubOptions/);
  assert.match(flightChatSource, /explorationHubs: \[\]/);
  assert.match(flightChatSource, /flight\.stopAirports/);
  assert.match(flightChatSource, /Verified in live connecting itineraries/);
});

test("chat always searches one way and never asks for return dates", () => {
  assert.match(chatApiSource, /NEVER ask whether the trip is one-way or round-trip/);
  assert.match(chatApiSource, /tripType: "one_way"/);
  assert.match(chatApiSource, /returnDateStart: _returnDateStart/);
});
