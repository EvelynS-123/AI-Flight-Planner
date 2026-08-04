import csv
import io
import json
import re
import urllib.request
from pathlib import Path


AIRPORTS_SOURCE_COMMIT = "4fce4daecf8df6be13a0c6f1568399cc617034a3"
AIRPORTS_SOURCE_URL = (
    "https://raw.githubusercontent.com/mborsetti/airportsdata/"
    f"{AIRPORTS_SOURCE_COMMIT}/airportsdata/airports.csv"
)
COUNTRIES_SOURCE_COMMIT = "ca96624a56bd078437bca8184e78163e5039ad19"
COUNTRIES_SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    f"{COUNTRIES_SOURCE_COMMIT}/geojson/ne_110m_admin_0_countries.geojson"
)
PUBLIC_MAP_PATH = Path(__file__).parents[1] / "public" / "map"
AIRPORTS_OUTPUT_PATH = PUBLIC_MAP_PATH / "airport-map-data.json"
COUNTRIES_OUTPUT_PATH = PUBLIC_MAP_PATH / "route-countries.geojson"


def read_url(url: str) -> str:
    with urllib.request.urlopen(url) as response:
        return response.read().decode("utf-8")


def valid_iso2(value: object) -> str | None:
    code = str(value or "").strip().upper()
    return code if re.fullmatch(r"[A-Z]{2}", code) else None


PUBLIC_MAP_PATH.mkdir(parents=True, exist_ok=True)

airport_map_data = {}
for row in csv.DictReader(io.StringIO(read_url(AIRPORTS_SOURCE_URL))):
    code = row["iata"].strip().upper()
    country = valid_iso2(row.get("country"))
    if not re.fullmatch(r"[A-Z]{3}", code) or country is None:
        continue
    try:
        latitude = round(float(row["lat"]), 6)
        longitude = round(float(row["lon"]), 6)
    except (TypeError, ValueError):
        continue
    airport_map_data.setdefault(code, [latitude, longitude, country])

countries_source = json.loads(read_url(COUNTRIES_SOURCE_URL))
country_features = []
for feature in countries_source.get("features", []):
    properties = feature.get("properties", {})
    country = next(
        (
            code
            for key in ("ISO_A2", "WB_A2", "POSTAL")
            if (code := valid_iso2(properties.get(key))) is not None
        ),
        None,
    )
    geometry = feature.get("geometry")
    if country is None or not isinstance(geometry, dict):
        continue
    country_features.append(
        {
            "type": "Feature",
            "properties": {
                "country": country,
                "name": properties.get("NAME_EN") or properties.get("ADMIN") or country,
            },
            "geometry": geometry,
        }
    )

AIRPORTS_OUTPUT_PATH.write_text(
    json.dumps(
        airport_map_data,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    + "\n",
    encoding="utf-8",
)
COUNTRIES_OUTPUT_PATH.write_text(
    json.dumps(
        {"type": "FeatureCollection", "features": country_features},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    + "\n",
    encoding="utf-8",
)

print(
    f"Wrote {len(airport_map_data)} airports and {len(country_features)} countries "
    f"to {PUBLIC_MAP_PATH}"
)
