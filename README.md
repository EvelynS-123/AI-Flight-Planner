# Via · AI Flight Planner Demo

Via is a focused MVP for discovering and ranking flight routes from East Asia to North America. It compares nonstop flights, single-ticket connecting itineraries, and separately ticketed multi-city combinations using public fare snapshots for August and September 2026.

When `SERPAPI_API_KEY` is configured, a search checks current one-way Google
Flights results through SerpApi. Live nonstop and connecting offers are ranked
alongside the existing multi-city snapshots. If the provider is unavailable,
the interface explicitly falls back to the local snapshot data.

## Demo

https://via-flight-planner-demo.xachaix.chatgpt.site

## Current scope

- 133 sample routes
- 16 nonstop itineraries
- 17 single-ticket connecting itineraries
- 100 separately ticketed multi-city itineraries
- 6 departure airports in East Asia
- 4 arrival airports on the west coast of North America
- Exact departure-date search for August and September 2026
- Optional live one-way flight offers from Google Flights via SerpApi
- 15-minute server-side flight-search cache
- One shared weighting bar for cheapest, most interesting, and most direct
- Live score updates, animated number changes, and animated reordering
- First-visit AI preference chat that naturally learns hobbies and travel tastes
- Device-local semantic memory with AI-organized preference facts instead of a fixed interest taxonomy
- Offline AI evaluates every candidate route as one batch, including unusual soft preferences and hard constraints
- Time, transfer, and comfort facts refine directness, while destination and airline facts refine interest
- Simplified Chinese, English, Korean, and Japanese interfaces
- Source links and sample dates retained for fare references
- Full-screen AI stopover plans for multi-city routes
- Relaxed, balanced, and tight planning modes
- Follow-up chat for itinerary revisions
- Server-side provider switching for DeepSeek, GLM, and Kimi
- Server-side prompt-injection and off-topic request filtering

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, add one provider key, and keep that file
local. The browser never receives the API key.

For live flight search:

```env
SERPAPI_API_KEY=your_serpapi_key
FLIGHT_SEARCH_CACHE_TTL_MS=900000
```

Stopover recommendations use the separately configured travel-search provider.
Live flight offers use the SerpApi adapter under `app/flights`; the two provider
paths intentionally remain independent.

## Test

```bash
npm run typecheck
npm test
```

Run the complete local and CI verification before opening a pull request:

```bash
npm run check
```

## Project structure

- `app/` contains the product UI, route ranking, flight search, and AI stopover planning.
- `app/api/` contains server-only API routes.
- `db/` and `drizzle/` contain the flight-search cache schema and migration.
- `worker/` contains the Cloudflare Worker entry point.
- `tests/` contains the build-backed Node.js test suite.
- `scripts/` contains airport localization maintenance tools.

## Team development

Keep each pull request focused on one behavior or maintenance goal. Do not mix
new features with refactoring, and never commit local API keys. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the shared workflow and verification
requirements.

Fare data is provided only as a demonstration snapshot. It does not represent live availability, and separately ticketed segments may require independent booking and schedule verification.
