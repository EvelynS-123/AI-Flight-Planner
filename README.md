# Via · AI Flight Planner Demo

Via is a focused MVP for discovering and ranking flight routes from East Asia to North America. It compares nonstop flights, single-ticket connecting itineraries, and separately ticketed multi-city combinations using public fare snapshots for August and September 2026.

## Demo

https://via-planner.xachaix.chatgpt.site

## Current scope

- 133 sample routes
- 16 nonstop itineraries
- 17 single-ticket connecting itineraries
- 100 separately ticketed multi-city itineraries
- 6 departure airports in East Asia
- 4 arrival airports on the west coast of North America
- One shared weighting bar for cheapest, most interesting, and most direct
- Live score updates, animated number changes, and animated reordering
- Simplified Chinese, English, Korean, and Japanese interfaces
- Source links and sample dates retained for fare references

## Run locally

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```

Fare data is provided only as a demonstration snapshot. It does not represent live availability, and separately ticketed segments may require independent booking and schedule verification.
