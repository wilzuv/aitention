import { addDays, addMonths, format, getDay, getDaysInMonth } from "date-fns";

export interface RecurrenceRule {
  type: "daily" | "fixed_weekly" | "interval" | "monthly";
  days_of_week?: number[];
  interval_days?: number;
  day_of_month?: number;       // 1-31, for monthly type
  interval_months?: number;    // default 1, for "every 2 months" etc.
  anchor?: "scheduled" | "completion";
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function getRecurrenceAnchor(rule: RecurrenceRule): "scheduled" | "completion" {
  return rule.anchor ?? "scheduled";
}

export function getNextRecurringDate({
  rule,
  referenceDate,
}: {
  rule: RecurrenceRule;
  referenceDate: string;
}): string {
  const base = parseDateOnly(referenceDate);

  if (rule.type === "daily") {
    return format(addDays(base, 1), "yyyy-MM-dd");
  }

  if (rule.type === "interval") {
    const interval = Math.max(1, rule.interval_days ?? 1);
    return format(addDays(base, interval), "yyyy-MM-dd");
  }

  if (rule.type === "monthly") {
    const intervalMonths = Math.max(1, rule.interval_months ?? 1);
    const dayOfMonth = rule.day_of_month ?? base.getDate();
    const nextMonth = addMonths(base, intervalMonths);
    const maxDay = getDaysInMonth(nextMonth);
    const clampedDay = Math.min(dayOfMonth, maxDay);
    const result = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), clampedDay);
    return format(result, "yyyy-MM-dd");
  }

  const selectedDays = (rule.days_of_week ?? []).filter((d) => d >= 0 && d <= 6);
  if (selectedDays.length === 0) {
    return format(addDays(base, 7), "yyyy-MM-dd");
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(base, offset);
    if (selectedDays.includes(getDay(candidate))) {
      return format(candidate, "yyyy-MM-dd");
    }
  }

  return format(addDays(base, 7), "yyyy-MM-dd");
}

/**
 * Compute a default scheduled date for a recurrence rule when none is provided.
 * Returns the closest valid occurrence date (today or later).
 */
export function getDefaultScheduledDate(rule: RecurrenceRule, today?: Date): string {
  const now = today ?? new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  if (rule.type === "daily" || rule.type === "interval") {
    return todayStr;
  }

  if (rule.type === "fixed_weekly") {
    const selectedDays = (rule.days_of_week ?? []).filter((d) => d >= 0 && d <= 6);
    if (selectedDays.length === 0) return todayStr;

    const todayDay = getDay(now);
    // If today is one of the selected days, return today
    if (selectedDays.includes(todayDay)) return todayStr;

    // Find the next matching day
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = addDays(now, offset);
      if (selectedDays.includes(getDay(candidate))) {
        return format(candidate, "yyyy-MM-dd");
      }
    }
    return todayStr;
  }

  if (rule.type === "monthly") {
    const dayOfMonth = rule.day_of_month ?? now.getDate();
    const maxDayThisMonth = getDaysInMonth(now);
    const effectiveDay = Math.min(dayOfMonth, maxDayThisMonth);

    if (now.getDate() <= effectiveDay) {
      // This month's occurrence is today or in the future
      return format(new Date(now.getFullYear(), now.getMonth(), effectiveDay), "yyyy-MM-dd");
    }
    // This month's occurrence has passed, use next month
    const nextMonth = addMonths(now, 1);
    const maxDayNext = getDaysInMonth(nextMonth);
    const clampedDay = Math.min(dayOfMonth, maxDayNext);
    return format(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), clampedDay), "yyyy-MM-dd");
  }

  return todayStr;
}
