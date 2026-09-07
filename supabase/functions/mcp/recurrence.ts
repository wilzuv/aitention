// Deno-compatible port of src/lib/recurrence.ts.
//
// The browser-side lib uses date-fns; this file uses only built-in Date so the
// edge function has no extra runtime dependency. Logic is a faithful mirror of
// src/lib/recurrence.ts:1-61. When behaviour drifts there it must be re-applied
// here too. Tests for the original live at src/test/recurrence.test.ts.

export interface RecurrenceRule {
  type: "daily" | "fixed_weekly" | "interval" | "monthly";
  days_of_week?: number[];
  interval_days?: number;
  day_of_month?: number;
  interval_months?: number;
  anchor?: "scheduled" | "completion";
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function getRecurrenceAnchor(rule: RecurrenceRule): "scheduled" | "completion" {
  return rule.anchor ?? "scheduled";
}

export function getNextRecurringDate(args: {
  rule: RecurrenceRule;
  referenceDate: string;
}): string {
  const { rule, referenceDate } = args;
  const base = parseDateOnly(referenceDate);

  if (rule.type === "daily") {
    return formatDateOnly(addDaysLocal(base, 1));
  }

  if (rule.type === "interval") {
    const interval = Math.max(1, rule.interval_days ?? 1);
    return formatDateOnly(addDaysLocal(base, interval));
  }

  if (rule.type === "monthly") {
    const intervalMonths = Math.max(1, rule.interval_months ?? 1);
    const dayOfMonth = rule.day_of_month ?? base.getDate();
    // Construct the target year/month via Date(y, m, 1) — passing day=1 dodges
    // JS's setMonth() overflow behaviour (e.g. Jan 31 + 1 month rolls into
    // March instead of clamping to Feb). date-fns addMonths clamps internally;
    // we get the same result by computing month directly and clamping the day
    // afterwards.
    const targetMonthAnchor = new Date(
      base.getFullYear(),
      base.getMonth() + intervalMonths,
      1,
    );
    const maxDay = getDaysInMonth(
      targetMonthAnchor.getFullYear(),
      targetMonthAnchor.getMonth(),
    );
    const clampedDay = Math.min(dayOfMonth, maxDay);
    return formatDateOnly(
      new Date(
        targetMonthAnchor.getFullYear(),
        targetMonthAnchor.getMonth(),
        clampedDay,
      ),
    );
  }

  // fixed_weekly
  const selectedDays = (rule.days_of_week ?? []).filter((d) => d >= 0 && d <= 6);
  if (selectedDays.length === 0) {
    return formatDateOnly(addDaysLocal(base, 7));
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDaysLocal(base, offset);
    if (selectedDays.includes(candidate.getDay())) {
      return formatDateOnly(candidate);
    }
  }
  return formatDateOnly(addDaysLocal(base, 7));
}
