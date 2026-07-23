import type { RouteOption, RouteWeights, Segment } from "./route-data";
import { DEFAULT_CITY_ATTRACTIVENESS } from "./travel-preferences.ts";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type FlightTemplate = {
  id: string;
  from: string;
  to: string;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  departureTime: string;
  durationMinutes: number;
  operatingDays: Weekday[];
  scheduleSource: string;
};

export type ScheduledFlight = FlightTemplate & {
  logoUrl: string;
  departureUtc: number;
  arrivalUtc: number;
  departureDate: string;
  arrivalDate: string;
  arrivalTime: string;
  arrivalDayOffset: number;
};

export type ScheduledTicket = {
  ticketIndex: number;
  price: number;
  fareDate: string;
  fareSource: string;
  fareUrl: string;
  flights: ScheduledFlight[];
};

export type ScheduledStop = {
  airport: string;
  kind: "connection" | "multi-city";
  durationMinutes: number;
  usableMinutes: number;
  playDays: number;
  options: number[];
  arrivalUtc: number;
  departureUtc: number;
};

export type RouteScores = {
  price: number;
  interest: number;
  directness: number;
  total: number;
  stops: number;
  duration: number;
  convenience: number;
  attractiveness: number;
  usableTime: number;
  airportAccess: number;
  timeWindow: number;
};

export type RankedRouteOption = RouteOption & {
  scheduledTickets: ScheduledTicket[];
  scheduledStops: ScheduledStop[];
  totalDurationMinutes: number;
  selectedStopoverDays: number[];
  dataValid: boolean;
  scores: RouteScores;
};

export type StopoverSelections = Record<string, number[]>;

const DAILY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const DELTA_2026 = "https://prd.deltacargo.com/content/dam/cargo/images/pdf/DeltaInternationalScheduleMay2026.pdf";
const CATHAY_2026 = "https://news.cathaypacific.com/cathay-pacific-introduces-new-award-winning-aria-suite-business-class-new-premium-economy-and-refreshed-economy-experiences-to-los-angeles-rf82ie";

const AIRPORT_OFFSET_MINUTES: Record<string, number> = {
  PVG: 480, PEK: 480, HKG: 480, TPE: 480, CAN: 480, WUH: 480, MNL: 480,
  ICN: 540, NRT: 540, KIX: 540, HNL: -600,
  LAX: -420, SFO: -420, SEA: -420, YVR: -420,
};

const AIRPORT_CITY_MINUTES: Record<string, number> = {
  HNL: 22, NRT: 60, HKG: 28, KIX: 55, TPE: 42, ICN: 58,
  YVR: 25, PEK: 55, MNL: 35, CAN: 42, WUH: 45,
};

function routeSchedule(from: string, to: string) {
  return `https://www.flightsfrom.com/${from}-${to}`;
}

function flight(
  id: string,
  from: string,
  to: string,
  airlineCode: string,
  airlineName: string,
  flightNumber: string,
  departureTime: string,
  durationMinutes: number,
  operatingDays: Weekday[] = DAILY,
  scheduleSource = routeSchedule(from, to),
): FlightTemplate {
  return { id, from, to, airlineCode, airlineName, flightNumber, departureTime, durationMinutes, operatingDays, scheduleSource };
}

// Representative weekly timetable snapshots for the demo. The route links remain
// visible in the UI because schedules can change before August and September 2026.
const FLIGHTS = [
  flight("mu523", "PVG", "NRT", "MU", "China Eastern Airlines", "MU523", "09:05", 175),
  flight("ke894", "PVG", "ICN", "KE", "Korean Air", "KE894", "11:10", 125),
  flight("ci502", "PVG", "TPE", "CI", "China Airlines", "CI502", "12:05", 115),
  flight("dl38", "PVG", "LAX", "DL", "Delta Air Lines", "DL38", "18:25", 720, [1, 4, 6], DELTA_2026),
  flight("mu589", "PVG", "SFO", "MU", "China Eastern Airlines", "MU589", "13:00", 705, [0, 3, 5]),
  flight("cx365", "PVG", "HKG", "CX", "Cathay Pacific", "CX365", "09:20", 175),
  flight("cz3549", "PVG", "CAN", "CZ", "China Southern Airlines", "CZ3549", "10:30", 160),
  flight("cz3824", "PVG", "WUH", "CZ", "China Southern Airlines", "CZ3824", "08:00", 110),

  flight("uo646", "HKG", "NRT", "UO", "HK Express", "UO646", "13:05", 265),
  flight("oz722", "HKG", "ICN", "OZ", "Asiana Airlines", "OZ722", "13:10", 215),
  flight("cx520", "HKG", "NRT", "CX", "Cathay Pacific", "CX520", "10:30", 325),
  flight("cx884", "HKG", "LAX", "CX", "Cathay Pacific", "CX884", "12:45", 750, DAILY, CATHAY_2026),
  flight("ua153", "HKG", "LAX", "UA", "United Airlines", "UA153", "09:30", 795),
  flight("ua862", "HKG", "SFO", "UA", "United Airlines", "UA862", "11:15", 750),
  flight("cx858", "HKG", "SEA", "CX", "Cathay Pacific", "CX858", "09:30", 735, [0, 1, 3, 5]),
  flight("cx888", "HKG", "YVR", "CX", "Cathay Pacific", "CX888", "00:45", 695),
  flight("ac8", "HKG", "YVR", "AC", "Air Canada", "AC8", "18:00", 735),
  flight("ca118", "HKG", "PEK", "CA", "Air China", "CA118", "08:30", 200),
  flight("jx236", "HKG", "TPE", "JX", "STARLUX Airlines", "JX236", "19:45", 110),
  flight("pr301", "HKG", "MNL", "PR", "Philippine Airlines", "PR301", "11:30", 140),

  flight("br184", "TPE", "NRT", "BR", "EVA Air", "BR184", "07:55", 205),
  flight("jl802", "TPE", "NRT", "JL", "Japan Airlines", "JL802", "10:00", 195),
  flight("ci6", "TPE", "LAX", "CI", "China Airlines", "CI6", "17:00", 710, [1, 3, 5]),
  flight("jx2", "TPE", "LAX", "JX", "STARLUX Airlines", "JX2", "23:40", 710),
  flight("ci4", "TPE", "SFO", "CI", "China Airlines", "CI4", "23:30", 680),
  flight("dl68", "TPE", "SEA", "DL", "Delta Air Lines", "DL68", "09:55", 605, DAILY, DELTA_2026),
  flight("ci32", "TPE", "YVR", "CI", "China Airlines", "CI32", "23:55", 625),
  flight("pr891", "TPE", "MNL", "PR", "Philippine Airlines", "PR891", "09:45", 130),
  flight("ci156", "TPE", "KIX", "CI", "China Airlines", "CI156", "08:20", 165),

  flight("zg2", "NRT", "HNL", "ZG", "ZIPAIR Tokyo", "ZG2", "19:30", 435, [2, 4, 6]),
  flight("jl784", "NRT", "HNL", "JL", "Japan Airlines", "JL784", "20:45", 435, [0, 1, 3, 5]),
  flight("zg41", "NRT", "ICN", "ZG", "ZIPAIR Tokyo", "ZG41", "08:55", 160),
  flight("gk11", "NRT", "TPE", "GK", "Jetstar Japan", "GK11", "22:50", 230),
  flight("zg24", "NRT", "LAX", "ZG", "ZIPAIR Tokyo", "ZG24", "14:40", 600, [0, 1, 3, 5]),
  flight("zg26", "NRT", "SFO", "ZG", "ZIPAIR Tokyo", "ZG26", "21:25", 565, [1, 3, 5]),
  flight("jl68", "NRT", "SEA", "JL", "Japan Airlines", "JL68", "17:40", 565),
  flight("ac4", "NRT", "YVR", "AC", "Air Canada", "AC4", "16:40", 530),
  flight("pr427", "NRT", "MNL", "PR", "Philippine Airlines", "PR427", "14:15", 300),

  flight("ha460", "ICN", "HNL", "HA", "Hawaiian Airlines", "HA460", "21:25", 505),
  flight("ke53", "ICN", "HNL", "KE", "Korean Air", "KE53", "21:05", 515),
  flight("yp101", "ICN", "LAX", "YP", "Air Premia", "YP101", "12:50", 690, [0, 1, 3, 5]),
  flight("yp111", "ICN", "SFO", "YP", "Air Premia", "YP111", "17:30", 630, [1, 3, 5]),
  flight("ke71", "ICN", "YVR", "KE", "Korean Air", "KE71", "18:50", 590),
  flight("dl196", "ICN", "SEA", "DL", "Delta Air Lines", "DL196", "19:00", 611, DAILY, DELTA_2026),

  flight("ua1221", "HNL", "LAX", "UA", "United Airlines", "UA1221", "08:00", 335),
  flight("ua372", "HNL", "SFO", "UA", "United Airlines", "UA372", "07:00", 310),
  flight("as896", "HNL", "SEA", "AS", "Alaska Airlines", "AS896", "15:50", 345),
  flight("ac518", "HNL", "YVR", "AC", "Air Canada", "AC518", "23:00", 355, [0, 1, 3, 5]),

  flight("cz327", "CAN", "LAX", "CZ", "China Southern Airlines", "CZ327", "21:30", 760, [2, 4, 6]),
  flight("cz659", "WUH", "SFO", "CZ", "China Southern Airlines", "CZ659", "14:30", 720, [0, 3]),
  flight("ca983", "PEK", "LAX", "CA", "Air China", "CA983", "22:00", 750, [2, 4, 6]),
  flight("ac552", "YVR", "LAX", "AC", "Air Canada", "AC552", "08:15", 180),
  flight("ac566", "YVR", "SFO", "AC", "Air Canada", "AC566", "08:30", 145),
  flight("pr104", "MNL", "SFO", "PR", "Philippine Airlines", "PR104", "22:05", 740, [0, 1, 3, 5]),
  flight("pr102", "MNL", "LAX", "PR", "Philippine Airlines", "PR102", "21:05", 780, [0, 1, 3, 5]),
  flight("pr124", "MNL", "SEA", "PR", "Philippine Airlines", "PR124", "22:40", 710, [2, 4, 6]),
  flight("ac24", "KIX", "YVR", "AC", "Air Canada", "AC24", "18:00", 560),
] as const;

const FLIGHT_BY_ID = new Map<string, FlightTemplate>(FLIGHTS.map((item) => [item.id, item]));

const PAIR_SCHEDULES: Record<string, string[]> = {
  "PVG-NRT": ["mu523"], "PVG-ICN": ["ke894"], "PVG-TPE": ["ci502"],
  "PVG-HNL": ["ke894", "ke53"], "PVG-LAX": ["dl38"], "PVG-SFO": ["mu589"],
  "HKG-NRT": ["uo646"], "HKG-ICN": ["oz722"], "HKG-HNL": ["cx520", "jl784"],
  "HKG-LAX": ["cx884"], "HKG-SFO": ["ua862"], "HKG-SEA": ["cx858"], "HKG-YVR": ["cx888"],
  "TPE-NRT": ["br184"], "TPE-HNL": ["jl802", "jl784"], "TPE-LAX": ["ci6"],
  "TPE-SFO": ["ci4"], "TPE-SEA": ["dl68"], "TPE-YVR": ["ci32"],
  "NRT-HNL": ["zg2"], "NRT-ICN": ["zg41"], "NRT-TPE": ["gk11"],
  "NRT-LAX": ["zg24"], "NRT-SFO": ["zg26"], "NRT-SEA": ["jl68"], "NRT-YVR": ["ac4"],
  "ICN-HNL": ["ha460"], "ICN-LAX": ["yp101"], "ICN-SFO": ["yp111"],
  "ICN-SEA": ["dl196"], "ICN-YVR": ["ke71"],
  "HNL-LAX": ["ua1221"], "HNL-SFO": ["ua372"], "HNL-SEA": ["as896"], "HNL-YVR": ["ac518"],
};

const CONNECTION_ROUTE_SCHEDULES: Record<string, string[]> = {
  "pvg-lax-connection-cz": ["cz3549", "cz327"],
  "pvg-lax-connection-cathay": ["cx365", "cx884"],
  "pvg-sfo-connection-cz": ["cz3824", "cz659"],
  "pvg-sfo-connection-cathay": ["cx365", "ua862"],
  "hkg-lax-connection-airpremia": ["oz722", "yp101"],
  "hkg-lax-connection-ac": ["ac8", "ac552"],
  "hkg-lax-connection-ca": ["ca118", "ca983"],
  "hkg-lax-connection-jx": ["jx236", "jx2"],
  "hkg-sfo-connection-ac": ["ac8", "ac566"],
  "hkg-sfo-connection-airpremia": ["oz722", "yp111"],
  "hkg-sfo-connection-pal": ["pr301", "pr104"],
  "hkg-yvr-connection-ke": ["oz722", "ke71"],
  "hkg-sea-connection-jx": ["jx236", "dl68"],
  "tpe-lax-connection-pal": ["pr891", "pr102"],
  "tpe-yvr-connection-ac": ["ci156", "ac24"],
  "nrt-lax-connection-ke": ["zg41", "yp101"],
  "nrt-sea-connection-pal": ["pr427", "pr124"],
};

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseDate(value: string, fallbackMonth: "Aug" | "Sep" = "Sep") {
  const match = value.match(/^2026-(08|09)-(\d{2})$/);
  if (match) return value;
  return fallbackMonth === "Aug" ? "2026-08-15" : "2026-09-15";
}

function dateToDayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dayNumberToDate(value: number) {
  const date = new Date(value * 86_400_000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  return dayNumberToDate(dateToDayNumber(value) + days);
}

function localDateTimeToUtc(date: string, time: string, airport: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const offset = AIRPORT_OFFSET_MINUTES[airport] ?? 0;
  return Date.UTC(year, month - 1, day, hours, minutes) - offset * 60_000;
}

function utcToLocal(utc: number, airport: string) {
  const offset = AIRPORT_OFFSET_MINUTES[airport] ?? 0;
  const date = new Date(utc + offset * 60_000);
  return {
    date: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
    time: `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`,
    minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
  };
}

function scheduleOnDate(template: FlightTemplate, localDate: string, earliestUtc = -Infinity): ScheduledFlight | null {
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay() as Weekday;
  if (!template.operatingDays.includes(weekday)) return null;
  const departureUtc = localDateTimeToUtc(localDate, template.departureTime, template.from);
  if (departureUtc < earliestUtc) return null;
  const arrivalUtc = departureUtc + template.durationMinutes * 60_000;
  const arrival = utcToLocal(arrivalUtc, template.to);
  return {
    ...template,
    logoUrl: `https://images.kiwi.com/airlines/64/${template.airlineCode}.png`,
    departureUtc,
    arrivalUtc,
    departureDate: localDate,
    arrivalDate: arrival.date,
    arrivalTime: arrival.time,
    arrivalDayOffset: dateToDayNumber(arrival.date) - dateToDayNumber(localDate),
  };
}

function nextScheduledFlight(template: FlightTemplate, earliestUtc: number, preferredDate?: string) {
  const earliestLocal = utcToLocal(earliestUtc, template.from).date;
  const startDate = preferredDate && preferredDate > earliestLocal ? preferredDate : earliestLocal;
  for (let day = 0; day <= 14; day += 1) {
    const result = scheduleOnDate(template, addDays(startDate, day), earliestUtc);
    if (result) return result;
  }
  return null;
}

function scheduleExactTicket(flightIds: string[], localDate: string, earliestUtc: number) {
  const templates = flightIds.map((id) => FLIGHT_BY_ID.get(id)).filter((item): item is FlightTemplate => Boolean(item));
  if (!templates.length) return null;
  const first = scheduleOnDate(templates[0], localDate, earliestUtc);
  if (!first) return null;
  const flights = [first];
  for (const template of templates.slice(1)) {
    const next = nextScheduledFlight(template, flights.at(-1)!.arrivalUtc + 90 * 60_000);
    if (!next) return null;
    flights.push(next);
  }
  return flights;
}

function scheduleNextTicket(flightIds: string[], earliestUtc: number, preferredDate?: string) {
  const templates = flightIds.map((id) => FLIGHT_BY_ID.get(id)).filter((item): item is FlightTemplate => Boolean(item));
  if (!templates.length) return null;
  const first = nextScheduledFlight(templates[0], earliestUtc, preferredDate);
  if (!first) return null;
  const flights = [first];
  for (const template of templates.slice(1)) {
    const next = nextScheduledFlight(template, flights.at(-1)!.arrivalUtc + 90 * 60_000);
    if (!next) return null;
    flights.push(next);
  }
  return flights;
}

function flightIdsForTicket(route: RouteOption, segment: Segment) {
  if (route.ticketType === "connection" && CONNECTION_ROUTE_SCHEDULES[route.id]) return CONNECTION_ROUTE_SCHEDULES[route.id];
  return PAIR_SCHEDULES[`${segment.from}-${segment.to}`] ?? [];
}

function internalStops(flights: ScheduledFlight[]) {
  const stops: ScheduledStop[] = [];
  for (let index = 0; index < flights.length - 1; index += 1) {
    const current = flights[index];
    const next = flights[index + 1];
    const durationMinutes = Math.round((next.departureUtc - current.arrivalUtc) / 60_000);
    stops.push(makeStop(current.to, "connection", durationMinutes, 0, [], current.arrivalUtc, next.departureUtc));
  }
  return stops;
}

function makeStop(
  airport: string,
  kind: ScheduledStop["kind"],
  durationMinutes: number,
  playDays: number,
  options: number[],
  arrivalUtc: number,
  departureUtc: number,
): ScheduledStop {
  const access = AIRPORT_CITY_MINUTES[airport] ?? 60;
  const usableMinutes = Math.max(0, durationMinutes - 60 - access * 2 - 120);
  return { airport, kind, durationMinutes, usableMinutes, playDays, options, arrivalUtc, departureUtc };
}

function buildSchedule(route: RouteOption, requestedDays: number[] = []) {
  const scheduledTickets: ScheduledTicket[] = [];
  const scheduledStops: ScheduledStop[] = [];
  const selectedStopoverDays: number[] = [];
  let previousArrival = -Infinity;

  for (let ticketIndex = 0; ticketIndex < route.segments.length; ticketIndex += 1) {
    const segment = route.segments[ticketIndex];
    const flightIds = flightIdsForTicket(route, segment);
    if (!flightIds.length) return null;
    let flights: ScheduledFlight[] | null;

    if (ticketIndex === 0) {
      const startDate = parseDate(segment.date, route.months[0]);
      flights = scheduleNextTicket(flightIds, localDateTimeToUtc(startDate, "00:00", segment.from), startDate);
    } else {
      const hub = segment.from;
      const arrivalLocalDate = utcToLocal(previousArrival, hub).date;
      const validOptions: Array<{ days: number; flights: ScheduledFlight[] }> = [];
      for (let days = 0; days <= 7; days += 1) {
        const targetDate = addDays(arrivalLocalDate, days);
        const minimumUtc = days === 0 ? previousArrival + 180 * 60_000 : localDateTimeToUtc(targetDate, "00:00", hub);
        const candidate = scheduleExactTicket(flightIds, targetDate, minimumUtc);
        if (candidate) validOptions.push({ days, flights: candidate });
      }
      if (!validOptions.length) return null;
      const requested = requestedDays[ticketIndex - 1];
      const chosen = validOptions.find((option) => option.days === requested)
        ?? validOptions.find((option) => option.days === 1)
        ?? validOptions[0];
      flights = chosen.flights;
      selectedStopoverDays.push(chosen.days);
      const durationMinutes = Math.round((flights[0].departureUtc - previousArrival) / 60_000);
      scheduledStops.push(makeStop(hub, "multi-city", durationMinutes, chosen.days, validOptions.map((item) => item.days), previousArrival, flights[0].departureUtc));
    }

    if (!flights?.length) return null;
    scheduledStops.push(...internalStops(flights));
    previousArrival = flights.at(-1)!.arrivalUtc;
    scheduledTickets.push({
      ticketIndex,
      price: segment.price,
      fareDate: segment.date,
      fareSource: segment.source,
      fareUrl: segment.url,
      flights,
    });
  }

  const firstFlight = scheduledTickets[0]?.flights[0];
  const lastTicket = scheduledTickets.at(-1);
  const lastFlight = lastTicket?.flights.at(-1);
  if (!firstFlight || !lastFlight) return null;
  const totalDurationMinutes = Math.round((lastFlight.arrivalUtc - firstFlight.departureUtc) / 60_000);
  const dataValid = totalDurationMinutes >= 0 && scheduledStops.every((stop) => stop.durationMinutes >= 0);
  return { scheduledTickets, scheduledStops, totalDurationMinutes, selectedStopoverDays, dataValid };
}

function reversedMinMax(value: number, min: number, max: number) {
  return max === min ? 100 : 100 * (1 - (value - min) / (max - min));
}

function stopScore(stops: number) {
  if (stops === 0) return 100;
  if (stops === 1) return 70;
  if (stops === 2) return 35;
  return 0;
}

function usableTimeScore(minutes: number) {
  const hours = minutes / 60;
  if (hours < 2) return 0;
  // A monotonic sigmoid keeps short stopovers modest while approaching the
  // practical sightseeing ceiling after roughly two to three days.
  return 100 / (1 + Math.exp(-0.08 * (hours - 12)));
}

function airportAccessScore(airport: string) {
  const minutes = AIRPORT_CITY_MINUTES[airport] ?? 100;
  if (minutes < 30) return 100;
  if (minutes <= 60) return 80;
  if (minutes <= 90) return 50;
  return 20;
}

function timeWindowScore(stop: ScheduledStop) {
  if (stop.usableMinutes >= 8 * 60) return 100;
  const arrival = utcToLocal(stop.arrivalUtc, stop.airport).minutes;
  const departure = utcToLocal(stop.departureUtc, stop.airport).minutes;
  const midpoint = (arrival + Math.min(arrival + stop.durationMinutes, departure + 1440)) / 2 % 1440;
  if (midpoint >= 8 * 60 && midpoint < 18 * 60) return 100;
  if (midpoint >= 18 * 60 && midpoint < 24 * 60) return 90;
  if (midpoint >= 5 * 60 && midpoint < 8 * 60) return 50;
  if (midpoint >= 0 && midpoint < 5 * 60) return 0;
  return 20;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function crossesLocalMidnight(stop: ScheduledStop) {
  return utcToLocal(stop.arrivalUtc, stop.airport).date !== utcToLocal(stop.departureUtc, stop.airport).date;
}

export function scoreScheduledRoutes(
  routes: RouteOption[],
  weights: RouteWeights,
  selections: StopoverSelections = {},
  cityAttractiveness: Record<string, number> = DEFAULT_CITY_ATTRACTIVENESS,
): RankedRouteOption[] {
  const scheduled = routes
    .map((route) => ({ route, schedule: buildSchedule(route, selections[route.id] ?? []) }))
    .filter((item): item is { route: RouteOption; schedule: NonNullable<ReturnType<typeof buildSchedule>> } => Boolean(item.schedule?.dataValid));
  if (!scheduled.length) return [];

  const prices = scheduled.map(({ route }) => route.total);
  const durations = scheduled.map(({ schedule }) => schedule.totalDurationMinutes);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const durationMin = Math.min(...durations);
  const durationMax = Math.max(...durations);

  return scheduled.map(({ route, schedule }) => {
    const price = reversedMinMax(route.total, priceMin, priceMax);
    const stops = stopScore(schedule.scheduledStops.length);
    const duration = reversedMinMax(schedule.totalDurationMinutes, durationMin, durationMax);
    let conveniencePenalty = 0;
    if (route.ticketType === "multi-city") conveniencePenalty += 30 + 20;
    if (schedule.scheduledStops.some(crossesLocalMidnight)) conveniencePenalty += 15;
    if (schedule.scheduledStops.some((stop) => stop.durationMinutes < (stop.kind === "connection" ? 90 : 180))) conveniencePenalty += 20;
    const convenience = Math.max(0, 100 - conveniencePenalty);
    const directness = Math.max(0, Math.min(100, 0.4 * stops + 0.4 * duration + 0.2 * convenience));

    const attractiveness = average(schedule.scheduledStops.map((stop) => cityAttractiveness[stop.airport] ?? 70));
    const usableTime = average(schedule.scheduledStops.map((stop) => usableTimeScore(stop.usableMinutes)));
    const airportAccess = average(schedule.scheduledStops.map((stop) => airportAccessScore(stop.airport)));
    const timeWindow = average(schedule.scheduledStops.map(timeWindowScore));
    const interest = schedule.scheduledStops.length
      ? 0.4 * attractiveness + 0.3 * usableTime + 0.2 * airportAccess + 0.1 * timeWindow
      : 0;
    const total = (price * weights.price + interest * weights.interest + directness * weights.directness) / 100;

    return {
      ...route,
      ...schedule,
      scores: { price, interest, directness, total, stops, duration, convenience, attractiveness, usableTime, airportAccess, timeWindow },
    };
  });
}

export function durationLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const days = Math.floor(safe / 1440);
  const hours = Math.floor((safe % 1440) / 60);
  const remainingMinutes = safe % 60;
  return { days, hours, minutes: remainingMinutes };
}

export function operatingDayNumbers(days: readonly Weekday[]) {
  return [...days];
}

export const SCHEDULE_SOURCES = {
  algorithm: "https://drive.google.com/file/d/1B2ORTSMGBFq-EhzWdUKBAB_HfaXRpsCT/view",
  cathay2026: CATHAY_2026,
  delta2026: DELTA_2026,
};
