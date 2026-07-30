import json
from pathlib import Path

from opencc import OpenCC


ROOT = Path(__file__).parents[1]
DATA_PATH = ROOT / "app" / "data" / "airport-localized-names.json"
DISPLAY_OVERRIDES = {
    "DPS": "登巴萨",
    "HND": "东京",
    "NRT": "东京",
    "TPE": "台北",
}

localizations = json.loads(DATA_PATH.read_text(encoding="utf-8"))
converter = OpenCC("t2s")

for code, names in localizations.items():
    names["zh"] = DISPLAY_OVERRIDES.get(code, converter.convert(names["zh"]))

DATA_PATH.write_text(
    json.dumps(localizations, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    + "\n",
    encoding="utf-8",
)
print(f"Converted {len(localizations)} airport names to Simplified Chinese")
