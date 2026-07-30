"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { RankedRouteOption, ScheduledFlight } from "./flight-schedules";
import { airportCity, LOCALE_OPTIONS, type Locale } from "./i18n";
import { operationalProfileForAirport } from "./ai-travel/airport-rules";
import {
  evaluateRecommendationSelection,
  toggleRecommendationSelection,
} from "./ai-travel/recommendation-feasibility";
import type {
  RecommendationSelectionFeasibility,
  StopoverSelectionArrangement,
  StopoverRecommendationPool,
  TravelPace,
  TravelRecommendation,
  TravelRecommendationCategory,
  TravelRecommendationPlan,
  TravelRecommendationRequest,
} from "./ai-travel/types";
import type { TravelPreferenceState } from "./travel-preferences";

type WorkspaceProps = {
  route: RankedRouteOption;
  locale: Locale;
  preferences: TravelPreferenceState;
  originRect: DOMRect | null;
  onClose: () => void;
};

type ChatTurn = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

type SelectedByStopover = Record<number, string[]>;

const CATEGORY_ORDER: TravelRecommendationCategory[] = [
  "attraction",
  "meal",
  "hotel",
  "nightlife",
  "shopping",
];

const CATEGORY_ICONS: Record<TravelRecommendationCategory, string> = {
  attraction: "◇",
  meal: "◌",
  hotel: "⌂",
  nightlife: "☾",
  shopping: "▢",
};

const COPY = {
  zh: {
    eyebrow: "AI 中转推荐",
    title: "先留足余量，再选想去的地方",
    close: "返回航线",
    generating: "正在搜索并整理真实推荐",
    regenerate: "重新生成",
    relaxed: "宽松",
    balanced: "适中",
    tight: "紧凑",
    pace: "游玩节奏",
    flightFacts: "航班时间",
    lands: "抵达",
    departs: "离开",
    processing: "入境与行李",
    outbound: "进城交通",
    return: "返程交通",
    buffer: "机场预留",
    rest: "保护休息",
    flexible: "真正可支配",
    safeWindow: "安全游玩窗口",
    available: "剩余",
    chosen: "已选内容",
    localTransit: "市内交通",
    feasible: "这些选择可以安全装下",
    conflict: "当前组合装不下，需要减少或替换",
    missingHotel: "跨夜中转还需要选择一家住宿",
    openingConflict: "营业时间与可用窗口冲突",
    capacityConflict: "停留与交通时间超过可用余量",
    noSelection: "从下面挑选推荐，系统会自动判断顺序和余量。",
    suggestedOrder: "建议顺序",
    all: "全部",
    add: "加入",
    remove: "移除",
    replaceHotel: "更换住宿",
    duration: "建议停留",
    address: "地址",
    hours: "营业信息",
    source: "网页来源",
    verified: "网页时间",
    unknown: "需核实",
    transportSources: "机场交通依据",
    assumptions: "估算说明",
    customize: "让 AI 调整推荐池",
    placeholder: "例如，不要拉面，多推荐安静街区和爵士酒吧",
    send: "发送",
    quickFood: "多推荐本地小店",
    quickHidden: "多推荐非热门街区",
    quickNight: "增加夜生活选择",
    live: "GLM 5.2 + 实时搜索",
    error: "推荐生成失败，请重试",
    rateLimited: "AI 请求过于频繁，自动重试仍未成功。请稍候片刻再试。",
    searchLimited: "当前城市的可靠搜索结果不足，请稍后重试。",
    invalidResponse: "AI 返回的推荐格式不完整，请重试。",
    chatReady: "推荐池已更新，机场安全余量保持不变。",
    arrange: "AI 编排已选地点",
    arranging: "正在根据地址编排",
    rearrange: "重新编排",
    routeSummary: "游玩顺序与交通",
    congestion: "拥堵余量",
    arrangementError: "编排失败，请重试",
    disclaimer: "这是演示用估算，不代表实时交通、营业状态、入境许可或航班保证。",
    risk: { low: "余量充足", medium: "余量适中", high: "时间偏紧" },
    categories: {
      attraction: "景点",
      meal: "餐厅",
      hotel: "酒店",
      nightlife: "夜生活",
      shopping: "购物",
    },
  },
  en: {
    eyebrow: "AI STOPOVER PICKS",
    title: "Protect the margin, then choose the fun",
    close: "Back to routes",
    generating: "Searching and curating live recommendations",
    regenerate: "Regenerate",
    relaxed: "Relaxed",
    balanced: "Balanced",
    tight: "Tight",
    pace: "Visit pace",
    flightFacts: "Flight facts",
    lands: "Arrives",
    departs: "Departs",
    processing: "Entry and bags",
    outbound: "Into the city",
    return: "Return transit",
    buffer: "Airport buffer",
    rest: "Protected rest",
    flexible: "Truly flexible",
    safeWindow: "Safe city window",
    available: "Remaining",
    chosen: "Selected",
    localTransit: "Local transit",
    feasible: "These choices fit safely",
    conflict: "This combination does not fit yet",
    missingHotel: "Choose one stay for this overnight stopover",
    openingConflict: "Opening hours conflict with the usable window",
    capacityConflict: "Visits and transit exceed the flexible time",
    noSelection: "Pick from the recommendations below. Order and margins update automatically.",
    suggestedOrder: "Suggested order",
    all: "All",
    add: "Add",
    remove: "Remove",
    replaceHotel: "Change stay",
    duration: "Suggested visit",
    address: "Address",
    hours: "Hours",
    source: "Web source",
    verified: "Web hours",
    unknown: "Check first",
    transportSources: "Airport transit evidence",
    assumptions: "Estimate notes",
    customize: "Adjust recommendations with AI",
    placeholder: "For example, no ramen. Add quiet neighborhoods and jazz bars",
    send: "Send",
    quickFood: "More local small restaurants",
    quickHidden: "More low-key neighborhoods",
    quickNight: "Add nightlife choices",
    live: "GLM 5.2 + live search",
    error: "Recommendation generation failed. Try again.",
    rateLimited: "AI traffic is busy. Automatic retries were exhausted. Try again shortly.",
    searchLimited: "Not enough reliable search results were found for this city. Try again shortly.",
    invalidResponse: "The AI returned an incomplete recommendation format. Try again.",
    chatReady: "The pool is updated. Airport safety margins are unchanged.",
    arrange: "Arrange selected places with AI",
    arranging: "Arranging by address",
    rearrange: "Rearrange",
    routeSummary: "Visit order and transport",
    congestion: "traffic buffer",
    arrangementError: "Could not arrange these places. Try again.",
    disclaimer: "Demo estimates only, not live traffic, venue, immigration, or flight guarantees.",
    risk: { low: "Comfortable margin", medium: "Moderate margin", high: "Tight timing" },
    categories: {
      attraction: "Sights",
      meal: "Food",
      hotel: "Hotels",
      nightlife: "Nightlife",
      shopping: "Shopping",
    },
  },
  ko: {
    eyebrow: "AI 스톱오버 추천",
    title: "안전 여유를 지키고 원하는 곳을 선택하세요",
    close: "노선으로 돌아가기",
    generating: "실시간 추천을 검색하고 정리하는 중",
    regenerate: "다시 생성",
    relaxed: "여유",
    balanced: "보통",
    tight: "타이트",
    pace: "방문 속도",
    flightFacts: "항공편 시간",
    lands: "도착",
    departs: "출발",
    processing: "입국 및 수하물",
    outbound: "도심 이동",
    return: "공항 복귀",
    buffer: "공항 여유",
    rest: "보호된 휴식",
    flexible: "자유 시간",
    safeWindow: "안전한 도심 시간",
    available: "남은 시간",
    chosen: "선택 항목",
    localTransit: "도심 교통",
    feasible: "안전하게 가능한 선택입니다",
    conflict: "현재 조합은 시간이 부족합니다",
    missingHotel: "야간 환승을 위해 숙소 한 곳을 선택하세요",
    openingConflict: "영업시간과 이용 가능 시간이 맞지 않습니다",
    capacityConflict: "방문 및 이동 시간이 여유 시간을 초과합니다",
    noSelection: "아래 추천을 선택하면 순서와 여유 시간이 자동으로 갱신됩니다.",
    suggestedOrder: "추천 순서",
    all: "전체",
    add: "추가",
    remove: "제거",
    replaceHotel: "숙소 변경",
    duration: "추천 체류",
    address: "주소",
    hours: "영업 정보",
    source: "웹 출처",
    verified: "웹 시간",
    unknown: "확인 필요",
    transportSources: "공항 교통 근거",
    assumptions: "예상 기준",
    customize: "AI로 추천 조정",
    placeholder: "예: 라멘은 빼고 조용한 동네와 재즈 바를 추천해 줘",
    send: "보내기",
    quickFood: "현지 소규모 식당 더 보기",
    quickHidden: "한적한 동네 더 보기",
    quickNight: "야간 선택 늘리기",
    live: "GLM 5.2 + 실시간 검색",
    error: "추천 생성에 실패했습니다. 다시 시도해 주세요.",
    rateLimited: "AI 요청이 많아 자동 재시도에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    searchLimited: "이 도시의 신뢰할 수 있는 검색 결과가 부족합니다. 잠시 후 다시 시도해 주세요.",
    invalidResponse: "AI 추천 응답 형식이 완전하지 않습니다. 다시 시도해 주세요.",
    chatReady: "추천을 업데이트했습니다. 공항 안전 여유는 그대로입니다.",
    arrange: "AI로 선택 장소 정렬",
    arranging: "주소를 기준으로 정렬 중",
    rearrange: "다시 정렬",
    routeSummary: "방문 순서와 교통",
    congestion: "혼잡 여유",
    arrangementError: "장소를 정렬하지 못했습니다. 다시 시도하세요.",
    disclaimer: "데모용 추정치이며 실시간 교통, 영업, 입국 또는 항공편을 보장하지 않습니다.",
    risk: { low: "여유 충분", medium: "여유 보통", high: "시간 촉박" },
    categories: {
      attraction: "명소",
      meal: "음식",
      hotel: "호텔",
      nightlife: "야간 활동",
      shopping: "쇼핑",
    },
  },
  ja: {
    eyebrow: "AI 乗り継ぎおすすめ",
    title: "余裕を守って、行きたい場所を選ぶ",
    close: "ルートへ戻る",
    generating: "リアルタイム情報から候補を整理中",
    regenerate: "再生成",
    relaxed: "ゆったり",
    balanced: "標準",
    tight: "タイト",
    pace: "滞在ペース",
    flightFacts: "フライト時刻",
    lands: "到着",
    departs: "出発",
    processing: "入国・手荷物",
    outbound: "市内へ",
    return: "空港へ戻る",
    buffer: "空港の余裕",
    rest: "保護された休息",
    flexible: "自由時間",
    safeWindow: "安全な市内時間",
    available: "残り",
    chosen: "選択済み",
    localTransit: "市内移動",
    feasible: "安全に収まる組み合わせです",
    conflict: "この組み合わせはまだ収まりません",
    missingHotel: "夜をまたぐため宿泊先を一つ選んでください",
    openingConflict: "営業時間と利用可能時間が合いません",
    capacityConflict: "滞在と移動が自由時間を超えています",
    noSelection: "下の候補を選ぶと、順序と余裕時間が自動更新されます。",
    suggestedOrder: "おすすめ順",
    all: "すべて",
    add: "追加",
    remove: "外す",
    replaceHotel: "宿泊先を変更",
    duration: "滞在目安",
    address: "住所",
    hours: "営業時間",
    source: "ウェブ情報源",
    verified: "ウェブ時間",
    unknown: "要確認",
    transportSources: "空港交通の根拠",
    assumptions: "見積もり条件",
    customize: "AIで候補を調整",
    placeholder: "例：ラーメンは避け、静かな街とジャズバーを増やして",
    send: "送信",
    quickFood: "地元の小さな店を増やす",
    quickHidden: "落ち着いた街を増やす",
    quickNight: "夜の選択肢を増やす",
    live: "GLM 5.2 + リアルタイム検索",
    error: "候補の生成に失敗しました。もう一度お試しください。",
    rateLimited: "AIへのアクセスが集中しています。しばらくしてから再度お試しください。",
    searchLimited: "この都市の信頼できる検索結果が不足しています。しばらくしてから再度お試しください。",
    invalidResponse: "AIのおすすめ応答形式が不完全でした。もう一度お試しください。",
    chatReady: "候補を更新しました。空港の安全余裕は変わっていません。",
    arrange: "AIで選択場所を並べる",
    arranging: "住所をもとに整理中",
    rearrange: "並べ直す",
    routeSummary: "訪問順と移動",
    congestion: "混雑余裕",
    arrangementError: "場所を整理できませんでした。もう一度お試しください。",
    disclaimer: "デモ用の目安であり、交通、営業時間、入国、フライトを保証しません。",
    risk: { low: "余裕あり", medium: "標準的", high: "時間がタイト" },
    categories: {
      attraction: "観光",
      meal: "食事",
      hotel: "ホテル",
      nightlife: "ナイトライフ",
      shopping: "買い物",
    },
  },
} as const;

function closestFlight(
  flights: ScheduledFlight[],
  airport: string,
  direction: "arrival" | "departure",
  utc: number,
) {
  const matching = flights.filter((flight) => (
    direction === "arrival" ? flight.to === airport : flight.from === airport
  ));
  return matching.reduce<ScheduledFlight | undefined>((closest, flight) => {
    const flightUtc = direction === "arrival" ? flight.arrivalUtc : flight.departureUtc;
    const closestUtc = closest
      ? direction === "arrival" ? closest.arrivalUtc : closest.departureUtc
      : Number.POSITIVE_INFINITY;
    return Math.abs(flightUtc - utc) < Math.abs(closestUtc - utc) ? flight : closest;
  }, undefined);
}

export function routeToTravelPlanInput(
  route: RankedRouteOption,
  preferences: TravelPreferenceState,
  pace: TravelPace,
  locale: Locale,
  message?: string,
  revisionHistory: string[] = [],
  previousPlan?: TravelRecommendationPlan,
): TravelRecommendationRequest {
  const flights = route.scheduledTickets.flatMap((ticket) => ticket.flights);
  const stopovers = route.scheduledStops
    .filter((stop) => stop.kind === "multi-city")
    .map((stop) => {
      const arrival = closestFlight(flights, stop.airport, "arrival", stop.arrivalUtc);
      const departure = closestFlight(flights, stop.airport, "departure", stop.departureUtc);
      return {
        airport: stop.airport,
        arrival: {
          airlineName: arrival?.airlineName || "",
          flightNumber: arrival?.flightNumber || "",
          airport: stop.airport,
          utc: stop.arrivalUtc,
        },
        departure: {
          airlineName: departure?.airlineName || "",
          flightNumber: departure?.flightNumber || "",
          airport: stop.airport,
          utc: stop.departureUtc,
        },
      };
    });
  return {
    route: {
      id: route.id,
      origin: route.origin,
      destination: route.destination,
      stopovers,
    },
    preferences,
    pace,
    locale,
    message,
    revisionHistory,
    previousPlan,
  };
}

const STORAGE_PREFIX = "via.travel-recommendations.v1";
const STORAGE_VERSION = 2;

function routeSignature(route: RankedRouteOption, preferences: TravelPreferenceState) {
  return JSON.stringify({
    routeId: route.id,
    stops: route.scheduledStops
      .filter((stop) => stop.kind === "multi-city")
      .map((stop) => [stop.airport, stop.arrivalUtc, stop.departureUtc]),
    preferences,
  });
}

function readStoredState(routeId: string, signature: string) {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`${STORAGE_PREFIX}.${routeId}`) || "null",
    ) as {
      version?: number;
      signature?: string;
      pace?: TravelPace;
      plan?: TravelRecommendationPlan;
      turns?: ChatTurn[];
      selected?: SelectedByStopover;
    } | null;
    if (
      value?.version !== STORAGE_VERSION
      || value.signature !== signature
      || value.plan?.version !== 7
      || value.plan.audit?.status !== "passed"
      || !Array.isArray(value.plan.stopovers)
      || !Array.isArray(value.turns)
    ) return null;
    const validSources = new Set(
      value.plan.stopovers.flatMap((stopover) => (
        stopover.recommendations.map((item) => item.id)
      )),
    );
    const selected = Object.fromEntries(
      Object.entries(value.selected || {}).map(([index, ids]) => [
        Number(index),
        Array.isArray(ids) ? ids.filter((id) => validSources.has(id)) : [],
      ]),
    ) as SelectedByStopover;
    return {
      plan: value.plan,
      turns: value.turns.slice(-16),
      selected,
      pace: value.pace === "relaxed" || value.pace === "tight"
        ? value.pace
        : "balanced",
    };
  } catch {
    return null;
  }
}

function formatTime(utc: number, airport: string, locale: Locale) {
  const profile = operationalProfileForAirport(airport);
  const intl = LOCALE_OPTIONS.find((item) => item.code === locale)!.intl;
  return new Intl.DateTimeFormat(intl, {
    timeZone: profile.timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utc));
}

function formatDuration(minutes: number, locale: Locale) {
  const rounded = Math.max(0, Math.round(minutes));
  const days = Math.floor(rounded / 1440);
  const hours = Math.floor((rounded % 1440) / 60);
  const mins = rounded % 60;
  if (locale === "en") return [days && `${days}d`, hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(" ") || "0m";
  if (locale === "ko") return [days && `${days}일`, hours && `${hours}시간`, mins && `${mins}분`].filter(Boolean).join(" ") || "0분";
  if (locale === "ja") return [days && `${days}日`, hours && `${hours}時間`, mins && `${mins}分`].filter(Boolean).join(" ") || "0分";
  return [days && `${days}天`, hours && `${hours}小时`, mins && `${mins}分钟`].filter(Boolean).join(" ") || "0分钟";
}

function statusMessage(
  feasibility: RecommendationSelectionFeasibility,
  locale: Locale,
) {
  const copy = COPY[locale];
  if (feasibility.conflicts.includes("capacity")) return copy.capacityConflict;
  if (feasibility.conflicts.includes("opening-hours")) return copy.openingConflict;
  if (feasibility.conflicts.includes("hotel-required")) return copy.missingHotel;
  return copy.feasible;
}

function travelErrorMessage(caught: unknown, locale: Locale) {
  const copy = COPY[locale];
  const message = caught instanceof Error ? caught.message : "";
  if (/status 429/i.test(message)) return copy.rateLimited;
  if (/live search.*(fewer than|no usable|did not provide)/i.test(message)) {
    return copy.searchLimited;
  }
  if (/invalid JSON|empty response|valid selected-place arrangement/i.test(message)) {
    return copy.invalidResponse;
  }
  return message ? `${copy.error} · ${message}` : copy.error;
}

function RecommendationCard({
  item,
  locale,
  selected,
  hotelAlreadySelected,
  order,
  onToggle,
}: {
  item: TravelRecommendation;
  locale: Locale;
  selected: boolean;
  hotelAlreadySelected: boolean;
  order?: number;
  onToggle: () => void;
}) {
  const copy = COPY[locale];
  const action = selected
    ? copy.remove
    : item.category === "hotel" && hotelAlreadySelected
      ? copy.replaceHotel
      : copy.add;
  return (
    <article className={`ai-rec-card ${selected ? "selected" : ""}`}>
      <div className="ai-rec-card-top">
        <span className={`ai-rec-category ${item.category}`}>
          <i aria-hidden="true">{CATEGORY_ICONS[item.category]}</i>
          {copy.categories[item.category]}
        </span>
        {order && <span className="ai-rec-order">{order}</span>}
      </div>
      <div className="ai-rec-card-body">
        <h3>{item.title}</h3>
        <span className="ai-rec-area">{item.area}</span>
        <span className="ai-rec-address">{copy.address} · {item.address}</span>
        <p>{item.details}</p>
      </div>
      <div className="ai-rec-meta">
        {item.category !== "hotel" && (
          <>
            <span>
              {copy.duration} · {formatDuration(item.suggestedDurationMinutes, locale)}
              {item.visitType ? ` · ${item.visitType}` : ""}
            </span>
            {item.durationRationale && <span>{item.durationRationale}</span>}
            <span className={item.hoursConfidence === "unknown" ? "uncertain" : ""}>
              {item.hoursConfidence === "unknown" ? copy.unknown : copy.verified}
              {" · "}{item.openingHours}
            </span>
          </>
        )}
      </div>
      <footer>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
          {copy.source}<span aria-hidden="true">↗</span>
        </a>
        <button
          type="button"
          className={selected ? "remove" : ""}
          aria-pressed={selected}
          onClick={onToggle}
        >
          <span aria-hidden="true">{selected ? "−" : "+"}</span>{action}
        </button>
      </footer>
    </article>
  );
}

function RecommendationStopover({
  stopover,
  arrivalUtc,
  locale,
  selectedIds,
  arrangement,
  arranging,
  arrangementError,
  onToggle,
  onArrange,
}: {
  stopover: StopoverRecommendationPool;
  arrivalUtc: number;
  locale: Locale;
  selectedIds: string[];
  arrangement?: StopoverSelectionArrangement;
  arranging: boolean;
  arrangementError: string;
  onToggle: (item: TravelRecommendation) => void;
  onArrange: () => void;
}) {
  const copy = COPY[locale];
  const [activeCategory, setActiveCategory] = useState<
    TravelRecommendationCategory | "all"
  >("all");
  const feasibility = useMemo(
    () => evaluateRecommendationSelection(stopover, arrivalUtc, selectedIds),
    [arrivalUtc, selectedIds, stopover],
  );
  const selectedItems = selectedIds
    .map((id) => stopover.recommendations.find((item) => item.id === id))
    .filter((item): item is TravelRecommendation => Boolean(item));
  const selectedHotel = selectedItems.find((item) => item.category === "hotel");
  const orderedIds = arrangement?.orderedRecommendationIds
    || selectedItems.map((item) => item.id);
  const orderById = new Map(orderedIds.map((id, index) => [id, index + 1]));
  const availableCategories = CATEGORY_ORDER.filter((category) => (
    stopover.recommendations.some((item) => item.category === category)
  ));
  const visibleRecommendations = activeCategory === "all"
    ? stopover.recommendations
    : stopover.recommendations.filter((item) => item.category === activeCategory);
  const consumed = feasibility.selectedMinutes + feasibility.localTransitMinutes;
  const fill = stopover.safety.flexibleMinutes
    ? Math.min(100, consumed / stopover.safety.flexibleMinutes * 100)
    : 100;
  const itemTime = (offset: number) => formatTime(
    arrivalUtc + offset * 60_000,
    stopover.airport,
    locale,
  );

  return (
    <section className="ai-stopover-card ai-recommendation-stopover">
      <header className="ai-stopover-heading">
        <div>
          <span>{stopover.airport}</span>
          <h2>{airportCity(stopover.airport, locale)}</h2>
          <p>{stopover.summary}</p>
        </div>
        <span className={`ai-risk ${stopover.riskLevel}`}>{copy.risk[stopover.riskLevel]}</span>
      </header>

      <div className="ai-time-guardrails ai-safety-budget" aria-label={copy.safeWindow}>
        <div><span>{copy.processing}</span><strong>{formatDuration(stopover.safety.arrivalProcessingMinutes, locale)}</strong></div>
        <div><span>{copy.outbound}</span><strong>{formatDuration(stopover.safety.outboundTransitMinutes, locale)}</strong></div>
        {stopover.safety.protectedRestMinutes > 0 && (
          <div><span>{copy.rest}</span><strong>{formatDuration(stopover.safety.protectedRestMinutes, locale)}</strong></div>
        )}
        <div className="usable">
          <span>{copy.safeWindow}</span>
          <strong>
            {itemTime(stopover.safety.cityWindowStartOffsetMinutes)}
            {" — "}
            {itemTime(stopover.safety.cityWindowEndOffsetMinutes)}
          </strong>
        </div>
        <div><span>{copy.return}</span><strong>{formatDuration(stopover.safety.returnTransitMinutes, locale)}</strong></div>
        <div><span>{copy.buffer}</span><strong>{formatDuration(stopover.safety.airportBufferMinutes, locale)}</strong></div>
      </div>

      <section className={`ai-selection-budget ${feasibility.status}`}>
        <div className="ai-budget-heading">
          <div>
            <span>{copy.flexible}</span>
            <strong>{formatDuration(stopover.safety.flexibleMinutes, locale)}</strong>
          </div>
          <div>
            <span>{copy.available}</span>
            <strong>{formatDuration(feasibility.remainingMinutes, locale)}</strong>
          </div>
        </div>
        <div className="ai-budget-track" aria-hidden="true">
          <i style={{ width: `${fill}%` }} />
        </div>
        <div className="ai-budget-breakdown">
          <span>{copy.chosen} · {formatDuration(feasibility.selectedMinutes, locale)}</span>
          <span>{copy.localTransit} · {formatDuration(feasibility.localTransitMinutes, locale)}</span>
        </div>
        <p className="ai-feasibility-message">
          <i aria-hidden="true">{feasibility.status === "feasible" ? "✓" : "!"}</i>
          {statusMessage(feasibility, locale)}
        </p>
      </section>

      <section className="ai-selection-summary">
        <div className="ai-selection-summary-heading">
          <span>{arrangement ? copy.routeSummary : copy.suggestedOrder}</span>
          {selectedItems.length > 0 && (
            <button type="button" disabled={arranging} onClick={onArrange}>
              {arranging ? copy.arranging : arrangement ? copy.rearrange : copy.arrange}
            </button>
          )}
        </div>
        {arrangement ? (
          <ol className="ai-arranged-order">
            {orderedIds.map((id, index) => {
              const item = selectedItems.find((candidate) => candidate.id === id);
              const leg = arrangement.legs[index];
              if (!item) return null;
              return (
                <li key={id}>
                  <div className="ai-arranged-place">
                    <i aria-hidden="true">{index + 1}</i>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.address} · {formatDuration(item.suggestedDurationMinutes, locale)}</small>
                    </span>
                  </div>
                  {leg && (
                    <div className="ai-arranged-leg">
                      <span aria-hidden="true">↓</span>
                      <p>
                        <strong>{leg.mode} · {formatDuration(leg.estimatedMinutes, locale)}</strong>
                        <small>
                          {copy.congestion} {formatDuration(leg.congestionBufferMinutes, locale)}
                          {leg.details ? ` · ${leg.details}` : ""}
                        </small>
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : selectedItems.length ? (
          <ol>
            {orderedIds.map((id) => {
              const item = selectedItems.find((candidate) => candidate.id === id);
              return item ? <li key={id}>{item.title}</li> : null;
            })}
          </ol>
        ) : <p>{copy.noSelection}</p>}
        {arrangement?.summary && <p className="ai-arrangement-summary">{arrangement.summary}</p>}
        {arrangementError && <p className="ai-arrangement-error">{arrangementError}</p>}
      </section>

      <nav className="ai-rec-tabs" aria-label={copy.all}>
        <button
          type="button"
          className={activeCategory === "all" ? "active" : ""}
          aria-pressed={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
        >
          {copy.all}<span>{stopover.recommendations.length}</span>
        </button>
        {availableCategories.map((category) => (
          <button
            type="button"
            key={category}
            className={activeCategory === category ? "active" : ""}
            aria-pressed={activeCategory === category}
            onClick={() => setActiveCategory(category)}
          >
            {copy.categories[category]}
            <span>{stopover.recommendations.filter((item) => item.category === category).length}</span>
          </button>
        ))}
      </nav>

      <div className="ai-rec-grid">
        {visibleRecommendations.map((item) => (
          <RecommendationCard
            key={item.id}
            item={item}
            locale={locale}
            selected={selectedIds.includes(item.id)}
            hotelAlreadySelected={Boolean(selectedHotel)}
            order={orderById.get(item.id)}
            onToggle={() => onToggle(item)}
          />
        ))}
      </div>

      <div className="ai-plan-notes ai-recommendation-notes">
        <div>
          <span>{copy.transportSources}</span>
          <strong>{stopover.outboundTransitMode} · {stopover.returnTransitMode}</strong>
          <span className="ai-source-pair">
            <a href={stopover.outboundTransitSourceUrl} target="_blank" rel="noreferrer">
              {copy.outbound} ↗
            </a>
            <a href={stopover.returnTransitSourceUrl} target="_blank" rel="noreferrer">
              {copy.return} ↗
            </a>
          </span>
        </div>
        {stopover.assumptions.length > 0 && (
          <details>
            <summary>{copy.assumptions}</summary>
            <ul>{stopover.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
          </details>
        )}
      </div>
    </section>
  );
}

export default function AITravelWorkspace({
  route,
  locale,
  preferences,
  originRect,
  onClose,
}: WorkspaceProps) {
  const copy = COPY[locale];
  const rootRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [pace, setPace] = useState<TravelPace>("balanced");
  const [plan, setPlan] = useState<TravelRecommendationPlan | null>(null);
  const [selectedByStopover, setSelectedByStopover] = useState<SelectedByStopover>({});
  const [arrangementsByStopover, setArrangementsByStopover] = useState<
    Record<number, StopoverSelectionArrangement>
  >({});
  const [arrangingStopover, setArrangingStopover] = useState<number | null>(null);
  const [arrangementErrors, setArrangementErrors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const requestCounter = useRef(0);
  const arrangementRequestCounter = useRef(0);
  const signature = useMemo(
    () => routeSignature(route, preferences),
    [preferences, route],
  );

  const requestPlan = useCallback(async (
    nextPace: TravelPace,
    revision?: string,
    previousPlan?: TravelRecommendationPlan,
    revisionHistory: string[] = [],
  ) => {
    const requestId = ++requestCounter.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/travel-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(routeToTravelPlanInput(
          route,
          preferences,
          nextPace,
          locale,
          revision,
          revisionHistory,
          previousPlan,
        )),
      });
      const payload = await response.json() as {
        plan?: TravelRecommendationPlan;
        error?: string;
      };
      if (!response.ok || !payload.plan) throw new Error(payload.error || copy.error);
      if (requestId !== requestCounter.current) return;
      const nextPlan = payload.plan;
      setPlan(nextPlan);
      setArrangementsByStopover({});
      setArrangementErrors({});
      setSelectedByStopover((current) => Object.fromEntries(
        nextPlan.stopovers.map((stopover, index) => {
          const validIds = new Set(stopover.recommendations.map((item) => item.id));
          return [index, (current[index] || []).filter((id) => validIds.has(id))];
        }),
      ));
      if (revision) {
        setTurns((current) => [
          ...current,
          { id: Date.now(), role: "user", text: revision },
          {
            id: Date.now() + 1,
            role: "assistant",
            text: nextPlan.revisionMessage || copy.chatReady,
          },
        ]);
      }
    } catch (caught) {
      if (requestId !== requestCounter.current) return;
      setError(travelErrorMessage(caught, locale));
      if (revision) setMessage(revision);
    } finally {
      if (requestId === requestCounter.current) setLoading(false);
    }
  }, [copy.chatReady, copy.error, locale, preferences, route]);

  useEffect(() => {
    const stored = readStoredState(route.id, signature);
    if (stored) {
      requestCounter.current += 1;
      setPlan(stored.plan);
      setTurns(stored.turns);
      setSelectedByStopover(stored.selected);
      setPace(stored.pace as TravelPace);
      setError("");
      setLoading(false);
      return;
    }
    void requestPlan("balanced");
  }, [requestPlan, route.id, signature]);

  useEffect(() => {
    if (!plan || loading) return;
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}.${route.id}`, JSON.stringify({
        version: STORAGE_VERSION,
        signature,
        pace,
        plan,
        turns: turns.slice(-16),
        selected: selectedByStopover,
      }));
    } catch {
      // Private browsing or storage limits must not block the planner.
    }
  }, [loading, pace, plan, route.id, selectedByStopover, signature, turns]);

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element || !originRect) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scaleX = Math.max(0.12, originRect.width / window.innerWidth);
    const scaleY = Math.max(0.08, originRect.height / window.innerHeight);
    element.animate(
      [
        {
          opacity: 0.65,
          borderRadius: "24px",
          transform: `translate3d(${originRect.left}px, ${originRect.top}px, 0) scale(${scaleX}, ${scaleY})`,
        },
        { opacity: 1, borderRadius: "0px", transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [originRect]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => (
      rootRef.current?.querySelector<HTMLElement>("button")?.focus()
    ));
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, []);

  const close = useCallback(() => {
    const element = rootRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!element || !originRect || reduceMotion) {
      onClose();
      return;
    }
    const scaleX = Math.max(0.12, originRect.width / window.innerWidth);
    const scaleY = Math.max(0.08, originRect.height / window.innerHeight);
    const animation = element.animate(
      [
        { opacity: 1, borderRadius: "0px", transform: "translate3d(0, 0, 0) scale(1)" },
        {
          opacity: 0,
          borderRadius: "24px",
          transform: `translate3d(${originRect.left}px, ${originRect.top}px, 0) scale(${scaleX}, ${scaleY})`,
        },
      ],
      { duration: 360, easing: "cubic-bezier(0.4, 0, 1, 1)" },
    );
    animation.onfinish = onClose;
  }, [onClose, originRect]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [close]);

  const multiStops = useMemo(
    () => route.scheduledStops.filter((stop) => stop.kind === "multi-city"),
    [route.scheduledStops],
  );

  function changePace(nextPace: TravelPace) {
    if (nextPace === pace || loading) return;
    setPace(nextPace);
    const history = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
    void requestPlan(nextPace, undefined, plan || undefined, history);
  }

  function submitRevision(revision: string) {
    const trimmed = revision.trim();
    if (!trimmed || loading) return;
    const history = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
    setMessage("");
    void requestPlan(pace, trimmed, plan || undefined, history);
  }

  async function requestArrangement(stopoverIndex: number) {
    const selected = selectedByStopover[stopoverIndex] || [];
    if (!plan || !selected.length || arrangingStopover !== null) return;
    const requestId = ++arrangementRequestCounter.current;
    setArrangingStopover(stopoverIndex);
    setArrangementErrors((current) => ({ ...current, [stopoverIndex]: "" }));
    try {
      const routeInput = routeToTravelPlanInput(route, preferences, pace, locale);
      const response = await fetch("/api/travel-plan/arrange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: routeInput.route,
          pace,
          locale,
          plan,
          selectedByStopover: { [stopoverIndex]: selected },
        }),
      });
      const payload = await response.json() as {
        arrangement?: { stopovers: StopoverSelectionArrangement[] };
        error?: string;
      };
      const arrangement = payload.arrangement?.stopovers.find(
        (item) => item.airport === plan.stopovers[stopoverIndex]?.airport,
      );
      if (!response.ok || !arrangement) {
        throw new Error(payload.error || copy.arrangementError);
      }
      if (requestId !== arrangementRequestCounter.current) return;
      setArrangementsByStopover((current) => ({
        ...current,
        [stopoverIndex]: arrangement,
      }));
    } catch {
      if (requestId !== arrangementRequestCounter.current) return;
      setArrangementErrors((current) => ({
        ...current,
        [stopoverIndex]: copy.arrangementError,
      }));
    } finally {
      if (requestId === arrangementRequestCounter.current) {
        setArrangingStopover(null);
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitRevision(message);
  }

  function toggleRecommendation(stopoverIndex: number, item: TravelRecommendation) {
    arrangementRequestCounter.current += 1;
    setArrangingStopover(null);
    setArrangementsByStopover((current) => {
      const next = { ...current };
      delete next[stopoverIndex];
      return next;
    });
    setArrangementErrors((current) => ({ ...current, [stopoverIndex]: "" }));
    setSelectedByStopover((current) => {
      const selected = current[stopoverIndex] || [];
      if (selected.includes(item.id)) {
        return {
          ...current,
          [stopoverIndex]: toggleRecommendationSelection(
            plan?.stopovers[stopoverIndex]?.recommendations || [],
            selected,
            item.id,
          ),
        };
      }
      const stopover = plan?.stopovers[stopoverIndex];
      return {
        ...current,
        [stopoverIndex]: toggleRecommendationSelection(
          stopover?.recommendations || [],
          selected,
          item.id,
        ),
      };
    });
  }

  return (
    <section
      className="ai-workspace"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <header className="ai-workspace-header">
        <button className="ai-back-button" type="button" onClick={close}>
          <span aria-hidden="true">←</span>{copy.close}
        </button>
        <div className="ai-workspace-title">
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
        </div>
        <span className="ai-provider-badge live">
          <i aria-hidden="true" />{copy.live}
        </span>
      </header>

      <div className="ai-workspace-scroll">
        <section className="ai-selected-route">
          <div className="ai-route-line">
            <strong>{route.origin}</strong>
            {route.hubs.map((hub) => (
              <span key={hub}><i aria-hidden="true">→</i><strong>{hub}</strong></span>
            ))}
            <span><i aria-hidden="true">→</i><strong>{route.destination}</strong></span>
          </div>
          <div className="ai-flight-facts">
            <span>{copy.flightFacts}</span>
            {multiStops.map((stop) => (
              <div key={`${stop.airport}-${stop.arrivalUtc}`}>
                <strong>{airportCity(stop.airport, locale)}</strong>
                <small>{copy.lands} {formatTime(stop.arrivalUtc, stop.airport, locale)}</small>
                <i aria-hidden="true">→</i>
                <small>{copy.departs} {formatTime(stop.departureUtc, stop.airport, locale)}</small>
              </div>
            ))}
          </div>
        </section>

        <nav className="ai-pace-control" aria-label={copy.pace}>
          <span>{copy.pace}</span>
          <div>
            {(["relaxed", "balanced", "tight"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={pace === value ? "active" : ""}
                aria-pressed={pace === value}
                disabled={loading}
                onClick={() => changePace(value)}
              >
                {copy[value]}
              </button>
            ))}
          </div>
        </nav>

        <div
          className={`ai-plan-stage ${loading ? "loading" : ""}`}
          aria-live="polite"
          aria-busy={loading}
        >
          {loading && (
            <div className="ai-plan-loading">
              <span aria-hidden="true"><i /><i /><i /></span>
              <p>{copy.generating}</p>
            </div>
          )}
          {error && !loading && (
            <div className="ai-plan-error">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void requestPlan(
                  pace,
                  undefined,
                  plan || undefined,
                  turns.filter((turn) => turn.role === "user").map((turn) => turn.text),
                )}
              >
                {copy.regenerate}
              </button>
            </div>
          )}
          {plan && (
            <div className="ai-generated-plan ai-recommendation-plan">
              <p className="ai-plan-summary">{plan.summary}</p>
              {plan.stopovers.map((stopover, index) => (
                <RecommendationStopover
                  key={`${stopover.airport}-${index}`}
                  stopover={stopover}
                  arrivalUtc={multiStops[index]?.arrivalUtc || Date.now()}
                  locale={locale}
                  selectedIds={selectedByStopover[index] || []}
                  arrangement={arrangementsByStopover[index]}
                  arranging={arrangingStopover === index}
                  arrangementError={arrangementErrors[index] || ""}
                  onToggle={(item) => toggleRecommendation(index, item)}
                  onArrange={() => void requestArrangement(index)}
                />
              ))}
            </div>
          )}
        </div>

        <p className="ai-disclaimer">{plan?.disclaimer || copy.disclaimer}</p>
        <div className="ai-chat-clearance" aria-hidden="true" />
      </div>

      <aside className="ai-chat-sheet">
        <div className="ai-chat-handle" aria-hidden="true" />
        <div className="ai-chat-heading">
          <span aria-hidden="true">✦</span>
          <strong>{copy.customize}</strong>
        </div>
        {turns.length > 0 && (
          <div className="ai-chat-turns" aria-live="polite">
            {turns.slice(-8).map((turn) => (
              <p className={turn.role} key={turn.id}>{turn.text}</p>
            ))}
          </div>
        )}
        <div className="ai-quick-prompts">
          {[copy.quickFood, copy.quickHidden, copy.quickNight].map((prompt) => (
            <button
              type="button"
              key={prompt}
              disabled={loading}
              onClick={() => submitRevision(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <form className="ai-chat-form" onSubmit={handleSubmit}>
          <input
            value={message}
            disabled={loading}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={copy.placeholder}
            aria-label={copy.customize}
          />
          <button type="submit" disabled={loading || !message.trim()}>
            <span>{copy.send}</span><i aria-hidden="true">↑</i>
          </button>
        </form>
      </aside>
    </section>
  );
}
