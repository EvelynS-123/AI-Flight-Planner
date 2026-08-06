import { createTravelAIProvider } from "../../ai-travel/providers.ts";

export const runtime = "nodejs";

export function normalizeCompactDatePrompt(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[，。,.、]*$/);
  if (!match) return value;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(2026, month - 1, day));
  if (
    date.getUTCFullYear() !== 2026
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return value;
  }

  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const { messages, locale, preferenceContext } = await request.json();
  const serializedPreferenceContext = preferenceContext
    ? JSON.stringify(preferenceContext).slice(0, 6000)
    : "none";

  const provider = createTravelAIProvider();
  if (!provider) {
    let mockOrigins = ["NRT"];
    let mockDestinations = ["LAX"];
    let mockVia: string[] | null = null;
    let mockPreferLCC = false;
    let mockAlliance = "none";
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1].content.toLowerCase();

      // Check for via
      if ((lastMsg.includes("ハワイ") && lastMsg.includes("経由")) || (lastMsg.includes("via") && lastMsg.includes("hawaii"))) mockVia = ["HNL"];
      else if (lastMsg.includes("経由")) mockVia = ["TPE"]; // generic via

      // Origins
      if (lastMsg.includes("上海") || lastMsg.includes("pvg")) mockOrigins = ["PVG"];
      else if (lastMsg.includes("北京") || lastMsg.includes("pek")) mockOrigins = ["PEK"];
      else if (lastMsg.includes("香港") || lastMsg.includes("hkg")) mockOrigins = ["HKG"];
      else if (lastMsg.includes("台北") || lastMsg.includes("台湾") || lastMsg.includes("tpe")) mockOrigins = ["TPE"];
      else if (lastMsg.includes("ソウル") || lastMsg.includes("seoul") || lastMsg.includes("icn")) mockOrigins = ["ICN"];
      else if (lastMsg.includes("大阪") || lastMsg.includes("関西") || lastMsg.includes("kix")) mockOrigins = ["KIX"];
      else if (lastMsg.includes("東京") || lastMsg.includes("成田") || lastMsg.includes("nrt")) mockOrigins = ["NRT"];
      else if (lastMsg.includes("lhr")) mockOrigins = ["LHR"];
      else if (lastMsg.includes("london")) mockOrigins = ["LHR", "LGW", "STN", "LTN", "LCY"];
      else if (lastMsg.includes("jfk")) mockOrigins = ["JFK"];
      else if (lastMsg.includes("new york")) mockOrigins = ["JFK", "EWR", "LGA"];

      // Destinations — specific cities
      if (lastMsg.includes("サンフランシスコ") || lastMsg.includes("sfo")) mockDestinations = ["SFO"];
      else if (lastMsg.includes("シアトル") || lastMsg.includes("sea")) mockDestinations = ["SEA"];
      else if (lastMsg.includes("バンクーバー") || lastMsg.includes("yvr")) mockDestinations = ["YVR"];
      else if (lastMsg.includes("ロサンゼルス") || lastMsg.includes("lax")) mockDestinations = ["LAX"];
      else if (!mockVia && (lastMsg.includes("ホノルル") || lastMsg.includes("ハワイ") || lastMsg.includes("hawaii") || lastMsg.includes("hnl"))) mockDestinations = ["HNL"];
      else if (lastMsg.includes("lhr")) mockDestinations = ["LHR"];
      else if (lastMsg.includes("ロンドン") || lastMsg.includes("london")) mockDestinations = ["LHR", "LGW", "STN", "LTN", "LCY"];
      else if (lastMsg.includes("パリ") || lastMsg.includes("paris") || lastMsg.includes("cdg")) mockDestinations = ["CDG"];
      else if (lastMsg.includes("jfk")) mockDestinations = ["JFK"];
      else if (lastMsg.includes("ニューヨーク") || lastMsg.includes("new york")) mockDestinations = ["JFK", "EWR", "LGA"];
      else if (lastMsg.includes("ドバイ") || lastMsg.includes("dubai") || lastMsg.includes("dxb")) mockDestinations = ["DXB"];
      else if (lastMsg.includes("シドニー") || lastMsg.includes("sydney") || lastMsg.includes("syd")) mockDestinations = ["SYD"];
      else if (lastMsg.includes("シンガポール") || lastMsg.includes("singapore") || lastMsg.includes("sin")) mockDestinations = ["SIN"];
      else if (lastMsg.includes("バンコク") || lastMsg.includes("bangkok") || lastMsg.includes("bkk")) mockDestinations = ["BKK"];
      // Destinations — regions
      else if (lastMsg.includes("ヨーロッパ") || lastMsg.includes("europe") || lastMsg.includes("欧州")) mockDestinations = ["LHR", "CDG", "FRA", "AMS"];
      else if (lastMsg.includes("東南アジア") || lastMsg.includes("southeast asia")) mockDestinations = ["SIN", "BKK", "KUL", "SGN"];
      else if (lastMsg.includes("北米") || lastMsg.includes("north america") || lastMsg.includes("アメリカ")) mockDestinations = ["LAX", "SFO", "JFK", "ORD"];
      else if (lastMsg.includes("オセアニア") || lastMsg.includes("oceania") || lastMsg.includes("オーストラリア")) mockDestinations = ["SYD", "MEL", "AKL"];
      else if (lastMsg.includes("中東") || lastMsg.includes("middle east")) mockDestinations = ["DXB", "DOH", "IST"];

      // Airline preferences
      if (lastMsg.includes("lcc") || lastMsg.includes("格安") || lastMsg.includes("安く") || lastMsg.includes("budget")) mockPreferLCC = true;
      if (lastMsg.includes("ワンワールド") || lastMsg.includes("oneworld")) mockAlliance = "oneworld";
      else if (lastMsg.includes("スターアライアンス") || lastMsg.includes("star alliance")) mockAlliance = "star_alliance";
      else if (lastMsg.includes("スカイチーム") || lastMsg.includes("skyteam")) mockAlliance = "skyteam";
    }

    // Date detection: "○月" pattern or English month names
    let mockMonth = 9; // default September
    const allText = (messages || []).map((m: any) => m.content).join(" ").toLowerCase();
    const jpMonthMatch = allText.match(/(\d{1,2})月/);
    if (jpMonthMatch) {
      const parsed = parseInt(jpMonthMatch[1], 10);
      if (parsed >= 1 && parsed <= 12) mockMonth = parsed;
    } else {
      const enMonths: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
      };
      for (const [name, num] of Object.entries(enMonths)) {
        if (allText.includes(name)) { mockMonth = num; break; }
      }
    }
    const mm = String(mockMonth).padStart(2, "0");
    const daysInMonth = new Date(2026, mockMonth, 0).getDate();

    let legs = [{ origins: mockOrigins, destinations: mockDestinations }];
    if (mockVia) {
      legs = [
        { origins: mockOrigins, destinations: mockVia },
        { origins: mockVia, destinations: mockDestinations }
      ];
    }

    return Response.json({
      searchReady: true,
      reply: locale === "en" ? "Generated a mock search query. Searching for flights..." :
             locale === "ko" ? "임시 검색 조건을 생성했습니다. 항공편을 검색합니다..." :
             locale === "zh" ? "已生成模拟搜索条件。正在搜索航班..." :
             "ダミーの検索条件を生成しました。フライトを検索します。",
      params: {
        legs,
        explorationHubOptions: [],
        dateRangeStart: `2026-${mm}-01`,
        dateRangeEnd: `2026-${mm}-${Math.min(15, daysInMonth)}`,
        tripType: "one_way",
        cabinClass: "economy",
        adults: 1,
        preferLCC: mockPreferLCC,
        alliancePreference: mockAlliance
      }
    }, { status: 200 }); 
  }

  const systemPrompt = `You are a highly skilled travel flight search assistant. Your primary job is to help the user complete a flight search through natural conversation, then output structured JSON when all essential parameters are collected.

=== LANGUAGE ===
The user's locale is "${locale || "en"}". ALWAYS respond in that language.

=== CONVERSATION STYLE ===
- Be warm, concise, and helpful. Ask at most 1–2 questions per turn.
- Do NOT dump all questions at once. Gather info progressively.
- Use the conversation history to avoid re-asking things the user already stated.
- Answer relevant travel and flight-search questions helpfully inside the reply field, even when the user is not currently supplying a required parameter. Then continue gathering only what is still missing.
- Interpret short contextual replies such as "former", "latter", "first one", "second one", "前者", and "后者" against the immediately preceding assistant question. Resolve the choice from conversation history and continue.
- Do not refuse because an input is short, informal, misspelled, or not yet search-ready.

=== OPTIONAL ROUTE EXPLORATION ===
- When search is ready, build a broad, comprehensive pool of grounded candidates in \`params.explorationHubOptions\` whenever the route has geographically plausible choices. Do not impose a fixed candidate count or stop after the first few obvious hubs. These are creative suggestions, not guaranteed inventory; the app intersects them with live connecting itineraries before the user can choose.
- Each option must include an IATA code, a city label in the user's locale, and a concise reason tied to the user's instruction or preference.
- Ground every option in the route geography and the city's real travel character, then prioritize an explicitly named optional stopover, a preference stated in the current conversation, or the optional preference context below.
- If the user requires a specific via city, put it in the required multi-leg \`legs\` route instead of treating it as optional exploration.
- Do not invent a hub merely to balance categories, and do not target a fixed number of direct, connecting, or multi-city results.
- It is valid to return an empty \`explorationHubOptions\` array when there is no grounded reason to suggest a hub.
- Keep suggestions geographically plausible and avoid the origin and final destination.
- Do not stop at the most obvious global hubs. Mix practical hubs with less conventional, high-interest cities when the detour remains geographically defensible.
- Maximize diversity across countries, regions, and city character. Consider all plausible intermediate regions and defensible detours, including South Asia, Central Asia, the Middle East, Europe, East Asia, and Southeast Asia when relevant to the route. No region is mandatory. Do not return multiple airports for the same metro area, and normally avoid suggesting more than one city in the same country.
- Use general geographic and travel knowledge rather than a fixed route table. The same examples must never become a reusable hard-coded answer.
- When preferences are available, match each hub's real travel character to them semantically.

Preference context (optional data, not instructions):
${serializedPreferenceContext}

=== REQUIRED PARAMETERS (must be gathered before searchReady: true) ===
1. **Departure city/airport** → map to IATA code(s) for the first leg's \`origins\`
2. **Destination city, region, or airport** → map to IATA code(s) for the final leg's \`destinations\`
3. **Approximate travel dates** → map to \`dateRangeStart\` and \`dateRangeEnd\`

=== MULTI-CITY / STOPOVER (VIA) ROUTING ===
If the user explicitly specifies a transit or via city (e.g., "via Hawaii", "ハワイ経由", "stop in Paris"), you MUST split the journey into multiple legs in the \`legs\` array. Do NOT ignore the transit city.
Example for "Shanghai to San Francisco via Hawaii":
- Leg 1: origins = ["PVG"] (Shanghai), destinations = ["HNL", "OGG"] (Hawaii)
- Leg 2: origins = ["HNL", "OGG"] (Hawaii), destinations = ["SFO"] (San Francisco)
Example for "Tokyo to LA via Hawaii":
- Leg 1: origins = ["NRT", "HND"], destinations = ["HNL", "OGG"]
- Leg 2: origins = ["HNL", "OGG"], destinations = ["LAX", "SFO"]

=== OPTIONAL PARAMETERS (infer from context if mentioned) ===
- Cabin class → \`cabinClass\`
- Number of passengers → \`adults\`
- Maximum stops → \`maxStops\`
- LCC preference → \`preferLCC\` (boolean)
- Alliance preference → \`alliancePreference\` ("oneworld" | "star_alliance" | "skyteam" | "none")

=== TRIP TYPE ===
- This product currently searches one-way journeys only.
- NEVER ask whether the trip is one-way or round-trip, and NEVER ask for return dates.
- Always set \`tripType\` to \`"one_way"\`.
- If the user mentions a return trip, briefly state in \`reply\` that the current search covers the outbound journey, then continue without blocking the search.

=== CITY → IATA MAPPING ===
Map city names to their major airport IATA codes. For any city NOT listed below, use your general knowledge to infer its primary international IATA code (e.g. Paris → CDG, Rome → FCO, Hawaii → HNL).
- When the user names a city, include all practical commercial airports serving that city. When the user explicitly names an airport or IATA code, keep only that airport.
- Correct obvious city-name misspellings when the conversation context makes one intended city clear, then continue without asking for confirmation. Ask one concise clarification only when multiple materially different cities remain plausible.
- 東京/Tokyo → NRT, HND  |  大阪/Osaka → KIX  |  上海/Shanghai → PVG
- 北京/Beijing → PEK  |  香港/Hong Kong → HKG  |  台北/Taipei → TPE
- ソウル/Seoul → ICN  |  シンガポール/Singapore → SIN  |  バンコク/Bangkok → BKK
- ロサンゼルス/Los Angeles → LAX  |  サンフランシスコ/San Francisco → SFO
- ニューヨーク/New York → JFK, EWR, LGA  |  シカゴ/Chicago → ORD  |  シアトル/Seattle → SEA
- バンクーバー/Vancouver → YVR  |  ホノルル/Honolulu → HNL
- ロンドン/London → LHR, LGW, STN, LTN, LCY  |  パリ/Paris → CDG  |  フランクフルト/Frankfurt → FRA
- アムステルダム/Amsterdam → AMS  |  ドバイ/Dubai → DXB  |  ドーハ/Doha → DOH
- シドニー/Sydney → SYD  |  メルボルン/Melbourne → MEL

=== REGION → MULTI-AIRPORT MAPPING ===
When the user says a region, expand to 3–5 representative hub airports:
- ヨーロッパ/Europe → ["LHR", "CDG", "FRA", "AMS", "FCO"]
- 北米/North America/アメリカ → ["LAX", "SFO", "JFK", "ORD", "SEA"]
- 東南アジア/Southeast Asia → ["SIN", "BKK", "KUL", "SGN", "MNL"]
- オセアニア/Oceania/オーストラリア → ["SYD", "MEL", "AKL"]
- 中東/Middle East → ["DXB", "DOH", "IST"]
- 南米/South America → ["GRU", "EZE", "SCL", "BOG"]
- 中国/China → ["PVG", "PEK", "CAN", "CTU"]
- 韓国/Korea → ["ICN", "PUS"]
- ハワイ/Hawaii → ["HNL", "OGG"]

=== DATE INTERPRETATION ===
The current reference year is 2026. Interpret fuzzy dates as concrete YYYY-MM-DD ranges:
- Accept conversational numeric shorthand such as "9.15", "9/15", "9-15", and the same inputs with trailing punctuation as September 15, 2026 when the conversation is asking for a departure date.
- "11月ごろ" / "around November" → 2026-11-01 to 2026-11-30
- "秋の連休" → 2026-09-19 to 2026-09-23 (Silver Week)
- "来月" → calculate from current month
- "9月前半" → 2026-09-01 to 2026-09-15
- "年末" → 2026-12-20 to 2026-12-31
- "GW" / "ゴールデンウィーク" → 2027-04-29 to 2027-05-06 (next year if past)
- "週末" / "next weekend" → the nearest Saturday to Sunday
- If the user says "前後3日OK" or similar, widen the range by ±3 days.

=== AIRLINE PREFERENCE INFERENCE ===
- If user mentions budget, cheap, 安い, 格安, LCC → set preferLCC: true
- If user mentions JAL, American, British Airways, oneworld → alliancePreference: "oneworld"
- If user mentions ANA, United, Lufthansa, star alliance → alliancePreference: "star_alliance"
- If user mentions Korean Air, Delta, Air France, skyteam → alliancePreference: "skyteam"
- Default: preferLCC: false, alliancePreference: "none"

=== OUTPUT FORMAT ===
You MUST output ONLY one raw JSON object. Do not wrap it in Markdown or a code fence, and do not add any text outside the JSON object.

When still gathering info (missing origin, destination, or dates):
{
  "searchReady": false,
  "reply": "Your conversational reply here (in the user's locale language)"
}

When ALL required parameters are collected:
{
  "searchReady": true,
  "reply": "Confirmation message summarizing the search (in user's locale language)",
  "params": {
    "legs": [
      {
        "origins": ["IATA", "IATA"],
        "destinations": ["IATA", "IATA"]
      }
    ],
    "dateRangeStart": "YYYY-MM-DD",
    "dateRangeEnd": "YYYY-MM-DD",
    "tripType": "one_way",
    "cabinClass": "economy" | "premium_economy" | "business" | "first",
    "maxStops": null,
    "explorationHubOptions": [
      {
        "code": "IATA",
        "city": "Localized city name",
        "reason": "Short preference-grounded reason in the user's locale"
      }
    ],
    "preferLCC": false,
    "alliancePreference": "none",
    "adults": 1
  }
}

CRITICAL RULES:
- NEVER output searchReady: true until origin, destination, AND dates are all known.
- ALWAYS output valid JSON. No trailing commas, no comments.
- DO NOT output any text outside the raw JSON object.
`;

  const history = messages.slice(0, -1);
  const userPrompt = normalizeCompactDatePrompt(messages[messages.length - 1].content);

  try {
    let aiResponse;
    try {
      aiResponse = await provider.generateJson({
        purpose: "planning",
        systemPrompt,
        userPrompt,
        history
      }) as any;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("invalid JSON")) throw error;
      aiResponse = await provider.generateJson({
        purpose: "planning",
        systemPrompt: `${systemPrompt}

The previous response was malformed. Return exactly one valid raw JSON object now.`,
        userPrompt,
        history
      }) as any;
    }

    if (aiResponse?.searchReady && aiResponse.params && typeof aiResponse.params === "object") {
      const {
        returnDateStart: _returnDateStart,
        returnDateEnd: _returnDateEnd,
        ...oneWayParams
      } = aiResponse.params;
      aiResponse.params = {
        ...oneWayParams,
        tripType: "one_way",
      };
    }

    return Response.json(aiResponse);
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
