export type AirportCode = "PVG" | "PEK" | "HKG" | "TPE" | "ICN" | "KIX" | "LAX" | "SFO" | "SEA" | "YVR";

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
  hub: "NRT" | "ICN" | "TPE" | "HNL";
  months: Array<"Aug" | "Sep">;
  segments: [Segment, Segment];
  total: number;
};

export const AIRPORTS: Record<string, { city: string; country: string }> = {
  PVG: { city: "上海", country: "中国" },
  PEK: { city: "北京", country: "中国" },
  HKG: { city: "香港", country: "中国香港" },
  TPE: { city: "台北", country: "中国台湾" },
  ICN: { city: "首尔", country: "韩国" },
  KIX: { city: "大阪", country: "日本" },
  NRT: { city: "东京", country: "日本" },
  HNL: { city: "檀香山", country: "美国" },
  LAX: { city: "洛杉矶", country: "美国" },
  SFO: { city: "旧金山", country: "美国" },
  SEA: { city: "西雅图", country: "美国" },
  YVR: { city: "温哥华", country: "加拿大" },
};

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
  hnlLax: { price: 149, date: "2026-09-09", airline: "United", source: "Google Flights", url: "https://www.google.com/travel/flights/flights-from-honolulu-to-los-angeles.html", stops: 0 },
  hnlSfo: { price: 174, date: "2026-09-09", airline: "United", source: "Google Flights", url: "https://www.google.com/travel/flights/flights-from-honolulu-to-san-francisco.html", stops: 0 },
  hnlYvr: { price: 189, date: "2026-09-21", airline: "Route fare", source: "KAYAK", url: "https://www.kayak.com/flight-routes/Honolulu-HNL/Vancouver-Intl-YVR", stops: 0 },
  hnlSea: { price: 193, date: "2026-09-10", airline: "Route fare", source: "Expedia", url: "https://www.expedia.com/lp/flights/hnl/sea/honolulu-to-seattle", stops: 0 },
} as const;

function option(id: string, origin: AirportCode, hub: RouteOption["hub"], destination: AirportCode, first: keyof typeof SOURCES, second: keyof typeof SOURCES): RouteOption {
  const a = SOURCES[first];
  const b = SOURCES[second];
  return {
    id,
    origin,
    destination,
    hub,
    months: ["Aug", "Sep"],
    segments: [
      { from: origin, to: hub, ...a },
      { from: hub, to: destination, ...b },
    ],
    total: Number((a.price + b.price).toFixed(2)),
  };
}

export const ROUTES: RouteOption[] = [
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
];

export function scoreRoutes(routes: RouteOption[]) {
  if (!routes.length) return [];
  const prices = routes.map((route) => route.total);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return routes.map((route) => {
    const price = max === min ? 100 : ((max - route.total) / (max - min)) * 100;
    const extraStops = route.segments.reduce((sum, segment) => sum + segment.stops, 0);
    const normalizedStops = Math.max(0, 100 - extraStops * 35);
    const convenience = 50;
    const directness = 0.4 * normalizedStops + 0.4 * 50 + 0.2 * convenience;
    const experience = 50;
    const balanced = 0.3 * price + 0.35 * directness + 0.35 * experience;
    return { ...route, scores: { price, directness, experience, balanced } };
  });
}
