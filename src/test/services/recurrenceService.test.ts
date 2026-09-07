import { describe, expect, it } from "vitest";
import { getNextRecurringDate, getRecurrenceAnchor } from "@/lib/recurrence";

describe("getNextRecurringDate", () => {
  it("daily advances by 1 day", () => {
    expect(getNextRecurringDate({ rule: { type: "daily" }, referenceDate: "2026-03-30" })).toBe("2026-03-31");
  });

  it("interval advances by N days", () => {
    expect(getNextRecurringDate({ rule: { type: "interval", interval_days: 3 }, referenceDate: "2026-03-30" })).toBe("2026-04-02");
  });

  it("interval defaults to 1 day when interval_days missing", () => {
    expect(getNextRecurringDate({ rule: { type: "interval" }, referenceDate: "2026-03-30" })).toBe("2026-03-31");
  });

  it("fixed_weekly finds next matching day", () => {
    // 2026-03-30 is Monday (day 1), next Wednesday (day 3) is April 1
    expect(getNextRecurringDate({ rule: { type: "fixed_weekly", days_of_week: [3] }, referenceDate: "2026-03-30" })).toBe("2026-04-01");
  });

  it("fixed_weekly wraps around to next week", () => {
    // 2026-03-30 is Monday (day 1), next Monday is April 6
    expect(getNextRecurringDate({ rule: { type: "fixed_weekly", days_of_week: [1] }, referenceDate: "2026-03-30" })).toBe("2026-04-06");
  });

  it("fixed_weekly with empty days falls back to +7", () => {
    expect(getNextRecurringDate({ rule: { type: "fixed_weekly", days_of_week: [] }, referenceDate: "2026-03-30" })).toBe("2026-04-06");
  });

  it("monthly advances by 1 month on same day", () => {
    expect(getNextRecurringDate({ rule: { type: "monthly", day_of_month: 15, interval_months: 1 }, referenceDate: "2026-03-15" })).toBe("2026-04-15");
  });

  it("monthly clamps for short months (day 31 → Feb 28)", () => {
    expect(getNextRecurringDate({ rule: { type: "monthly", day_of_month: 31, interval_months: 1 }, referenceDate: "2026-01-31" })).toBe("2026-02-28");
  });

  it("monthly with interval_months > 1 advances correctly", () => {
    expect(getNextRecurringDate({ rule: { type: "monthly", day_of_month: 10, interval_months: 3 }, referenceDate: "2026-01-10" })).toBe("2026-04-10");
  });
});

describe("getRecurrenceAnchor", () => {
  it("defaults to 'scheduled' when no anchor set", () => {
    expect(getRecurrenceAnchor({ type: "daily" })).toBe("scheduled");
  });

  it("returns explicit anchor", () => {
    expect(getRecurrenceAnchor({ type: "interval", anchor: "completion" })).toBe("completion");
  });
});
