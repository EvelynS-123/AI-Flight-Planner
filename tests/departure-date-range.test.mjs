import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarMonths,
  clampDepartureDate,
  departureDateRange,
} from "../app/departure-date-range.ts";

test("departure date range starts today and ends six calendar months later", () => {
  const range = departureDateRange(new Date(2026, 6, 29, 12));

  assert.deepEqual(range, {
    min: "2026-07-29",
    max: "2027-01-29",
  });
});

test("six-month boundary clamps to the last valid day of the target month", () => {
  assert.equal(addCalendarMonths("2023-08-31", 6), "2024-02-29");
  assert.equal(addCalendarMonths("2024-08-31", 6), "2025-02-28");
});

test("an expired or over-limit default is moved inside the selectable range", () => {
  const range = { min: "2026-10-01", max: "2027-04-01" };

  assert.equal(clampDepartureDate("2026-09-15", range), "2026-10-01");
  assert.equal(clampDepartureDate("2027-05-01", range), "2027-04-01");
  assert.equal(clampDepartureDate("2026-12-10", range), "2026-12-10");
});
