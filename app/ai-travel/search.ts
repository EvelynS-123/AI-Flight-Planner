import { operationalProfileForAirport } from "./airport-rules.ts";
import type {
  TravelPlanRequest,
  TravelSearchEvidence,
  TravelSearchProvider,
  TravelSearchResult,
} from "./types.ts";

const SEARCH_RESULTS_PER_QUERY = 8;
const MAX_RESULTS_PER_STOPOVER = 72;
type SearchCategory = NonNullable<TravelSearchResult["category"]>;
type SearchEvidenceOptions = {
  requiredCategoriesByStopover?: SearchCategory[][];
  minimumResultsPerCategory?: number;
  strictRecommendationSources?: boolean;
  allowCategorySources?: boolean;
};
const CITY_SEARCH_TERMS: Record<string, string[]> = {
  Tokyo: [
    "tokyo", "東京", "东京", "도쿄", "ginza", "shinjuku", "shibuya",
    "ikebukuro", "tsukiji", "roppongi", "asakusa", "ueno", "nihombashi",
    "taito", "chuo", "minato", "setagaya", "sumida",
  ],
  Taipei: [
    "taipei", "台北", "臺北", "타이베이", "台北市", "xinyi", "daan",
    "datong", "wanhua", "zhongshan", "songshan", "ximending", "shilin",
    "beitou",
  ],
  Honolulu: ["honolulu", "檀香山", "호놀룰루", "ホノルル"],
  Seoul: ["seoul", "서울", "首尔", "首爾", "ソウル"],
};
const CONFLICTING_AIRPORT_TERMS: Record<string, string[]> = {
  NRT: ["hnd", "haneda", "羽田"],
  HND: ["nrt", "narita", "成田"],
  TPE: ["tsa", "songshan", "松山"],
  ICN: ["gmp", "gimpo", "金浦", "김포"],
};
const CONFLICTING_CITY_TERMS: Record<string, string[]> = {
  Tokyo: [
    "hong kong", "香港", "macau", "macao", "澳门", "澳門",
    "shanghai", "上海", "taipei", "台北", "臺北",
    "seoul", "首尔", "首爾", "honolulu", "檀香山",
    "kyoto", "京都", "osaka", "大阪", "naha", "那霸",
    "kansas city", "chicago", "bangkok",
  ],
  Taipei: [
    "hong kong", "香港", "macau", "macao", "澳门", "澳門",
    "shanghai", "上海", "tokyo", "東京",
    "seoul", "首尔", "首爾", "honolulu", "檀香山",
  ],
  Honolulu: [
    "hong kong", "香港", "macau", "macao", "澳门", "澳門",
    "shanghai", "上海", "tokyo", "東京", "taipei", "台北", "臺北",
    "seoul", "首尔", "首爾",
  ],
  Seoul: [
    "hong kong", "香港", "macau", "macao", "澳门", "澳門",
    "shanghai", "上海", "tokyo", "東京", "taipei", "台北", "臺北",
    "honolulu", "檀香山", "guangzhou", "广州", "廣州",
    "shenzhen", "深圳", "beijing", "北京",
  ],
};

function compactText(value: string, limit = 260) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function preferenceTerms(request: TravelPlanRequest) {
  return Object.entries(request.preferences.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category)
    .join(", ");
}

export function buildTravelSearchQueries(
  request: TravelPlanRequest,
  stopoverIndex: number,
) {
  const stopover = request.route.stopovers[stopoverIndex];
  const profile = operationalProfileForAirport(stopover.airport);
  const revision = compactText(request.message || "", 180);
  const preferences = preferenceTerms(request);
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: profile.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(stopover.arrival.utc));

  const queries = [
    `transport::${profile.city} ${stopover.airport} airport to city center public transport travel time official ${localDate}`,
    `attraction::${profile.city} specific named attractions individual official pages opening hours ${localDate} ${preferences}`,
    `meal::${profile.city} specific named restaurants individual official pages opening hours local food ${localDate} ${preferences}`,
    `hotel::${profile.city} specific named hotels individual official pages near airport transport check-in ${localDate}`,
    `nightlife::${profile.city} specific named night markets bars live music venues individual official pages opening hours ${localDate} ${preferences}`,
    `shopping::${profile.city} specific named shopping streets markets malls department stores individual official pages opening hours ${localDate} ${preferences}`,
  ];
  if (revision) {
    queries.push(`revision::${profile.city} specific named travel places matching this request: ${revision} individual official pages hours transport`);
  }
  return queries.map((query) => compactText(query)).filter(Boolean);
}

function stableId(url: string) {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `web-${(hash >>> 0).toString(36)}`;
}

function normalizeResult(
  result: TravelSearchResult,
  query: string,
  category?: SearchCategory,
): TravelSearchResult | null {
  try {
    const url = new URL(result.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    const normalizedUrl = url.toString().slice(0, 1200);
    const title = compactText(result.title, 180);
    const snippet = compactText(result.snippet, 700);
    if (!title || !snippet) return null;
    return {
      id: stableId(normalizedUrl),
      query,
      category,
      title,
      url: normalizedUrl,
      snippet,
      siteName: compactText(result.siteName || "", 100) || undefined,
    };
  } catch {
    return null;
  }
}

function parseCategorizedQuery(value: string) {
  const match = value.match(
    /^(transport|attraction|meal|hotel|nightlife|shopping|revision)::(.+)$/s,
  );
  if (!match) return { query: value, category: undefined };
  return {
    category: match[1] as SearchCategory,
    query: match[2].trim(),
  };
}

function candidateTitleFromQuery(query: string, city: string, airport: string) {
  let value = query.normalize("NFKC");
  for (const term of [...(CITY_SEARCH_TERMS[city] || []), city, airport]) {
    value = value.replace(new RegExp(
      term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "giu",
    ), " ");
  }
  value = value
    .replace(
      /\b(official|website|site|page|opening|hours|address|menu|prices?|timetable|schedule)\b[\s\S]*$/iu,
      "",
    )
    .replace(/(官方网站|官网|营业时间|地址|菜单|价格|时刻表|公式サイト|営業時間|住所|メニュー|공식\s*사이트|영업시간|주소|메뉴)[\s\S]*$/iu, "")
    .replace(/\b(airport to city|city center)\b/giu, " ")
    .replace(/\bnamed\s+(attractions?|restaurants?|hotels?|nightlife|shopping)\b/giu, " ")
    .replace(/\b(attractions?|restaurants?|hotels?|nightlife|shopping|transport service)\s*$/iu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,|\-–—:]+|[\s,|\-–—:]+$/gu, "")
    .trim();
  return value.slice(0, 120) || undefined;
}

function resultMatchesStopover(
  result: TravelSearchResult,
  city: string,
  airport: string,
  requireIdentityMatch = false,
) {
  const text = `${result.title} ${result.snippet}`.normalize("NFKC").toLowerCase();
  const identityText = `${result.title} ${result.url}`
    .normalize("NFKC")
    .toLowerCase();
  if (
    (CONFLICTING_AIRPORT_TERMS[airport] || [])
      .some((term) => text.includes(term.toLowerCase()))
  ) return false;
  const terms = CITY_SEARCH_TERMS[city] || [city.toLowerCase()];
  const identityNamesConflictingCity = (CONFLICTING_CITY_TERMS[city] || [])
    .some((term) => identityText.includes(term.normalize("NFKC").toLowerCase()));
  if (identityNamesConflictingCity) return false;
  const locationText = requireIdentityMatch ? identityText : text;
  return terms.some((term) => (
    locationText.includes(term.normalize("NFKC").toLowerCase())
  )) || locationText.includes(airport.toLowerCase());
}

function resultMatchesExactQuery(
  result: TravelSearchResult,
  city: string,
  airport: string,
  allowCategorySources = false,
) {
  if (
    allowCategorySources
    && /(current best|local guide|award winners?|recommended|recommendations?|名单|名單|测评|測評|推荐|推薦)/iu
      .test(result.query.normalize("NFKC"))
  ) return true;
  const genericTerms = new Set([
    "official", "website", "site", "page", "opening", "hours", "address",
    "menu", "price", "prices", "timetable", "schedule", "restaurant",
    "restaurants", "hotel", "hotels", "attraction", "transport", "travel",
    "time", "from", "city", "airport", "named", "specific", "individual",
    "官网", "官方网站", "营业时间", "地址", "菜单", "价格", "餐厅", "饭店",
    "酒店", "景点", "交通", "时刻表", "공식", "영업시간", "주소", "식당",
    "호텔", "명소", "교통", "公式", "営業時間", "住所", "レストラン",
    "ホテル", "観光", "交通",
  ]);
  for (const term of [...(CITY_SEARCH_TERMS[city] || []), city, airport]) {
    genericTerms.add(term.normalize("NFKC").toLowerCase());
  }
  const terms = result.query
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 2 && !genericTerms.has(term));
  if (!terms.length) return true;
  const resultIdentity = `${
    allowCategorySources
      ? `${result.title} ${result.snippet} ${result.url}`
      : `${result.title} ${result.url}`
  }`
    .normalize("NFKC")
    .toLowerCase();
  return terms.some((term) => resultIdentity.includes(term));
}

function resultMatchesCategory(
  result: TravelSearchResult,
  category?: SearchCategory,
  allowCategorySources = false,
) {
  if (!category || category === "revision") return true;
  const text = `${result.title} ${result.snippet} ${result.url}`
    .normalize("NFKC")
    .toLowerCase();
  const identityText = `${result.title} ${result.url}`
    .normalize("NFKC")
    .toLowerCase();
  if (/(prioritypass|\blounge\b|doc88|docin|wenku\.baidu|toutiao|\/iata\/|\biata\b|airport[-_ ]?code|three[- ]letter code|三字代码|三字碼)/iu.test(identityText)) {
    return false;
  }
  const transport = /(airport|limousine bus|shuttle|railway|train|metro|subway|transit|transport|taxi|express|空港|机场|機場|バス|鉄道|地铁|地鐵|공항|버스|철도)/iu;
  const transportService = /(limousine bus|airport bus|airport transfer|ground transportation|public transport|shuttle|railway|train|metro|subway|transit|transport|taxi|transfer|access|airport.{0,30}(to|from).{0,30}(city|downtown|tokyo)|バス|鉄道|地下鉄|巴士|铁路|鐵路|地铁|地鐵|接驳|接駁|出租车|計程車|공항버스|철도|지하철|택시)/iu;
  const lodging = /(hotel|inn|hostel|resort|lodging|accommodation|ホテル|旅館|酒店|饭店|飯店|住宿|호텔|숙소)/iu;
  const food = /(restaurant|dining|cafe|coffee|sushi|ramen|tempura|bistro|eatery|food|cuisine|\bkitchen\b|レストラン|寿司|鮨|ラーメン|料理|餐厅|餐廳|餐馆|餐館|美食|레스토랑|식당|카페|음식)/iu;
  const nightlife = /(night\s*market|nightlife|bar|cocktail|pub|club|karaoke|izakaya|live\s*music|夜市|酒吧|夜生活|居酒屋|卡拉ok|ナイトライフ|バー|居酒屋|ライブ|야시장|바|나이트라이프|이자카야|라이브)/iu;
  const shopping = /(shopping|mall|department\s*store|market|shopping\s*street|boutique|retail|购物|購物|商场|商場|百货|百貨|市场|市場|商店街|ショッピング|百貨店|市場|쇼핑|백화점|시장)/iu;
  const photoOnly = /(locationphotodirectlink|\/photos?(\/|$)|\bpicture of\b|\btraveler photos?\b)/iu;
  if (category === "transport") {
    return transportService.test(identityText)
      && !food.test(identityText)
      && !lodging.test(identityText)
      && !/(gurunavi|tabelog|opentable|restaurant[_/-]review|prioritypass|\blounge\b|botejyu|doc88|docin|wenku\.baidu|toutiao|\/iata\/|\biata\b|airport[-_ ]?code|three[- ]letter code|三字代码|三字碼)/iu.test(identityText);
  }
  if (category === "hotel") {
    return lodging.test(identityText)
      && (
        allowCategorySources
        || !/(hotels?\s+near|hotels?\s+in\s+tokyo|hotel deals?|compare hotels?|directbooking)/iu.test(identityText)
      )
      && !food.test(identityText)
      && !nightlife.test(identityText)
      && !shopping.test(identityText)
      && !photoOnly.test(identityText);
  }
  if (category === "meal") {
    return food.test(identityText)
      && (
        allowCategorySources
        || !/(restaurants?\s+guide|find.*restaurants?|restaurant directory|delivery available|pickup or delivery)/iu.test(identityText)
      )
      && !lodging.test(identityText)
      && !photoOnly.test(identityText);
  }
  if (category === "nightlife") {
    return nightlife.test(identityText)
      && !lodging.test(identityText)
      && !photoOnly.test(identityText);
  }
  if (category === "shopping") {
    return shopping.test(identityText)
      && (
        allowCategorySources
        || !/(stores?\s+tokyo|market\s+tokyo|shopping guide)/iu.test(identityText)
      )
      && !lodging.test(identityText)
      && !food.test(identityText)
      && !photoOnly.test(identityText);
  }
  if (category === "attraction") {
    return !transport.test(identityText)
      && !lodging.test(identityText)
      && !food.test(identityText)
      && !nightlife.test(identityText)
      && !shopping.test(identityText)
      && !/(tohoku\s*x\s*tokyo)/iu.test(identityText)
      && !photoOnly.test(identityText);
  }
  return true;
}

function isSpecificRecommendationResult(
  result: TravelSearchResult,
  city: string,
  allowCategorySources = false,
) {
  if (result.category === "transport" || result.category === "revision") return true;
  const title = result.title
    .normalize("NFKC")
    .replace(/^20\d{2}\s*/u, "")
    .replace(/\s+\|\s+.*$/u, "")
    .trim();
  const compactTitle = title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  const compactCity = city
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  if (
    compactTitle.length < 4
    || compactTitle === compactCity
    || compactTitle === `${compactCity}city`
  ) return false;
  const identity = `${result.title} ${result.url}`
    .normalize("NFKC")
    .toLowerCase();
  const specificOfficialPath = (
    /\/spot\/\d+\/|\/shoplist\/|\/storedetails\/\d+|\/search\/detail\/\d+/iu
      .test(identity)
    || /gurunavi\.com\/en\/[a-z0-9]+\/(?:mp\/)?(?:print\/)?rst/iu
      .test(identity)
    || /tripadvisor\.com\/(?:attraction|restaurant)_review-[^/]*-d\d+/iu
      .test(identity)
    || /yelp\.[^/]+\/biz\//iu.test(identity)
  );
  if (
    /(^|\b)(override|ignore previous|system prompt)(\b|$)|忽略.{0,12}(指令|提示词)|覆盖.{0,12}(指令|提示词)/iu
      .test(identity)
  ) return false;
  if (
    /(攻略|游览攻略|遊覽攻略|门票_地址|旅遊攻略|旅游线路|旅遊線路|旅游注意事项|旅遊注意事項|旅游必备物品|旅遊必備物品|travel tips?|things to do|(?:the\s+)?\d+\s+best|the\s+best|food tours?|hotel guide|推荐的?\d+大|夜生活推荐|可预订|please stand by|toastmasters|all you need to know|bars,\s*cafes,\s*clubs,\s*shops)/iu
      .test(result.title)
    && !specificOfficialPath
    && !allowCategorySources
  ) return false;
  if (
    /^(hotel information|hotel-information|酒店设施|首頁|home|東京|tokyo)$/iu
      .test(title.trim())
  ) return false;
  if (
    /(hulutrip\.com|tuniu\.com|weelv\.com|iinhotel\.com|hotelscombined\.|travelko\.com|japanican\.com|tianyancha\.com|booking\.com\/airport\/)/iu
      .test(identity)
  ) return false;
  if (allowCategorySources) return true;
  return !(
    /(directory|guide to|travel guide|city guide|find your|search results?|top \d+|best \d+|things to do|directbooking|pickup or delivery|order authentic|all hotels?|all restaurants?|hotels?\s+near|hotels?\s+in\s+tokyo|hotel deals?|compare hotels?|restaurants?\s+guide|restaurant directory|shopping guide|\/reviews?\/|\/hotel_review-)/iu
      .test(identity)
    && !specificOfficialPath
  );
}

function supplementalCategoryQueries(
  city: string,
  airport: string,
  category: SearchCategory,
) {
  if (category === "transport") {
    return [
      `${city} ${airport} airport to ${city} city transfer train bus travel time official`,
      `${airport} official ground transportation railway bus ${city} travel time`,
    ];
  }
  if (category === "attraction") {
    return [
      `${city} official tourism individual attraction pages opening hours`,
      `${city} named museum official website opening hours`,
      `${city} 観光スポット 公式 営業時間 博物館 寺 展望台`,
      `${city} 景點 官方網站 開放時間 博物館 寺廟 觀景台`,
      `${city} official tourism attraction details museum temple opening hours`,
      `site:trip.com/travel-guide/attraction/${city.toLowerCase()} ${city} museum temple opening hours`,
      `${city} observation deck Trip.com opening hours`,
      `${city} art museum Trip.com opening hours`,
    ];
  }
  if (category === "meal") {
    return [
      `${city} named sushi restaurant official website opening hours`,
      `${city} named restaurant official website menu opening hours`,
      `${city} individual local restaurant menu address opening hours`,
      `${city} named restaurant Gurunavi opening hours address`,
      `${city} 餐廳 官方網站 菜單 地址 營業時間`,
      `${city} Taiwanese restaurant Tripadvisor Restaurant_Review opening hours`,
      `${city} dim sum restaurant Tripadvisor Restaurant_Review opening hours`,
      `${city} beef noodle restaurant Tripadvisor Restaurant_Review opening hours`,
    ];
  }
  if (category === "nightlife") {
    return [
      `${city} named izakaya bar Gurunavi opening hours address`,
      `${city} named cocktail bar official website hours address`,
      `${city} evening entertainment venue official website hours address`,
      `${city} 酒吧 夜市 現場音樂 具體店家 官方 營業時間`,
      `${city} night market official tourism opening hours address`,
      `${city} cocktail bar Tripadvisor opening hours address`,
      `${city} speakeasy bar Yelp opening hours address`,
      `${city} jazz bar Tripadvisor opening hours address`,
    ];
  }
  if (category === "shopping") {
    return [
      `${city} named shopping mall department store official opening hours`,
      `${city} individual market shopping street flagship store official page hours`,
      `${city} named retail complex official site address opening hours`,
      `${city} 商場 百貨 市場 購物街 官方網站 營業時間`,
      `${city} department store Yelp opening hours address`,
      `${city} shopping mall Tripadvisor opening hours address`,
      `${city} market official tourism opening hours address`,
    ];
  }
  return [
    `${city} specific hotel property official website address`,
    `${city} named hotel official site city center`,
    `${city} luxury hotel official website location check-in`,
    `${city} 飯店 酒店 官方網站 地址 入住時間`,
  ];
}

function resultPlaceKey(result: TravelSearchResult) {
  return result.title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^20\d{2}\s*/u, "")
    .replace(
      /\s+-\s+(tickets|all you need|restaurant reviews|updated|official|deals|tarifs)[\s\S]*$/iu,
      "",
    )
    .replace(/^(omega boutique [^-]+)\s+-[\s\S]*$/iu, "$1")
    .replace(/\s+(official website|official site|store list)[\s\S]*$/iu, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function categoryPlaceCount(
  results: TravelSearchResult[],
  category: SearchCategory,
) {
  return new Set(
    results
      .filter((result) => result.category === category)
      .map(resultPlaceKey)
      .filter(Boolean),
  ).size;
}

export async function gatherTravelSearchEvidence(
  request: TravelPlanRequest,
  provider: TravelSearchProvider,
  discoveredQueries?: string[][],
  options: SearchEvidenceOptions = {},
): Promise<TravelSearchEvidence> {
  const stopovers: TravelSearchEvidence["stopovers"] = [];
  for (const [index, stopover] of request.route.stopovers.entries()) {
    const profile = operationalProfileForAirport(stopover.airport);
    const discovered = (discoveredQueries?.[index] || [])
      .map((query) => compactText(query))
      .filter(Boolean)
      .slice(0, 36);
    const usesExactDiscoveredQueries = discovered.length >= 6;
    const requiredCategories = options.requiredCategoriesByStopover?.[index] || [
      "transport",
      "attraction",
      "meal",
      "hotel",
      "nightlife",
      "shopping",
    ] satisfies SearchCategory[];
    const requiredCategorySet = new Set(requiredCategories);
    const categorizedQueries = usesExactDiscoveredQueries
      ? discovered
      : buildTravelSearchQueries(request, index).filter((value) => {
        const parsed = parseCategorizedQuery(value);
        return parsed.category === "revision"
          || !parsed.category
          || requiredCategorySet.has(parsed.category);
      });
    const querySpecs = categorizedQueries.map(parseCategorizedQuery);
    const queries = querySpecs.map((spec) => spec.query);
    const batches: TravelSearchResult[][] = [];
    const searchConcurrency = 5;
    for (let offset = 0; offset < querySpecs.length; offset += searchConcurrency) {
      const concurrentBatches = await Promise.all(
        querySpecs.slice(offset, offset + searchConcurrency).map(async (spec) => {
          const results = await provider.search(spec.query, SEARCH_RESULTS_PER_QUERY);
          return results.map((result) => normalizeResult(
            result,
            spec.query,
            spec.category,
          )).map((result) => (
            result
              ? {
                ...result,
                candidateTitle: candidateTitleFromQuery(
                  spec.query,
                  profile.city,
                  stopover.airport,
                ),
              } as TravelSearchResult
              : null
          )).filter(
            (result): result is TravelSearchResult => (
              Boolean(result)
              && resultMatchesStopover(
                result!,
                profile.city,
                stopover.airport,
                Boolean(
                  options.strictRecommendationSources
                  && !options.allowCategorySources
                ),
              )
              && resultMatchesCategory(
                result!,
                spec.category,
                Boolean(options.allowCategorySources),
              )
              && (
                !options.strictRecommendationSources
                || isSpecificRecommendationResult(
                  result!,
                  profile.city,
                  Boolean(options.allowCategorySources),
                )
              )
              && (
                !usesExactDiscoveredQueries
                || resultMatchesExactQuery(
                  result!,
                  profile.city,
                  stopover.airport,
                  Boolean(options.allowCategorySources),
                )
              )
            ),
          );
        }),
      );
      batches.push(...concurrentBatches);
    }
    const unique = new Map<string, TravelSearchResult>();
    for (const result of batches.flat()) {
      if (!unique.has(result.url)) unique.set(result.url, result);
    }
    let results = [...unique.values()].slice(0, MAX_RESULTS_PER_STOPOVER);
    const minimumResults = Math.max(
      1,
      Math.min(4, options.minimumResultsPerCategory || 1),
    );
    const targetCounts: Record<SearchCategory, number> = {
      transport: 1,
      attraction: minimumResults,
      meal: minimumResults,
      hotel: minimumResults,
      nightlife: minimumResults,
      shopping: minimumResults,
      revision: 1,
    };
    const supplementalByCategory = new Map(
      requiredCategories.map((category) => [
        category,
        supplementalCategoryQueries(profile.city, stopover.airport, category),
      ]),
    );
    const maximumSupplementalRounds = Math.max(
      0,
      ...[...supplementalByCategory.values()].map((categoryQueries) => (
        categoryQueries.length
      )),
    );
    for (let round = 0; round < maximumSupplementalRounds; round += 1) {
      const currentResults = [...unique.values()];
      const roundSpecs = requiredCategories.flatMap((category) => {
        if (categoryPlaceCount(currentResults, category) >= targetCounts[category]) {
          return [];
        }
        const supplementalQuery = supplementalByCategory.get(category)?.[round];
        return supplementalQuery ? [{ category, supplementalQuery }] : [];
      });
      if (!roundSpecs.length) break;
      const roundBatches = await Promise.all(roundSpecs.map(
        async ({ category, supplementalQuery }) => ({
          category,
          supplementalQuery,
          supplemental: await provider.search(supplementalQuery, 10),
        }),
      ));
      for (const { category, supplementalQuery, supplemental } of roundBatches) {
        queries.push(supplementalQuery);
        for (const rawResult of supplemental) {
          const result = normalizeResult(rawResult, supplementalQuery, category);
          if (
            !result
            || !resultMatchesStopover(
              result,
              profile.city,
              stopover.airport,
              Boolean(
                options.strictRecommendationSources
                && !options.allowCategorySources
              ),
            )
            || !resultMatchesCategory(
              result,
              category,
              Boolean(options.allowCategorySources),
            )
            || (
              options.strictRecommendationSources
              && !isSpecificRecommendationResult(
                result,
                profile.city,
                Boolean(options.allowCategorySources),
              )
            )
            || unique.has(result.url)
          ) continue;
          unique.set(result.url, result);
        }
      }
    }
    results = [...unique.values()].slice(0, MAX_RESULTS_PER_STOPOVER);
    if (!results.length) {
      throw new Error(`Live search returned no usable results for ${profile.city}.`);
    }
    const missing = requiredCategories.filter((category) => (
      categoryPlaceCount(results, category) < targetCounts[category]
    ));
    if (missing.length) {
      throw new Error(
        `Live search returned fewer than ${minimumResults} specific ${missing.join(", ")} choices for ${profile.city}.`,
      );
    }
    stopovers.push({
      airport: stopover.airport,
      city: profile.city,
      queries,
      results,
    });
  }

  return {
    provider: provider.id,
    searchedAt: new Date().toISOString(),
    stopovers,
  };
}

export function evidenceById(
  evidence: TravelSearchEvidence,
  stopoverIndex: number,
  previousPlan?: TravelPlanRequest["previousPlan"],
) {
  const results = new Map(
    (evidence.stopovers[stopoverIndex]?.results || []).map((result) => [result.id, result]),
  );
  const previousStopover = previousPlan?.stopovers[stopoverIndex];
  for (const item of previousStopover?.days.flatMap((day) => day.items) || []) {
    if (!item.sourceId || !item.sourceUrl || results.has(item.sourceId)) continue;
    results.set(item.sourceId, {
      id: item.sourceId,
      query: "previous live-search evidence",
      category: item.type === "transport"
        ? "transport"
        : item.type === "hotel"
          ? "hotel"
          : item.type === "meal"
            ? "meal"
            : "attraction",
      title: item.sourceTitle || item.title,
      url: item.sourceUrl,
      snippet: item.details,
    });
  }
  if (
    previousStopover?.hotelSourceId
    && previousStopover.hotelSourceUrl
    && !results.has(previousStopover.hotelSourceId)
  ) {
    results.set(previousStopover.hotelSourceId, {
      id: previousStopover.hotelSourceId,
      query: "previous live-search evidence",
      category: "hotel",
      title: previousStopover.hotelName || previousStopover.hotelArea || "Hotel",
      url: previousStopover.hotelSourceUrl,
      snippet: previousStopover.hotelArea || "",
    });
  }
  for (const [id, url, title] of [
    [
      previousStopover?.outboundTransitSourceId,
      previousStopover?.outboundTransitSourceUrl,
      previousStopover?.outboundTransitMode,
    ],
    [
      previousStopover?.returnTransitSourceId,
      previousStopover?.returnTransitSourceUrl,
      previousStopover?.returnTransitMode,
    ],
  ]) {
    if (!id || !url || results.has(id)) continue;
    results.set(id, {
      id,
      query: "previous live-search evidence",
      category: "transport",
      title: title || "Airport transport",
      url,
      snippet: title || "Airport transport",
    });
  }
  return results;
}
