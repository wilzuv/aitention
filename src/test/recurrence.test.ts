import { describe, expect, it } from "vitest";
import { getDefaultScheduledDate, getNextRecurringDate, type RecurrenceRule } from "@/lib/recurrence";

describe("getNextRecurringDate", () => {
  it("advances daily rules by one day", () => {
    const rule: RecurrenceRule = { type: "daily" };
    expect(getNextRecurringDate({ rule, referenceDate: "2026-03-17" })).toBe("2026-03-18");
  });

  it("advances interval rules by interval_days", () => {
    const rule: RecurrenceRule = { type: "interval", interval_days: 3 };
    expect(getNextRecurringDate({ rule, referenceDate: "2026-03-17" })).toBe("2026-03-20");
  });

  it("advances weekly rules to the next selected weekday", () => {
    const rule: RecurrenceRule = { type: "fixed_weekly", days_of_week: [1, 4] };
    expect(getNextRecurringDate({ rule, referenceDate: "2026-03-17" })).toBe("2026-03-19");
  });

  it("advances monthly rules by one month", () => {
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 15, interval_months: 1 };
    expect(getNextRecurringDate({ rule, referenceDate: "2026-03-15" })).toBe("2026-04-15");
  });

  it("advances monthly rules by N months", () => {
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 10, interval_months: 3 };
    expect(getNextRecurringDate({ rule, referenceDate: "2026-01-10" })).toBe("2026-04-10");
  });

  it("clamps day_of_month to end of shorter month (Feb)", () => {
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 31, interval_months: 1 };
    // Jan 31 → Feb has 28 days in 2026
    expect(getNextRecurringDate({ rule, referenceDate: "2026-01-31" })).toBe("2026-02-28");
  });

  it("clamps day_of_month to end of shorter month (Apr = 30 days)", () => {
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 31, interval_months: 1 };
    // Mar 31 → Apr has 30 days
    expect(getNextRecurringDate({ rule, referenceDate: "2026-03-31" })).toBe("2026-04-30");
  });

  it("handles leap year February correctly", () => {
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 29, interval_months: 1 };
    // Jan 29 → Feb 29, 2028 is a leap year
    expect(getNextRecurringDate({ rule, referenceDate: "2028-01-29" })).toBe("2028-02-29");
  });

  it("uses default day_of_month from reference date when not specified", () => {
    const rule: RecurrenceRule = { type: "monthly", interval_months: 1 };
    // Reference is March 20 → next month is April 20
    expect(getNextRecurringDate({ rule, referenceDate: "2026-03-20" })).toBe("2026-04-20");
  });
});

describe("getDefaultScheduledDate", () => {
  it("returns today for daily rules", () => {
    const rule: RecurrenceRule = { type: "daily" };
    const today = new Date("2026-03-25T00:00:00");
    expect(getDefaultScheduledDate(rule, today)).toBe("2026-03-25");
  });

  it("returns today for interval rules", () => {
    const rule: RecurrenceRule = { type: "interval", interval_days: 5 };
    const today = new Date("2026-03-25T00:00:00");
    expect(getDefaultScheduledDate(rule, today)).toBe("2026-03-25");
  });

  it("returns today if today is a selected day for fixed_weekly", () => {
    // 2026-03-25 is a Wednesday (3)
    const rule: RecurrenceRule = { type: "fixed_weekly", days_of_week: [1, 3] };
    const today = new Date("2026-03-25T00:00:00");
    expect(getDefaultScheduledDate(rule, today)).toBe("2026-03-25");
  });

  it("returns next matching day for fixed_weekly if today is not selected", () => {
    // 2026-03-25 is Wednesday (3), looking for Monday (1)
    const rule: RecurrenceRule = { type: "fixed_weekly", days_of_week: [1] };
    const today = new Date("2026-03-25T00:00:00");
    expect(getDefaultScheduledDate(rule, today)).toBe("2026-03-30");
  });

  it("returns this month for monthly if day_of_month is in the future", () => {
    // Today is March 10, rule is day_of_month=15
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 15, interval_months: 1 };
    const today = new Date("2026-03-10T00:00:00");
    expect(getDefaultScheduledDate(rule, today)).toBe("2026-03-15");
  });

  it("returns next month for monthly if day_of_month has passed", () => {
    // Today is March 25, rule is day_of_month=10
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 10, interval_months: 1 };
    const today = new Date("2026-03-25T00:00:00");
    expect(getDefaultScheduledDate(rule, today)).toBe("2026-04-10");
  });

  it("returns today for monthly if day_of_month matches today", () => {
    const rule: RecurrenceRule = { type: "monthly", day_of_month: 25, interval_months: 1 };
    const today = new Date("2026-03-25T00:00:00");
    expect(getDefaultScheduledDate(rule, today)).toBe("2026-03-25");
  });
});
