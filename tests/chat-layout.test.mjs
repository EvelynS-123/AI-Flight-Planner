import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeFinderSource = await readFile(new URL("../app/route-finder.tsx", import.meta.url), "utf8");
const flightChatSource = await readFile(new URL("../app/flight-chat.tsx", import.meta.url), "utf8");

test("chatbot replaces the legacy origin destination and month search form", () => {
  assert.doesNotMatch(routeFinderSource, /className="search-card"/);
  assert.doesNotMatch(routeFinderSource, /POPULAR_AIRPORTS|draftOrigin|draftDestination/);
  assert.match(routeFinderSource, /const \[searched, setSearched\] = useState\(false\)/);
  assert.match(routeFinderSource, /className="assistant-search-panel" hidden=\{!isChatOpen\}/);
  assert.match(routeFinderSource, /<FlightChat[\s\S]*onSearchStart=\{beginChatSearch\}/);
});

test("chat search skips the weight refinement step and collapses before searching", () => {
  assert.doesNotMatch(flightChatSource, /WeightPanel|\/api\/chat\/analyze/);
  assert.match(flightChatSource, /setPhase\("searching"\);[\s\S]*onSearchStart\(\);[\s\S]*searchFlights\(searchParams\)/);
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
