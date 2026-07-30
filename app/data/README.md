# Airport city data

`airport-cities.json` is generated from the OurAirports `airports.csv` dataset:

- Source: https://ourairports.com/data/
- Snapshot: 2026-07-28
- License: Public Domain
- Included rows: airports with `scheduled_service = yes`, a three-letter `iata_code`, and a non-empty `municipality`
- Stored shape: `{ "IATA": "municipality" }`

The table supplies a stable city name before the existing batched AI call localizes it and writes the city-character description. It is not used to invent or verify flight availability.
