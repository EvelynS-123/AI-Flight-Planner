import { scoreScheduledRoutes, type StopoverSelections } from "./flight-schedules.ts";

export type AirportCode = "PVG" | "PEK" | "HKG" | "TPE" | "ICN" | "KIX" | "NRT" | "LAX" | "SFO" | "SEA" | "YVR";

export type Segment = {
  from: string;
  to: string;
  price: number;
  date: string;
  airline: string;
  source: string;
  url: string;
  stops: number;
};

export type RouteOption = {
  id: string;
  origin: AirportCode;
  destination: AirportCode;
  hubs: string[];
  ticketType: "direct" | "connection" | "multi-city";
  stopCount: number;
  months: Array<"Aug" | "Sep">;
  segments: Segment[];
  total: number;
};

export type RouteWeights = {
  price: number;
  interest: number;
  directness: number;
};

export function moveWeightBoundary(
  current: RouteWeights,
  boundary: "price-interest" | "interest-directness",
  value: number,
): RouteWeights {
  const nextValue = Math.max(0, Math.min(100, Math.round(value)));
  if (boundary === "price-interest") {
    const price = Math.min(nextValue, 100 - current.directness);
    return { price, interest: 100 - price - current.directness, directness: current.directness };
  }
  const interestEnd = Math.max(current.price, nextValue);
  return { price: current.price, interest: interestEnd - current.price, directness: 100 - interestEnd };
}

export const AIRPORTS: Record<string, { city: string; country: string }> = {
  PVG: { city: "上海", country: "中国" },
  PEK: { city: "北京", country: "中国" },
  HKG: { city: "香港", country: "中国香港" },
  TPE: { city: "台北", country: "中国台湾" },
  ICN: { city: "首尔", country: "韩国" },
  KIX: { city: "大阪", country: "日本" },
  NRT: { city: "东京", country: "日本" },
  HNL: { city: "檀香山", country: "美国" },
  CAN: { city: "广州", country: "中国" },
  WUH: { city: "武汉", country: "中国" },
  MNL: { city: "马尼拉", country: "菲律宾" },
  LAX: { city: "洛杉矶", country: "美国" },
  SFO: { city: "旧金山", country: "美国" },
  SEA: { city: "西雅图", country: "美国" },
  YVR: { city: "温哥华", country: "加拿大" },
};

export const DEMO_ORIGINS: AirportCode[] = ["PVG", "HKG", "TPE", "NRT"];
export const DEMO_DESTINATIONS: AirportCode[] = ["LAX", "SFO", "SEA", "YVR"];

const SOURCES = {
  pvgNrt: { price: 106, date: "2026-09-18", airline: "Trip.com fare", source: "Trip.com", url: "https://www.trip.com/flights/airport-pvg-nrt/", stops: 0 },
  pvgIcn: { price: 114, date: "2026-09-04", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/pvg/icn/shanghai-to-seoul", stops: 0 },
  pvgTpe: { price: 87, date: "2026-09-15", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/pvg/tpe/shanghai-to-taipei", stops: 0 },
  pvgHnl: { price: 495, date: "route snapshot · checked Jul 2026", airline: "Korean Air", source: "Expedia", url: "https://www.expedia.com/lp/flight-routes/korean-air-from-pudong-intl-to-daniel-k-inouye-intl/ke/pvg/hnl", stops: 1 },
  pekNrt: { price: 169, date: "2026-08-08", airline: "Spring Japan", source: "Trip.com", url: "https://www.trip.com/flights/airport-pek-nrt/", stops: 0 },
  pekIcn: { price: 89, date: "2026-08-31", airline: "Shandong Airlines", source: "Trip.com", url: "https://ca.trip.com/flights/airport-pek-icn/", stops: 0 },
  hkgNrt: { price: 124, date: "2026-08-07", airline: "HK Express", source: "Trip.com", url: "https://us.trip.com/flights/airport-hkg-nrt/", stops: 0 },
  hkgIcn: { price: 97.57, date: "2026-09-05", airline: "Route fare", source: "Traveloka", url: "https://www.traveloka.com/en-en/flight/route/Hong-Kong-Seoul.HKG.ICN", stops: 0 },
  hkgHnl: { price: 424, date: "2026-09-13", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/hkg/hnl/hong-kong-to-honolulu", stops: 1 },
  tpeNrt: { price: 120, date: "2026-08 snapshot", airline: "Route fare", source: "AirHint", url: "https://deals.airhint.com/cheapest-deals/one-way/TPE/NRT", stops: 0 },
  tpeHnl: { price: 371, date: "2026-08-31", airline: "Alaska Airlines", source: "Trip.com", url: "https://www.trip.com/flights/city-tpe-airport-hnl/", stops: 1 },
  icnHnl: { price: 284, date: "2026-08-26", airline: "Air Premia", source: "Trip.com", url: "https://www.trip.com/flights/airport-icn-hnl/", stops: 0 },
  kixHnl: { price: 248, date: "2026-08-26", airline: "Route fare", source: "Momondo", url: "https://www.momondo.com/flights/kansai-intl-airport-kix/honolulu", stops: 0 },
  nrtHnl: { price: 211, date: "2026-09-29", airline: "ZIPAIR", source: "Trip.com", url: "https://www.trip.com/flights/airport-nrt-city-hnl/", stops: 0 },
  nrtIcn: { price: 115, date: "2026-09-30", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/nrt/icn/tokyo-to-seoul?flightType=ONE_WAY", stops: 0 },
  nrtTpe: { price: 115, date: "2026-09-10", airline: "Jetstar Japan", source: "Trip.com", url: "https://www.trip.com/flights/airport-nrt-city-tpe/", stops: 0 },
  nrtLax: { price: 265, date: "2026-09-12", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/nrt/lax/tokyo-to-los-angeles", stops: 0 },
  nrtSfo: { price: 389, date: "2026-09 snapshot", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/nrt/sfo/tokyo-to-san-francisco", stops: 0 },
  nrtYvr: { price: 303, date: "2026-09-10", airline: "ZIPAIR", source: "Trip.com", url: "https://www.trip.com/flights/airport-nrt-yvr/", stops: 0 },
  nrtSea: { price: 638, date: "2026-08-31", airline: "Route fare", source: "Agoda", url: "https://www.agoda.com/flights/airport/nrt/sea/tokyo-seattle-wa.html", stops: 0 },
  icnLax: { price: 397, date: "2026-09 snapshot", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/icn/lax/seoul-to-los-angeles", stops: 0 },
  icnSfo: { price: 395, date: "2026-09-25", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/sel/sfo/seoul-to-san-francisco", stops: 0 },
  icnYvr: { price: 398, date: "2026-09 snapshot", airline: "Route fare", source: "AirHint", url: "https://deals.airhint.com/cheapest-deals/one-way/ICN/YVR", stops: 0 },
  tpeLax: { price: 512, date: "2026-09-06", airline: "STARLUX", source: "Trip.com", url: "https://www.trip.com/flights/airport-tpe-lax/", stops: 0 },
  tpeSfo: { price: 444, date: "2026-08/09 snapshot", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/tpe/sfo/taipei-to-san-francisco", stops: 0 },
  tpeSea: { price: 406, date: "2026-09-11", airline: "Delta", source: "Trip.com", url: "https://www.trip.com/flights/airport-tpe-sea/", stops: 0 },
  icnSea: { price: 491, date: "2026-09-30", airline: "Philippine Airlines · 1 stop", source: "Google Flights", url: "https://www.google.com/travel/flights/flights-from-seoul-to-seattle.html?gl=US&hl=en-US", stops: 1 },
  hnlLax: { price: 149, date: "2026-09-09", airline: "United", source: "Google Flights", url: "https://www.google.com/travel/flights/flights-from-honolulu-to-los-angeles.html", stops: 0 },
  hnlSfo: { price: 174, date: "2026-09-09", airline: "United", source: "Google Flights", url: "https://www.google.com/travel/flights/flights-from-honolulu-to-san-francisco.html", stops: 0 },
  hnlYvr: { price: 189, date: "2026-09-21", airline: "Route fare", source: "KAYAK", url: "https://www.kayak.com/flight-routes/Honolulu-HNL/Vancouver-Intl-YVR", stops: 0 },
  hnlSea: { price: 193, date: "2026-09-10", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/hnl/sea/honolulu-to-seattle", stops: 0 },
} as const;

function option(id: string, origin: AirportCode, hub: string, destination: AirportCode, first: keyof typeof SOURCES, second: keyof typeof SOURCES): RouteOption {
  const a = SOURCES[first];
  const b = SOURCES[second];
  return {
    id,
    origin,
    destination,
    hubs: [hub],
    ticketType: "multi-city",
    stopCount: 1,
    months: ["Aug", "Sep"],
    segments: [
      { from: origin, to: hub, ...a },
      { from: hub, to: destination, ...b },
    ],
    total: Number((a.price + b.price).toFixed(2)),
  };
}

const SEED_ROUTES: RouteOption[] = [
  option("pvg-nrt-lax", "PVG", "NRT", "LAX", "pvgNrt", "nrtLax"),
  option("pvg-icn-lax", "PVG", "ICN", "LAX", "pvgIcn", "icnLax"),
  option("pvg-tpe-lax", "PVG", "TPE", "LAX", "pvgTpe", "tpeLax"),
  option("pvg-hnl-lax", "PVG", "HNL", "LAX", "pvgHnl", "hnlLax"),
  option("pvg-nrt-sfo", "PVG", "NRT", "SFO", "pvgNrt", "nrtSfo"),
  option("pvg-icn-sfo", "PVG", "ICN", "SFO", "pvgIcn", "icnSfo"),
  option("pvg-tpe-sfo", "PVG", "TPE", "SFO", "pvgTpe", "tpeSfo"),
  option("pvg-nrt-yvr", "PVG", "NRT", "YVR", "pvgNrt", "nrtYvr"),
  option("pvg-icn-yvr", "PVG", "ICN", "YVR", "pvgIcn", "icnYvr"),
  option("pvg-nrt-sea", "PVG", "NRT", "SEA", "pvgNrt", "nrtSea"),
  option("pvg-tpe-sea", "PVG", "TPE", "SEA", "pvgTpe", "tpeSea"),
  option("pek-nrt-lax", "PEK", "NRT", "LAX", "pekNrt", "nrtLax"),
  option("pek-icn-lax", "PEK", "ICN", "LAX", "pekIcn", "icnLax"),
  option("pek-nrt-yvr", "PEK", "NRT", "YVR", "pekNrt", "nrtYvr"),
  option("pek-icn-yvr", "PEK", "ICN", "YVR", "pekIcn", "icnYvr"),
  option("hkg-nrt-lax", "HKG", "NRT", "LAX", "hkgNrt", "nrtLax"),
  option("hkg-icn-lax", "HKG", "ICN", "LAX", "hkgIcn", "icnLax"),
  option("hkg-hnl-lax", "HKG", "HNL", "LAX", "hkgHnl", "hnlLax"),
  option("hkg-nrt-sfo", "HKG", "NRT", "SFO", "hkgNrt", "nrtSfo"),
  option("hkg-icn-sfo", "HKG", "ICN", "SFO", "hkgIcn", "icnSfo"),
  option("hkg-nrt-yvr", "HKG", "NRT", "YVR", "hkgNrt", "nrtYvr"),
  option("hkg-icn-yvr", "HKG", "ICN", "YVR", "hkgIcn", "icnYvr"),
  option("tpe-nrt-lax", "TPE", "NRT", "LAX", "tpeNrt", "nrtLax"),
  option("tpe-hnl-lax", "TPE", "HNL", "LAX", "tpeHnl", "hnlLax"),
  option("tpe-nrt-sfo", "TPE", "NRT", "SFO", "tpeNrt", "nrtSfo"),
  option("tpe-nrt-yvr", "TPE", "NRT", "YVR", "tpeNrt", "nrtYvr"),
  option("tpe-hnl-sea", "TPE", "HNL", "SEA", "tpeHnl", "hnlSea"),
  option("icn-hnl-lax", "ICN", "HNL", "LAX", "icnHnl", "hnlLax"),
  option("icn-hnl-sfo", "ICN", "HNL", "SFO", "icnHnl", "hnlSfo"),
  option("icn-hnl-yvr", "ICN", "HNL", "YVR", "icnHnl", "hnlYvr"),
  option("icn-hnl-sea", "ICN", "HNL", "SEA", "icnHnl", "hnlSea"),
  option("kix-hnl-lax", "KIX", "HNL", "LAX", "kixHnl", "hnlLax"),
  option("kix-hnl-sfo", "KIX", "HNL", "SFO", "kixHnl", "hnlSfo"),
  option("kix-hnl-yvr", "KIX", "HNL", "YVR", "kixHnl", "hnlYvr"),
  option("kix-hnl-sea", "KIX", "HNL", "SEA", "kixHnl", "hnlSea"),
  option("nrt-hnl-sea", "NRT", "HNL", "SEA", "nrtHnl", "hnlSea"),
  option("nrt-icn-sea", "NRT", "ICN", "SEA", "nrtIcn", "icnSea"),
  option("nrt-tpe-sea", "NRT", "TPE", "SEA", "nrtTpe", "tpeSea"),
];

const DIRECT_SEGMENTS: Segment[] = [
  { from: "PVG", to: "LAX", price: 612, date: "2026-09-16", airline: "United · source fare HK$4,775", source: "Trip.com", url: "https://www.trip.com/flights/airport-pvg-lax/", stops: 0 },
  { from: "NRT", to: "LAX", price: 262, date: "2026-09-09", airline: "ZIPAIR", source: "Google Flights", url: "https://www.google.com/travel/flights/flights-from-tokyo-to-los-angeles.html", stops: 0 },
  { from: "HKG", to: "LAX", price: 418, date: "2026-09 snapshot", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/hkg/lax/hong-kong-to-los-angeles", stops: 0 },
  { from: "ICN", to: "LAX", price: 397, date: "2026-09 snapshot", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/icn/lax/seoul-to-los-angeles", stops: 0 },
  { from: "ICN", to: "SFO", price: 395, date: "2026-09-25", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/sel/sfo/seoul-to-san-francisco", stops: 0 },
  { from: "ICN", to: "YVR", price: 398, date: "2026-09 snapshot", airline: "Route fare", source: "AirHint", url: "https://deals.airhint.com/cheapest-deals/one-way/ICN/YVR", stops: 0 },
  { from: "TPE", to: "LAX", price: 512, date: "2026-09-06", airline: "STARLUX", source: "Trip.com", url: "https://www.trip.com/flights/airport-tpe-lax/", stops: 0 },
  { from: "TPE", to: "SFO", price: 444, date: "2026-08/09 snapshot", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/tpe/sfo/taipei-to-san-francisco", stops: 0 },
  { from: "TPE", to: "SEA", price: 406, date: "2026-09-11", airline: "Delta", source: "Trip.com", url: "https://www.trip.com/flights/airport-tpe-sea/", stops: 0 },
  { from: "KIX", to: "LAX", price: 586, date: "2026-08/09 snapshot", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/kix/lax/osaka-to-los-angeles", stops: 0 },
  { from: "HKG", to: "SEA", price: 926.52, date: "2026-08-11", airline: "Cathay Pacific", source: "Traveloka", url: "https://www.traveloka.com/en-en/flight/route/Hong-Kong-Seattle.HKG.SEA", stops: 0 },
];

function itinerary(
  id: string,
  origin: AirportCode,
  destination: AirportCode,
  price: number,
  date: string,
  airline: string,
  source: string,
  url: string,
  hubs: string[] = [],
): RouteOption {
  return {
    id,
    origin,
    destination,
    hubs,
    ticketType: "connection",
    stopCount: Math.max(1, hubs.length),
    months: [date.includes("08-") ? "Aug" : "Sep"],
    segments: [{ from: origin, to: destination, price, date, airline, source, url, stops: Math.max(1, hubs.length) }],
    total: price,
  };
}

function directItinerary(
  id: string,
  origin: AirportCode,
  destination: AirportCode,
  price: number,
  date: string,
  airline: string,
  source: string,
  url: string,
): RouteOption {
  return {
    id,
    origin,
    destination,
    hubs: [],
    ticketType: "direct",
    stopCount: 0,
    months: [date.includes("08-") ? "Aug" : "Sep"],
    segments: [{ from: origin, to: destination, price, date, airline, source, url, stops: 0 }],
    total: price,
  };
}

// Alternative nonstop observations stay separate from the graph's cheapest
// segment so one airport pair can compare more than one real direct option.
const DIRECT_ROUTES: RouteOption[] = [
  directItinerary("pvg-lax-direct-united", "PVG", "LAX", 609, "2026-09-09", "United Airlines", "Trip.com", "https://www.trip.com/flights/airport-pvg-lax/"),
  directItinerary("pvg-sfo-direct-mu", "PVG", "SFO", 709, "2026-09-10", "China Eastern Airlines", "Trip.com", "https://www.trip.com/flights/airport-pvg-sfo/"),
  directItinerary("hkg-lax-direct-united", "HKG", "LAX", 410, "2026-09-02", "United Airlines", "Trip.com", "https://www.trip.com/flights/airport-hkg-lax/"),
  directItinerary("hkg-sfo-direct-united", "HKG", "SFO", 430, "2026-09-14", "United Airlines", "Trip.com", "https://us.trip.com/flights/city-hkg-airport-sfo/"),
  directItinerary("tpe-lax-direct-ci", "TPE", "LAX", 516, "2026-09-03", "China Airlines", "Trip.com", "https://www.trip.com/flights/airport-tpe-lax/"),
  directItinerary("tpe-yvr-direct-ci", "TPE", "YVR", 579, "2026-09-14", "China Airlines", "Trip.com", "https://www.trip.com/flights/airport-tpe-city-yvr/"),
];

// These are end-to-end, single-search itinerary observations. Every connection
// keeps only hubs that were exposed by the source's flight schedule.
const CONNECTION_ROUTES: RouteOption[] = [
  itinerary("pvg-lax-connection-cz", "PVG", "LAX", 451, "2026-09-07", "China Southern Airlines", "Trip.com", "https://www.trip.com/flights/airport-pvg-lax/", ["CAN"]),
  itinerary("pvg-lax-connection-cathay", "PVG", "LAX", 455, "2026-09-11", "Cathay Pacific", "Trip.com", "https://www.trip.com/flights/airport-pvg-lax/", ["HKG"]),
  itinerary("pvg-sfo-connection-cz", "PVG", "SFO", 462, "2026-09-03", "China Southern Airlines", "Trip.com", "https://www.trip.com/flights/airport-pvg-sfo/", ["WUH"]),
  itinerary("pvg-sfo-connection-cathay", "PVG", "SFO", 482, "2026-09-12", "Cathay Pacific", "Trip.com", "https://www.trip.com/flights/airport-pvg-sfo/", ["HKG"]),
  itinerary("hkg-lax-connection-airpremia", "HKG", "LAX", 435, "2026-08-26", "Air Premia", "Trip.com", "https://www.trip.com/flights/airport-hkg-lax/", ["ICN"]),
  itinerary("hkg-lax-connection-ac", "HKG", "LAX", 396, "2026-09-13", "Air Canada", "Trip.com", "https://www.trip.com/flights/airport-hkg-lax/", ["YVR"]),
  itinerary("hkg-lax-connection-ca", "HKG", "LAX", 407, "2026-09-05", "Air China", "Trip.com", "https://www.trip.com/flights/airport-hkg-lax/", ["PEK"]),
  itinerary("hkg-lax-connection-jx", "HKG", "LAX", 416, "2026-09-05", "STARLUX Airlines", "Trip.com", "https://www.trip.com/flights/airport-hkg-lax/", ["TPE"]),
  itinerary("hkg-sfo-connection-ac", "HKG", "SFO", 354, "2026-09-13", "Air Canada", "Trip.com", "https://us.trip.com/flights/city-hkg-airport-sfo/", ["YVR"]),
  itinerary("hkg-sfo-connection-airpremia", "HKG", "SFO", 399, "2026-09-12", "Air Premia", "Trip.com", "https://us.trip.com/flights/city-hkg-airport-sfo/", ["ICN"]),
  itinerary("hkg-sfo-connection-pal", "HKG", "SFO", 401, "2026-09-07", "Philippine Airlines", "Trip.com", "https://us.trip.com/flights/city-hkg-airport-sfo/", ["MNL"]),
  itinerary("hkg-yvr-connection-ke", "HKG", "YVR", 451, "2026-09-30", "Korean Air", "Google Flights", "https://www.google.com/travel/flights/flights-from-hong-kong-to-vancouver.html", ["ICN"]),
  itinerary("hkg-sea-connection-jx", "HKG", "SEA", 450, "2026-09-04", "STARLUX Airlines", "Google Flights", "https://www.google.com/travel/flights/flights-from-hong-kong-to-seattle.html?gl=US&hl=en-US", ["TPE"]),
  itinerary("tpe-lax-connection-pal", "TPE", "LAX", 378, "2026-09-13", "Philippine Airlines", "Trip.com", "https://www.trip.com/flights/airport-tpe-lax/", ["MNL"]),
  itinerary("tpe-yvr-connection-ac", "TPE", "YVR", 360, "2026-09-15", "Air Canada", "Trip.com", "https://www.trip.com/flights/airport-tpe-city-yvr/", ["KIX"]),
  itinerary("nrt-lax-connection-ke", "NRT", "LAX", 437, "2026-09 route snapshot", "Korean Air", "Trip.com", "https://us.trip.com/flights/airport-nrt-lax/", ["ICN"]),
  itinerary("nrt-sea-connection-pal", "NRT", "SEA", 681, "2026-09-23", "Philippine Airlines", "Google Flights", "https://www.google.com/travel/flights/flights-from-tokyo-to-seattle.html?gl=US&hl=en-US", ["MNL"]),
];

const uniqueSegments = new Map<string, Segment>();
for (const segment of [...SEED_ROUTES.flatMap((route) => route.segments), ...DIRECT_SEGMENTS]) {
  const key = `${segment.from}-${segment.to}`;
  const current = uniqueSegments.get(key);
  if (!current || segment.price < current.price) uniqueSegments.set(key, segment);
}

export const SEGMENTS = [...uniqueSegments.values()];

function buildRoutes() {
  const origins = DEMO_ORIGINS;
  const destinations = DEMO_DESTINATIONS;
  const routes: RouteOption[] = [];

  function walk(origin: AirportCode, destination: AirportCode, airport: string, path: Segment[], visited: Set<string>) {
    if (path.length >= 3) return;
    for (const segment of SEGMENTS.filter((item) => item.from === airport)) {
      if (visited.has(segment.to)) continue;
      const nextPath = [...path, segment];
      if (segment.to === destination) {
        routes.push({
          id: `graph-${nextPath.map((item) => item.from).concat(destination).join("-").toLowerCase()}`,
          origin,
          destination,
          hubs: nextPath.slice(0, -1).map((item) => item.to),
          ticketType: nextPath.length === 1 ? "direct" : "multi-city",
          stopCount: nextPath.length === 1 ? nextPath[0].stops : nextPath.length - 1 + nextPath.reduce((sum, item) => sum + item.stops, 0),
          months: ["Aug", "Sep"],
          segments: nextPath,
          total: Number(nextPath.reduce((sum, item) => sum + item.price, 0).toFixed(2)),
        });
      } else if (!destinations.includes(segment.to as AirportCode)) {
        walk(origin, destination, segment.to, nextPath, new Set([...visited, segment.to]));
      }
    }
  }

  for (const origin of origins) {
    for (const destination of destinations) walk(origin, destination, origin, [], new Set([origin]));
  }
  return routes;
}

export const ROUTES: RouteOption[] = [...buildRoutes(), ...DIRECT_ROUTES, ...CONNECTION_ROUTES];

export function scoreRoutes(
  routes: RouteOption[],
  weights: RouteWeights = { price: 30, interest: 35, directness: 35 },
  selections: StopoverSelections = {},
) {
  return scoreScheduledRoutes(routes, weights, selections);
}
