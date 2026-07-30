import { createTravelAIProvider } from "../../../ai-travel/providers.ts";
import airportCities from "../../../data/airport-cities.json" with { type: "json" };

export const runtime = "nodejs";

type HubInput = {
  code: string;
  city: string;
};

const AIRPORT_CITY_BY_IATA = airportCities as Record<string, string>;

function normalizeHubs(value: unknown): HubInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const code = typeof item.code === "string"
      ? item.code.trim().toUpperCase()
      : "";
    const city = typeof item.city === "string" ? item.city.trim() : "";
    if (!/^[A-Z]{3}$/.test(code) || !city || seen.has(code)) return [];
    seen.add(code);
    return [{ code, city }];
  });
}

export async function POST(request: Request) {
  const { hubs: rawHubs, locale, preferenceContext } = await request.json();
  const hubs = normalizeHubs(rawHubs).map((hub) => ({
    ...hub,
    city: AIRPORT_CITY_BY_IATA[hub.code] || hub.city,
  }));
  if (hubs.length === 0) return Response.json({ hubs: {} });

  const provider = createTravelAIProvider();
  const fallbackDetails = Object.fromEntries(
    hubs.map((hub) => [hub.code, { city: hub.city, reason: "" }]),
  );
  if (!provider) return Response.json({ hubs: fallbackDetails });

  const language = locale === "zh"
    ? "Simplified Chinese"
    : locale === "ja"
      ? "Japanese"
      : locale === "ko"
        ? "Korean"
        : "English";
  const preference = preferenceContext
    ? JSON.stringify(preferenceContext).slice(0, 2000)
    : "none";

  try {
    const result = await provider.generateJson({
      purpose: "query-discovery",
      systemPrompt: `Describe the real travel character of a supplied list of verified flight-connection cities.
Return only a JSON object shaped as {"hubs":[{"code":"IATA","city":"localized city name","reason":"concise description"}]}.
Keep every supplied IATA code exactly once and do not add or remove cities.
The city field must contain only the city or metropolitan-area name in ${language}, never an airport name.
Write each description in ${language}, using roughly 8–18 words.
Mention distinctive food, culture, urban life, nature, history, or scenery. Do not mention route verification, flights, airports, or generic praise.
When preferences are supplied, emphasize genuinely matching city characteristics without inventing facts.`,
      userPrompt: JSON.stringify({ hubs, preferenceContext: preference }),
    }) as { hubs?: unknown };

    const allowedCodes = new Set(hubs.map((hub) => hub.code));
    const details = { ...fallbackDetails };
    for (const entry of Array.isArray(result?.hubs) ? result.hubs : []) {
      if (!entry || typeof entry !== "object") continue;
      const value = entry as Record<string, unknown>;
      const code = typeof value.code === "string"
        ? value.code.trim().toUpperCase()
        : "";
      const city = typeof value.city === "string" ? value.city.trim() : "";
      const reason = typeof value.reason === "string" ? value.reason.trim() : "";
      if (!allowedCodes.has(code) || !city || !reason) continue;
      details[code] = {
        city: city.slice(0, 80),
        reason: reason.slice(0, 120),
      };
    }
    return Response.json({ hubs: details });
  } catch (error) {
    console.error("Hub characteristic API error:", error);
    return Response.json({ hubs: fallbackDetails });
  }
}
