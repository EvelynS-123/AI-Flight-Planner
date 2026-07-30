import json
from pathlib import Path

from argostranslate import translate


ROOT = Path(__file__).parents[1]
INPUT_PATH = ROOT / "app" / "data" / "airport-localized-names.wikidata.json"
OUTPUT_PATH = ROOT / "app" / "data" / "airport-localized-names.json"
LANGUAGES = ("zh", "ko", "ja")
MANUAL_OVERRIDES = {
    "BAH": {
        "en": "Bahrain",
        "zh": "巴林",
        "ko": "바레인",
        "ja": "バーレーン",
    },
    "CPH": {
        "en": "Copenhagen",
        "zh": "哥本哈根",
        "ko": "코펜하겐",
        "ja": "コペンハーゲン",
    },
    "CKG": {
        "en": "Chongqing",
        "zh": "重庆",
        "ko": "충칭",
        "ja": "重慶",
    },
    "SHJ": {
        "en": "Sharjah",
        "zh": "沙迦",
        "ko": "샤르자",
        "ja": "シャールジャ",
    },
    "HAK": {
        "en": "Haikou",
        "zh": "海口",
        "ko": "하이커우",
        "ja": "海口",
    },
}


class SingleNameSentencizer:
    def split_sentences(self, text):
        return [text]


localizations = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
translators = {
    language: translate.get_translation_from_codes("en", language)
    for language in LANGUAGES
}
if any(translator is None for translator in translators.values()):
    raise RuntimeError("Install the Argos en_zh, en_ko, and en_ja models first.")
for translator in translators.values():
    translator.underlying.sentencizer = SingleNameSentencizer()

caches = {language: {} for language in LANGUAGES}
missing_total = sum(
    language not in names
    for names in localizations.values()
    for language in LANGUAGES
)
completed = 0

for code, names in localizations.items():
    english = names["en"]
    for language in LANGUAGES:
        if names.get(language):
            continue
        cache = caches[language]
        if english not in cache:
            cache[english] = translators[language].translate(english).strip()
        names[language] = cache[english] or english
        completed += 1
        if completed % 100 == 0 or completed == missing_total:
            print(f"Filled {completed}/{missing_total} missing names", flush=True)

for names in localizations.values():
    for language, suffix in {"zh": "市", "ko": "시", "ja": "市"}.items():
        value = names[language]
        if value.endswith(suffix) and len(value) > len(suffix) + 1:
            names[language] = value[: -len(suffix)].strip()

for code, names in MANUAL_OVERRIDES.items():
    if code in localizations:
        localizations[code].update(names)

for code, names in localizations.items():
    for language in ("en", *LANGUAGES):
        if not names.get(language):
            raise RuntimeError(f"Missing {language} airport name for {code}")

OUTPUT_PATH.write_text(
    json.dumps(localizations, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    + "\n",
    encoding="utf-8",
)
print(f"Wrote {len(localizations)} complete airport localizations to {OUTPUT_PATH}")
