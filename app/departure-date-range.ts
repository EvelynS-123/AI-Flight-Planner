export type DepartureDateRange = {
  min: string;
  max: string;
};

function formatDateParts(year: number, month: number, day: number) {
  return [
    year.toString().padStart(4, "0"),
    month.toString().padStart(2, "0"),
    day.toString().padStart(2, "0"),
  ].join("-");
}

export function localDateValue(date: Date) {
  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function addCalendarMonths(dateValue: string, months: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return formatDateParts(targetYear, targetMonth + 1, Math.min(day, lastDay));
}

export function departureDateRange(now = new Date()): DepartureDateRange {
  const min = localDateValue(now);
  return {
    min,
    max: addCalendarMonths(min, 6),
  };
}

export function clampDepartureDate(value: string, range: DepartureDateRange) {
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}
