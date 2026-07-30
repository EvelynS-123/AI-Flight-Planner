import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).parents[1]
AIRPORT_CITIES_PATH = ROOT / "app" / "data" / "airport-cities.json"
DEFAULT_OUTPUT_PATH = ROOT / "app" / "data" / "airport-localized-names.wikidata.json"
WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
LANGUAGES = ("zh", "ko", "ja")


def wikidata_query(codes):
    values = " ".join(json.dumps(code) for code in codes)
    return f"""
SELECT ?iata ?rank ?placeZh ?placeKo ?placeJa ?airportZh ?airportKo ?airportJa WHERE {{
  VALUES ?iata {{ {values} }}
  ?airport wdt:P238 ?iata.
  {{
    ?airport wdt:P931 ?place.
    BIND(2 AS ?rank)
  }}
  UNION
  {{
    ?airport wdt:P131 ?place.
    FILTER NOT EXISTS {{ ?airport wdt:P931 [] }}
    BIND(1 AS ?rank)
  }}
  OPTIONAL {{ ?place rdfs:label ?placeZh. FILTER(LANG(?placeZh) = "zh") }}
  OPTIONAL {{ ?place rdfs:label ?placeKo. FILTER(LANG(?placeKo) = "ko") }}
  OPTIONAL {{ ?place rdfs:label ?placeJa. FILTER(LANG(?placeJa) = "ja") }}
  OPTIONAL {{ ?airport rdfs:label ?airportZh. FILTER(LANG(?airportZh) = "zh") }}
  OPTIONAL {{ ?airport rdfs:label ?airportKo. FILTER(LANG(?airportKo) = "ko") }}
  OPTIONAL {{ ?airport rdfs:label ?airportJa. FILTER(LANG(?airportJa) = "ja") }}
}}
"""


def city_name_query(names):
    values = " ".join(f"{json.dumps(name)}@en" for name in names)
    return f"""
SELECT ?cityEn ?cityZh ?cityKo ?cityJa WHERE {{
  VALUES ?cityEn {{ {values} }}
  ?place rdfs:label ?cityEn.
  ?place wdt:P625 [].
  OPTIONAL {{ ?place rdfs:label ?cityZh. FILTER(LANG(?cityZh) = "zh") }}
  OPTIONAL {{ ?place rdfs:label ?cityKo. FILTER(LANG(?cityKo) = "ko") }}
  OPTIONAL {{ ?place rdfs:label ?cityJa. FILTER(LANG(?cityJa) = "ja") }}
}}
"""


def fetch_rows(query):
    url = f"{WIKIDATA_ENDPOINT}?format=json&query={urllib.parse.quote(query)}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/sparql-results+json",
            "User-Agent": "ViaFlightPlanner/1.0 (airport localization generator)",
        },
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.load(response)
            return payload["results"]["bindings"]
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


def strip_airport_suffix(value, language):
    suffixes = {
        "zh": ("国际机场", "國際機場", "机场", "機場", "空港"),
        "ko": ("국제공항", "공항"),
        "ja": ("国際空港", "空港", "飛行場"),
    }
    result = value.strip()
    for suffix in suffixes[language]:
        if result.endswith(suffix):
            result = result[: -len(suffix)].strip()
            break
    return result


def strip_city_suffix(value, language):
    suffix = {"zh": "市", "ko": "시", "ja": "市"}[language]
    result = value.strip()
    if result.endswith(suffix) and len(result) > len(suffix) + 1:
        return result[: -len(suffix)].strip()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--codes", help="Comma-separated IATA codes for a sample run")
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()

    airport_cities = json.loads(AIRPORT_CITIES_PATH.read_text(encoding="utf-8"))
    if args.codes:
        requested = [code.strip().upper() for code in args.codes.split(",")]
        codes = [code for code in requested if code in airport_cities]
    else:
        codes = sorted(airport_cities)

    output = {code: {"en": airport_cities[code]} for code in codes}
    for offset in range(0, len(codes), args.batch_size):
        batch = codes[offset : offset + args.batch_size]
        rows = fetch_rows(wikidata_query(batch))
        for row in rows:
            code = row["iata"]["value"].upper()
            if code not in output:
                continue
            for language in LANGUAGES:
                place_key = f"place{language.capitalize()}"
                airport_key = f"airport{language.capitalize()}"
                if place_key in row:
                    output[code][language] = strip_city_suffix(
                        row[place_key]["value"],
                        language,
                    )
                elif airport_key in row:
                    output[code][language] = strip_airport_suffix(
                        row[airport_key]["value"],
                        language,
                    )
        completed = min(offset + len(batch), len(codes))
        print(f"Fetched {completed}/{len(codes)} airport localizations", flush=True)

    codes_by_city = {}
    for code, names in output.items():
        if any(not names.get(language) for language in LANGUAGES):
            codes_by_city.setdefault(names["en"], []).append(code)
    city_names = sorted(codes_by_city)
    for offset in range(0, len(city_names), args.batch_size):
        batch = city_names[offset : offset + args.batch_size]
        rows = fetch_rows(city_name_query(batch))
        for row in rows:
            english = row["cityEn"]["value"]
            for code in codes_by_city.get(english, []):
                for language in LANGUAGES:
                    key = f"city{language.capitalize()}"
                    if key in row and not output[code].get(language):
                        output[code][language] = strip_city_suffix(
                            row[key]["value"],
                            language,
                        )
        completed = min(offset + len(batch), len(city_names))
        print(
            f"Matched {completed}/{len(city_names)} served-city labels",
            flush=True,
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    coverage = {
        language: sum(language in names for names in output.values())
        for language in LANGUAGES
    }
    print(json.dumps({"airports": len(output), "coverage": coverage}, ensure_ascii=False))


if __name__ == "__main__":
    main()
