"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import NumberFlow, { continuous } from "@number-flow/react";
import { DEMO_DESTINATIONS as DESTINATIONS, DEMO_ORIGINS as ORIGINS, ROUTES, moveWeightBoundary, scoreRoutes, type AirportCode, type RouteOption, type RouteWeights } from "./route-data";
import { durationLabel, operatingDayNumbers, type StopoverSelections } from "./flight-schedules";
import { COPY, LOCALE_OPTIONS, airportCity, localizeDateLabel, type Copy, type Locale } from "./i18n";

const SCORE_NUMBER_PLUGINS = [continuous];

function OriginalArtDefs() {
  return (
    <svg width="0" height="0" className="art-defs" aria-hidden="true">
      <defs>
        <filter id="gouache" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="turbulence" baseFrequency="0.035 0.06" numOctaves="3" seed="2" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="softedge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="8" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

function SketchCloud({ width = 220 }: { width?: number }) {
  return (
    <svg width={width} height={width * 0.48} viewBox="0 0 220 105" fill="none" aria-hidden="true" filter="url(#softedge)">
      <ellipse cx="110" cy="72" rx="100" ry="30" fill="white" fillOpacity="0.72" />
      <ellipse cx="72" cy="58" rx="52" ry="38" fill="white" fillOpacity="0.78" />
      <ellipse cx="148" cy="54" rx="44" ry="34" fill="white" fillOpacity="0.72" />
      <ellipse cx="110" cy="46" rx="38" ry="32" fill="white" fillOpacity="0.82" />
      <ellipse cx="84" cy="36" rx="28" ry="24" fill="white" fillOpacity="0.75" />
      <ellipse cx="134" cy="33" rx="24" ry="20" fill="white" fillOpacity="0.68" />
      <path d="M75 52 C85 48 100 50 110 52" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <ellipse cx="110" cy="80" rx="88" ry="12" fill="#C8DFF0" fillOpacity="0.22" />
    </svg>
  );
}

function BigPlane() {
  return (
    <svg className="big-plane" viewBox="0 0 220 80" fill="none" aria-hidden="true" filter="url(#gouache)">
      <path d="M20 42 C28 38 60 34 110 33 C155 32 185 35 200 40 C208 43 205 50 195 52 C165 56 120 56 70 54 C45 53 22 50 20 42Z" fill="white" fillOpacity="0.9" />
      <path d="M40 50 C80 52 140 52 185 49" stroke="#D0E8F4" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <path d="M195 40 C208 40 216 44 214 47 C212 50 202 52 195 52Z" fill="white" fillOpacity="0.9" />
      <path d="M100 50 C110 50 125 52 140 68 C148 76 145 80 138 78 C120 72 104 60 100 56Z" fill="white" fillOpacity="0.82" />
      <path d="M26 42 C22 36 18 26 22 24 C26 22 34 30 38 38Z" fill="white" fillOpacity="0.8" />
      <path d="M26 48 C20 52 14 56 12 54 C10 52 18 46 26 46Z" fill="white" fillOpacity="0.72" />
      {[145, 158, 171, 184].map((x) => <ellipse key={x} cx={x} cy="43" rx="4" ry="3" fill="#B8D8F0" fillOpacity="0.55" />)}
      <path d="M18 44 C8 43 -10 44 -30 46" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function SketchPlane({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M24 14 L8 6 L10 13 L4 14 L10 15 L8 22 Z" fill="#5A9CC0" fillOpacity="0.9" stroke="#3A7EA8" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}

function AirportLabel({ code, locale }: { code: string; locale: Locale }) {
  return (
    <span className="airport-label">
      <strong>{code}</strong>
      <span>{airportCity(code, locale)}</span>
    </span>
  );
}

function Arrow() {
  return <span className="route-arrow" aria-hidden="true">→</span>;
}

function ticketCopy(route: RouteOption, copy: Copy) {
  if (route.ticketType === "direct") return { label: copy.direct, detail: copy.directDetail };
  if (route.ticketType === "connection") return { label: copy.connection, detail: copy.connectionDetail(route.stopCount) };
  return { label: copy.multiCity, detail: copy.multiCityDetail(route.segments.length) };
}

const DURATION_UNITS: Record<Locale, { day: string; hour: string; minute: string }> = {
  zh: { day: "天", hour: "小时", minute: "分钟" },
  en: { day: "d", hour: "h", minute: "m" },
  ko: { day: "일", hour: "시간", minute: "분" },
  ja: { day: "日", hour: "時間", minute: "分" },
};

function localizeDuration(minutes: number, locale: Locale) {
  const value = durationLabel(minutes);
  const units = DURATION_UNITS[locale];
  const parts = [];
  if (value.days) parts.push(`${value.days}${units.day}`);
  if (value.hours) parts.push(`${value.hours}${units.hour}`);
  if (value.minutes || !parts.length) parts.push(`${value.minutes}${units.minute}`);
  return parts.join(" ");
}

function localizeWeekdays(days: readonly number[], locale: Locale) {
  const intl = LOCALE_OPTIONS.find((item) => item.code === locale)!.intl;
  return operatingDayNumbers(days as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>)
    .map((day) => new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 7, 2 + day))))
    .join(locale === "en" ? ", " : "、");
}

export default function RouteFinder() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [origin, setOrigin] = useState<AirportCode>("PVG");
  const [destination, setDestination] = useState<AirportCode>("LAX");
  const [draftOrigin, setDraftOrigin] = useState<AirportCode>("PVG");
  const [draftDestination, setDraftDestination] = useState<AirportCode>("LAX");
  const [month, setMonth] = useState<"Aug" | "Sep">("Sep");
  const [weights, setWeights] = useState<RouteWeights>({ price: 30, interest: 35, directness: 35 });
  const [stopoverSelections, setStopoverSelections] = useState<StopoverSelections>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searched, setSearched] = useState(true);
  const [isDraggingWeights, setIsDraggingWeights] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const previousPositions = useRef(new Map<string, number>());
  const reorderAnimations = useRef(new Map<string, Animation>());
  const allocationBarRef = useRef<HTMLDivElement>(null);
  const activeBoundary = useRef<"price-interest" | "interest-directness" | null>(null);
  const dragOrder = useRef<string[] | null>(null);
  const dragBarRect = useRef<DOMRect | null>(null);
  const pendingBoundaryUpdate = useRef<{ boundary: "price-interest" | "interest-directness"; clientX: number } | null>(null);
  const boundaryFrame = useRef<number | null>(null);
  const copy = COPY[locale];
  const localeOption = LOCALE_OPTIONS.find((item) => item.code === locale)!;

  const results = useMemo(() => {
    const matched = ROUTES.filter((route) => route.origin === origin && route.destination === destination && route.months.includes(month));
    const scored = scoreRoutes(matched, weights, stopoverSelections);
    if (isDraggingWeights && dragOrder.current) {
      const positions = new Map(dragOrder.current.map((id, index) => [id, index]));
      return scored.sort((a, b) => (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    return scored.sort((a, b) => b.scores.total - a.scores.total || a.total - b.total);
  }, [origin, destination, month, weights, stopoverSelections, isDraggingWeights]);

  const resultSummary = useMemo(() => {
    const counts = { direct: 0, connection: 0, "multi-city": 0 };
    for (const route of results) counts[route.ticketType] += 1;
    return copy.routeSummary(results.length, counts.direct, counts.connection, counts["multi-city"]);
  }, [results, copy]);
  const handlesAreColliding = weights.interest <= 4;

  useLayoutEffect(() => {
    if (isDraggingWeights) return;
    const nextPositions = new Map<string, number>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (const [id, element] of cardRefs.current) {
      const transform = getComputedStyle(element).transform;
      const currentY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
      const nextTop = element.getBoundingClientRect().top - currentY;
      nextPositions.set(id, nextTop);

      const previous = previousPositions.current.get(id);
      if (previous === undefined) continue;
      const delta = previous - nextTop;
      if (Math.abs(delta) < 1) continue;

      reorderAnimations.current.get(id)?.cancel();
      if (reduceMotion) continue;

      // Keep the card at its current presentation position, even if the user
      // changes the slider again before the previous reorder has settled.
      const animation = element.animate(
        [
          { transform: `translate3d(0, ${delta + currentY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      reorderAnimations.current.set(id, animation);
      animation.onfinish = () => {
        if (reorderAnimations.current.get(id) === animation) reorderAnimations.current.delete(id);
      };
    }
    previousPositions.current = nextPositions;
  }, [results, isDraggingWeights]);

  useEffect(() => () => {
    for (const animation of reorderAnimations.current.values()) animation.cancel();
    reorderAnimations.current.clear();
  }, []);

  useEffect(() => {
    document.documentElement.lang = localeOption.htmlLang;
  }, [localeOption.htmlLang]);

  useEffect(() => {
    const continueDrag = (event: globalThis.PointerEvent) => {
      if (activeBoundary.current) queueBoundaryFromClientX(activeBoundary.current, event.clientX);
    };
    const endDrag = () => {
      if (!activeBoundary.current) return;
      flushBoundaryUpdate();
      activeBoundary.current = null;
      dragBarRect.current = null;
      dragOrder.current = null;
      setIsDraggingWeights(false);
    };
    window.addEventListener("pointermove", continueDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", continueDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      if (boundaryFrame.current !== null) cancelAnimationFrame(boundaryFrame.current);
    };
  }, []);

  function updateBoundary(boundary: "price-interest" | "interest-directness", value: number) {
    setWeights((current) => moveWeightBoundary(current, boundary, value));
  }

  function applyBoundaryFromClientX(boundary: "price-interest" | "interest-directness", clientX: number) {
    const bar = allocationBarRef.current;
    if (!bar) return;
    const rect = dragBarRect.current ?? bar.getBoundingClientRect();
    const value = ((clientX - rect.left) / rect.width) * 100;
    updateBoundary(boundary, value);
  }

  function queueBoundaryFromClientX(boundary: "price-interest" | "interest-directness", clientX: number) {
    pendingBoundaryUpdate.current = { boundary, clientX };
    if (boundaryFrame.current !== null) return;
    boundaryFrame.current = requestAnimationFrame(() => {
      boundaryFrame.current = null;
      const pending = pendingBoundaryUpdate.current;
      pendingBoundaryUpdate.current = null;
      if (pending) applyBoundaryFromClientX(pending.boundary, pending.clientX);
    });
  }

  function flushBoundaryUpdate() {
    if (boundaryFrame.current !== null) cancelAnimationFrame(boundaryFrame.current);
    boundaryFrame.current = null;
    const pending = pendingBoundaryUpdate.current;
    pendingBoundaryUpdate.current = null;
    if (pending) applyBoundaryFromClientX(pending.boundary, pending.clientX);
  }

  function startBoundaryDrag(boundary: "price-interest" | "interest-directness", event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    dragOrder.current = results.map((route) => route.id);
    dragBarRect.current = allocationBarRef.current?.getBoundingClientRect() ?? null;
    for (const animation of reorderAnimations.current.values()) animation.cancel();
    reorderAnimations.current.clear();
    setIsDraggingWeights(true);
    activeBoundary.current = boundary;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyBoundaryFromClientX(boundary, event.clientX);
  }

  function moveBoundaryFromKeyboard(boundary: "price-interest" | "interest-directness", event: KeyboardEvent<HTMLButtonElement>) {
    const current = boundary === "price-interest" ? weights.price : weights.price + weights.interest;
    const step = event.shiftKey ? 5 : 1;
    let next = current;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= step;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += step;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 100;
    else return;
    event.preventDefault();
    updateBoundary(boundary, next);
  }

  function updateStopoverDays(routeId: string, stopIndex: number, days: number) {
    setStopoverSelections((current) => {
      const next = [...(current[routeId] ?? [])];
      next[stopIndex] = days;
      return { ...current, [routeId]: next };
    });
  }

  function search() {
    setOrigin(draftOrigin);
    setDestination(draftDestination);
    setExpanded(null);
    setSearched(true);
  }

  function swap() {
    if (DESTINATIONS.includes(draftOrigin) && ORIGINS.includes(draftDestination)) {
      const nextOrigin = draftDestination;
      const nextDestination = draftOrigin;
      setDraftOrigin(nextOrigin);
      setDraftDestination(nextDestination);
    }
  }

  return (
    <main className="planner">
      <OriginalArtDefs />
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.home}>
          <SketchPlane size={30} />
          <span>AI Flight Planner</span>
        </a>
        <div className="topbar-actions">
          <span className="demo-badge">{copy.demoBadge}</span>
          <label className="language-picker">
            <span className="sr-only">{copy.language}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={copy.language}>
              {LOCALE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="original-sky" aria-hidden="true">
          <div className="cloud cloud-one"><SketchCloud width={270} /></div>
          <div className="cloud cloud-two"><SketchCloud width={190} /></div>
          <BigPlane />
        </div>
        <div className="hero-copy-block">
          <p className="eyebrow">{copy.heroEyebrow}</p>
          <h1>{copy.heroTitle.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
          <p className="hero-copy">{copy.heroCopy}</p>
        </div>

        <div className="search-card" aria-label={copy.searchAria}>
          <div className="field-grid">
            <label className="select-field">
              <span>{copy.from}</span>
              <select aria-label={copy.from} value={draftOrigin} onChange={(event) => setDraftOrigin(event.target.value as AirportCode)}>
                {ORIGINS.map((code) => <option key={code} value={code}>{code} · {airportCity(code, locale)}</option>)}
              </select>
            </label>
            <button className="swap-button" type="button" onClick={swap} aria-label={copy.swap} disabled>↔</button>
            <label className="select-field">
              <span>{copy.to}</span>
              <select aria-label={copy.to} value={draftDestination} onChange={(event) => setDraftDestination(event.target.value as AirportCode)}>
                {DESTINATIONS.map((code) => <option key={code} value={code}>{code} · {airportCity(code, locale)}</option>)}
              </select>
            </label>
            <label className="select-field month-field">
              <span>{copy.month}</span>
              <select aria-label={copy.month} value={month} onChange={(event) => setMonth(event.target.value as "Aug" | "Sep")}>
                <option value="Aug">{copy.august}</option>
                <option value="Sep">{copy.september}</option>
              </select>
            </label>
            <button className="search-button" type="button" onClick={search}>{copy.search}</button>
          </div>
          <p className="search-note"><span aria-hidden="true">◉</span> {copy.searchNote}</p>
        </div>
      </section>

      {searched && (
        <section className="results-section" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">{copy.routeIdeas}</p>
              <h2><AirportLabel code={origin} locale={locale} /> <Arrow /> <AirportLabel code={destination} locale={locale} /></h2>
              <p>{results.length ? resultSummary : copy.noRoute}</p>
            </div>
          </div>

          {results.length > 0 && (
            <div className={`weight-panel ${isDraggingWeights ? "dragging" : ""}`} aria-label={copy.weightAria}>
              <div className="weight-intro">
                <div><span>{copy.weightTitle}</span><strong>100%</strong></div>
                <p>{copy.weightHelp}</p>
              </div>
              <div className="allocation-control">
                <div className="allocation-stage">
                  <div className="allocation-bar" ref={allocationBarRef} aria-hidden="true">
                    <span className="allocation-price" style={{ width: `${weights.price}%` }} />
                    <span className="allocation-interest" style={{ width: `${weights.interest}%` }} />
                    <span className="allocation-directness" style={{ width: `${weights.directness}%` }} />
                  </div>
                  <button
                    className={`allocation-handle price-interest-handle ${handlesAreColliding ? "colliding" : ""}`}
                    type="button"
                    role="slider"
                    aria-label={copy.firstBoundary}
                    aria-valuemin={0}
                    aria-valuemax={100 - weights.directness}
                    aria-valuenow={weights.price}
                    style={{ left: `${weights.price}%` }}
                    onPointerDown={(event) => startBoundaryDrag("price-interest", event)}
                    onKeyDown={(event) => moveBoundaryFromKeyboard("price-interest", event)}
                  />
                  <button
                    className={`allocation-handle interest-directness-handle ${handlesAreColliding ? "colliding" : ""}`}
                    type="button"
                    role="slider"
                    aria-label={copy.secondBoundary}
                    aria-valuemin={weights.price}
                    aria-valuemax={100}
                    aria-valuenow={weights.price + weights.interest}
                    style={{ left: `${weights.price + weights.interest}%` }}
                    onPointerDown={(event) => startBoundaryDrag("interest-directness", event)}
                    onKeyDown={(event) => moveBoundaryFromKeyboard("interest-directness", event)}
                  />
                </div>
                <div className="allocation-legend">
                  <span className="price"><i>¥</i>{copy.cheapest}<strong>{weights.price}%</strong></span>
                  <span className="interest"><i>✦</i>{copy.interesting}<strong>{weights.interest}%</strong></span>
                  <span className="directness"><i>→</i>{copy.directest}<strong>{weights.directness}%</strong></span>
                </div>
              </div>
            </div>
          )}

          {results.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">⌁</span>
              <h3>{copy.emptyTitle}</h3>
              <p>{copy.emptyBody}</p>
            </div>
          ) : (
            <div className="route-list">
              {results.map((route, index) => {
                const isOpen = expanded === route.id;
                const ticket = ticketCopy(route, copy);
                return (
                  <div className="route-motion" key={route.id} ref={(element) => { if (element) cardRefs.current.set(route.id, element); else cardRefs.current.delete(route.id); }}>
                  <article className={`route-card ${isOpen ? "open" : ""}`}>
                    <button className="route-summary" type="button" onClick={() => setExpanded(isOpen ? null : route.id)} aria-expanded={isOpen}>
                      <div className="rank">{index + 1}</div>
                      <div className="route-main">
                        <div className="route-codes">
                          <strong>{route.origin}</strong>
                          {route.hubs.map((hub) => (
                            <span className="route-hop" key={hub}>
                              <Arrow />
                              <span
                                className={`hub-code ${route.ticketType === "connection" ? "connection-hub" : "multi-city-hub"}`}
                                title={`${route.ticketType === "connection" ? copy.connectionHub : copy.multiCityHub} · ${airportCity(hub, locale)}`}
                              >
                                {hub}
                              </span>
                            </span>
                          ))}
                          <Arrow /><strong>{route.destination}</strong>
                        </div>
                        <div className="route-meta">
                          <span className={`ticket-pill ${route.ticketType}`}>{ticket.label}</span>
                          <span>{ticket.detail}</span>
                          {route.hubs.length > 0 && <span>{copy.via} {route.hubs.map((hub) => airportCity(hub, locale)).join(locale === "en" ? ", " : "、")}</span>}
                          <span>{copy.totalDuration} {localizeDuration(route.totalDurationMinutes, locale)}</span>
                        </div>
                      </div>
                      <div className="score-block">
                        <span>{copy.liveScore}</span>
                        <strong>
                          <NumberFlow
                            className="score-number"
                            value={Math.round(route.scores.total)}
                            plugins={SCORE_NUMBER_PLUGINS}
                            animated={!isDraggingWeights}
                            transformTiming={{ duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                            spinTiming={{ duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                            opacityTiming={{ duration: 160, easing: "ease-out" }}
                            willChange={!isDraggingWeights}
                          />
                        </strong>
                      </div>
                      <div className="price-block">
                        <span>{copy.sampleTotal}</span>
                        <strong>${route.total.toLocaleString(localeOption.intl, { maximumFractionDigits: 2 })}</strong>
                      </div>
                      <span className="disclosure" aria-hidden="true">⌄</span>
                    </button>

                    <div className="route-details" aria-hidden={!isOpen}>
                      {isOpen && <div className="details-inner">
                        <div className="warning-strip">
                          <span aria-hidden="true">!</span>
                          {route.ticketType === "multi-city" && <p>{copy.multiCityWarning}</p>}
                          {route.ticketType === "connection" && <p>{copy.connectionWarning}</p>}
                          {route.ticketType === "direct" && <p>{copy.directWarning}</p>}
                        </div>
                        {route.scheduledStops.length > 0 && (
                          <div className="stopover-plans">
                            {route.scheduledStops.map((stop, stopIndex) => {
                              const multiIndex = route.scheduledStops.slice(0, stopIndex).filter((item) => item.kind === "multi-city").length;
                              return (
                                <div className={`stopover-plan ${stop.kind}`} key={`${stop.airport}-${stopIndex}`}>
                                  <div className="stopover-copy">
                                    <span>{stop.kind === "multi-city" ? copy.stopoverPlan : copy.connectionTime}</span>
                                    <strong>{airportCity(stop.airport, locale)} · {localizeDuration(stop.durationMinutes, locale)}</strong>
                                    <small>{copy.usableTime} {localizeDuration(stop.usableMinutes, locale)}</small>
                                  </div>
                                  {stop.kind === "multi-city" ? (
                                    <label className="stay-selector">
                                      <span>{copy.playDays}</span>
                                      <select
                                        aria-label={`${copy.playDays} · ${airportCity(stop.airport, locale)}`}
                                        value={route.selectedStopoverDays[multiIndex] ?? stop.playDays}
                                        onChange={(event) => updateStopoverDays(route.id, multiIndex, Number(event.target.value))}
                                      >
                                        {stop.options.map((days) => <option key={days} value={days}>{copy.daysOption(days)}</option>)}
                                      </select>
                                    </label>
                                  ) : (
                                    <span className="fixed-connection">{copy.fixedConnection}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flight-tickets">
                          {route.scheduledTickets.map((ticketItem) => (
                            <section className="flight-ticket" key={ticketItem.ticketIndex}>
                              <div className="ticket-heading">
                                <strong>{copy.ticket} {ticketItem.ticketIndex + 1}</strong>
                                <span>${ticketItem.price.toLocaleString(localeOption.intl, { maximumFractionDigits: 2 })} · {localizeDateLabel(ticketItem.fareDate, locale)}</span>
                                <a href={ticketItem.fareUrl} target="_blank" rel="noreferrer">{copy.view} {ticketItem.fareSource} ↗</a>
                              </div>
                              <div className="flights">
                                {ticketItem.flights.map((flight, flightIndex) => (
                                  <div className="flight-row" key={`${flight.id}-${flight.departureUtc}`}>
                                    <div className="flight-index">{ticketItem.ticketIndex + 1}.{flightIndex + 1}</div>
                                    <div className="airline-brand">
                                      <img src={flight.logoUrl} alt={`${flight.airlineName} logo`} width="48" height="32" />
                                      <span><strong>{flight.airlineName}</strong><small>{flight.flightNumber}</small></span>
                                    </div>
                                    <div className="flight-timeline">
                                      <div className="time-point">
                                        <strong>{flight.departureTime}</strong>
                                        <span>{flight.from} · {localizeDateLabel(flight.departureDate, locale)}</span>
                                      </div>
                                      <div className="air-time"><span>→</span><small>{localizeDuration(flight.durationMinutes, locale)}</small></div>
                                      <div className="time-point arrival">
                                        <strong>{flight.arrivalTime}{flight.arrivalDayOffset > 0 ? ` +${flight.arrivalDayOffset}` : ""}</strong>
                                        <span>{flight.to} · {localizeDateLabel(flight.arrivalDate, locale)}</span>
                                      </div>
                                    </div>
                                    <div className="schedule-reference">
                                      <a href={flight.scheduleSource} target="_blank" rel="noreferrer">{copy.weeklySchedule} ↗</a>
                                      <small>{copy.operates} {localizeWeekdays(flight.operatingDays, locale)}</small>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                        <div className="score-note">
                          <strong>{copy.whyHere}</strong>
                          <div>
                            <p>{copy.scoreNote(weights.price, weights.interest, weights.directness)}</p>
                            <div className="score-breakdown">
                              <span>{copy.cheapest}<strong>{Math.round(route.scores.price)}</strong></span>
                              <span>{copy.interesting}<strong>{Math.round(route.scores.interest)}</strong></span>
                              <span>{copy.directest}<strong>{Math.round(route.scores.directness)}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>}
                    </div>
                  </article>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <footer>
        <span>Via · Core MVP</span>
        <p>{copy.footer}</p>
      </footer>
    </main>
  );
}
