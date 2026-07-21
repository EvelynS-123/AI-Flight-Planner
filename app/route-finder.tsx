"use client";

import { useMemo, useState } from "react";
import { AIRPORTS, ROUTES, scoreRoutes, type AirportCode } from "./route-data";

type SortMode = "balanced" | "price" | "directness";

const ORIGINS: AirportCode[] = ["PVG", "PEK", "HKG", "TPE", "ICN", "KIX"];
const DESTINATIONS: AirportCode[] = ["LAX", "SFO", "SEA", "YVR"];

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

export default function RouteFinder() {
  const [origin, setOrigin] = useState<AirportCode>("PVG");
  const [destination, setDestination] = useState<AirportCode>("LAX");
  const [draftOrigin, setDraftOrigin] = useState<AirportCode>("PVG");
  const [draftDestination, setDraftDestination] = useState<AirportCode>("LAX");
  const [month, setMonth] = useState<"Aug" | "Sep">("Sep");
  const [sort, setSort] = useState<SortMode>("balanced");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searched, setSearched] = useState(true);

  const results = useMemo(() => {
    const matched = ROUTES.filter((route) => route.origin === origin && route.destination === destination && route.months.includes(month));
    const scored = scoreRoutes(matched);
    return scored.sort((a, b) => {
      if (sort === "price") return a.total - b.total;
      if (sort === "directness") return b.scores.directness - a.scores.directness || a.total - b.total;
      return b.scores.balanced - a.scores.balanced;
    });
  }, [origin, destination, month, sort]);

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
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Via 首页">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>Via</span>
        </a>
        <span className="demo-badge">2026 夏季样本</span>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">MULTI-CITY ROUTE FINDER</p>
        <h1>有些好路线，<br />不在一次搜索里。</h1>
        <p className="hero-copy">把跨太平洋行程拆成两段，发现常规搜索容易漏掉的中转组合。</p>

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
            <button className="search-button" type="button" onClick={search}>查找两段路线</button>
          </div>
          <p className="search-note"><span aria-hidden="true">◉</span> 价格为各航段独立搜索的单程快照，不是实时联程报价</p>
        </div>
      </section>

      {searched && (
        <section className="results-section" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">ROUTE IDEAS</p>
              <h2><AirportLabel code={origin} /> <Arrow /> <AirportLabel code={destination} /></h2>
              <p>{results.length ? `找到 ${results.length} 条两段组合` : "当前样本里还没有这条路线"}</p>
            </div>
            {results.length > 0 && (
              <div className="segmented" role="group" aria-label="排序方式">
                <button className={sort === "balanced" ? "active" : ""} onClick={() => setSort("balanced")}>综合</button>
                <button className={sort === "price" ? "active" : ""} onClick={() => setSort("price")}>最低价</button>
                <button className={sort === "directness" ? "active" : ""} onClick={() => setSort("directness")}>少折腾</button>
              </div>
            )}
          </div>

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
                return (
                  <article className={`route-card ${isOpen ? "open" : ""}`} key={route.id}>
                    <button className="route-summary" type="button" onClick={() => setExpanded(isOpen ? null : route.id)} aria-expanded={isOpen}>
                      <div className="rank">{index + 1}</div>
                      <div className="route-main">
                        <div className="route-codes">
                          <strong>{route.origin}</strong><Arrow /><span className="hub-code">{route.hub}</span><Arrow /><strong>{route.destination}</strong>
                        </div>
                        <div className="route-meta">
                          <span>两张单程票</span>
                          <span>在 {AIRPORTS[route.hub].city} 自行衔接</span>
                          {route.segments.some((segment) => segment.stops > 0) && <span>某航段含经停</span>}
                        </div>
                      </div>
                      <div className="score-block">
                        <span>综合分</span>
                        <strong>{Math.round(route.scores.balanced)}</strong>
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
                          <p>这是 multi-city 灵感组合。两段价格来自不同搜索快照，日期未必可直接衔接，行李通常也不会直挂。</p>
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
                          <p>按原算法的综合模式计算，价格 30%，直达性 35%，体验 35%。当前 MVP 没有可靠体验数据，因此体验项统一设为中性值 50。</p>
                        </div>
                      </div>
                    </div>
                  </article>
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
