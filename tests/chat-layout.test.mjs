import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeFinderSource = await readFile(new URL("../app/route-finder.tsx", import.meta.url), "utf8");
const flightChatSource = await readFile(new URL("../app/flight-chat.tsx", import.meta.url), "utf8");
const globalCssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const preferenceChatSource = await readFile(new URL("../app/preference-chat.tsx", import.meta.url), "utf8");
const preferenceChatApiSource = await readFile(new URL("../app/api/preferences/chat/route.ts", import.meta.url), "utf8");
const chatApiSource = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const hubCharacteristicsSource = await readFile(new URL("../app/api/chat/hub-characteristics/route.ts", import.meta.url), "utf8");
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

test("preference chatbot replaces numeric quiz without removing manual route weights", () => {
  assert.match(routeFinderSource, /<PreferenceChat/);
  assert.doesNotMatch(routeFinderSource, /preference-scale|PREFERENCE_CATEGORIES\.map/);
  assert.match(routeFinderSource, /moveBoundaryFromKeyboard/);
  assert.match(routeFinderSource, /className=\{`weight-panel/);
  assert.match(preferenceChatSource, /\/api\/preferences\/chat/);
  assert.match(preferenceChatSource, /readyToSave/);
  assert.match(preferenceChatSource, /你平时最喜欢做什么/);
  assert.match(preferenceChatApiSource, /Ask exactly one short, useful question per turn/);
  assert.match(preferenceChatApiSource, /Interview naturally instead of walking through a questionnaire/);
  assert.match(preferenceChatApiSource, /Do not default to binary or multiple-choice questions/);
  assert.match(preferenceChatApiSource, /Preprocess the conversation into concise, durable preference facts/);
});

test("first visit requires a saved language before opening preference chat", () => {
  assert.match(routeFinderSource, /LOCALE_STORAGE_KEY/);
  assert.match(routeFinderSource, /localeGate/);
  assert.match(routeFinderSource, /className=\{`language-gate/);
  assert.match(routeFinderSource, /function chooseInitialLocale/);
  assert.match(routeFinderSource, /localStorage\.setItem\(LOCALE_STORAGE_KEY/);
  assert.match(routeFinderSource, /onLocaleChange=\{changeLocale\}/);
});

test("changing language updates the preference chat greeting", () => {
  assert.match(
    preferenceChatSource,
    /setMessages\(\(current\) =>[\s\S]*current\.slice\(1\)[\s\S]*\[locale, memory\]/,
  );
});

test("route details keep only three scores and reveal component weights on hover or focus", () => {
  assert.doesNotMatch(routeFinderSource, /copy\.whyHere|copy\.scoreNote/);
  assert.equal((routeFinderSource.match(/<ScoreDetail/g) || []).length, 3);
  assert.match(routeFinderSource, /interestComponents/);
  assert.match(routeFinderSource, /directnessComponents/);
  assert.match(globalCssSource, /\.score-detail:hover \.score-tooltip/);
  assert.match(globalCssSource, /\.score-detail:focus-visible \.score-tooltip/);
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

test("AI thinking and route search expose accessible request-bound loading states", () => {
  assert.match(flightChatSource, /loading && phase === "chat"[\s\S]*className="chat-searching chat-thinking" role="status"/);
  assert.match(routeFinderSource, /aria-busy=\{isLoading\}[\s\S]*isLoading && \([\s\S]*className="route-search-loader" role="status"/);
  assert.match(globalCssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.route-search-plane/);
});

test("grouped live results expose one inline date and time selector", () => {
  assert.match(routeFinderSource, /const groups = groupFlightResults\(flights\)/);
  assert.match(routeFinderSource, /className="live-variant-picker"/);
  assert.match(routeFinderSource, /type="date"/);
  assert.match(routeFinderSource, /currentTarget\.showPicker\(\)/);
  assert.match(routeFinderSource, /variantRequest:/);
  assert.match(routeFinderSource, /selectLiveFlightVariant\(route\.id, event\.target\.value\)/);
  assert.match(flightChatSource, /chatResultsTitle\(groupFlightResults\(flights\)\.length\)/);
});

test("variant choices expose sightseeing time and keep the edited route anchored", () => {
  assert.match(routeFinderSource, /maxUsableStopoverMinutesForFlight/);
  assert.match(routeFinderSource, /className="variant-native-control"/);
  assert.match(routeFinderSource, /variantAnchor\.current = \{ id: groupId, top:/);
  assert.match(routeFinderSource, /window\.scrollTo\(\{ top: window\.scrollY \+ delta, behavior: "auto" \}\)/);
  assert.match(routeFinderSource, /if \(id === anchoredRouteId\) continue/);
});

test("mixed multi-city routes distinguish connection hubs and show both labels", () => {
  assert.match(routeFinderSource, /hasInternalConnections = route\.ticketType === "multi-city"/);
  assert.match(routeFinderSource, /const isConnectionHub = stopKind === "connection"/);
  assert.match(routeFinderSource, /isConnectionHub \? "connection-hub" : "multi-city-hub"/);
  assert.match(routeFinderSource, /className="ticket-pill connection">\{copy\.connection\}/);
});

test("route exploration stays generalized, diverse, and preference-grounded", () => {
  assert.match(chatApiSource, /match each hub's real travel character to them semantically/);
  assert.match(chatApiSource, /rather than a fixed route table/);
  assert.match(chatApiSource, /Do not impose a fixed candidate count/);
  assert.match(chatApiSource, /including South Asia, Central Asia, the Middle East, Europe, East Asia, and Southeast Asia/);
  assert.match(chatApiSource, /Maximize diversity across countries, regions, and city character/);
  assert.match(chatApiSource, /do not target a fixed number of direct, connecting, or multi-city results/);
  assert.match(flightSearchApiSource, /normalizeExplorationHubs/);
  assert.match(flightSearchApiSource, /combineTwoLegResults/);
});

test("users explicitly limit stopover exploration before search", () => {
  assert.match(flightChatSource, /selectedHubs\.length >= 3/);
  assert.match(flightChatSource, /explorationHubs: selectedHubs/);
  assert.doesNotMatch(flightChatSource, /live searches|实时搜索|リアルタイム検索は約|실시간 검색 약/);
  assert.match(flightSearchApiSource, /MAX_PROVIDER_REQUESTS = 1 \+ MAX_EXPLORATION_HUBS \* 2/);
  assert.match(flightChatSource, /option\.codes\.join\(" \/ "\)/);
  assert.match(flightSearchApiSource, /\.split\(","\)/);
});

test("stopover choices are extracted from one verified regular search", () => {
  assert.match(flightChatSource, /verifiedHubOptions/);
  assert.match(flightChatSource, /explorationHubs: \[\]/);
  assert.match(flightChatSource, /flight\.stopAirports/);
  assert.doesNotMatch(flightChatSource, /实时联程航线已验证|Verified in live connecting itineraries/);
  assert.match(flightChatSource, /\/api\/chat\/hub-characteristics/);
  assert.match(hubCharacteristicsSource, /Keep every supplied IATA code exactly once/);
  assert.match(hubCharacteristicsSource, /LOCALIZED_AIRPORT_NAMES/);
  assert.doesNotMatch(hubCharacteristicsSource, /"city":"localized city name"/);
  assert.match(flightChatSource, /return applyHubDetails\(options, data\.hubs\)/);
  assert.doesNotMatch(hubCharacteristicsSource, /AUH|IST|HAK|DEL|BOM/);
  assert.doesNotMatch(flightChatSource, /\.slice\(0, 12\)/);
});

test("chat accepts compact conversational dates without Markdown JSON ambiguity", () => {
  assert.match(chatApiSource, /"9\.15", "9\/15", "9-15"/);
  assert.match(chatApiSource, /Do not wrap it in Markdown or a code fence/);
});

test("chat always searches one way and never asks for return dates", () => {
  assert.match(chatApiSource, /NEVER ask whether the trip is one-way or round-trip/);
  assert.match(chatApiSource, /tripType: "one_way"/);
  assert.match(chatApiSource, /returnDateStart: _returnDateStart/);
});
