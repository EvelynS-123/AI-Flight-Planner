import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  equalApexArcAltitude,
  greatCircleAngle,
} from "../app/route-globe-geometry.ts";

const routeFinderSource = await readFile(new URL("../app/route-finder.tsx", import.meta.url), "utf8");
const routeGlobeSource = await readFile(new URL("../app/route-globe.tsx", import.meta.url), "utf8");
const flightChatSource = await readFile(new URL("../app/flight-chat.tsx", import.meta.url), "utf8");
const globalCssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const preferenceChatSource = await readFile(new URL("../app/preference-chat.tsx", import.meta.url), "utf8");
const preferenceChatApiSource = await readFile(new URL("../app/api/preferences/chat/route.ts", import.meta.url), "utf8");
const chatApiSource = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const hubCharacteristicsSource = await readFile(new URL("../app/api/chat/hub-characteristics/route.ts", import.meta.url), "utf8");
const flightSearchApiSource = await readFile(new URL("../app/api/flights/search/route.ts", import.meta.url), "utf8");
const airportMapData = JSON.parse(await readFile(new URL("../public/map/airport-map-data.json", import.meta.url), "utf8"));
const routeCountries = JSON.parse(await readFile(new URL("../public/map/route-countries.geojson", import.meta.url), "utf8"));
const localizedAirportNames = JSON.parse(await readFile(new URL("../app/data/airport-localized-names.json", import.meta.url), "utf8"));

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

test("route details keep only three scores without a hover breakdown", () => {
  assert.doesNotMatch(routeFinderSource, /copy\.whyHere|copy\.scoreNote/);
  assert.equal((routeFinderSource.match(/<ScoreDetail/g) || []).length, 3);
  assert.doesNotMatch(routeFinderSource, /score-tooltip|scoreDetailCopy/);
  assert.doesNotMatch(globalCssSource, /\.score-tooltip|\.score-component|\.score-bonus/);
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

test("selected routes update a draggable satellite globe below the weight panel", () => {
  assert.match(routeFinderSource, /setSelectedRouteId\(routeId\)/);
  assert.match(routeFinderSource, /className="route-results-layout"/);
  assert.match(routeFinderSource, /<RouteGlobe route=\{selectedRoute\} locale=\{locale\}/);
  assert.match(routeGlobeSource, /dynamic\(\(\) => import\("react-globe\.gl"\), \{ ssr: false \}\)/);
  assert.match(routeGlobeSource, /globeImageUrl="\/map\/earth-blue-marble\.jpg"/);
  assert.match(routeGlobeSource, /polygonsData=\{countries\}/);
  assert.match(routeGlobeSource, /routeCountries\.has/);
  assert.match(routeGlobeSource, /function routeFlightLegs/);
  assert.match(routeGlobeSource, /const ARC_APEX_ALTITUDE = 0\.12/);
  assert.match(routeGlobeSource, /arcAltitude=\{\(arc\) => \(arc as RouteArc\)\.altitude\}/);
  assert.match(routeGlobeSource, /pointsData=\{routePoints\}/);
  assert.doesNotMatch(routeGlobeSource, /htmlElementsData|route-globe-order-marker/);
  assert.match(routeGlobeSource, /const ROUTE_START_COLOR = "#ff4d4f"/);
  assert.match(routeGlobeSource, /const ROUTE_END_COLOR = "#ffd43b"/);
  assert.match(routeGlobeSource, /\[ROUTE_START_COLOR, ROUTE_END_COLOR\]/);
  assert.match(globalCssSource, /\.route-globe-itinerary i \{[^}]*background: #ff4d4f/);
  assert.match(globalCssSource, /\.route-globe-itinerary \.stopover i \{ background: #ff9f43/);
  assert.match(globalCssSource, /\.route-globe-itinerary \.destination i \{ background: #ffd43b/);
  assert.doesNotMatch(routeGlobeSource, /labelsData|RouteArrow|labelText/);
  assert.doesNotMatch(routeGlobeSource, /arcDashLength|arcDashGap|arcDashAnimateTime/);
  assert.match(routeGlobeSource, /arcStroke=\{1\}/);
  assert.match(routeGlobeSource, /kind === "stopover" \? 0\.85 : 1/);
  assert.match(routeGlobeSource, /pointAltitude=\{0\.055\}/);
  assert.doesNotMatch(routeGlobeSource, /routePoint\.order|arc\.order/);
  assert.match(routeGlobeSource, /fetch\("\/map\/airport-map-data\.json"/);
  assert.match(routeGlobeSource, /fetch\("\/map\/route-countries\.geojson"/);
  assert.match(routeGlobeSource, /controls\.enableZoom = false/);
  assert.doesNotMatch(routeGlobeSource, /zoomGlobe|route-globe-zoom|滚轮缩放/);
  assert.doesNotMatch(globalCssSource, /\.route-globe-zoom/);
  assert.match(routeGlobeSource, /role="img"/);
  assert.match(routeFinderSource, /className="route-results-layout"[\s\S]*className="route-globe-sticky"[\s\S]*<RouteGlobe/);
  assert.doesNotMatch(routeFinderSource, /<\/main>[\s\S]*<RouteGlobe/);
  assert.match(globalCssSource, /\.route-globe-sticky \{ position: sticky; top: 16px/);
  assert.match(globalCssSource, /\.planner \{[^}]*overflow: clip/);
  assert.doesNotMatch(globalCssSource, /route-globe-viewport-dock|route-globe-space/);
  assert.match(globalCssSource, /@media \(max-width: 900px\)[\s\S]*\.route-globe-sticky \{ position: static/);
  assert.match(globalCssSource, /\.route-globe-dock-toggle/);
});

test("route arcs compensate for globe curvature to share one rendered apex", () => {
  const endpointAltitude = 0.025;
  const apexAltitude = 0.12;
  const routes = [
    [31.1434, 121.8052, 22.308, 113.9185],
    [1.35019, 103.994, 37.618806, -122.375417],
  ];
  const controls = routes.map(([startLat, startLng, endLat, endLng]) => {
    const angle = greatCircleAngle(startLat, startLng, endLat, endLng);
    const altitude = equalApexArcAltitude(
      startLat,
      startLng,
      endLat,
      endLng,
      apexAltitude,
      endpointAltitude,
    );
    const controlRadius = 1 + 1.5 * altitude - 0.5 * endpointAltitude;
    const renderedApex = 0.25 * (1 + endpointAltitude) * Math.cos(angle / 2)
      + 0.75 * controlRadius * Math.cos(angle / 4)
      - 1;
    assert.ok(Math.abs(renderedApex - apexAltitude) < 1e-12);
    return { altitude, angle };
  });
  assert.ok(
    controls[1].altitude > controls[0].altitude,
    "long routes need a higher control point to avoid sagging into the globe",
  );

  const longArc = controls[1];
  const endpointRadius = 1 + endpointAltitude;
  const controlRadius = 1 + 1.5 * longArc.altitude - 0.5 * endpointAltitude;
  const points = [
    [endpointRadius * Math.cos(longArc.angle / 2), -endpointRadius * Math.sin(longArc.angle / 2)],
    [controlRadius * Math.cos(longArc.angle / 4), -controlRadius * Math.sin(longArc.angle / 4)],
    [controlRadius * Math.cos(longArc.angle / 4), controlRadius * Math.sin(longArc.angle / 4)],
    [endpointRadius * Math.cos(longArc.angle / 2), endpointRadius * Math.sin(longArc.angle / 2)],
  ];
  for (let step = 0; step <= 100; step += 1) {
    const t = step / 100;
    const u = 1 - t;
    const rendered = points[0].map((_, axis) => (
      u ** 3 * points[0][axis]
      + 3 * u ** 2 * t * points[1][axis]
      + 3 * u * t ** 2 * points[2][axis]
      + t ** 3 * points[3][axis]
    ));
    assert.ok(Math.hypot(...rendered) >= 1, "SIN to SFO must stay outside the globe");
  }
});

test("the route globe has coordinates and country codes for every localized airport", () => {
  assert.ok(Object.keys(airportMapData).length >= Object.keys(localizedAirportNames).length);
  for (const code of Object.keys(localizedAirportNames)) {
    const airport = airportMapData[code];
    assert.equal(airport?.length, 3, `${code} should have latitude, longitude, and country`);
    assert.ok(Number.isFinite(airport[0]) && airport[0] >= -90 && airport[0] <= 90);
    assert.ok(Number.isFinite(airport[1]) && airport[1] >= -180 && airport[1] <= 180);
    assert.match(airport[2], /^[A-Z]{2}$/);
  }
});

test("the local country overlay contains strategy-map polygons", () => {
  assert.equal(routeCountries.type, "FeatureCollection");
  assert.ok(routeCountries.features.length >= 170);
  assert.ok(routeCountries.features.some((feature) => feature.properties.country === "TW"));
  assert.equal(airportMapData.TPE[2], "TW");
  assert.equal(airportMapData.TSA[2], "TW");
  for (const feature of routeCountries.features) {
    assert.match(feature.properties.country, /^[A-Z]{2}$/);
    assert.ok(["Polygon", "MultiPolygon"].includes(feature.geometry.type));
  }
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

test("named cities expand to their practical commercial airports", () => {
  assert.match(chatApiSource, /New York → JFK, EWR, LGA/);
  assert.match(chatApiSource, /London → LHR, LGW, STN, LTN, LCY/);
  assert.match(chatApiSource, /When the user explicitly names an airport or IATA code, keep only that airport/);
  assert.match(flightSearchApiSource, /normalizeAirportGroup\(legOrigins\)/);
  assert.match(flightSearchApiSource, /normalizeAirportGroup\(legDestinations\)/);
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
