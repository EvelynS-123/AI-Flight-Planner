import { createTravelAIProvider } from "../../ai-travel/providers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { messages, locale } = await request.json();

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

      // Destinations — specific cities
      if (lastMsg.includes("サンフランシスコ") || lastMsg.includes("sfo")) mockDestinations = ["SFO"];
      else if (lastMsg.includes("シアトル") || lastMsg.includes("sea")) mockDestinations = ["SEA"];
      else if (lastMsg.includes("バンクーバー") || lastMsg.includes("yvr")) mockDestinations = ["YVR"];
      else if (lastMsg.includes("ロサンゼルス") || lastMsg.includes("lax")) mockDestinations = ["LAX"];
      else if (!mockVia && (lastMsg.includes("ホノルル") || lastMsg.includes("ハワイ") || lastMsg.includes("hawaii") || lastMsg.includes("hnl"))) mockDestinations = ["HNL"];
      else if (lastMsg.includes("ロンドン") || lastMsg.includes("london") || lastMsg.includes("lhr")) mockDestinations = ["LHR"];
      else if (lastMsg.includes("パリ") || lastMsg.includes("paris") || lastMsg.includes("cdg")) mockDestinations = ["CDG"];
      else if (lastMsg.includes("ニューヨーク") || lastMsg.includes("new york") || lastMsg.includes("jfk")) mockDestinations = ["JFK"];
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

  const systemPrompt = `You are a highly skilled travel flight search assistant. Your single purpose is to gather the user's travel requirements through natural conversation, then output a structured JSON when all essential parameters are collected.

=== LANGUAGE ===
The user's locale is "${locale || "en"}". ALWAYS respond in that language.

=== CONVERSATION STYLE ===
- Be warm, concise, and helpful. Ask at most 1–2 questions per turn.
- Do NOT dump all questions at once. Gather info progressively.
- Use the conversation history to avoid re-asking things the user already stated.

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
- Round trip vs one-way → \`tripType\`
- Return dates → \`returnDateStart\`, \`returnDateEnd\`
- Cabin class → \`cabinClass\`
- Number of passengers → \`adults\`
- Maximum stops → \`maxStops\`
- LCC preference → \`preferLCC\` (boolean)
- Alliance preference → \`alliancePreference\` ("oneworld" | "star_alliance" | "skyteam" | "none")

=== CITY → IATA MAPPING ===
Map city names to their major airport IATA codes. For any city NOT listed below, use your general knowledge to infer its primary international IATA code (e.g. Paris → CDG, Rome → FCO, Hawaii → HNL).
- 東京/Tokyo → NRT, HND  |  大阪/Osaka → KIX  |  上海/Shanghai → PVG
- 北京/Beijing → PEK  |  香港/Hong Kong → HKG  |  台北/Taipei → TPE
- ソウル/Seoul → ICN  |  シンガポール/Singapore → SIN  |  バンコク/Bangkok → BKK
- ロサンゼルス/Los Angeles → LAX  |  サンフランシスコ/San Francisco → SFO
- ニューヨーク/New York → JFK  |  シカゴ/Chicago → ORD  |  シアトル/Seattle → SEA
- バンクーバー/Vancouver → YVR  |  ホノルル/Honolulu → HNL
- ロンドン/London → LHR  |  パリ/Paris → CDG  |  フランクフルト/Frankfurt → FRA
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
You MUST output ONLY a single JSON block wrapped in \`\`\`json ... \`\`\`. No other text outside the JSON block.

When still gathering info (missing origin, destination, or dates):
\`\`\`json
{
  "searchReady": false,
  "reply": "Your conversational reply here (in the user's locale language)"
}
\`\`\`

When ALL required parameters are collected:
\`\`\`json
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
    "returnDateStart": "YYYY-MM-DD",
    "returnDateEnd": "YYYY-MM-DD",
    "tripType": "one_way" | "round_trip",
    "cabinClass": "economy" | "premium_economy" | "business" | "first",
    "maxStops": null,
    "preferLCC": false,
    "alliancePreference": "none",
    "adults": 1
  }
}
\`\`\`

CRITICAL RULES:
- NEVER output searchReady: true until origin, destination, AND dates are all known.
- ALWAYS output valid JSON. No trailing commas, no comments.
- DO NOT output any text outside the JSON code block.
`;

  const history = messages.slice(0, -1);
  const userPrompt = messages[messages.length - 1].content;

  try {
    const aiResponse = await provider.generateJson({
      purpose: "planning",
      systemPrompt,
      userPrompt,
      history
    }) as any;

    return Response.json(aiResponse);
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

