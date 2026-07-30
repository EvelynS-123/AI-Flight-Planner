// Simple FNV-1a hash for cache keys and IDs (Workers-compatible, no Node.js crypto needed)
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export const runtime = "nodejs";

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
  } = await request.json();

  const apiKey = process.env.SERPAPI_API_KEY;

  let legsToProcess = legs;
  if (!legsToProcess || legsToProcess.length === 0) {
    if (origins && destinations) {
      legsToProcess = [{ origins, destinations }];
    } else {
      return Response.json({ results: [] });
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
  ) {
    const outDates = limitDates(getSampledDates(startDate, endDate), sampledDateLimit);
    const useRoundTrip = !forceOneWay
      && tripType === "round_trip"
      && returnDateStart
      && returnDateEnd;
    const retDates = useRoundTrip
      ? getSampledDates(returnDateStart, returnDateEnd)
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

    const results: any[] = [];
    if (apiKey) {
      for (let i = 0; i < queries.length; i += 3) {
        const chunk = queries.slice(i, i + 3);
        const chunkResults = await Promise.all(chunk.map(q => executeQuery(q)));
        results.push(...chunkResults.flat());
      }
    }

    const unique = new Map<string, any>();
    for (const r of results) {
      if (r.price === undefined || r.price === null) continue;
      if (maxStops !== undefined && r.stops > maxStops) continue;

      const key = `${r.airline}-${r.flightNumbers.join(",")}-${r.departureTime}`;
      if (!unique.has(key)) {
        unique.set(key, r);
      }
    }

    let finalResults = Array.from(unique.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 100);

    if (finalResults.length === 0 && allowMockFallback) {
      finalResults = generateMockFlights(legOrigins[0] || "NRT", legDestinations[0] || "LAX", startDate);
    }
    return finalResults;
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
      undefined,
      true,
      legsToProcess.length > 1,
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
      return Response.json({ results: normalResults });
    }

    const searchStart = dateRangeStart || new Date().toISOString().split("T")[0];
    const searchEnd = dateRangeEnd || searchStart;
    const exploredByHub = await Promise.all(
      groundedHubs.map(async (hub) => {
        const [firstLeg, secondLeg] = await Promise.all([
          searchSingleLeg(originCodes, [hub], searchStart, searchEnd, 3, false, true),
          searchSingleLeg(
            [hub],
            destinationCodes,
            addIsoDays(searchStart, 1),
            addIsoDays(searchEnd, 2),
            3,
            false,
            true,
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

    return Response.json({
      results: dedupeFlights([...normalResults, ...exploredByHub.flat()])
        .sort((a, b) => a.price - b.price)
        .slice(0, 150),
    });
  }

  // 3. Explicit required via-city instructions arrive as formal legs.
  const leg1Results = allLegsResults[0];
  const leg2Results = allLegsResults[1];
  const finalCombined = combineTwoLegResults(leg1Results, leg2Results)
    .filter((flight) => maxStops == null || flight.stops <= maxStops)
    .sort((a, b) => a.price - b.price)
    .slice(0, 100);

  return Response.json({ results: finalCombined });
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
  ).slice(0, 3);
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

async function executeQuery(url: string) {
  const cacheTtlMilliseconds = Math.max(
    0,
    Number(process.env.FLIGHT_SEARCH_CACHE_TTL_MS || 1800000),
  );

  const cacheKey = fnv1a(url);
  const cached = FLIGHT_SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.best_flights && !data.other_flights) return [];

    const rawFlights = [...(data.best_flights || []), ...(data.other_flights || [])];
    
    const parsed = rawFlights.map(f => {
      const flightNum = f.flights.map((fl: any) => fl.flight_number);
      const stops = f.flights.length - 1;
      const stopAirports = stops > 0 ? f.flights.slice(0, -1).map((fl: any) => fl.arrival_airport.id) : [];

      const result = {
        id: fnv1a(`${f.flights[0].airline}-${flightNum.join(",")}-${f.flights[0].departure_airport.time}`),
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
        flights: f.flights
      };
      return result;
    });

    if (cacheTtlMilliseconds > 0) {
      FLIGHT_SEARCH_CACHE.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMilliseconds,
        results: parsed,
      });
    }

    return parsed;
  } catch (e) {
    console.error("SerpApi Error:", e);
    return [];
  }
}

