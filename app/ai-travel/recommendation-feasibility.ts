import type {
  RecommendationSelectionFeasibility,
  StopoverRecommendationPool,
  TravelRecommendation,
} from "./types.ts";

const MINUTE = 60_000;
const SLOT_MINUTES = 15;

function localMinuteOfDay(utc: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utc));
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function isProtectedRestMinute(utc: number, timeZone: string) {
  const minute = localMinuteOfDay(utc, timeZone);
  return minute >= 23 * 60 || minute < 7 * 60;
}

export function protectedRestMinutesBetween(
  arrivalUtc: number,
  startOffsetMinutes: number,
  endOffsetMinutes: number,
  timeZone: string,
) {
  let minutes = 0;
  for (
    let offset = startOffsetMinutes;
    offset < endOffsetMinutes;
    offset += SLOT_MINUTES
  ) {
    if (isProtectedRestMinute(arrivalUtc + offset * MINUTE, timeZone)) {
      minutes += Math.min(SLOT_MINUTES, endOffsetMinutes - offset);
    }
  }
  return minutes;
}

function normalizedArea(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function estimateLocalTransitMinutes(
  previous: TravelRecommendation | null,
  next: TravelRecommendation,
) {
  if (!previous) return 15;
  const previousArea = normalizedArea(previous.area);
  const nextArea = normalizedArea(next.area);
  if (previousArea && nextArea && (
    previousArea === nextArea
    || previousArea.includes(nextArea)
    || nextArea.includes(previousArea)
  )) return 15;
  return 35;
}

export function toggleRecommendationSelection(
  recommendations: TravelRecommendation[],
  selectedIds: string[],
  itemId: string,
) {
  const item = recommendations.find((candidate) => candidate.id === itemId);
  if (!item) return selectedIds;
  if (selectedIds.includes(itemId)) {
    return selectedIds.filter((id) => id !== itemId);
  }
  const withoutPreviousHotel = item.category === "hotel"
    ? selectedIds.filter((id) => (
      recommendations.find((candidate) => candidate.id === id)?.category !== "hotel"
    ))
    : selectedIds;
  return [...withoutPreviousHotel, itemId];
}

function isOpenAt(item: TravelRecommendation, utc: number, timeZone: string) {
  if (
    item.openingStartMinute === null
    || item.openingEndMinute === null
  ) return true;
  const minute = localMinuteOfDay(utc, timeZone);
  if (item.openingStartMinute === item.openingEndMinute) return true;
  if (item.openingEndMinute > item.openingStartMinute) {
    return minute >= item.openingStartMinute && minute < item.openingEndMinute;
  }
  return minute >= item.openingStartMinute || minute < item.openingEndMinute;
}

function slotIsUsable(
  item: TravelRecommendation,
  arrivalUtc: number,
  startOffsetMinutes: number,
  durationMinutes: number,
  timeZone: string,
  requiresHotel: boolean,
) {
  for (let minute = 0; minute < durationMinutes; minute += SLOT_MINUTES) {
    const utc = arrivalUtc + (startOffsetMinutes + minute) * MINUTE;
    if (requiresHotel && isProtectedRestMinute(utc, timeZone)) return false;
    if (!isOpenAt(item, utc, timeZone)) return false;
  }
  return true;
}

function earliestUsableStart(
  item: TravelRecommendation,
  arrivalUtc: number,
  earliestOffsetMinutes: number,
  endOffsetMinutes: number,
  timeZone: string,
  requiresHotel: boolean,
) {
  const duration = item.suggestedDurationMinutes;
  const roundedStart = Math.ceil(earliestOffsetMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  for (
    let start = roundedStart;
    start + duration <= endOffsetMinutes;
    start += SLOT_MINUTES
  ) {
    if (slotIsUsable(
      item,
      arrivalUtc,
      start,
      duration,
      timeZone,
      requiresHotel,
    )) return start;
  }
  return null;
}

type ScheduleResult = {
  order: string[];
  transitMinutes: number;
};

function findFeasibleOrder(
  stopover: StopoverRecommendationPool,
  arrivalUtc: number,
  items: TravelRecommendation[],
) {
  let exploredStates = 0;
  const stateLimit = 50_000;

  function visit(
    remaining: TravelRecommendation[],
    cursor: number,
    previous: TravelRecommendation | null,
    order: string[],
    transitMinutes: number,
  ): ScheduleResult | null {
    exploredStates += 1;
    if (exploredStates > stateLimit) return null;
    if (!remaining.length) return { order, transitMinutes };

    const candidates = remaining
      .map((item) => ({
        item,
        transit: estimateLocalTransitMinutes(previous, item),
      }))
      .sort((left, right) => (
        (left.item.openingEndMinute ?? 1440)
        - (right.item.openingEndMinute ?? 1440)
      ));

    for (const { item, transit } of candidates) {
      const start = earliestUsableStart(
        item,
        arrivalUtc,
        cursor + transit,
        stopover.safety.cityWindowEndOffsetMinutes,
        stopover.timeZone,
        stopover.safety.requiresHotel,
      );
      if (start === null) continue;
      const next = visit(
        remaining.filter((candidate) => candidate.id !== item.id),
        start + item.suggestedDurationMinutes,
        item,
        [...order, item.id],
        transitMinutes + transit,
      );
      if (next) return next;
    }
    return null;
  }

  return visit(
    items,
    stopover.safety.cityWindowStartOffsetMinutes,
    null,
    [],
    0,
  );
}

export function evaluateRecommendationSelection(
  stopover: StopoverRecommendationPool,
  arrivalUtc: number,
  selectedIds: string[],
): RecommendationSelectionFeasibility {
  const selected = selectedIds
    .map((id) => stopover.recommendations.find((item) => item.id === id))
    .filter((item): item is TravelRecommendation => Boolean(item));
  const hotels = selected.filter((item) => item.category === "hotel");
  const activities = selected.filter((item) => item.category !== "hotel");
  const selectedMinutes = activities.reduce(
    (total, item) => total + item.suggestedDurationMinutes,
    0,
  );
  const missingHotel = stopover.safety.requiresHotel && hotels.length === 0;
  const minimumTransit = activities.length
    ? 15 + Math.max(0, activities.length - 1) * 15
    : 0;
  const capacityExceeded = (
    selectedMinutes + minimumTransit > stopover.safety.flexibleMinutes
  );
  const schedule = capacityExceeded
    ? null
    : findFeasibleOrder(stopover, arrivalUtc, activities);
  const localTransitMinutes = schedule?.transitMinutes ?? minimumTransit;
  const remainingMinutes = Math.max(
    0,
    stopover.safety.flexibleMinutes - selectedMinutes - localTransitMinutes,
  );
  const conflicts: RecommendationSelectionFeasibility["conflicts"] = [];
  if (capacityExceeded) conflicts.push("capacity");
  else if (!schedule) conflicts.push("opening-hours");
  if (missingHotel) conflicts.push("hotel-required");

  return {
    status: conflicts.length ? "conflict" : "feasible",
    selectedMinutes,
    localTransitMinutes,
    remainingMinutes,
    suggestedOrder: schedule?.order || [],
    missingHotel,
    conflicts,
  };
}
