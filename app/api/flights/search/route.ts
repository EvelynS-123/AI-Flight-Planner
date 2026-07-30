// Simple FNV-1a hash for cache keys and IDs (Workers-compatible, no Node.js crypto needed)
import {
  readPersistentFlightSearchCache,
  writePersistentFlightSearchCache,
} from "../../../../db/flight-search-cache.ts";

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export const runtime = "nodejs";

const MAX_EXPLORATION_HUBS = 3;
const MAX_PROVIDER_REQUESTS = 1 + MAX_EXPLORATION_HUBS * 2;

const FLIGHT_SEARCH_CACHE = new Map<string, {
  expiresAt: number;
  results: any[];
}>();

export async function POST(request: Request) {
  const {
    origins,
    destinations,
    dateRangeStart,
    dateRangeEnd,
    returnDateStart,
    returnDateEnd,
    tripType,
    cabinClass,
    maxStops,
    adults,
    legs,
    explorationHubs,
    explorationHubReasons,
    variantRequest,
  } = await request.json();

  const apiKey = process.env.SERPAPI_API_KEY;
  let remainingProviderRequests = MAX_PROVIDER_REQUESTS;
  let providerRequests = 0;
  const respond = (results: any[]) => Response.json({
    results,
    meta: {
      providerRequests,
      requestLimit: MAX_PROVIDER_REQUESTS,
    },
  });
  const reserveQueries = (queries: string[], requestedLimit = 1) => {
    const limit = Math.max(
      0,
      Math.min(requestedLimit, remainingProviderRequests),
    );
    const selected = queries.slice(0, limit);
    remainingProviderRequests -= selected.length;
    return selected;
  };

  let legsToProcess = legs;
  if (!legsToProcess || legsToProcess.length === 0) {
    if (origins && destinations) {
      legsToProcess = [{ origins, destinations }];
    }
  }

  // Helper to search a single leg
  async function searchSingleLeg(
    legOrigins: string[],
    legDestinations: string[],
    startDate: string,
    endDate: string,
    sampledDateLimit?: number,
    allowMockFallback = true,
    forceOneWay = false,
    queryLimit = 1,
    returnDateOverride?: { start: string; end: string },
  ) {
    const outDates = limitDates(getSampledDates(startDate, endDate), sampledDateLimit);
    const effectiveReturnStart = returnDateOverride?.start || returnDateStart;
    const effectiveReturnEnd = returnDateOverride?.end || returnDateEnd;
    const useRoundTrip = !forceOneWay
      && tripType === "round_trip"
      && effectiveReturnStart
      && effectiveReturnEnd;
    const retDates = useRoundTrip
      ? limitDates(getSampledDates(effectiveReturnStart, effectiveReturnEnd), 1)
      : [undefined];

    const queries: string[] = [];
    
    for (const origin of legOrigins) {
      for (const dest of legDestinations) {
        for (const outDate of outDates) {
          for (const retDate of retDates) {
            let url = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${dest}&outbound_date=${outDate}&currency=USD&type=${useRoundTrip ? 1 : 2}&api_key=${apiKey}&adults=${adults || 1}`;
            
            if (retDate) {
              url += `&return_date=${retDate}`;
            }

            let tc = 1;
            if (cabinClass === "premium_economy") tc = 2;
            else if (cabinClass === "business") tc = 3;
            else if (cabinClass === "first") tc = 4;
            
            url += `&travel_class=${tc}&hl=en&gl=us`;

            queries.push(url);
          }
        }
      }
    }

    const plannedQueries = apiKey ? reserveQueries(queries, queryLimit) : [];
    const results = (
      await Promise.all(
        plannedQueries.map((query) =>
          executeQuery(query, () => {
            providerRequests += 1;
          })
        ),
      )
    ).flat();

    const unique = new Map<string, any>();
    for (const r of results) {
      if (r.price === undefined || r.price === null) continue;
      if (maxStops != null && r.stops > maxStops) continue;

      const key = `${r.airline}-${r.flightNumbers.join(",")}-${r.departureTime}`;
      if (!unique.has(key)) {
        unique.set(key, r);
      }
    }

    let finalResults = Array.from(unique.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 100);

    if (finalResults.length === 0 && allowMockFallback && !apiKey) {
      finalResults = generateMockFlights(legOrigins[0] || "NRT", legDestinations[0] || "LAX", startDate);
    }
    return finalResults;
  }

  if (variantRequest && typeof variantRequest === "object") {
    const requestValue = variantRequest as Record<string, unknown>;
    const selectedDate = typeof requestValue.date === "string"
      ? requestValue.date
      : "";
    const groupKey = typeof requestValue.groupKey === "string"
      ? requestValue.groupKey
      : "";
    const representative = requestValue.representative && typeof requestValue.representative === "object"
      ? requestValue.representative as Record<string, any>
      : null;

    if (!isIsoDate(selectedDate) || !groupKey || !representative) {
      return respond([]);
    }

    let variants: any[] = [];
    if (
      representative.isSelfTransfer
      && representative.leg1
      && representative.leg2
    ) {
      const firstLeg = representative.leg1;
      const secondLeg = representative.leg2;
      const dayOffset = Math.max(
        0,
        calendarDayDifference(
          String(firstLeg.departureTime).slice(0, 10),
          String(secondLeg.departureTime).slice(0, 10),
        ),
      );
      const secondDate = addIsoDays(selectedDate, dayOffset);
      const [firstResults, secondResults] = await Promise.all([
        searchSingleLeg(
          [firstLeg.origin],
          [firstLeg.destination],
          selectedDate,
          selectedDate,
          1,
          false,
          true,
          1,
        ),
        searchSingleLeg(
          [secondLeg.origin],
          [secondLeg.destination],
          secondDate,
          secondDate,
          1,
          false,
          true,
          1,
        ),
      ]);
      variants = combineTwoLegResults(firstResults, secondResults);
    } else {
      const returnOverride = shiftedReturnDates(
        selectedDate,
        dateRangeStart,
        returnDateStart,
        returnDateEnd,
      );
      variants = await searchSingleLeg(
        [representative.origin],
        [representative.destination],
        selectedDate,
        selectedDate,
        1,
        false,
        false,
        1,
        returnOverride,
      );
    }

    return respond(
      variants.filter((flight) => flightGroupingKey(flight) === groupKey),
    );
  }

  if (!legsToProcess || legsToProcess.length === 0) {
    return respond([]);
  }

  // 1. Process all legs in parallel
  const legResultsPromises = legsToProcess.map((leg: any, i: number) => {
    // For subsequent legs, we ideally want to search dates after the first leg.
    // For simplicity, we just use the same date range start/end for all in this demo,
    // but in a real app, we'd adjust `dateRangeStart` based on previous leg's arrival.
    // Alternatively, SerpAPI handles specific dates. We'll use the same dates here and filter by time later.
    let start = dateRangeStart || new Date().toISOString().split("T")[0];
    if (i > 0) {
      // Offset by i days roughly for mock/demo purposes
      const d = new Date(start);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + i);
        start = d.toISOString().split("T")[0];
      }
    }
    return searchSingleLeg(
      leg.origins,
      leg.destinations,
      start,
      dateRangeEnd,
      1,
      true,
      legsToProcess.length > 1,
      1,
    );
  });

  const allLegsResults = await Promise.all(legResultsPromises);

  // 2. For a normal origin-destination search, retain Google's direct and
  // connecting itineraries, then add grounded split-ticket explorations.
  if (allLegsResults.length === 1) {
    const normalResults = allLegsResults[0];
    const originCodes = Array.isArray(legsToProcess[0]?.origins)
      ? legsToProcess[0].origins
      : [];
    const destinationCodes = Array.isArray(legsToProcess[0]?.destinations)
      ? legsToProcess[0].destinations
      : [];
    const groundedHubs = normalizeExplorationHubs(
      explorationHubs,
      originCodes,
      destinationCodes,
    );

    if (groundedHubs.length === 0 || maxStops === 0) {
      return respond(normalResults);
    }

    const searchStart = dateRangeStart || new Date().toISOString().split("T")[0];
    const searchEnd = dateRangeEnd || searchStart;
    const exploredByHub = await Promise.all(
      groundedHubs.map(async (hub) => {
        const [firstLeg, secondLeg] = await Promise.all([
          searchSingleLeg(originCodes, [hub], searchStart, searchEnd, 1, false, true, 1),
          searchSingleLeg(
            [hub],
            destinationCodes,
            addIsoDays(searchStart, 1),
            addIsoDays(searchEnd, 2),
            1,
            false,
            true,
            1,
          ),
        ]);

        const hubReasons = explorationHubReasons && typeof explorationHubReasons === "object"
          ? explorationHubReasons as Record<string, unknown>
          : null;
        const reason = typeof hubReasons?.[hub] === "string"
          ? hubReasons[hub]
          : undefined;

        return combineTwoLegResults(firstLeg, secondLeg)
          .filter((flight) => maxStops == null || flight.stops <= maxStops)
          .map((flight) => ({
            ...flight,
            explorationHub: hub,
            explorationHubReason: reason,
          }));
      }),
    );

    return respond(
      dedupeFlights([...normalResults, ...exploredByHub.flat()])
        .sort((a, b) => a.price - b.price)
        .slice(0, 150),
    );
  }

  // 3. Explicit required via-city instructions arrive as formal legs.
  const leg1Results = allLegsResults[0];
  const leg2Results = allLegsResults[1];
  const finalCombined = combineTwoLegResults(leg1Results, leg2Results)
    .filter((flight) => maxStops == null || flight.stops <= maxStops)
    .sort((a, b) => a.price - b.price)
    .slice(0, 100);

  return respond(finalCombined);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function calendarDayDifference(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000);
}

function shiftedReturnDates(
  selectedDate: string,
  originalDepartureStart: unknown,
  originalReturnStart: unknown,
  originalReturnEnd: unknown,
) {
  if (
    typeof originalDepartureStart !== "string"
    || typeof originalReturnStart !== "string"
    || typeof originalReturnEnd !== "string"
  ) {
    return undefined;
  }

  const startOffset = calendarDayDifference(originalDepartureStart, originalReturnStart);
  const endOffset = calendarDayDifference(originalDepartureStart, originalReturnEnd);
  if (startOffset < 0 || endOffset < startOffset) return undefined;
  return {
    start: addIsoDays(selectedDate, startOffset),
    end: addIsoDays(selectedDate, endOffset),
  };
}

function flightGroupingKey(flight: any): string {
  const category = flight.isSelfTransfer || flight.leg1 || flight.leg2
    ? "multi-city"
    : flight.stops === 0
      ? "direct"
      : "connection";
  const operatingAirlines = Array.isArray(flight.flights)
    ? flight.flights
        .map((segment: any) =>
          typeof segment?.airline === "string"
            ? segment.airline.trim().toLowerCase()
            : ""
        )
        .filter(Boolean)
    : [];
  const airlineSignature = operatingAirlines.length
    ? operatingAirlines.join(">")
    : String(flight.airline || "").trim().toLowerCase();
  const path = [
    flight.origin,
    ...(Array.isArray(flight.stopAirports) ? flight.stopAirports : []),
    flight.destination,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .join(">");
  return [category, airlineSignature, path].join("|");
}

function normalizeExplorationHubs(
  value: unknown,
  origins: string[],
  destinations: string[],
): string[] {
  if (!Array.isArray(value)) return [];

  const endpoints = new Set(
    [...origins, ...destinations]
      .filter((code): code is string => typeof code === "string")
      .map((code) => code.toUpperCase()),
  );

  return Array.from(
    new Set(
      value
        .filter((code): code is string => typeof code === "string")
        .map((code) => code.trim().toUpperCase())
        .filter((code) => /^[A-Z]{3}$/.test(code) && !endpoints.has(code)),
    ),
  ).slice(0, MAX_EXPLORATION_HUBS);
}

function addIsoDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function limitDates(dates: string[], limit?: number): string[] {
  if (!limit || limit < 1 || dates.length <= limit) return dates;
  if (limit === 1) return [dates[Math.floor((dates.length - 1) / 2)]];

  return Array.from(
    new Set(
      Array.from({ length: limit }, (_, index) =>
        dates[Math.round(index * (dates.length - 1) / (limit - 1))]
      ),
    ),
  );
}

function combineTwoLegResults(firstLeg: any[], secondLeg: any[]) {
  const combined: any[] = [];

  for (const f1 of firstLeg) {
    for (const f2 of secondLeg) {
      const arrTime1 = new Date(f1.arrivalTime.replace(" ", "T")).getTime();
      const depTime2 = new Date(f2.departureTime.replace(" ", "T")).getTime();
      const layoverMins = (depTime2 - arrTime1) / 60000;

      if (!Number.isFinite(layoverMins) || layoverMins < 90 || layoverMins > 2160) {
        continue;
      }

      const isLcc1 =
        ["Budget Fly", "Express Air"].includes(f1.airline)
        || f1.airline?.toLowerCase().includes("lcc");
      const isLcc2 =
        ["Budget Fly", "Express Air"].includes(f2.airline)
        || f2.airline?.toLowerCase().includes("lcc");

      let riskPattern: "A" | "B" | "C" = "C";
      if (f1.airline === f2.airline) {
        riskPattern = isLcc1 || isLcc2 ? "C" : "B";
      } else if (!isLcc1 && !isLcc2) {
        riskPattern = parseInt(fnv1a(`${f1.airline}|${f2.airline}`), 16) % 2 === 0
          ? "A"
          : "C";
      }

      combined.push({
        id: `${f1.id}-${f2.id}`,
        airline: f1.airline === f2.airline ? f1.airline : "Multiple Airlines",
        airlineLogo: f1.airline === f2.airline
          ? f1.airlineLogo
          : "https://www.gstatic.com/flights/airline_logos/70px/dark/multi.png",
        flightNumbers: [...f1.flightNumbers, ...f2.flightNumbers],
        origin: f1.origin,
        destination: f2.destination,
        departureTime: f1.departureTime,
        arrivalTime: f2.arrivalTime,
        durationMinutes: f1.durationMinutes + f2.durationMinutes + layoverMins,
        stops: f1.stops + f2.stops + 1,
        stopAirports: [...f1.stopAirports, f1.destination, ...f2.stopAirports],
        price: f1.price + f2.price,
        currency: f1.currency,
        cabinClass: f1.cabinClass,
        priceLevel: f1.priceLevel,
        flights: [...(f1.flights || []), ...(f2.flights || [])],
        airportNames: {
          ...(f1.airportNames || {}),
          ...(f2.airportNames || {}),
        },
        isSelfTransfer: true,
        riskPattern,
        leg1: f1,
        leg2: f2,
      });
    }
  }

  return combined;
}

function dedupeFlights(flights: any[]) {
  const unique = new Map<string, any>();
  for (const flight of flights) {
    if (!unique.has(flight.id)) unique.set(flight.id, flight);
  }
  return Array.from(unique.values());
}

function generateMockFlights(origin: string, dest: string, dateStr: string) {
  const basePrice = 450 + Math.floor(Math.random() * 200);
  const airlines = [
    { name: "Demo Airlines", logo: "ZZ", type: "full" },
    { name: "Global Airways", logo: "GL", type: "full" },
    { name: "Budget Fly", logo: "BF", type: "lcc" },
    { name: "Pacific Air", logo: "PA", type: "full" },
    { name: "Express Air", logo: "EX", type: "lcc" }
  ];
  const hubs = ["HNL", "TPE", "ICN", "SFO", "SEA"];

  const results = [];
  const numResults = 12 + Math.floor(Math.random() * 4); // 12 to 15

  for (let i = 0; i < numResults; i++) {
    const airline = airlines[i % airlines.length];
    const isDirect = Math.random() > 0.5;
    const isLcc = airline.type === "lcc";
    const price = Math.max(150, basePrice + (Math.random() * 300 - 150) - (isLcc ? 120 : 0) + (isDirect ? 50 : -30));
    
    const stops = isDirect ? 0 : (Math.random() > 0.8 ? 2 : 1);
    const stopAirports = [];
    if (stops > 0) {
      stopAirports.push(hubs[Math.floor(Math.random() * hubs.length)]);
      if (stops > 1) {
        stopAirports.push(hubs[Math.floor(Math.random() * hubs.length)]);
      }
    }

    const durationMinutes = 540 + Math.floor(Math.random() * 180) + (stops * 120);
    const depHour = Math.floor(Math.random() * 24);
    const depMinute = Math.random() > 0.5 ? "00" : "30";
    const depTime = `${dateStr} ${depHour.toString().padStart(2, "0")}:${depMinute}`;
    
    // Naive arrival time calculation for mock purposes
    const arrTimeStr = new Date(new Date(depTime.replace(" ", "T")).getTime() + durationMinutes * 60000).toISOString();
    const arrTime = arrTimeStr.split("T")[0] + " " + arrTimeStr.split("T")[1].substring(0, 5);

    const flightNumbers = [`${airline.logo} ${100 + Math.floor(Math.random() * 800)}`];
    if (stops > 0) flightNumbers.push(`${airline.logo} ${100 + Math.floor(Math.random() * 800)}`);
    if (stops > 1) flightNumbers.push(`${airline.logo} ${100 + Math.floor(Math.random() * 800)}`);

    const mockFlights = [];
    let currentDepTimeStr = depTime;
    let currentDepDateObj = new Date(currentDepTimeStr.replace(" ", "T"));
    
    for (let j = 0; j <= stops; j++) {
      const segOrigin = j === 0 ? origin : stopAirports[j - 1];
      const segDest = j === stops ? dest : stopAirports[j];
      const segDuration = Math.floor(durationMinutes / (stops + 1)) - (j < stops ? 30 : 0);
      
      const segArrTimeObj = new Date(currentDepDateObj.getTime() + segDuration * 60000);
      const segArrTimeStr = segArrTimeObj.toISOString().split("T")[0] + " " + segArrTimeObj.toISOString().split("T")[1].substring(0, 5);

      mockFlights.push({
        departure_airport: { id: segOrigin, time: currentDepTimeStr },
        arrival_airport: { id: segDest, time: segArrTimeStr },
        airline: airline.name,
        airline_logo: `https://www.gstatic.com/flights/airline_logos/70px/dark/${airline.logo}.png`,
        flight_number: flightNumbers[j] || flightNumbers[0],
        duration: segDuration,
        travel_class: "Economy"
      });

      if (j < stops) {
        currentDepDateObj = new Date(segArrTimeObj.getTime() + 120 * 60000); // 2 hour layover
        currentDepTimeStr = currentDepDateObj.toISOString().split("T")[0] + " " + currentDepDateObj.toISOString().split("T")[1].substring(0, 5);
      }
    }

    results.push({
      id: fnv1a(`mock-${i}-${origin}-${dest}-${Date.now()}`),
      airline: airline.name,
      airlineLogo: `https://www.gstatic.com/flights/airline_logos/70px/dark/${airline.logo}.png`,
      flightNumbers,
      origin,
      destination: dest,
      departureTime: mockFlights[0].departure_airport.time,
      arrivalTime: mockFlights[mockFlights.length - 1].arrival_airport.time,
      durationMinutes,
      stops,
      stopAirports,
      price: Math.floor(price),
      currency: "USD",
      cabinClass: "Economy",
      bookingUrl: "https://google.com/flights",
      priceLevel: price < 300 ? "low" : price > 600 ? "high" : "typical",
      carbonEmissions: 300 + Math.floor(Math.random() * 400) + (stops * 100),
      flights: mockFlights
    });
  }

  return results.sort((a, b) => a.price - b.price);
}

function getSampledDates(startStr: string, endStr: string): string[] {
  const dates = [];
  let current = new Date(startStr);
  const end = new Date(endStr);
  
  if (isNaN(current.getTime()) || isNaN(end.getTime())) {
    return [startStr]; // fallback
  }

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 2);
  }
  
  return dates;
}

async function executeQuery(url: string, onProviderRequest?: () => void) {
  const cacheTtlMilliseconds = Math.max(
    0,
    Number(process.env.FLIGHT_SEARCH_CACHE_TTL_MS || 1800000),
  );

  const canonicalUrl = new URL(url);
  canonicalUrl.searchParams.delete("api_key");
  const cacheKey = fnv1a(canonicalUrl.toString());
  const cached = FLIGHT_SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }
  const persistent = await readPersistentFlightSearchCache(cacheKey);
  if (persistent) {
    FLIGHT_SEARCH_CACHE.set(cacheKey, persistent);
    return persistent.results;
  }

  try {
    onProviderRequest?.();
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.best_flights && !data.other_flights) return [];

    const rawFlights = [...(data.best_flights || []), ...(data.other_flights || [])];
    
    const parsed = rawFlights.map(f => {
      const flightNum = f.flights.map((fl: any) => fl.flight_number);
      const stops = f.flights.length - 1;
      const stopAirports = stops > 0 ? f.flights.slice(0, -1).map((fl: any) => fl.arrival_airport.id) : [];
      const airportNames = Object.fromEntries(
        f.flights.flatMap((flight: any) => [
          [
            String(flight.departure_airport?.id || "").toUpperCase(),
            String(flight.departure_airport?.name || "").trim(),
          ],
          [
            String(flight.arrival_airport?.id || "").toUpperCase(),
            String(flight.arrival_airport?.name || "").trim(),
          ],
        ]).filter(([code, name]: [string, string]) => /^[A-Z0-9]{3}$/.test(code) && name),
      );

      const result = {
        id: fnv1a([
          f.flights[0].airline,
          flightNum.join(","),
          f.flights[0].departure_airport.id,
          f.flights[f.flights.length - 1].arrival_airport.id,
          f.flights[0].departure_airport.time,
        ].join("|")),
        airline: f.flights[0].airline,
        airlineLogo: f.flights[0].airline_logo,
        flightNumbers: flightNum,
        origin: f.flights[0].departure_airport.id,
        destination: f.flights[f.flights.length - 1].arrival_airport.id,
        departureTime: f.flights[0].departure_airport.time,
        arrivalTime: f.flights[f.flights.length - 1].arrival_airport.time,
        durationMinutes: f.total_duration,
        stops,
        stopAirports,
        price: f.price,
        currency: "USD",
        cabinClass: f.flights[0].travel_class,
        bookingUrl: data.search_metadata?.google_flights_url || "",
        carbonEmissions: f.carbon_emissions?.this_flight,
        priceLevel: data.price_insights?.typical_price_level,
        flights: f.flights,
        airportNames,
      };
      return result;
    });

    if (cacheTtlMilliseconds > 0) {
      const expiresAt = Date.now() + cacheTtlMilliseconds;
      FLIGHT_SEARCH_CACHE.set(cacheKey, {
        expiresAt,
        results: parsed,
      });
      await writePersistentFlightSearchCache(cacheKey, parsed, expiresAt);
    }

    return parsed;
  } catch (e) {
    console.error("SerpApi Error:", e);
    return [];
  }
}

