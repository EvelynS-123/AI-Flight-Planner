type SearchLeg = {
  origins?: unknown;
  destinations?: unknown;
};

function airportCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(
    value
      .filter((code): code is string => typeof code === "string")
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{3}$/.test(code)),
  ));
}

export function journeyAirportGroups(
  searchContext: Record<string, unknown> | null,
  fallbackOrigin: string,
  fallbackDestination: string,
) {
  const legs = Array.isArray(searchContext?.legs)
    ? searchContext.legs.filter(
      (leg): leg is SearchLeg => Boolean(leg) && typeof leg === "object",
    )
    : [];

  const origins = airportCodes(legs[0]?.origins ?? searchContext?.origins);
  const destinations = airportCodes(
    legs[legs.length - 1]?.destinations ?? searchContext?.destinations,
  );

  return {
    origins: origins.length ? origins : [fallbackOrigin],
    destinations: destinations.length ? destinations : [fallbackDestination],
  };
}
