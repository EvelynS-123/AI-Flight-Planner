import { createTravelAIProvider } from "../../../ai-travel/providers";

export const runtime = "nodejs";

type HubInput = {
  code: string;
  city: string;
};

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
  const hubs = normalizeHubs(rawHubs);
  if (hubs.length === 0) return Response.json({ reasons: {} });

  const provider = createTravelAIProvider();
  if (!provider) return Response.json({ reasons: {} });

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
Return only a JSON object shaped as {"reasons":{"IATA":"concise description"}}.
Keep every supplied IATA code exactly once and do not add or remove cities.
Write each description in ${language}, using roughly 8–18 words.
Mention distinctive food, culture, urban life, nature, history, or scenery. Do not mention route verification, flights, airports, or generic praise.
When preferences are supplied, emphasize genuinely matching city characteristics without inventing facts.`,
      userPrompt: JSON.stringify({ hubs, preferenceContext: preference }),
    }) as { reasons?: unknown };

    const allowedCodes = new Set(hubs.map((hub) => hub.code));
    const reasons = Object.fromEntries(
      Object.entries(
        result?.reasons && typeof result.reasons === "object"
          ? result.reasons as Record<string, unknown>
          : {},
      ).flatMap(([code, reason]) => (
        allowedCodes.has(code)
        && typeof reason === "string"
        && reason.trim()
          ? [[code, reason.trim().slice(0, 120)]]
          : []
      )),
    );
    return Response.json({ reasons });
  } catch (error) {
    console.error("Hub characteristic API error:", error);
    return Response.json({ reasons: {} });
  }
}
