import csv
import io
import json
import re
import urllib.request
from pathlib import Path


SOURCE_COMMIT = "4fce4daecf8df6be13a0c6f1568399cc617034a3"
SOURCE_URL = (
    "https://raw.githubusercontent.com/mborsetti/airportsdata/"
    f"{SOURCE_COMMIT}/airportsdata/airports.csv"
)
OUTPUT_PATH = Path(__file__).parents[1] / "app" / "data" / "airport-cities.json"


with urllib.request.urlopen(SOURCE_URL) as response:
    source = response.read().decode("utf-8")

airport_cities = {}
for row in csv.DictReader(io.StringIO(source)):
    code = row["iata"].strip().upper()
    city = row["city"].strip()
    if re.fullmatch(r"[A-Z]{3}", code) and city:
        airport_cities.setdefault(code, city)

OUTPUT_PATH.write_text(
    json.dumps(airport_cities, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    + "\n",
    encoding="utf-8",
)

print(f"Wrote {len(airport_cities)} IATA city mappings to {OUTPUT_PATH}")
