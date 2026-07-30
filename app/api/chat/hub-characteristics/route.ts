import { createTravelAIProvider } from "../../../ai-travel/providers.ts";
import localizedAirportNames from "../../../data/airport-localized-names.json" with { type: "json" };
import { airportCity } from "../../../i18n.ts";

export const runtime = "nodejs";

type HubInput = {
  code: string;
  city: string;
};

type SupportedLocale = "en" | "zh" | "ko" | "ja";

const LOCALIZED_AIRPORT_NAMES = localizedAirportNames as Record<
  string,
  Record<SupportedLocale, string>
>;

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
  const supportedLocale: SupportedLocale = locale === "zh" || locale === "ko" || locale === "ja"
    ? locale
    : "en";
  const hubs = normalizeHubs(rawHubs).map((hub) => ({
    ...hub,
    city: airportCity(
      hub.code,
      "en",
      LOCALIZED_AIRPORT_NAMES[hub.code]?.en || hub.city,
    ),
  }));
  if (hubs.length === 0) return Response.json({ hubs: {} });

  const provider = createTravelAIProvider();
  const fallbackDetails = Object.fromEntries(
    hubs.map((hub) => [hub.code, {
      city: airportCity(
        hub.code,
        supportedLocale,
        LOCALIZED_AIRPORT_NAMES[hub.code]?.[supportedLocale]
          || LOCALIZED_AIRPORT_NAMES[hub.code]?.en
          || hub.city,
      ),
      reason: "",
    }]),
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
    ? JSON.stringify(preferenceContext).slice(0, 6000)
    : "none";

  try {
    const result = await provider.generateJson({
      purpose: "query-discovery",
      systemPrompt: `Describe the real travel character of a supplied list of verified flight-connection cities.
Return only a JSON object shaped as {"hubs":[{"code":"IATA","reason":"concise description"}]}.
Keep every supplied IATA code exactly once and do not add or remove cities.
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
      const reason = typeof value.reason === "string" ? value.reason.trim() : "";
      if (!allowedCodes.has(code) || !reason) continue;
      details[code] = {
        city: fallbackDetails[code].city.slice(0, 80),
        reason: reason.slice(0, 120),
      };
    }
    return Response.json({ hubs: details });
  } catch (error) {
    console.error("Hub characteristic API error:", error);
    return Response.json({ hubs: fallbackDetails });
  }
}
