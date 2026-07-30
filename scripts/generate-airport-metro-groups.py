import json
from pathlib import Path

import airportsdata


ROOT = Path(__file__).parents[1]
OUTPUT_PATH = ROOT / "app" / "data" / "airport-metro-groups.json"

groups = {
    city_code: {
        "name": value["name"],
        "airports": sorted(value["airports"]),
    }
    for city_code, value in airportsdata.load_iata_macs().items()
}

OUTPUT_PATH.write_text(
    json.dumps(groups, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    + "\n",
    encoding="utf-8",
)
print(f"Wrote {len(groups)} IATA multi-airport city groups to {OUTPUT_PATH}")
