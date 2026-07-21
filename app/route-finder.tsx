"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AIRPORTS, ROUTES, rebalanceWeights, scoreRoutes, type AirportCode, type RouteOption, type RouteWeights } from "./route-data";

const ORIGINS: AirportCode[] = ["PVG", "PEK", "HKG", "TPE", "ICN", "KIX", "NRT"];
const DESTINATIONS: AirportCode[] = ["LAX", "SFO", "SEA", "YVR"];

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

function AirportLabel({ code }: { code: string }) {
  const airport = AIRPORTS[code];
  return (
    <span className="airport-label">
      <strong>{code}</strong>
      <span>{airport?.city}</span>
    </span>
  );
}

function Arrow() {
  return <span className="route-arrow" aria-hidden="true">→</span>;
}

function ticketCopy(route: RouteOption) {
  if (route.ticketType === "direct") return { label: "直飞", detail: "一张票，无需中转" };
  if (route.ticketType === "connection") return { label: "联程票", detail: `一个行程，${route.stopCount} 次中转` };
  return { label: "Multicity", detail: `${route.segments.length} 张单程票，自行衔接` };
}

export default function RouteFinder() {
  const [origin, setOrigin] = useState<AirportCode>("PVG");
  const [destination, setDestination] = useState<AirportCode>("LAX");
  const [draftOrigin, setDraftOrigin] = useState<AirportCode>("PVG");
  const [draftDestination, setDraftDestination] = useState<AirportCode>("LAX");
  const [month, setMonth] = useState<"Aug" | "Sep">("Sep");
  const [weights, setWeights] = useState<RouteWeights>({ price: 30, interest: 35, directness: 35 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searched, setSearched] = useState(true);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const previousPositions = useRef(new Map<string, DOMRect>());

  const results = useMemo(() => {
    const matched = ROUTES.filter((route) => route.origin === origin && route.destination === destination && route.months.includes(month));
    return scoreRoutes(matched, weights).sort((a, b) => b.scores.total - a.scores.total || a.total - b.total);
  }, [origin, destination, month, weights]);

  const resultSummary = useMemo(() => {
    const counts = { direct: 0, connection: 0, "multi-city": 0 };
    for (const route of results) counts[route.ticketType] += 1;
    return `直飞 ${counts.direct} 条，联程 ${counts.connection} 条，Multicity ${counts["multi-city"]} 条`;
  }, [results]);

  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>();
    for (const [id, element] of cardRefs.current) {
      const next = element.getBoundingClientRect();
      nextPositions.set(id, next);
      const previous = previousPositions.current.get(id);
      if (!previous) continue;
      const delta = previous.top - next.top;
      if (Math.abs(delta) < 1) continue;
      element.style.transition = "none";
      element.style.transform = `translate3d(0, ${delta}px, 0)`;
      requestAnimationFrame(() => {
        element.style.transition = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";
        element.style.transform = "translate3d(0, 0, 0)";
      });
    }
    previousPositions.current = nextPositions;
  }, [results]);

  function updateWeight(key: keyof RouteWeights, value: number) {
    setWeights((current) => rebalanceWeights(current, key, value));
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
        <a className="brand" href="#top" aria-label="Via 首页">
          <SketchPlane size={30} />
          <span>AI Flight Planner</span>
        </a>
        <span className="demo-badge">2026 夏季样本</span>
      </header>

      <section className="hero" id="top">
        <div className="original-sky" aria-hidden="true">
          <div className="cloud cloud-one"><SketchCloud width={270} /></div>
          <div className="cloud cloud-two"><SketchCloud width={190} /></div>
          <BigPlane />
        </div>
        <div className="hero-copy-block">
          <p className="eyebrow">MULTI-CITY ROUTE FINDER</p>
          <h1>Make the journey<br />part of the adventure.</h1>
          <p className="hero-copy">把直飞、联程票和分开出票的跨太平洋组合放在一起比较，让旅途本身也成为选择。</p>
        </div>

        <div className="search-card" aria-label="航线搜索">
          <div className="field-grid">
            <label className="select-field">
              <span>从哪里出发</span>
              <select value={draftOrigin} onChange={(event) => setDraftOrigin(event.target.value as AirportCode)}>
                {ORIGINS.map((code) => <option key={code} value={code}>{code} · {AIRPORTS[code].city}</option>)}
              </select>
            </label>
            <button className="swap-button" type="button" onClick={swap} aria-label="交换出发地和目的地" disabled>↔</button>
            <label className="select-field">
              <span>到哪里</span>
              <select value={draftDestination} onChange={(event) => setDraftDestination(event.target.value as AirportCode)}>
                {DESTINATIONS.map((code) => <option key={code} value={code}>{code} · {AIRPORTS[code].city}</option>)}
              </select>
            </label>
            <label className="select-field month-field">
              <span>出行月份</span>
              <select value={month} onChange={(event) => setMonth(event.target.value as "Aug" | "Sep")}>
                <option value="Aug">2026 年 8 月</option>
                <option value="Sep">2026 年 9 月</option>
              </select>
            </label>
            <button className="search-button" type="button" onClick={search}>查找航线</button>
          </div>
          <p className="search-note"><span aria-hidden="true">◉</span> 同时搜索直飞、联程与最多三段的组合路线，价格为单程美元快照，原币报价会在详情标注</p>
        </div>
      </section>

      {searched && (
        <section className="results-section" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">ROUTE IDEAS</p>
              <h2><AirportLabel code={origin} /> <Arrow /> <AirportLabel code={destination} /></h2>
              <p>{results.length ? `找到 ${results.length} 条，${resultSummary}` : "当前样本里还没有这条路线"}</p>
            </div>
          </div>

          {results.length > 0 && (
            <div className="weight-panel" aria-label="路线排序权重">
              <div className="weight-intro">
                <div><span>你的排序权重</span><strong>100%</strong></div>
                <p>拖动任一项，路线分数与名次会实时变化。</p>
              </div>
              {([
                ["price", "最便宜", "¥"],
                ["interest", "最有趣", "✦"],
                ["directness", "最直接", "→"],
              ] as const).map(([key, label, icon]) => (
                <label className={`weight-control weight-${key}`} key={key}>
                  <span className="weight-label"><i>{icon}</i>{label}<strong>{weights[key]}%</strong></span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={weights[key]}
                    onChange={(event) => updateWeight(key, Number(event.target.value))}
                    style={{ "--weight": `${weights[key]}%` } as React.CSSProperties}
                  />
                </label>
              ))}
            </div>
          )}

          {results.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">⌁</span>
              <h3>换一个出发地或目的地试试</h3>
              <p>本 demo 目前收录东亚 6 个出发机场和北美西海岸 4 个到达机场。</p>
            </div>
          ) : (
            <div className="route-list">
              {results.map((route, index) => {
                const isOpen = expanded === route.id;
                const ticket = ticketCopy(route);
                return (
                  <div className="route-motion" key={route.id} ref={(element) => { if (element) cardRefs.current.set(route.id, element); else cardRefs.current.delete(route.id); }}>
                  <article className={`route-card ${isOpen ? "open" : ""}`}>
                    <button className="route-summary" type="button" onClick={() => setExpanded(isOpen ? null : route.id)} aria-expanded={isOpen}>
                      <div className="rank">{index + 1}</div>
                      <div className="route-main">
                        <div className="route-codes">
                          <strong>{route.origin}</strong>
                          {route.hubs.map((hub) => <span className="route-hop" key={hub}><Arrow /><span className="hub-code">{hub}</span></span>)}
                          <Arrow /><strong>{route.destination}</strong>
                        </div>
                        <div className="route-meta">
                          <span className={`ticket-pill ${route.ticketType}`}>{ticket.label}</span>
                          <span>{ticket.detail}</span>
                          {route.hubs.length > 0 && <span>经 {route.hubs.map((hub) => AIRPORTS[hub]?.city ?? hub).join("、")}</span>}
                        </div>
                      </div>
                      <div className="score-block">
                        <span>实时得分</span>
                        <strong key={Math.round(route.scores.total)}>{Math.round(route.scores.total)}</strong>
                      </div>
                      <div className="price-block">
                        <span>样本合计</span>
                        <strong>${route.total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
                      </div>
                      <span className="disclosure" aria-hidden="true">⌄</span>
                    </button>

                    <div className="route-details" aria-hidden={!isOpen}>
                      <div className="details-inner">
                        <div className="warning-strip">
                          <span aria-hidden="true">!</span>
                          {route.ticketType === "multi-city" && <p>这是分开出票的 Multicity 灵感组合。各段价格来自独立搜索快照，日期未必可直接衔接，行李通常也不会直挂。</p>}
                          {route.ticketType === "connection" && <p>这是同一次搜索里出现的端到端联程报价样本。实际是否同一票号、行李能否直挂及保护规则，仍要在出票页确认。</p>}
                          {route.ticketType === "direct" && <p>这是直飞单程价格快照。航班计划与最终含税价格可能变化，请在出票页重新确认。</p>}
                        </div>
                        <div className="segments">
                          {route.segments.map((segment, segmentIndex) => (
                            <div className="segment" key={`${segment.from}-${segment.to}`}>
                              <div className="segment-number">{segmentIndex + 1}</div>
                              <div className="segment-route"><strong>{segment.from} → {segment.to}</strong><span>{segment.airline}</span></div>
                              <div className="segment-date"><span>价格日期</span><strong>{segment.date}</strong></div>
                              <div className="segment-price"><strong>${segment.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong><span>单程</span></div>
                              <a href={segment.url} target="_blank" rel="noreferrer">查看 {segment.source} ↗</a>
                            </div>
                          ))}
                        </div>
                        <div className="score-note">
                          <strong>为什么排在这里</strong>
                          <p>当前分数由最便宜 {weights.price}%、最有趣 {weights.interest}%、最直接 {weights.directness}% 实时计算。最有趣分基于中转城市的 demo 体验值，直飞的趣味项采用中性值。</p>
                        </div>
                      </div>
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
        <p>仅用于路线探索演示。最终价格、航班时刻和入境要求请以航空公司或出票平台为准。</p>
      </footer>
    </main>
  );
}
