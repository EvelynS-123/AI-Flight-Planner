"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import type { RankedRouteOption } from "./flight-schedules";
import { airportCity, type Locale } from "./i18n";
import { equalApexArcAltitude } from "./route-globe-geometry";

const InteractiveGlobe = dynamic(() => import("react-globe.gl"), { ssr: false });

type AirportMapEntry = readonly [latitude: number, longitude: number, country: string];
type Coordinates = readonly [latitude: number, longitude: number];
type PointKind = "origin" | "stopover" | "destination";
type RoutePoint = {
  code: string;
  country: string;
  kind: PointKind;
  label: string;
  lat: number;
  lng: number;
};
type RouteArc = {
  altitude: number;
  from: string;
  to: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};
type CountryFeature = {
  type: "Feature";
  properties: { country: string; name: string };
  geometry: { type: string; coordinates: unknown };
};
type CountryCollection = { type: "FeatureCollection"; features: CountryFeature[] };

const EMPTY_AIRPORTS: Record<string, AirportMapEntry> = {};
const ROUTE_START_COLOR = "#ff4d4f";
const ROUTE_END_COLOR = "#ffd43b";
const ORIGIN_COLOR = ROUTE_START_COLOR;
const STOPOVER_COLOR = "#ff9f43";
const DESTINATION_COLOR = ROUTE_END_COLOR;
const ROUTE_COUNTRY_COLOR = "rgba(34, 118, 174, 0.58)";
const ROUTE_COUNTRY_BORDER = "rgba(174, 238, 255, 0.98)";
const ROUTE_ARC_COLORS: [string, string] = [ROUTE_START_COLOR, ROUTE_END_COLOR];
const ARC_APEX_ALTITUDE = 0.12;
const ARC_ENDPOINT_ALTITUDE = 0.025;
const INITIAL_VIEW_ALTITUDE = 1.75;
const RENDERER_CONFIG = { antialias: true, alpha: true, powerPreference: "high-performance" } as const;

function copyFor(locale: Locale) {
  if (locale === "zh") return {
    eyebrow: "航线地图",
    title: "当前航线",
    drag: "拖动旋转",
    loading: "正在载入卫星地球",
    missing: "部分机场暂时缺少地图坐标",
    showMap: "展开地图",
    hideMap: "收起地图",
    credit: "卫星影像：NASA Blue Marble",
  };
  if (locale === "ko") return {
    eyebrow: "노선 지도",
    title: "현재 노선",
    drag: "드래그로 회전",
    loading: "위성 지구본을 불러오는 중",
    missing: "일부 공항의 지도 좌표가 없습니다",
    showMap: "지도 펼치기",
    hideMap: "지도 접기",
    credit: "위성 이미지: NASA Blue Marble",
  };
  if (locale === "ja") return {
    eyebrow: "ルートマップ",
    title: "現在のルート",
    drag: "ドラッグで回転",
    loading: "衛星地球を読み込み中",
    missing: "一部の空港は地図座標がありません",
    showMap: "地図を開く",
    hideMap: "地図を閉じる",
    credit: "衛星画像：NASA Blue Marble",
  };
  return {
    eyebrow: "Route map",
    title: "Current route",
    drag: "Drag to rotate",
    loading: "Loading satellite globe",
    missing: "Some airports are missing map coordinates",
    showMap: "Show map",
    hideMap: "Hide map",
    credit: "Satellite imagery: NASA Blue Marble",
  };
}

function routeAirportCodes(route: RankedRouteOption): string[] {
  const flightCodes = route.scheduledTickets.flatMap((ticket) => (
    ticket.flights.flatMap((flight) => [flight.from, flight.to])
  ));
  const source = flightCodes.length > 0
    ? flightCodes
    : [route.origin, ...route.hubs, route.destination];

  return source.reduce<string[]>((codes, code) => {
    const normalized = code.trim().toUpperCase();
    if (normalized && codes.at(-1) !== normalized) codes.push(normalized);
    return codes;
  }, []);
}

function routeFlightLegs(route: RankedRouteOption): Array<{ from: string; to: string }> {
  const scheduledLegs = route.scheduledTickets.flatMap((ticket) => (
    ticket.flights.map((flight) => ({
      from: flight.from.trim().toUpperCase(),
      to: flight.to.trim().toUpperCase(),
    }))
  ));
  if (scheduledLegs.length > 0) return scheduledLegs;

  const codes = [route.origin, ...route.hubs, route.destination];
  return codes.slice(0, -1).map((code, index) => ({
    from: code.trim().toUpperCase(),
    to: codes[index + 1].trim().toUpperCase(),
  }));
}

function routeCenter(points: Coordinates[]): Coordinates {
  const vector = points.reduce((sum, [latitude, longitude]) => {
    const lat = latitude * Math.PI / 180;
    const lon = longitude * Math.PI / 180;
    const cosLat = Math.cos(lat);
    sum[0] += cosLat * Math.cos(lon);
    sum[1] += cosLat * Math.sin(lon);
    sum[2] += Math.sin(lat);
    return sum;
  }, [0, 0, 0]);
  const longitude = Math.atan2(vector[1], vector[0]) * 180 / Math.PI;
  const latitude = Math.atan2(vector[2], Math.hypot(vector[0], vector[1])) * 180 / Math.PI;
  return [latitude, longitude];
}

function pointColor(point: object) {
  const kind = (point as RoutePoint).kind;
  return kind === "origin"
    ? ORIGIN_COLOR
    : kind === "destination"
      ? DESTINATION_COLOR
      : STOPOVER_COLOR;
}

function pointRadius(point: object) {
  return (point as RoutePoint).kind === "stopover" ? 0.85 : 1;
}

export default function RouteGlobe({ route, locale }: { route: RankedRouteOption; locale: Locale }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [airportMap, setAirportMap] = useState<Record<string, AirportMapEntry> | null>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [globeSize, setGlobeSize] = useState(264);
  const [globeReady, setGlobeReady] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const routeCodes = useMemo(() => routeAirportCodes(route), [route]);
  const flightLegs = useMemo(() => routeFlightLegs(route), [route]);
  const airportData = airportMap ?? EMPTY_AIRPORTS;
  const copy = copyFor(locale);

  const plottedCodes = useMemo(
    () => routeCodes.filter((code) => airportData[code]),
    [airportData, routeCodes],
  );
  const missingCodes = useMemo(
    () => airportMap ? routeCodes.filter((code) => !airportMap[code]) : [],
    [airportMap, routeCodes],
  );
  const routePoints = useMemo<RoutePoint[]>(() => plottedCodes.map((code, index) => {
    const [lat, lng, country] = airportData[code];
    const kind: PointKind = index === 0
      ? "origin"
      : index === plottedCodes.length - 1
        ? "destination"
        : "stopover";
    return {
      code,
      country,
      kind,
      lat,
      lng,
      label: `${code} · ${airportCity(code, locale, route.airportNames?.[code])}`,
    };
  }), [airportData, locale, plottedCodes, route.airportNames]);
  const routeCountries = useMemo(
    () => new Set(routePoints.map((point) => point.country)),
    [routePoints],
  );
  const routeArcs = useMemo<RouteArc[]>(() => flightLegs.flatMap((leg) => {
    const from = airportData[leg.from];
    const to = airportData[leg.to];
    return from && to ? [{
      altitude: equalApexArcAltitude(
        from[0],
        from[1],
        to[0],
        to[1],
        ARC_APEX_ALTITUDE,
        ARC_ENDPOINT_ALTITUDE,
      ),
      from: leg.from,
      to: leg.to,
      startLat: from[0],
      startLng: from[1],
      endLat: to[0],
      endLng: to[1],
    }] : [];
  }), [airportData, flightLegs]);
  const focus = useMemo(
    () => routeCenter(routePoints.length > 0
      ? routePoints.map((point) => [point.lat, point.lng] as Coordinates)
      : [[0, 0]]),
    [routePoints],
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/map/airport-map-data.json", { signal: controller.signal }),
      fetch("/map/route-countries.geojson", { signal: controller.signal }),
    ])
      .then(async ([airportResponse, countryResponse]) => {
        if (!airportResponse.ok || !countryResponse.ok) throw new Error("route_map_data_unavailable");
        const [airportPayload, countryPayload] = await Promise.all([
          airportResponse.json() as Promise<Record<string, AirportMapEntry>>,
          countryResponse.json() as Promise<CountryCollection>,
        ]);
        setAirportMap(airportPayload);
        setCountries(countryPayload.features);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAirportMap({});
          setCountries([]);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const updateSize = () => setGlobeSize(Math.max(220, Math.round(host.getBoundingClientRect().width)));
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReduceMotion(media.matches);
    updateMotionPreference();
    media.addEventListener("change", updateMotionPreference);
    return () => media.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!globeReady) return;
    globeRef.current?.pointOfView(
      { lat: focus[0], lng: focus[1], altitude: INITIAL_VIEW_ALTITUDE },
      reduceMotion ? 0 : 650,
    );
  }, [focus, globeReady, reduceMotion, route.id]);

  function handleGlobeReady() {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    setGlobeReady(true);
  }

  const routeLabel = `${copy.title} ${routeCodes.join(" → ")}`;

  return (
    <aside className={`route-globe-card ${dockOpen ? "dock-open" : "dock-closed"}`} aria-labelledby="route-globe-title">
      <div className="route-globe-heading">
        <div>
          <span>{copy.eyebrow}</span>
          <h3 id="route-globe-title">{copy.title}</h3>
        </div>
        <div className="route-globe-heading-actions">
          <small id="route-globe-help">{copy.drag}</small>
          <button
            className="route-globe-dock-toggle"
            type="button"
            aria-expanded={dockOpen}
            aria-label={dockOpen ? copy.hideMap : copy.showMap}
            onClick={() => setDockOpen((open) => !open)}
          >
            {dockOpen ? "−" : "+"}
          </button>
        </div>
      </div>
      <div className="route-globe-content">
        <div
          className={`route-globe-canvas-wrap ${globeReady ? "ready" : ""}`}
          ref={hostRef}
          role="img"
          aria-label={routeLabel}
          aria-describedby="route-globe-help"
          aria-busy={!globeReady}
        >
          {!globeReady && <span className="route-globe-loading" role="status">{copy.loading}</span>}
          <InteractiveGlobe
            ref={globeRef}
            width={globeSize}
            height={globeSize}
            rendererConfig={RENDERER_CONFIG}
            backgroundColor="rgba(0, 0, 0, 0)"
            globeImageUrl="/map/earth-blue-marble.jpg"
            bumpImageUrl="/map/earth-topology.png"
            showAtmosphere
            atmosphereColor="#76c9ef"
            atmosphereAltitude={0.16}
            animateIn={false}
            waitForGlobeReady
            polygonsData={countries}
            polygonAltitude={(feature) => routeCountries.has((feature as CountryFeature).properties.country) ? 0.02 : 0.003}
            polygonCapColor={(feature) => routeCountries.has((feature as CountryFeature).properties.country) ? ROUTE_COUNTRY_COLOR : "rgba(8, 25, 40, 0.025)"}
            polygonSideColor={(feature) => routeCountries.has((feature as CountryFeature).properties.country) ? "rgba(41, 111, 151, 0.28)" : "rgba(0, 0, 0, 0)"}
            polygonStrokeColor={(feature) => routeCountries.has((feature as CountryFeature).properties.country) ? ROUTE_COUNTRY_BORDER : "rgba(230, 244, 252, 0.17)"}
            polygonLabel={(feature) => routeCountries.has((feature as CountryFeature).properties.country) ? (feature as CountryFeature).properties.name : ""}
            polygonCapCurvatureResolution={4}
            polygonsTransitionDuration={320}
            pointsData={routePoints}
            pointLat={(point) => (point as RoutePoint).lat}
            pointLng={(point) => (point as RoutePoint).lng}
            pointAltitude={0.055}
            pointRadius={pointRadius}
            pointColor={pointColor}
            pointResolution={18}
            pointLabel={(point) => (point as RoutePoint).label}
            pointsTransitionDuration={360}
            arcsData={routeArcs}
            arcStartLat={(arc) => (arc as RouteArc).startLat}
            arcStartLng={(arc) => (arc as RouteArc).startLng}
            arcEndLat={(arc) => (arc as RouteArc).endLat}
            arcEndLng={(arc) => (arc as RouteArc).endLng}
            arcStartAltitude={ARC_ENDPOINT_ALTITUDE}
            arcEndAltitude={ARC_ENDPOINT_ALTITUDE}
            arcAltitude={(arc) => (arc as RouteArc).altitude}
            arcColor={() => ROUTE_ARC_COLORS}
            arcStroke={1}
            arcLabel={(arc) => `${(arc as RouteArc).from} → ${(arc as RouteArc).to}`}
            arcsTransitionDuration={420}
            onGlobeReady={handleGlobeReady}
          />
        </div>
        <ol className="route-globe-itinerary" aria-label={routeCodes.join(" → ")}>
          {routeCodes.map((code, index) => (
            <li
              key={`${code}-${index}`}
              className={index === 0 ? "origin" : index === routeCodes.length - 1 ? "destination" : "stopover"}
            >
              <i aria-hidden="true" />
              <span>
                <strong>{code}</strong>
                <small>{airportCity(code, locale, route.airportNames?.[code])}</small>
              </span>
            </li>
          ))}
        </ol>
        <a
          className="route-globe-credit"
          href="https://visibleearth.nasa.gov/images/57723/the-blue-marble"
          target="_blank"
          rel="noreferrer"
        >
          {copy.credit} ↗
        </a>
        {missingCodes.length > 0 && (
          <p className="route-globe-missing">{copy.missing} · {missingCodes.join(", ")}</p>
        )}
      </div>
    </aside>
  );
}
