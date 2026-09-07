import { describe, it, expect } from "vitest";
import { parseTaskInput, replaceTokenInText } from "@/lib/taskParser";

describe("parseTaskInput recurrence parsing", () => {
  const referenceDate = new Date("2026-03-17T00:00:00Z");

  it("parses ordinal weekday recurrence like 'every second wed'", () => {
    const parsed = parseTaskInput("Do one career task tom every second wed", referenceDate);

    expect(parsed.date).toBe("2026-03-18");
    expect(parsed.recurrence).toEqual({ type: "interval", interval_days: 14 });
    expect(parsed.cleanName).toBe("Do one career task");
  });

  it("keeps both date and interval recurrence tokens", () => {
    const parsed = parseTaskInput("Pay bills tomorrow every 3 days", referenceDate);

    expect(parsed.date).toBe("2026-03-18");
    expect(parsed.recurrence).toEqual({ type: "interval", interval_days: 3 });
    expect(parsed.cleanName).toBe("Pay bills");
  });
});

describe("parseTaskInput goal and estimate parsing", () => {
  it("parses @goal query token and strips it from clean name", () => {
    const parsed = parseTaskInput("Deep work @career_focus");

    expect(parsed.goalQuery).toBe("career_focus");
    expect(parsed.cleanName).toBe("Deep work");
    expect(parsed.tokens.some((t) => t.type === "goal")).toBe(true);
  });

  it("parses min estimate token and strips it from clean name", () => {
    const parsed = parseTaskInput("Read docs min45");

    expect(parsed.estimatedMinutes).toBe(45);
    expect(parsed.cleanName).toBe("Read docs");
    expect(parsed.tokens.some((t) => t.type === "estimate")).toBe(true);
  });

  it("parses NNmin estimate syntax (e.g. 180min)", () => {
    const parsed = parseTaskInput("Draft proposal 180min");

    expect(parsed.estimatedMinutes).toBe(180);
    expect(parsed.cleanName).toBe("Draft proposal");
    expect(parsed.tokens.some((t) => t.type === "estimate")).toBe(true);
  });

  it("parses NNmin estimate mid-sentence", () => {
    const parsed = parseTaskInput("Review PR 60min today");

    expect(parsed.estimatedMinutes).toBe(60);
    expect(parsed.cleanName).toBe("Review PR");
  });
});

describe("parseTaskInput date shorthand", () => {
  const referenceDate = new Date("2026-03-25T00:00:00Z");

  it("parses 'tod' as today", () => {
    const parsed = parseTaskInput("Buy milk tod", referenceDate);

    expect(parsed.date).toBe("2026-03-25");
    expect(parsed.cleanName).toBe("Buy milk");
    expect(parsed.tokens.some((t) => t.type === "date" && t.raw === "tod")).toBe(true);
  });

  it("parses 'tod' with other tokens", () => {
    const parsed = parseTaskInput("Call dentist tod !1", referenceDate);

    expect(parsed.date).toBe("2026-03-25");
    expect(parsed.priority).toBe(3); // !1 = High = 3
    expect(parsed.cleanName).toBe("Call dentist");
  });

  it("parses 'tom' as tomorrow", () => {
    const parsed = parseTaskInput("Finish report tom", referenceDate);

    expect(parsed.date).toBe("2026-03-26");
    expect(parsed.cleanName).toBe("Finish report");
  });
});

describe("parseTaskInput bare day names", () => {
  // 2026-03-25 is a Wednesday
  const referenceDate = new Date("2026-03-25T00:00:00Z");

  it("parses 'wed' on a Wednesday as today", () => {
    const parsed = parseTaskInput("Standup wed", referenceDate);

    expect(parsed.date).toBe("2026-03-25");
    expect(parsed.cleanName).toBe("Standup");
  });

  it("parses 'fri' on a Wednesday as this Friday", () => {
    const parsed = parseTaskInput("Review fri", referenceDate);

    expect(parsed.date).toBe("2026-03-27");
    expect(parsed.cleanName).toBe("Review");
  });

  it("parses 'monday' on a Wednesday as next Monday", () => {
    const parsed = parseTaskInput("Report monday", referenceDate);

    expect(parsed.date).toBe("2026-03-30");
    expect(parsed.cleanName).toBe("Report");
  });

  it("parses 'tue' on a Wednesday as next Tuesday", () => {
    const parsed = parseTaskInput("Sync tue", referenceDate);

    expect(parsed.date).toBe("2026-03-31");
    expect(parsed.cleanName).toBe("Sync");
  });

  it("does not conflict with 'every wed' recurrence", () => {
    const parsed = parseTaskInput("Standup every wed", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "fixed_weekly", days_of_week: [3] });
    expect(parsed.date).toBeNull();
    expect(parsed.cleanName).toBe("Standup");
  });

  it("does not conflict with 'next friday' date", () => {
    const parsed = parseTaskInput("Review next friday", referenceDate);

    // "next friday" takes priority over bare "friday"
    expect(parsed.date).toBe("2026-03-27");
    expect(parsed.cleanName).toBe("Review");
  });

  it("parses full day name 'saturday'", () => {
    const parsed = parseTaskInput("Groceries saturday", referenceDate);

    expect(parsed.date).toBe("2026-03-28");
    expect(parsed.cleanName).toBe("Groceries");
  });
});

describe("parseTaskInput numeric dates", () => {
  // 2026-03-25 is reference
  const referenceDate = new Date("2026-03-25T00:00:00Z");

  it("parses DD.MM short form (future date this year)", () => {
    const parsed = parseTaskInput("Party 15.06", referenceDate);

    expect(parsed.date).toBe("2026-06-15");
    expect(parsed.cleanName).toBe("Party");
  });

  it("parses DD/MM short form with slash", () => {
    const parsed = parseTaskInput("Dinner 25/12", referenceDate);

    expect(parsed.date).toBe("2026-12-25");
    expect(parsed.cleanName).toBe("Dinner");
  });

  it("parses DD.MM short form (past date rolls to next year)", () => {
    const parsed = parseTaskInput("Anniversary 14.02", referenceDate);

    // Feb 14 is before Mar 25, so rolls to next year
    expect(parsed.date).toBe("2027-02-14");
    expect(parsed.cleanName).toBe("Anniversary");
  });

  it("parses DD.MM.YYYY full form", () => {
    const parsed = parseTaskInput("Reunion 12.12.2029", referenceDate);

    expect(parsed.date).toBe("2029-12-12");
    expect(parsed.cleanName).toBe("Reunion");
  });

  it("parses DD/MM/YYYY full form with slash", () => {
    const parsed = parseTaskInput("Deadline 01/06/2027", referenceDate);

    expect(parsed.date).toBe("2027-06-01");
    expect(parsed.cleanName).toBe("Deadline");
  });

  it("rejects invalid day/month ranges", () => {
    const parsed = parseTaskInput("Invalid 32.13", referenceDate);

    // Should not parse as date
    expect(parsed.date).toBeNull();
    expect(parsed.cleanName).toBe("Invalid 32.13");
  });

  it("parses numeric date with other tokens", () => {
    const parsed = parseTaskInput("Buy gift 25.12 !1", referenceDate);

    expect(parsed.date).toBe("2026-12-25");
    expect(parsed.priority).toBe(3); // !1 = High = 3
    expect(parsed.cleanName).toBe("Buy gift");
  });
});

describe("parseTaskInput monthly recurrence", () => {
  // 2026-03-25 (day 25)
  const referenceDate = new Date("2026-03-25T00:00:00Z");

  it("parses 'every month'", () => {
    const parsed = parseTaskInput("Pay rent every month", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "monthly", day_of_month: 25, interval_months: 1 });
    expect(parsed.cleanName).toBe("Pay rent");
  });

  it("parses 'every 1st'", () => {
    const parsed = parseTaskInput("Bills every 1st", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "monthly", day_of_month: 1, interval_months: 1 });
    expect(parsed.cleanName).toBe("Bills");
  });

  it("parses 'every 15th'", () => {
    const parsed = parseTaskInput("Check accounts every 15th", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "monthly", day_of_month: 15, interval_months: 1 });
    expect(parsed.cleanName).toBe("Check accounts");
  });

  it("parses 'on the 1st of every month'", () => {
    const parsed = parseTaskInput("Review on the 1st of every month", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "monthly", day_of_month: 1, interval_months: 1 });
    expect(parsed.cleanName).toBe("Review");
  });

  it("parses 'every 2 months'", () => {
    const parsed = parseTaskInput("Dentist every 2 months", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "monthly", day_of_month: 25, interval_months: 2 });
    expect(parsed.cleanName).toBe("Dentist");
  });

  it("parses 'every 3 months on the 1st'", () => {
    const parsed = parseTaskInput("Quarterly review every 3 months on the 1st", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "monthly", day_of_month: 1, interval_months: 3 });
    expect(parsed.cleanName).toBe("Quarterly review");
  });

  it("does not conflict with 'every 3 days' (interval)", () => {
    const parsed = parseTaskInput("Water plants every 3 days", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "interval", interval_days: 3 });
    expect(parsed.cleanName).toBe("Water plants");
  });

  // "every week" produces interval (7 days from completion, can drift),
  // while "every monday" produces fixed_weekly (anchored to weekday).
  // This is intentional: "every week" means "7 days after I complete it"
  // whereas "every monday" means "always on Mondays regardless of completion date".
  it("'every week' uses interval type (completion-relative), not fixed_weekly", () => {
    const parsed = parseTaskInput("Review notes every week", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "interval", interval_days: 7 });
  });

  it("'every monday' uses fixed_weekly type (day-anchored)", () => {
    const parsed = parseTaskInput("Team standup every monday", referenceDate);

    expect(parsed.recurrence).toEqual({ type: "fixed_weekly", days_of_week: [1] });
  });
});

describe("replaceTokenInText", () => {
  const referenceDate = new Date("2026-03-25T00:00:00Z");

  it("replaces an existing priority token", () => {
    const parsed = parseTaskInput("Buy milk !1", referenceDate);
    const result = replaceTokenInText("Buy milk !1", parsed.tokens, "priority", "!2");
    expect(result).toBe("Buy milk !2");
  });

  it("appends priority when none exists", () => {
    const parsed = parseTaskInput("Buy milk", referenceDate);
    const result = replaceTokenInText("Buy milk", parsed.tokens, "priority", "!1");
    expect(result).toBe("Buy milk !1");
  });

  it("removes a priority token when newRaw is null", () => {
    const parsed = parseTaskInput("Buy milk !1", referenceDate);
    const result = replaceTokenInText("Buy milk !1", parsed.tokens, "priority", null);
    expect(result).toBe("Buy milk");
  });

  it("replaces a date token", () => {
    const parsed = parseTaskInput("Buy milk tomorrow", referenceDate);
    const result = replaceTokenInText("Buy milk tomorrow", parsed.tokens, "date", "fri");
    expect(result).toBe("Buy milk fri");
  });

  it("appends a date when none exists", () => {
    const parsed = parseTaskInput("Buy milk !1", referenceDate);
    const result = replaceTokenInText("Buy milk !1", parsed.tokens, "date", "tomorrow");
    expect(result).toBe("Buy milk !1 tomorrow");
  });

  it("replaces recurrence token", () => {
    const parsed = parseTaskInput("Task every day", referenceDate);
    const result = replaceTokenInText("Task every day", parsed.tokens, "recurrence", "every monday");
    expect(result).toBe("Task every monday");
  });

  it("returns text unchanged when removing non-existent token", () => {
    const parsed = parseTaskInput("Buy milk", referenceDate);
    const result = replaceTokenInText("Buy milk", parsed.tokens, "priority", null);
    expect(result).toBe("Buy milk");
  });
});

describe("conflict detection (inactiveTokens)", () => {
  const referenceDate = new Date("2026-03-25T00:00:00Z");

  it("detects conflicting priority tokens", () => {
    const parsed = parseTaskInput("Task !1 !2", referenceDate);
    expect(parsed.priority).toBe(2); // Last one wins: !2 = Medium
    expect(parsed.inactiveTokens.length).toBe(1);
    expect(parsed.inactiveTokens[0].raw).toBe("!1");
  });

  it("detects conflicting recurrence tokens", () => {
    const parsed = parseTaskInput("Task every day every monday", referenceDate);
    expect(parsed.recurrence?.type).toBe("fixed_weekly"); // Last one wins
    expect(parsed.inactiveTokens.length).toBe(1);
    expect(parsed.inactiveTokens[0].raw).toBe("every day");
  });

  it("no conflicts when different types", () => {
    const parsed = parseTaskInput("Task every day tomorrow !1", referenceDate);
    expect(parsed.inactiveTokens.length).toBe(0);
  });
});
