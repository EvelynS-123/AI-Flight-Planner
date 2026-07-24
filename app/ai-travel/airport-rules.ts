import type { AirportOperationalProfile } from "./types.ts";

const profiles: AirportOperationalProfile[] = [
  {
    airport: "NRT",
    city: "Tokyo",
    timeZone: "Asia/Tokyo",
    busyness: "very-busy",
    arrivalProcessingMinutes: [55, 105],
    airportBufferMinutes: [150, 210],
  },
  {
    airport: "ICN",
    city: "Seoul",
    timeZone: "Asia/Seoul",
    busyness: "very-busy",
    arrivalProcessingMinutes: [50, 100],
    airportBufferMinutes: [150, 210],
  },
  {
    airport: "TPE",
    city: "Taipei",
    timeZone: "Asia/Taipei",
    busyness: "busy",
    arrivalProcessingMinutes: [45, 90],
    airportBufferMinutes: [135, 195],
  },
  {
    airport: "HKG",
    city: "Hong Kong",
    timeZone: "Asia/Hong_Kong",
    busyness: "very-busy",
    arrivalProcessingMinutes: [50, 100],
    airportBufferMinutes: [150, 210],
  },
  {
    airport: "HNL",
    city: "Honolulu",
    timeZone: "Pacific/Honolulu",
    busyness: "busy",
    arrivalProcessingMinutes: [45, 90],
    airportBufferMinutes: [135, 195],
  },
  {
    airport: "KIX",
    city: "Osaka",
    timeZone: "Asia/Tokyo",
    busyness: "busy",
    arrivalProcessingMinutes: [50, 95],
    airportBufferMinutes: [140, 200],
  },
  {
    airport: "PEK",
    city: "Beijing",
    timeZone: "Asia/Shanghai",
    busyness: "very-busy",
    arrivalProcessingMinutes: [55, 110],
    airportBufferMinutes: [160, 220],
  },
  {
    airport: "MNL",
    city: "Manila",
    timeZone: "Asia/Manila",
    busyness: "very-busy",
    arrivalProcessingMinutes: [60, 120],
    airportBufferMinutes: [170, 230],
  },
  {
    airport: "CAN",
    city: "Guangzhou",
    timeZone: "Asia/Shanghai",
    busyness: "very-busy",
    arrivalProcessingMinutes: [50, 100],
    airportBufferMinutes: [150, 210],
  },
  {
    airport: "WUH",
    city: "Wuhan",
    timeZone: "Asia/Shanghai",
    busyness: "busy",
    arrivalProcessingMinutes: [45, 90],
    airportBufferMinutes: [145, 205],
  },
  {
    airport: "YVR",
    city: "Vancouver",
    timeZone: "America/Vancouver",
    busyness: "busy",
    arrivalProcessingMinutes: [45, 95],
    airportBufferMinutes: [140, 200],
  },
];

export const AIRPORT_OPERATIONAL_PROFILES = Object.fromEntries(
  profiles.map((profile) => [profile.airport, profile]),
) as Record<string, AirportOperationalProfile>;

const GENERIC_AIRPORT_PROFILE: AirportOperationalProfile = {
  airport: "GENERIC",
  city: "Stopover city",
  timeZone: "UTC",
  busyness: "busy",
  arrivalProcessingMinutes: [60, 110],
  airportBufferMinutes: [150, 210],
};

export function operationalProfileForAirport(airport: string) {
  return AIRPORT_OPERATIONAL_PROFILES[airport] ?? {
    ...GENERIC_AIRPORT_PROFILE,
    airport,
    city: airport,
  };
}
