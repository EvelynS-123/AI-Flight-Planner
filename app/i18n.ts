export const LOCALE_OPTIONS = [
  { code: "zh", label: "简中", htmlLang: "zh-CN", intl: "zh-CN" },
  { code: "en", label: "EN", htmlLang: "en", intl: "en-US" },
  { code: "ko", label: "한국어", htmlLang: "ko", intl: "ko-KR" },
  { code: "ja", label: "日本語", htmlLang: "ja", intl: "ja-JP" },
] as const;

export type Locale = (typeof LOCALE_OPTIONS)[number]["code"];

export type Copy = {
  language: string;
  preferences: string;
  quizStep: (step: number) => string;
  quizTitle: string;
  quizBody: string;
  quizCategoryTitle: string;
  quizCategoryHelp: string;
  quizFood: string;
  quizCulture: string;
  quizNature: string;
  quizUrban: string;
  quizLow: string;
  quizHigh: string;
  quizFavoritesTitle: string;
  quizFavoritesHelp: string;
  quizFavoritesCount: (count: number) => string;
  quizSkip: string;
  quizBack: string;
  quizNext: string;
  quizSave: string;
  quizClose: string;
  home: string;
  demoBadge: string;
  heroEyebrow: string;
  heroTitle: string;
  heroCopy: string;
  searchAria: string;
  from: string;
  to: string;
  month: string;
  august: string;
  september: string;
  search: string;
  swap: string;
  searchNote: string;
  routeIdeas: string;
  noRoute: string;
  weightAria: string;
  weightTitle: string;
  weightHelp: string;
  firstBoundary: string;
  secondBoundary: string;
  cheapest: string;
  interesting: string;
  directest: string;
  emptyTitle: string;
  emptyBody: string;
  liveScore: string;
  sampleTotal: string;
  via: string;
  direct: string;
  connection: string;
  multiCity: string;
  directDetail: string;
  connectionDetail: (stops: number) => string;
  multiCityDetail: (segments: number) => string;
  connectionHub: string;
  multiCityHub: string;
  directWarning: string;
  connectionWarning: string;
  multiCityWarning: string;
  totalDuration: string;
  stopoverPlan: string;
  connectionTime: string;
  usableTime: string;
  playDays: string;
  daysOption: (days: number) => string;
  fixedConnection: string;
  ticket: string;
  weeklySchedule: string;
  operates: string;
  priceDate: string;
  oneWay: string;
  view: string;
  whyHere: string;
  scoreNote: (price: number, interest: number, directness: number) => string;
  footer: string;
  routeSummary: (total: number, direct: number, connection: number, multiCity: number) => string;
  routeSnapshot: string;
  snapshot: string;
  routeFare: string;
  tripFare: string;
  sourceFare: string;
};

export const COPY: Record<Locale, Copy> = {
  zh: {
    preferences: "旅行偏好",
    quizStep: (step) => `第 ${step} 步，共 2 步`,
    quizTitle: "什么样的中转值得停下来？",
    quizBody: "用几个轻量选择，让“最有趣”更像你的答案。你可以随时修改。",
    quizCategoryTitle: "你旅行时更在意什么？",
    quizCategoryHelp: "分别选择兴趣程度，1 表示不太在意，5 表示非常喜欢。",
    quizFood: "美食探索",
    quizCulture: "历史文化",
    quizNature: "自然休闲",
    quizUrban: "现代都市",
    quizLow: "不太在意",
    quizHigh: "非常喜欢",
    quizFavoritesTitle: "有没有特别想去的城市？",
    quizFavoritesHelp: "可选，最多选择 3 个。它们会在城市吸引力中获得最高优先级。",
    quizFavoritesCount: (count) => `已选择 ${count}/3`,
    quizSkip: "跳过，使用默认推荐",
    quizBack: "上一步",
    quizNext: "下一步",
    quizSave: "保存偏好",
    quizClose: "关闭偏好设置",
    totalDuration: "全程时间",
    stopoverPlan: "中转地停留",
    connectionTime: "中转时间",
    usableTime: "预计可游玩",
    playDays: "在中转地玩几天",
    daysOption: (days) => days === 0 ? "当天继续" : `${days} 天`,
    fixedConnection: "固定联程",
    ticket: "机票",
    weeklySchedule: "每周参考时刻",
    operates: "运行日",
    language: "语言",
    home: "Via 首页",
    demoBadge: "2026 夏季样本",
    heroEyebrow: "多城市航线搜索",
    heroTitle: "让旅途本身\n成为冒险。",
    heroCopy: "把直飞、联程票和分开出票的跨太平洋组合放在一起比较，让旅途本身也成为选择。",
    searchAria: "航线搜索",
    from: "从哪里出发",
    to: "到哪里",
    month: "出行月份",
    august: "2026 年 8 月",
    september: "2026 年 9 月",
    search: "查找航线",
    swap: "交换出发地和目的地",
    searchNote: "同时搜索直飞、联程与最多三段的组合路线，价格为单程美元快照，原币报价会在详情标注",
    routeIdeas: "路线灵感",
    noRoute: "当前样本里还没有这条路线",
    weightAria: "路线排序权重",
    weightTitle: "你的排序权重",
    weightHelp: "拖动两个分界点，在同一条 bar 上分配三项权重。",
    firstBoundary: "最便宜与最有趣的分界",
    secondBoundary: "最有趣与最直接的分界",
    cheapest: "最便宜",
    interesting: "最有趣",
    directest: "最直接",
    emptyTitle: "换一个出发地或目的地试试",
    emptyBody: "本 demo 聚焦 4 个数据较完整的东亚出发机场和 4 个北美西海岸到达机场。",
    liveScore: "实时得分",
    sampleTotal: "样本合计",
    via: "经",
    direct: "直飞",
    connection: "联程票",
    multiCity: "Multicity",
    directDetail: "一张票，无需中转",
    connectionDetail: (stops) => `一个行程，${stops} 次中转`,
    multiCityDetail: (segments) => `${segments} 张单程票，自行衔接`,
    connectionHub: "联程中转机场",
    multiCityHub: "Multicity 中转机场",
    directWarning: "这是直飞单程价格快照。航班计划与最终含税价格可能变化，请在出票页重新确认。",
    connectionWarning: "这是同一次搜索里出现的端到端联程报价样本。实际是否同一票号、行李能否直挂及保护规则，仍要在出票页确认。",
    multiCityWarning: "这是分开出票的 Multicity 灵感组合。各段价格来自独立搜索快照，日期未必可直接衔接，行李通常也不会直挂。",
    priceDate: "价格日期",
    oneWay: "单程",
    view: "查看",
    whyHere: "为什么排在这里",
    scoreNote: (price, interest, directness) => `当前分数由最便宜 ${price}%、最有趣 ${interest}%、最直接 ${directness}% 实时计算。可游玩时间按 S 曲线加分，约 2 至 3 天接近上限，更长的总行程仍会降低最直接分。`,
    footer: "仅用于路线探索演示。最终价格、航班时刻和入境要求请以航空公司或出票平台为准。",
    routeSummary: (total, direct, connection, multiCity) => `找到 ${total} 条，直飞 ${direct} 条，联程 ${connection} 条，Multicity ${multiCity} 条`,
    routeSnapshot: "航线快照",
    snapshot: "快照",
    routeFare: "航线票价",
    tripFare: "Trip.com 票价",
    sourceFare: "原始报价",
  },
  en: {
    preferences: "Travel preferences",
    quizStep: (step) => `Step ${step} of 2`,
    quizTitle: "What makes a stop worth taking?",
    quizBody: "A few quick choices make “most interesting” feel like your answer. You can edit them anytime.",
    quizCategoryTitle: "What matters to you when you travel?",
    quizCategoryHelp: "Rate each interest from 1, not important, to 5, love it.",
    quizFood: "Food discovery",
    quizCulture: "History & culture",
    quizNature: "Nature & downtime",
    quizUrban: "Modern city life",
    quizLow: "Not important",
    quizHigh: "Love it",
    quizFavoritesTitle: "Any cities already calling you?",
    quizFavoritesHelp: "Optional. Pick up to three; they receive the highest city-attractiveness priority.",
    quizFavoritesCount: (count) => `${count}/3 selected`,
    quizSkip: "Skip and use default picks",
    quizBack: "Back",
    quizNext: "Next",
    quizSave: "Save preferences",
    quizClose: "Close preferences",
    totalDuration: "Total journey",
    stopoverPlan: "Stopover stay",
    connectionTime: "Connection time",
    usableTime: "Estimated sightseeing",
    playDays: "Days to explore",
    daysOption: (days) => days === 0 ? "Continue the same day" : `${days} ${days === 1 ? "day" : "days"}`,
    fixedConnection: "Fixed connection",
    ticket: "Ticket",
    weeklySchedule: "Weekly timetable",
    operates: "Operates",
    language: "Language",
    home: "Via home",
    demoBadge: "Summer 2026 sample",
    heroEyebrow: "MULTI-CITY ROUTE FINDER",
    heroTitle: "Make the journey\npart of the adventure.",
    heroCopy: "Compare nonstop, connecting, and separately ticketed transpacific options, so the journey becomes part of the choice.",
    searchAria: "Route search",
    from: "From",
    to: "To",
    month: "Travel month",
    august: "August 2026",
    september: "September 2026",
    search: "Find routes",
    swap: "Swap origin and destination",
    searchNote: "Search nonstop, connecting, and up-to-three-segment options together. Prices are one-way USD snapshots; original currencies appear in details.",
    routeIdeas: "ROUTE IDEAS",
    noRoute: "No route is available in the current sample",
    weightAria: "Route ranking weights",
    weightTitle: "Your ranking mix",
    weightHelp: "Drag the two boundaries to split all three weights on one bar.",
    firstBoundary: "Boundary between cheapest and most interesting",
    secondBoundary: "Boundary between most interesting and most direct",
    cheapest: "Cheapest",
    interesting: "Most interesting",
    directest: "Most direct",
    emptyTitle: "Try another origin or destination",
    emptyBody: "This demo focuses on four well-covered East Asian origins and four North American West Coast destinations.",
    liveScore: "Live score",
    sampleTotal: "Sample total",
    via: "via",
    direct: "Nonstop",
    connection: "Connecting",
    multiCity: "Multi-city",
    directDetail: "One ticket, no connection",
    connectionDetail: (stops) => `One itinerary, ${stops} ${stops === 1 ? "stop" : "stops"}`,
    multiCityDetail: (segments) => `${segments} one-way tickets, self-transfer`,
    connectionHub: "Connecting airport",
    multiCityHub: "Multi-city stop",
    directWarning: "This is a one-way nonstop fare snapshot. Schedules and final tax-inclusive prices may change; reconfirm on the booking page.",
    connectionWarning: "This end-to-end connecting fare appeared in one search. Confirm the ticket number, through-checked baggage, and disruption protection on the booking page.",
    multiCityWarning: "This is a multi-city idea built from separately ticketed one-way fares. Segment prices come from independent snapshots, dates may not connect, and baggage usually will not be checked through.",
    priceDate: "Fare date",
    oneWay: "One way",
    view: "View",
    whyHere: "Why it ranks here",
    scoreNote: (price, interest, directness) => `The live score uses ${price}% cheapest, ${interest}% most interesting, and ${directness}% most direct. Usable stopover time follows a sigmoid curve that nears its ceiling around two to three days; longer trips still reduce directness.`,
    footer: "For route exploration only. Recheck final fares, schedules, and entry requirements with the airline or booking provider.",
    routeSummary: (total, direct, connection, multiCity) => `${total} routes · ${direct} nonstop, ${connection} connecting, ${multiCity} multi-city`,
    routeSnapshot: "route snapshot",
    snapshot: "snapshot",
    routeFare: "Route fare",
    tripFare: "Trip.com fare",
    sourceFare: "source fare",
  },
  ko: {
    preferences: "여행 취향",
    quizStep: (step) => `2단계 중 ${step}단계`,
    quizTitle: "어떤 경유지라면 머물고 싶나요?",
    quizBody: "몇 가지 선택으로 ‘가장 흥미로운’ 순위를 나에게 맞출 수 있습니다. 언제든 수정할 수 있어요.",
    quizCategoryTitle: "여행에서 무엇을 중요하게 생각하나요?",
    quizCategoryHelp: "관심이 적으면 1, 매우 좋아하면 5를 선택하세요.",
    quizFood: "미식 탐방",
    quizCulture: "역사와 문화",
    quizNature: "자연과 휴식",
    quizUrban: "현대 도시",
    quizLow: "관심 적음",
    quizHigh: "매우 좋아함",
    quizFavoritesTitle: "특히 가고 싶은 도시가 있나요?",
    quizFavoritesHelp: "선택 사항이며 최대 3곳까지 가능합니다. 도시 매력도에서 가장 높은 우선순위를 받습니다.",
    quizFavoritesCount: (count) => `${count}/3 선택`,
    quizSkip: "건너뛰고 기본 추천 사용",
    quizBack: "이전",
    quizNext: "다음",
    quizSave: "취향 저장",
    quizClose: "여행 취향 닫기",
    totalDuration: "총 여행 시간",
    stopoverPlan: "스톱오버 체류",
    connectionTime: "환승 시간",
    usableTime: "예상 관광 시간",
    playDays: "경유지 체류 일수",
    daysOption: (days) => days === 0 ? "당일 계속 이동" : `${days}일`,
    fixedConnection: "고정 환승",
    ticket: "항공권",
    weeklySchedule: "주간 참고 시간표",
    operates: "운항일",
    language: "언어",
    home: "Via 홈",
    demoBadge: "2026년 여름 샘플",
    heroEyebrow: "다구간 노선 찾기",
    heroTitle: "여정 자체를\n모험으로.",
    heroCopy: "직항, 연결편, 별도 발권한 태평양 횡단 조합을 한곳에서 비교해 여정 자체도 선택의 일부로 만들어 보세요.",
    searchAria: "노선 검색",
    from: "출발지",
    to: "도착지",
    month: "여행 월",
    august: "2026년 8월",
    september: "2026년 9월",
    search: "노선 찾기",
    swap: "출발지와 도착지 바꾸기",
    searchNote: "직항, 연결편, 최대 3구간 조합을 함께 검색합니다. 가격은 편도 미화 스냅샷이며 원화가 아닌 원래 통화는 상세 정보에 표시됩니다.",
    routeIdeas: "추천 노선",
    noRoute: "현재 샘플에는 이 노선이 없습니다",
    weightAria: "노선 순위 가중치",
    weightTitle: "순위 가중치",
    weightHelp: "두 경계점을 드래그해 하나의 바에서 세 가중치를 배분하세요.",
    firstBoundary: "최저가와 흥미도 사이 경계",
    secondBoundary: "흥미도와 직행성 사이 경계",
    cheapest: "최저가",
    interesting: "가장 흥미로운",
    directest: "가장 직행",
    emptyTitle: "다른 출발지나 도착지를 선택해 보세요",
    emptyBody: "이 데모는 데이터가 비교적 충분한 동아시아 출발 공항 4곳과 북미 서해안 도착 공항 4곳에 집중합니다.",
    liveScore: "실시간 점수",
    sampleTotal: "샘플 합계",
    via: "경유",
    direct: "직항",
    connection: "연결편",
    multiCity: "다구간",
    directDetail: "항공권 1장, 환승 없음",
    connectionDetail: (stops) => `하나의 여정, ${stops}회 환승`,
    multiCityDetail: (segments) => `편도 항공권 ${segments}장, 직접 연결`,
    connectionHub: "연결편 환승 공항",
    multiCityHub: "다구간 경유 공항",
    directWarning: "직항 편도 운임 스냅샷입니다. 운항 일정과 최종 세금 포함 가격은 바뀔 수 있으니 예약 페이지에서 다시 확인하세요.",
    connectionWarning: "한 번의 검색에 표시된 출발지-도착지 연결편 운임 예시입니다. 동일 티켓 번호 여부, 수하물 연결, 지연·결항 보호 규정은 발권 페이지에서 확인하세요.",
    multiCityWarning: "별도 발권한 편도 운임을 조합한 다구간 아이디어입니다. 구간별 가격은 서로 다른 검색 스냅샷이며 날짜가 이어지지 않을 수 있고 수하물도 보통 자동 연결되지 않습니다.",
    priceDate: "운임 날짜",
    oneWay: "편도",
    view: "보기",
    whyHere: "이 순위인 이유",
    scoreNote: (price, interest, directness) => `실시간 점수는 최저가 ${price}%, 흥미도 ${interest}%, 직행성 ${directness}%로 계산됩니다. 경유지에서 활용 가능한 시간은 S자 곡선으로 반영되어 약 2~3일에 상한에 가까워지며, 총 여정이 길수록 직행성 점수는 낮아집니다.`,
    footer: "노선 탐색용 데모입니다. 최종 운임, 운항 일정, 입국 요건은 항공사 또는 예약 사이트에서 다시 확인하세요.",
    routeSummary: (total, direct, connection, multiCity) => `총 ${total}개 · 직항 ${direct}개, 연결편 ${connection}개, 다구간 ${multiCity}개`,
    routeSnapshot: "노선 스냅샷",
    snapshot: "스냅샷",
    routeFare: "노선 운임",
    tripFare: "Trip.com 운임",
    sourceFare: "원문 운임",
  },
  ja: {
    preferences: "旅の好み",
    quizStep: (step) => `2ステップ中 ${step}`,
    quizTitle: "立ち寄りたくなる経由地は？",
    quizBody: "いくつかの選択で「最も面白い」をあなた向けにします。いつでも変更できます。",
    quizCategoryTitle: "旅で何を重視しますか？",
    quizCategoryHelp: "関心が低ければ1、大好きなら5を選んでください。",
    quizFood: "食の探索",
    quizCulture: "歴史と文化",
    quizNature: "自然と休息",
    quizUrban: "現代都市",
    quizLow: "あまり重視しない",
    quizHigh: "大好き",
    quizFavoritesTitle: "特に行きたい都市はありますか？",
    quizFavoritesHelp: "任意で最大3都市。都市の魅力度で最優先になります。",
    quizFavoritesCount: (count) => `${count}/3 選択`,
    quizSkip: "スキップして既定のおすすめを使う",
    quizBack: "戻る",
    quizNext: "次へ",
    quizSave: "好みを保存",
    quizClose: "旅の好みを閉じる",
    totalDuration: "総移動時間",
    stopoverPlan: "ストップオーバー滞在",
    connectionTime: "乗り継ぎ時間",
    usableTime: "観光可能時間の目安",
    playDays: "経由地で過ごす日数",
    daysOption: (days) => days === 0 ? "当日中に出発" : `${days}日`,
    fixedConnection: "固定乗り継ぎ",
    ticket: "航空券",
    weeklySchedule: "週間参考時刻表",
    operates: "運航日",
    language: "言語",
    home: "Via ホーム",
    demoBadge: "2026年夏のサンプル",
    heroEyebrow: "周遊ルート検索",
    heroTitle: "旅そのものを\n冒険に。",
    heroCopy: "直行便、乗継便、別発券の太平洋横断ルートをまとめて比較し、移動そのものも選択肢に加えます。",
    searchAria: "ルート検索",
    from: "出発地",
    to: "目的地",
    month: "旅行月",
    august: "2026年8月",
    september: "2026年9月",
    search: "ルートを検索",
    swap: "出発地と目的地を入れ替える",
    searchNote: "直行便、乗継便、最大3区間の組み合わせをまとめて検索します。価格は片道米ドルのスナップショットで、元通貨は詳細に表示します。",
    routeIdeas: "ルート候補",
    noRoute: "現在のサンプルにはこのルートがありません",
    weightAria: "ルート順位の重み",
    weightTitle: "順位の重み",
    weightHelp: "2つの境界を動かし、1本のバーで3項目の重みを配分します。",
    firstBoundary: "最安と面白さの境界",
    secondBoundary: "面白さと直行性の境界",
    cheapest: "最安",
    interesting: "最も面白い",
    directest: "最も直行",
    emptyTitle: "別の出発地または目的地をお試しください",
    emptyBody: "このデモは、データが比較的充実した東アジアの出発空港4か所と北米西海岸の到着空港4か所に絞っています。",
    liveScore: "リアルタイム評価",
    sampleTotal: "サンプル合計",
    via: "経由",
    direct: "直行便",
    connection: "乗継便",
    multiCity: "周遊",
    directDetail: "航空券1枚、乗継なし",
    connectionDetail: (stops) => `1つの旅程、乗継${stops}回`,
    multiCityDetail: (segments) => `片道航空券${segments}枚、自己乗継`,
    connectionHub: "乗継空港",
    multiCityHub: "周遊の経由空港",
    directWarning: "直行便の片道運賃スナップショットです。運航予定と最終的な税込価格は変動するため、予約ページで再確認してください。",
    connectionWarning: "1回の検索に表示された出発地から目的地までの乗継運賃例です。同一航空券か、手荷物を通しで預けられるか、遅延・欠航時の保護条件を予約ページで確認してください。",
    multiCityWarning: "別発券の片道運賃を組み合わせた周遊ルート案です。区間価格は別々の検索スナップショットで、日程がつながらない場合があり、手荷物も通常は通しで預けられません。",
    priceDate: "運賃日",
    oneWay: "片道",
    view: "確認",
    whyHere: "この順位の理由",
    scoreNote: (price, interest, directness) => `リアルタイム評価は、最安 ${price}%、面白さ ${interest}%、直行性 ${directness}%で計算します。乗継地で使える時間はS字カーブで加点され、約2〜3日で上限に近づきます。一方、総旅程が長いほど直行性は下がります。`,
    footer: "ルート探索用のデモです。最終運賃、運航予定、入国要件は航空会社または予約サイトで再確認してください。",
    routeSummary: (total, direct, connection, multiCity) => `${total}件 · 直行便 ${direct}件、乗継便 ${connection}件、周遊 ${multiCity}件`,
    routeSnapshot: "ルートスナップショット",
    snapshot: "スナップショット",
    routeFare: "ルート運賃",
    tripFare: "Trip.com 運賃",
    sourceFare: "元の運賃",
  },
};

export const AIRPORT_CITIES: Record<Locale, Record<string, string>> = {
  zh: { PVG: "上海", PEK: "北京", HKG: "香港", TPE: "台北", ICN: "首尔", KIX: "大阪", NRT: "东京", HNL: "檀香山", CAN: "广州", WUH: "武汉", MNL: "马尼拉", LAX: "洛杉矶", SFO: "旧金山", SEA: "西雅图", YVR: "温哥华" },
  en: { PVG: "Shanghai", PEK: "Beijing", HKG: "Hong Kong", TPE: "Taipei", ICN: "Seoul", KIX: "Osaka", NRT: "Tokyo", HNL: "Honolulu", CAN: "Guangzhou", WUH: "Wuhan", MNL: "Manila", LAX: "Los Angeles", SFO: "San Francisco", SEA: "Seattle", YVR: "Vancouver" },
  ko: { PVG: "상하이", PEK: "베이징", HKG: "홍콩", TPE: "타이베이", ICN: "서울", KIX: "오사카", NRT: "도쿄", HNL: "호놀룰루", CAN: "광저우", WUH: "우한", MNL: "마닐라", LAX: "로스앤젤레스", SFO: "샌프란시스코", SEA: "시애틀", YVR: "밴쿠버" },
  ja: { PVG: "上海", PEK: "北京", HKG: "香港", TPE: "台北", ICN: "ソウル", KIX: "大阪", NRT: "東京", HNL: "ホノルル", CAN: "広州", WUH: "武漢", MNL: "マニラ", LAX: "ロサンゼルス", SFO: "サンフランシスコ", SEA: "シアトル", YVR: "バンクーバー" },
};

export function airportCity(code: string, locale: Locale) {
  return AIRPORT_CITIES[locale][code] ?? code;
}

export function localizeDateLabel(value: string, locale: Locale) {
  const option = LOCALE_OPTIONS.find((item) => item.code === locale)!;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(option.intl, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  const copy = COPY[locale];
  return value.replaceAll("route snapshot", copy.routeSnapshot).replaceAll("snapshot", copy.snapshot);
}

export function localizeAirlineLabel(value: string, locale: Locale) {
  const copy = COPY[locale];
  return value
    .replaceAll("Trip.com fare", copy.tripFare)
    .replaceAll("Route fare", copy.routeFare)
    .replaceAll("source fare", copy.sourceFare);
}
