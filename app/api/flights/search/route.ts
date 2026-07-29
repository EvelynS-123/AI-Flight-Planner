import { createSerpApiFlightProvider, FlightSearchProviderError } from "../../../flights/serpapi";
import type { FlightSearchRequest } from "../../../flights/types";

export const runtime = "nodejs";

function requestBody(value: unknown): FlightSearchRequest | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FlightSearchRequest>;
  if (
    typeof candidate.origin !== "string"
    || typeof candidate.destination !== "string"
    || typeof candidate.departureDate !== "string"
  ) return null;
  return {
    origin: candidate.origin,
    destination: candidate.destination,
    departureDate: candidate.departureDate,
    adults: typeof candidate.adults === "number" ? candidate.adults : 1,
    currency: typeof candidate.currency === "string" ? candidate.currency : "USD",
    forceRefresh: candidate.forceRefresh === true,
  };
}
export async function POST(request: Request) {
  try {
    const body = requestBody(await request.json());
    if (!body) {
      return Response.json({
        error: "Invalid flight-search request.",
        code: "invalid_request",
      }, { status: 400 });
    }
    const provider = createSerpApiFlightProvider();
    if (!provider) {
      return Response.json({
        error: "SerpApi is not configured.",
        code: "serpapi_not_configured",
      }, { status: 503 });
    }
    const result = await provider.search(body);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof FlightSearchProviderError) {
      return Response.json({
        error: error.message,
        code: error.code,
      }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Flight search failed.";
    console.error(`[flight-search] ${message}`);
    return Response.json({
      error: "Flight search failed.",
      code: "flight_search_failed",
    }, { status: 502 });
  }
}
