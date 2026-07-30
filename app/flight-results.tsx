"use client";
import type { Copy, Locale } from "./i18n";

export type FlightResult = {
  id: string;
  airline: string;
  airlineLogo: string;
  flightNumbers: string[];
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  stopAirports: string[];
  price: number;
  currency: string;
  cabinClass: string;
  bookingUrl: string;
  carbonEmissions?: number;
  priceLevel?: "low" | "typical" | "high";
  flights?: any[]; // The raw flights array from SerpAPI
  isSelfTransfer?: boolean;
  riskPattern?: "A" | "B" | "C";
  leg1?: any;
  leg2?: any;
};

type SortKey = "price" | "duration" | "departure";

function formatDuration(minutes: number, locale: Locale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === "ja") return `${h}時間${m > 0 ? `${m}分` : ""}`;
  if (locale === "zh") return `${h}小时${m > 0 ? `${m}分钟` : ""}`;
  if (locale === "ko") return `${h}시간${m > 0 ? ` ${m}분` : ""}`;
  return `${h}h ${m > 0 ? `${m}m` : ""}`;
}

function formatTime(isoString: string): string {
  if (!isoString) return "";
  const match = isoString.match(/(\d{2}:\d{2})/);
  return match ? match[1] : isoString.slice(11, 16);
}

function formatDate(isoString: string, locale: Locale): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      const datePart = isoString.split(" ")[0] || isoString.slice(0, 10);
      return datePart;
    }
    const intl = locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : locale === "ko" ? "ko-KR" : "en-US";
    return new Intl.DateTimeFormat(intl, { month: "short", day: "numeric", weekday: "short" }).format(d);
  } catch {
    return isoString.slice(0, 10);
  }
}

export function FlightResults({
  flights,
  copy,
  locale,
  sortKey,
  onSortChange,
}: {
  flights: FlightResult[];
  copy: Copy;
  locale: Locale;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
}) {
  const sorted = [...flights].sort((a, b) => {
    if (sortKey === "duration") return a.durationMinutes - b.durationMinutes;
    if (sortKey === "departure") return a.departureTime.localeCompare(b.departureTime);
    return a.price - b.price;
  });

  return (
    <div className="flight-results">
      <div className="flight-results-header">
        <h3>{copy.chatResultsTitle(flights.length)}</h3>
        <div className="flight-sort-buttons">
          {(["price", "duration", "departure"] as SortKey[]).map((key) => (
            <button
              key={key}
              className={`flight-sort-btn${sortKey === key ? " active" : ""}`}
              onClick={() => onSortChange(key)}
            >
              {key === "price" ? copy.chatSortPrice : key === "duration" ? copy.chatSortDuration : copy.chatSortDeparture}
            </button>
          ))}
        </div>
      </div>
      <div className="flight-card-list">
        {sorted.map((flight) => (
          <div key={flight.id} className="flight-card">
            <div className="flight-card-top">
              <div className="flight-airline">
                {flight.airlineLogo && (
                  <img src={flight.airlineLogo} alt={flight.airline} className="flight-airline-logo" />
                )}
                <span className="flight-airline-name">{flight.airline}</span>
                <span className="flight-numbers">{flight.flightNumbers.join(" · ")}</span>
              </div>
              <div className="flight-price-badge">
                <span className="flight-price">${flight.price}</span>
                {flight.priceLevel && flight.priceLevel !== "typical" && (
                  <span className={`flight-price-level ${flight.priceLevel}`}>
                    {copy.chatPriceLevel(flight.priceLevel)}
                  </span>
                )}
              </div>
            </div>
            <div className="flight-card-middle">
              <div className="flight-leg">
                <div className="flight-time-block">
                  <span className="flight-time">{formatTime(flight.departureTime)}</span>
                  <span className="flight-airport">{flight.origin}</span>
                </div>
                <div className="flight-route-line">
                  <div className="flight-duration">{formatDuration(flight.durationMinutes, locale)}</div>
                  <div className="flight-line-track">
                    <div className="flight-line" />
                    {flight.stops > 0 && flight.stopAirports.map((stop, i) => (
                      <span key={i} className="flight-stop-dot" title={stop} />
                    ))}
                  </div>
                  <div className="flight-stops">{copy.chatStops(flight.stops)}</div>
                </div>
                <div className="flight-time-block">
                  <span className="flight-time">{formatTime(flight.arrivalTime)}</span>
                  <span className="flight-airport">{flight.destination}</span>
                </div>
              </div>
              {flight.stops > 0 && flight.stopAirports.length > 0 && (
                <div className="flight-via">
                  {flight.stopAirports.join(" · ")}
                </div>
              )}
              <div className="flight-date-line">
                {formatDate(flight.departureTime, locale)}
              </div>
            </div>
            <div className="flight-card-bottom">
              {flight.riskPattern && (
                <div className={`flight-risk-warning pattern-${flight.riskPattern}`}>
                  {flight.riskPattern === "A" && copy.riskPatternA}
                  {flight.riskPattern === "B" && copy.riskPatternB}
                  {flight.riskPattern === "C" && copy.riskPatternC}
                </div>
              )}
              {flight.bookingUrl && (
                <a
                  href={flight.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flight-book-btn"
                >
                  {copy.chatBooking} ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

