import type {
  FlightSearchRequest,
  LiveFlightOffer,
  LiveFlightSearchResult,
  LiveFlightSegment,
} from "./types.ts";

type ProviderEnvironment = Record<string, string | undefined>;

type SerpApiAirport = {
  name?: string;
  id?: string;
  time?: string;
};

type SerpApiFlight = {
  departure_airport?: SerpApiAirport;
  arrival_airport?: SerpApiAirport;
  duration?: number;
  airplane?: string;
  airline?: string;
  airline_logo?: string;
  travel_class?: string;
  flight_number?: string;
};

type SerpApiOffer = {
  flights?: SerpApiFlight[];
  layovers?: Array<{
    duration?: number;
    name?: string;
    id?: string;
    overnight?: boolean;
  }>;
  total_duration?: number;
  price?: number;
  type?: string;
  airline_logo?: string;
  departure_token?: string;
  booking_token?: string;
};

type SerpApiPayload = {
  error?: string;
  search_metadata?: {
    google_flights_url?: string;
  };
  search_parameters?: {
    currency?: string;
  };
  best_flights?: SerpApiOffer[];
  other_flights?: SerpApiOffer[];
};

type CacheEntry = {
  expiresAt: number;
  result: LiveFlightSearchResult;
};

const FLIGHT_SEARCH_CACHE = new Map<string, CacheEntry>();

export class FlightSearchProviderError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 502,
    code = "flight_provider_error",
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizedBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function safeString(value: unknown, limit = 240) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function safeMinutes(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function airlineCode(flightNumber: string) {
  return flightNumber.replace(/\s+/g, "").match(/^([A-Z0-9]{2,3})/i)?.[1]?.toUpperCase() || "XX";
}

function normalizeFlight(
  raw: SerpApiFlight,
  index: number,
  fallbackLogo: string,
): LiveFlightSegment | null {
  const from = safeString(raw.departure_airport?.id, 3).toUpperCase();
  const to = safeString(raw.arrival_airport?.id, 3).toUpperCase();
  const departureLocal = safeString(raw.departure_airport?.time, 32);
  const arrivalLocal = safeString(raw.arrival_airport?.time, 32);
  const flightNumber = safeString(raw.flight_number, 20);
  const airlineName = safeString(raw.airline, 100) || "Airline";
  if (
    !/^[A-Z0-9]{3}$/.test(from)
    || !/^[A-Z0-9]{3}$/.test(to)
    || !departureLocal
    || !arrivalLocal
    || !flightNumber
  ) return null;

  const code = airlineCode(flightNumber);
  const logo = safeString(raw.airline_logo, 1000)
    || fallbackLogo
    || `https://www.gstatic.com/flights/airline_logos/70px/${code}.png`;
  return {
    id: `flight-${stableId(`${flightNumber}|${departureLocal}|${from}|${to}|${index}`)}`,
    from,
    fromName: safeString(raw.departure_airport?.name, 160) || from,
    to,
    toName: safeString(raw.arrival_airport?.name, 160) || to,
    departureLocal,
    arrivalLocal,
    durationMinutes: safeMinutes(raw.duration),
    airlineCode: code,
    airlineName,
    flightNumber,
    airplane: safeString(raw.airplane, 100) || undefined,
    travelClass: safeString(raw.travel_class, 80) || undefined,
    logoUrl: logo,
  };
}

export function normalizeSerpApiResponse(
  payload: SerpApiPayload,
  request: Required<Pick<
    FlightSearchRequest,
    "origin" | "destination" | "departureDate" | "adults" | "currency"
  >>,
  searchedAt = new Date().toISOString(),
): LiveFlightSearchResult {
  if (payload.error) {
    throw new FlightSearchProviderError(
      safeString(payload.error, 400) || "SerpApi rejected the flight search.",
      502,
      "serpapi_rejected",
    );
  }

  const sourceUrl = safeString(
    payload.search_metadata?.google_flights_url,
    2000,
  ) || "https://www.google.com/travel/flights";
  const currency = safeString(payload.search_parameters?.currency, 3).toUpperCase()
    || request.currency;
  const rawOffers = [
    ...(payload.best_flights || []),
    ...(payload.other_flights || []),
  ].slice(0, 40);
  const offers: LiveFlightOffer[] = [];
  const seen = new Set<string>();

  for (const raw of rawOffers) {
    const fallbackLogo = safeString(raw.airline_logo, 1000);
    const segments = (raw.flights || [])
      .map((flight, index) => normalizeFlight(flight, index, fallbackLogo))
      .filter((flight): flight is LiveFlightSegment => Boolean(flight));
    const price = Number(raw.price);
    if (!segments.length || !Number.isFinite(price) || price <= 0) continue;

    const identity = [
      price,
      ...segments.map((flight) => (
        `${flight.flightNumber}|${flight.departureLocal}|${flight.from}|${flight.to}`
      )),
    ].join("|");
    if (seen.has(identity)) continue;
    seen.add(identity);

    offers.push({
      id: `serp-${stableId(identity)}`,
      price: Number(price.toFixed(2)),
      currency,
      totalDurationMinutes: safeMinutes(raw.total_duration)
        || segments.reduce((sum, flight) => sum + flight.durationMinutes, 0),
      type: safeString(raw.type, 80) || (segments.length === 1 ? "Nonstop" : "Connecting"),
      segments,
      layovers: (raw.layovers || []).map((layover) => ({
        airport: safeString(layover.id, 3).toUpperCase(),
        name: safeString(layover.name, 160) || safeString(layover.id, 3).toUpperCase(),
        durationMinutes: safeMinutes(layover.duration),
        overnight: Boolean(layover.overnight),
      })).filter((layover) => /^[A-Z0-9]{3}$/.test(layover.airport)),
      source: "Google Flights via SerpApi",
      sourceUrl,
      departureToken: safeString(raw.departure_token, 4000) || undefined,
      bookingToken: safeString(raw.booking_token, 4000) || undefined,
    });
  }

  return {
    provider: "serpapi-google-flights",
    searchedAt,
    cached: false,
    request,
    offers,
  };
}

function validateSearchRequest(input: FlightSearchRequest) {
  const origin = safeString(input.origin, 3).toUpperCase();
  const destination = safeString(input.destination, 3).toUpperCase();
  const departureDate = safeString(input.departureDate, 10);
  const adults = Math.max(1, Math.min(9, Math.round(Number(input.adults || 1))));
  const currency = safeString(input.currency || "USD", 3).toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(origin) || !/^[A-Z0-9]{3}$/.test(destination)) {
    throw new FlightSearchProviderError("Origin and destination must be IATA codes.", 400, "invalid_airport");
  }
  if (origin === destination) {
    throw new FlightSearchProviderError("Origin and destination must differ.", 400, "same_airport");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || !Number.isFinite(Date.parse(`${departureDate}T00:00:00Z`))) {
    throw new FlightSearchProviderError("Departure date must use YYYY-MM-DD.", 400, "invalid_date");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new FlightSearchProviderError("Currency must use an ISO 4217 code.", 400, "invalid_currency");
  }
  return { origin, destination, departureDate, adults, currency };
}

export function createSerpApiFlightProvider(
  environment: ProviderEnvironment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = environment.SERPAPI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = normalizedBaseUrl(
    environment.SERPAPI_BASE_URL || "https://serpapi.com",
  );
  const cacheTtlMilliseconds = Math.max(
    0,
    Number(environment.FLIGHT_SEARCH_CACHE_TTL_MS || 15 * 60_000),
  );

  return {
    id: "serpapi-google-flights" as const,
    async search(input: FlightSearchRequest): Promise<LiveFlightSearchResult> {
      const request = validateSearchRequest(input);
      const cacheKey = `${baseUrl}|${JSON.stringify(request)}`;
      const cached = FLIGHT_SEARCH_CACHE.get(cacheKey);
      if (!input.forceRefresh && cached && cached.expiresAt > Date.now()) {
        return {
          ...cached.result,
          cached: true,
          offers: cached.result.offers.map((offer) => ({
            ...offer,
            segments: offer.segments.map((segment) => ({ ...segment })),
            layovers: offer.layovers.map((layover) => ({ ...layover })),
          })),
        };
      }

      const url = new URL(`${baseUrl}/search.json`);
      url.searchParams.set("engine", "google_flights");
      url.searchParams.set("departure_id", request.origin);
      url.searchParams.set("arrival_id", request.destination);
      url.searchParams.set("outbound_date", request.departureDate);
      url.searchParams.set("type", "2");
      url.searchParams.set("travel_class", "1");
      url.searchParams.set("adults", String(request.adults));
      url.searchParams.set("currency", request.currency);
      url.searchParams.set("hl", "en");
      url.searchParams.set("gl", "us");
      url.searchParams.set("api_key", apiKey);
      if (input.forceRefresh) url.searchParams.set("no_cache", "true");

      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetchImpl(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
      }
      if (!response) {
        throw new FlightSearchProviderError("SerpApi did not return a response.");
      }
      if (!response.ok) {
        throw new FlightSearchProviderError(
          `SerpApi request failed with status ${response.status}.`,
          response.status === 429 ? 429 : 502,
          response.status === 429 ? "serpapi_rate_limited" : "serpapi_http_error",
        );
      }

      const payload = await response.json() as SerpApiPayload;
      const result = normalizeSerpApiResponse(payload, request);
      if (!result.offers.length) {
        throw new FlightSearchProviderError(
          "SerpApi returned no usable flight offers.",
          404,
          "no_flight_offers",
        );
      }
      if (cacheTtlMilliseconds > 0) {
        FLIGHT_SEARCH_CACHE.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMilliseconds,
          result,
        });
      }
      return result;
    },
  };
}
