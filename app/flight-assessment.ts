import type { RankedRouteOption } from "./flight-schedules.ts";
import type { Locale } from "./i18n.ts";

export type FlightAssessmentFactType =
  | "lowest-price"
  | "shortest-duration"
  | "nonstop"
  | "highest-directness"
  | "sightseeing-time"
  | "highest-interest"
  | "price-score"
  | "duration-score"
  | "directness-score"
  | "interest-score"
  | "self-transfer"
  | "very-long-stopover"
  | "long-stopover"
  | "highest-price"
  | "longest-duration"
  | "low-directness"
  | "connection-count"
  | "total-duration";

export type FlightAssessmentFact = {
  id: string;
  type: FlightAssessmentFactType;
  value?: number;
  comparisonValue?: number;
  airport?: string;
};

export type FlightAssessmentRouteInput = {
  routeId: string;
  ticketType: "direct" | "connection" | "multi-city";
  totalPrice: number;
  totalDurationMinutes: number;
  stopCount: number;
  priceScore: number;
  durationScore: number;
  directnessScore: number;
  interestScore: number;
  stops: Array<{
    airport: string;
    kind: "connection" | "multi-city";
    durationMinutes: number;
    usableMinutes: number;
  }>;
};

export type FlightAssessmentCandidate = {
  routeId: string;
  pros: FlightAssessmentFact[];
  cons: FlightAssessmentFact[];
};

export type FlightAssessmentSelection = {
  routeId: string;
  proId: string;
  conId: string;
  generatedBy: "ai" | "rules";
};

type AssessmentView = {
  title: string;
  proLabel: string;
  conLabel: string;
  pro: string;
  con: string;
  verdict: string;
};

const FACT_TYPES = new Set<FlightAssessmentFactType>([
  "lowest-price",
  "shortest-duration",
  "nonstop",
  "highest-directness",
  "sightseeing-time",
  "highest-interest",
  "price-score",
  "duration-score",
  "directness-score",
  "interest-score",
  "self-transfer",
  "very-long-stopover",
  "long-stopover",
  "highest-price",
  "longest-duration",
  "low-directness",
  "connection-count",
  "total-duration",
]);

function finiteNumber(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : 0;
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximumLength)
    : "";
}

export function sanitizeFlightAssessmentRoutes(value: unknown): FlightAssessmentRouteInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 80).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<FlightAssessmentRouteInput>;
    const routeId = cleanText(candidate.routeId, 120);
    if (!routeId || seen.has(routeId)) return [];
    seen.add(routeId);
    const ticketType = candidate.ticketType === "direct"
      || candidate.ticketType === "multi-city"
      ? candidate.ticketType
      : "connection";
    return [{
      routeId,
      ticketType,
      totalPrice: finiteNumber(candidate.totalPrice, 0, 1_000_000),
      totalDurationMinutes: finiteNumber(candidate.totalDurationMinutes, 0, 100_000),
      stopCount: Math.round(finiteNumber(candidate.stopCount, 0, 20)),
      priceScore: finiteNumber(candidate.priceScore, 0, 100),
      durationScore: finiteNumber(candidate.durationScore, 0, 100),
      directnessScore: finiteNumber(candidate.directnessScore, 0, 100),
      interestScore: finiteNumber(candidate.interestScore, 0, 100),
      stops: Array.isArray(candidate.stops)
        ? candidate.stops.slice(0, 10).flatMap((stop) => {
          if (!stop || typeof stop !== "object") return [];
          return [{
            airport: cleanText(stop.airport, 8).toUpperCase(),
            kind: stop.kind === "multi-city" ? "multi-city" as const : "connection" as const,
            durationMinutes: finiteNumber(stop.durationMinutes, 0, 100_000),
            usableMinutes: finiteNumber(stop.usableMinutes, 0, 100_000),
          }];
        })
        : [],
    }];
  });
}

export function flightAssessmentRouteInput(
  route: RankedRouteOption,
): FlightAssessmentRouteInput {
  return {
    routeId: route.id,
    ticketType: route.ticketType,
    totalPrice: route.total,
    totalDurationMinutes: route.totalDurationMinutes,
    stopCount: route.stopCount,
    priceScore: route.scores.price,
    durationScore: route.scores.duration,
    directnessScore: route.scores.directness,
    interestScore: route.scores.interest,
    stops: route.scheduledStops.map((stop) => ({
      airport: stop.airport,
      kind: stop.kind,
      durationMinutes: stop.durationMinutes,
      usableMinutes: stop.usableMinutes,
    })),
  };
}

function fact(
  routeId: string,
  side: "pro" | "con",
  type: FlightAssessmentFactType,
  details: Omit<FlightAssessmentFact, "id" | "type"> = {},
): FlightAssessmentFact {
  return { id: `${routeId}:${side}:${type}`, type, ...details };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function fallbackPro(route: FlightAssessmentRouteInput) {
  const scores = [
    { type: "price-score" as const, value: route.priceScore },
    { type: "duration-score" as const, value: route.durationScore },
    { type: "directness-score" as const, value: route.directnessScore },
    { type: "interest-score" as const, value: route.interestScore },
  ].sort((left, right) => right.value - left.value);
  return fact(route.routeId, "pro", scores[0].type, { value: scores[0].value });
}

export function buildFlightAssessmentCandidates(
  routes: FlightAssessmentRouteInput[],
): FlightAssessmentCandidate[] {
  if (!routes.length) return [];
  const prices = routes.map((route) => route.totalPrice);
  const durations = routes.map((route) => route.totalDurationMinutes);
  const directnessScores = routes.map((route) => route.directnessScore);
  const interestScores = routes.map((route) => route.interestScore);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const durationMin = Math.min(...durations);
  const durationMax = Math.max(...durations);
  const directnessMax = Math.max(...directnessScores);
  const interestMax = Math.max(...interestScores);
  const priceMedian = median(prices);
  const durationMedian = median(durations);

  return routes.map((route) => {
    const pros: FlightAssessmentFact[] = [];
    const cons: FlightAssessmentFact[] = [];
    const multiCityStops = route.stops.filter((stop) => stop.kind === "multi-city");
    const longestMultiCityStop = multiCityStops.sort(
      (left, right) => right.durationMinutes - left.durationMinutes,
    )[0];
    const bestSightseeingStop = [...multiCityStops].sort(
      (left, right) => right.usableMinutes - left.usableMinutes,
    )[0];

    if (route.totalPrice <= priceMin + 0.01) {
      pros.push(fact(route.routeId, "pro", "lowest-price", { value: route.totalPrice }));
    } else if (route.totalPrice <= priceMedian) {
      pros.push(fact(route.routeId, "pro", "price-score", { value: route.priceScore }));
    }
    if (route.totalDurationMinutes <= durationMin + 0.5) {
      pros.push(fact(route.routeId, "pro", "shortest-duration", { value: route.totalDurationMinutes }));
    } else if (route.totalDurationMinutes <= durationMedian) {
      pros.push(fact(route.routeId, "pro", "duration-score", { value: route.durationScore }));
    }
    if (route.ticketType === "direct") {
      pros.push(fact(route.routeId, "pro", "nonstop"));
    }
    if (route.directnessScore >= directnessMax - 0.5) {
      pros.push(fact(route.routeId, "pro", "highest-directness", { value: route.directnessScore }));
    }
    if (bestSightseeingStop?.usableMinutes >= 4 * 60) {
      pros.push(fact(route.routeId, "pro", "sightseeing-time", {
        value: bestSightseeingStop.usableMinutes,
        airport: bestSightseeingStop.airport,
      }));
    }
    if (route.stops.length && route.interestScore >= interestMax - 0.5) {
      pros.push(fact(route.routeId, "pro", "highest-interest", { value: route.interestScore }));
    }
    if (!pros.length) pros.push(fallbackPro(route));

    if (route.ticketType === "multi-city") {
      cons.push(fact(route.routeId, "con", "self-transfer"));
    }
    if (longestMultiCityStop?.durationMinutes >= 6 * 1440) {
      cons.push(fact(route.routeId, "con", "very-long-stopover", {
        value: longestMultiCityStop.durationMinutes,
        airport: longestMultiCityStop.airport,
      }));
    } else if (longestMultiCityStop?.durationMinutes >= 3 * 1440) {
      cons.push(fact(route.routeId, "con", "long-stopover", {
        value: longestMultiCityStop.durationMinutes,
        airport: longestMultiCityStop.airport,
      }));
    }
    if (routes.length > 1 && priceMax > priceMin && route.totalPrice >= priceMax - 0.01) {
      cons.push(fact(route.routeId, "con", "highest-price", {
        value: route.totalPrice,
        comparisonValue: route.totalPrice - priceMin,
      }));
    }
    if (routes.length > 1 && durationMax > durationMin && route.totalDurationMinutes >= durationMax - 0.5) {
      cons.push(fact(route.routeId, "con", "longest-duration", {
        value: route.totalDurationMinutes,
        comparisonValue: route.totalDurationMinutes - durationMin,
      }));
    }
    if (route.directnessScore < 50) {
      cons.push(fact(route.routeId, "con", "low-directness", { value: route.directnessScore }));
    }
    if (route.stopCount > 0) {
      cons.push(fact(route.routeId, "con", "connection-count", { value: route.stopCount }));
    }
    if (!cons.length) {
      cons.push(fact(route.routeId, "con", "total-duration", { value: route.totalDurationMinutes }));
    }

    return { routeId: route.routeId, pros, cons };
  });
}

export function fallbackFlightAssessments(
  candidates: FlightAssessmentCandidate[],
): FlightAssessmentSelection[] {
  return candidates.map((candidate) => ({
    routeId: candidate.routeId,
    proId: candidate.pros[0].id,
    conId: candidate.cons[0].id,
    generatedBy: "rules",
  }));
}

export function normalizeModelFlightAssessments(
  value: unknown,
  candidates: FlightAssessmentCandidate[],
): FlightAssessmentSelection[] {
  const raw = Array.isArray(value) ? value : [];
  const byRoute = new Map<string, { proId: string; conId: string }>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const routeId = cleanText(candidate.routeId, 120);
    const proId = cleanText(candidate.proId, 180);
    const conId = cleanText(candidate.conId, 180);
    byRoute.set(routeId, { proId, conId });
  }
  return candidates.map((candidate) => {
    const selected = byRoute.get(candidate.routeId);
    const proValid = candidate.pros.some((item) => item.id === selected?.proId);
    const conValid = candidate.cons.some((item) => item.id === selected?.conId);
    return proValid && conValid
      ? {
        routeId: candidate.routeId,
        proId: selected!.proId,
        conId: selected!.conId,
        generatedBy: "ai" as const,
      }
      : fallbackFlightAssessments([candidate])[0];
  });
}

export function parseFlightAssessmentResponse(
  value: unknown,
  candidates: FlightAssessmentCandidate[],
): FlightAssessmentSelection[] {
  if (!Array.isArray(value)) return fallbackFlightAssessments(candidates);
  const sourceByRoute = new Map(value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<FlightAssessmentSelection>;
    return [[cleanText(candidate.routeId, 120), candidate.generatedBy === "ai" ? "ai" as const : "rules" as const]];
  }));
  return normalizeModelFlightAssessments(value, candidates).map((item) => ({
    ...item,
    generatedBy: sourceByRoute.get(item.routeId) === "ai" && item.generatedBy === "ai"
      ? "ai"
      : "rules",
  }));
}

function durationText(minutes: number, locale: Locale) {
  const rounded = Math.max(0, Math.round(minutes));
  const days = Math.floor(rounded / 1440);
  const hours = Math.floor((rounded % 1440) / 60);
  const remainingMinutes = rounded % 60;
  if (locale === "zh") return [days && `${days}天`, hours && `${hours}小时`, remainingMinutes && `${remainingMinutes}分钟`].filter(Boolean).join(" ") || "0分钟";
  if (locale === "ko") return [days && `${days}일`, hours && `${hours}시간`, remainingMinutes && `${remainingMinutes}분`].filter(Boolean).join(" ") || "0분";
  if (locale === "ja") return [days && `${days}日`, hours && `${hours}時間`, remainingMinutes && `${remainingMinutes}分`].filter(Boolean).join(" ") || "0分";
  return [days && `${days}d`, hours && `${hours}h`, remainingMinutes && `${remainingMinutes}m`].filter(Boolean).join(" ") || "0m";
}

function moneyText(value: number, locale: Locale) {
  const intl = locale === "zh" ? "zh-CN" : locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : "en-US";
  return `$${Math.max(0, value).toLocaleString(intl, { maximumFractionDigits: 2 })}`;
}

function factText(item: FlightAssessmentFact, locale: Locale) {
  const value = item.value ?? 0;
  const comparison = item.comparisonValue ?? 0;
  const airport = item.airport || "";
  const copy: Record<Locale, Record<FlightAssessmentFactType, string>> = {
    zh: {
      "lowest-price": `本组价格最低，为 ${moneyText(value, locale)}`,
      "shortest-duration": `本组总行程最短，为 ${durationText(value, locale)}`,
      nonstop: "全程直飞，不需要中转",
      "highest-directness": `本组直达性最高，为 ${Math.round(value)} 分`,
      "sightseeing-time": `${airport} 约有 ${durationText(value, locale)} 可用于游览`,
      "highest-interest": `本组兴趣度最高，为 ${Math.round(value)} 分`,
      "price-score": `价格竞争力是相对优势，得分 ${Math.round(value)}`,
      "duration-score": `行程时长是相对优势，得分 ${Math.round(value)}`,
      "directness-score": `直达性是相对优势，得分 ${Math.round(value)}`,
      "interest-score": `兴趣度是相对优势，得分 ${Math.round(value)}`,
      "self-transfer": "分开出票，需要自行中转并重新处理行李",
      "very-long-stopover": `${airport} 停留 ${durationText(value, locale)}，明显过长`,
      "long-stopover": `${airport} 停留 ${durationText(value, locale)}，行程较长`,
      "highest-price": `本组价格最高，为 ${moneyText(value, locale)}，比最低价高 ${moneyText(comparison, locale)}`,
      "longest-duration": `本组总行程最长，为 ${durationText(value, locale)}，比最短行程多 ${durationText(comparison, locale)}`,
      "low-directness": `直达性只有 ${Math.round(value)} 分`,
      "connection-count": `全程共有 ${Math.round(value)} 次停留或中转`,
      "total-duration": `总行程需要 ${durationText(value, locale)}`,
    },
    en: {
      "lowest-price": `Lowest price in this set at ${moneyText(value, locale)}`,
      "shortest-duration": `Shortest total journey in this set at ${durationText(value, locale)}`,
      nonstop: "Nonstop, with no connection",
      "highest-directness": `Highest directness in this set at ${Math.round(value)}`,
      "sightseeing-time": `About ${durationText(value, locale)} of usable sightseeing time in ${airport}`,
      "highest-interest": `Highest interest score in this set at ${Math.round(value)}`,
      "price-score": `Price is its relative strength, scoring ${Math.round(value)}`,
      "duration-score": `Journey time is its relative strength, scoring ${Math.round(value)}`,
      "directness-score": `Directness is its relative strength, scoring ${Math.round(value)}`,
      "interest-score": `Interest is its relative strength, scoring ${Math.round(value)}`,
      "self-transfer": "Separate tickets require a self-transfer and baggage recheck",
      "very-long-stopover": `The ${durationText(value, locale)} stop in ${airport} is excessively long`,
      "long-stopover": `The ${durationText(value, locale)} stop in ${airport} makes this a long trip`,
      "highest-price": `Highest price in this set at ${moneyText(value, locale)}, ${moneyText(comparison, locale)} above the lowest`,
      "longest-duration": `Longest journey in this set at ${durationText(value, locale)}, ${durationText(comparison, locale)} longer than the shortest`,
      "low-directness": `Directness is only ${Math.round(value)}`,
      "connection-count": `${Math.round(value)} stop${Math.round(value) === 1 ? "" : "s"} or connection${Math.round(value) === 1 ? "" : "s"} overall`,
      "total-duration": `The total journey takes ${durationText(value, locale)}`,
    },
    ko: {
      "lowest-price": `비교 항공편 중 최저가인 ${moneyText(value, locale)}`,
      "shortest-duration": `비교 항공편 중 가장 짧은 총 ${durationText(value, locale)} 여정`,
      nonstop: "환승이 없는 직항편",
      "highest-directness": `비교 항공편 중 가장 높은 직항 우선도 ${Math.round(value)}점`,
      "sightseeing-time": `${airport}에서 약 ${durationText(value, locale)} 동안 관광 가능`,
      "highest-interest": `비교 항공편 중 가장 높은 흥미도 ${Math.round(value)}점`,
      "price-score": `가격 경쟁력이 상대적 강점이며 ${Math.round(value)}점`,
      "duration-score": `여정 시간이 상대적 강점이며 ${Math.round(value)}점`,
      "directness-score": `직항 우선도가 상대적 강점이며 ${Math.round(value)}점`,
      "interest-score": `흥미도가 상대적 강점이며 ${Math.round(value)}점`,
      "self-transfer": "별도 항공권이라 자가 환승과 수하물 재위탁 필요",
      "very-long-stopover": `${airport}에서 ${durationText(value, locale)} 동안 머물러 지나치게 긴 일정`,
      "long-stopover": `${airport}에서 ${durationText(value, locale)} 동안 머무는 긴 일정`,
      "highest-price": `비교 항공편 중 최고가인 ${moneyText(value, locale)}, 최저가보다 ${moneyText(comparison, locale)} 높음`,
      "longest-duration": `비교 항공편 중 가장 긴 총 ${durationText(value, locale)} 여정, 최단 여정보다 ${durationText(comparison, locale)} 더 소요`,
      "low-directness": `직항 우선도가 ${Math.round(value)}점에 불과함`,
      "connection-count": `전체 일정에 정차 또는 환승 ${Math.round(value)}회 포함`,
      "total-duration": `총 여정 시간이 ${durationText(value, locale)}`,
    },
    ja: {
      "lowest-price": `比較対象で最安の${moneyText(value, locale)}`,
      "shortest-duration": `比較対象で最短の総所要時間${durationText(value, locale)}`,
      nonstop: "乗り継ぎのない直行便",
      "highest-directness": `比較対象で最高の直行性スコア${Math.round(value)}点`,
      "sightseeing-time": `${airport}で約${durationText(value, locale)}の観光時間`,
      "highest-interest": `比較対象で最高の興味度${Math.round(value)}点`,
      "price-score": `価格競争力が相対的な強みで${Math.round(value)}点`,
      "duration-score": `所要時間が相対的な強みで${Math.round(value)}点`,
      "directness-score": `直行性が相対的な強みで${Math.round(value)}点`,
      "interest-score": `興味度が相対的な強みで${Math.round(value)}点`,
      "self-transfer": "別切り航空券のため、セルフ乗り継ぎと手荷物の再預け入れが必要",
      "very-long-stopover": `${airport}での${durationText(value, locale)}の滞在は長すぎます`,
      "long-stopover": `${airport}で${durationText(value, locale)}滞在する長い旅程`,
      "highest-price": `比較対象で最高の${moneyText(value, locale)}、最安値より${moneyText(comparison, locale)}高額`,
      "longest-duration": `比較対象で最長の${durationText(value, locale)}、最短より${durationText(comparison, locale)}長い旅程`,
      "low-directness": `直行性スコアは${Math.round(value)}点`,
      "connection-count": `全体で${Math.round(value)}回の経由または乗り継ぎ`,
      "total-duration": `総所要時間は${durationText(value, locale)}`,
    },
  };
  return copy[locale][item.type];
}

function verdictText(pro: FlightAssessmentFact, locale: Locale) {
  const priceTypes = new Set<FlightAssessmentFactType>(["lowest-price", "price-score"]);
  const scheduleTypes = new Set<FlightAssessmentFactType>(["shortest-duration", "duration-score"]);
  const directTypes = new Set<FlightAssessmentFactType>(["nonstop", "highest-directness", "directness-score"]);
  const stopoverTypes = new Set<FlightAssessmentFactType>(["sightseeing-time", "highest-interest", "interest-score"]);
  if (locale === "zh") {
    if (priceTypes.has(pro.type)) return "价格最优先且能接受上述行程代价时，值得选择。";
    if (scheduleTypes.has(pro.type)) return "缩短行程最重要且能接受上述代价时，值得选择。";
    if (directTypes.has(pro.type)) return "减少中转负担最重要且能接受上述代价时，值得选择。";
    if (stopoverTypes.has(pro.type)) return "想把中转地也变成旅行的一部分，并能接受上述代价时，值得选择。";
  }
  if (locale === "ko") {
    if (priceTypes.has(pro.type)) return "가격이 최우선이고 위 일정상 단점을 감수할 수 있다면 추천합니다.";
    if (scheduleTypes.has(pro.type)) return "이동 시간을 줄이는 것이 최우선이고 위 단점을 감수할 수 있다면 추천합니다.";
    if (directTypes.has(pro.type)) return "환승 부담을 줄이는 것이 최우선이고 위 단점을 감수할 수 있다면 추천합니다.";
    if (stopoverTypes.has(pro.type)) return "스톱오버를 여행의 일부로 즐기고 위 단점을 감수할 수 있다면 추천합니다.";
  }
  if (locale === "ja") {
    if (priceTypes.has(pro.type)) return "価格を最優先し、上記のデメリットを許容できるならおすすめです。";
    if (scheduleTypes.has(pro.type)) return "移動時間の短縮を最優先し、上記のデメリットを許容できるならおすすめです。";
    if (directTypes.has(pro.type)) return "乗り継ぎ負担の軽減を最優先し、上記のデメリットを許容できるならおすすめです。";
    if (stopoverTypes.has(pro.type)) return "ストップオーバーも旅として楽しみ、上記のデメリットを許容できるならおすすめです。";
  }
  if (priceTypes.has(pro.type)) return "Recommended if price comes first and you can accept the tradeoff above.";
  if (scheduleTypes.has(pro.type)) return "Recommended if reducing journey time comes first and you can accept the tradeoff above.";
  if (directTypes.has(pro.type)) return "Recommended if reducing connection burden comes first and you can accept the tradeoff above.";
  return "Recommended if the stopover experience matters and you can accept the tradeoff above.";
}

export function flightAssessmentLoadingCopy(locale: Locale) {
  if (locale === "zh") return "正在评估这条航班…";
  if (locale === "ko") return "이 항공편을 평가하고 있습니다…";
  if (locale === "ja") return "このフライトを評価しています…";
  return "Assessing this flight…";
}

export function flightAssessmentView(
  candidate: FlightAssessmentCandidate,
  selection: FlightAssessmentSelection,
  locale: Locale,
): AssessmentView | null {
  const pro = candidate.pros.find((item) => item.id === selection.proId);
  const con = candidate.cons.find((item) => item.id === selection.conId);
  if (!pro || !con) return null;
  const labels = locale === "zh"
    ? { ai: "AI 航班点评", rules: "数据评估", pro: "优点", con: "缺点" }
    : locale === "ko"
      ? { ai: "AI 한줄 평가", rules: "데이터 기반 평가", pro: "장점", con: "단점" }
      : locale === "ja"
        ? { ai: "AIフライト評価", rules: "データ評価", pro: "メリット", con: "デメリット" }
        : { ai: "AI flight take", rules: "Data-based take", pro: "Pro", con: "Con" };
  return {
    title: labels[selection.generatedBy],
    proLabel: labels.pro,
    conLabel: labels.con,
    pro: factText(pro, locale),
    con: factText(con, locale),
    verdict: verdictText(pro, locale),
  };
}

export function isKnownAssessmentFactType(value: unknown): value is FlightAssessmentFactType {
  return typeof value === "string" && FACT_TYPES.has(value as FlightAssessmentFactType);
}
