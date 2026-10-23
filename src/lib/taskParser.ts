import {
  addDays,
  addWeeks,
  nextDay,
  format,
  getDay,
  isBefore,
  startOfDay,
} from "date-fns";
import type { RecurrenceRule } from "@/lib/recurrence";

// Maps day names to date-fns day indices (0=Sun)
const DAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const DAY_NAMES_PATTERN = "sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat";

const RECURRENCE_ORDINAL_MAP: Record<string, number> = {
  other: 2,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export interface ParsedToken {
  /** Original text matched in input */
  raw: string;
  /** Start index in the input string */
  start: number;
  /** End index (exclusive) in the input string */
  end: number;
  /** What type of token */
  type: "date" | "recurrence" | "estimate" | "goal";
  /** Resolved value */
  value: string | number | RecurrenceRule;
}

export interface ParseResult {
  /** Clean task name with tokens stripped */
  cleanName: string;
  /** Parsed date (yyyy-MM-dd) or null */
  date: string | null;
  /** Parsed recurrence rule or null */
  recurrence: RecurrenceRule | null;
  /** Parsed estimate in minutes (from minNN) or null */
  estimatedMinutes: number | null;
  /** Parsed goal token query (from @query) or null */
  goalQuery: string | null;
  /** All recognized tokens for visual highlighting */
  tokens: ParsedToken[];
  /** Tokens that are inactive due to conflicts (same type, earlier position) */
  inactiveTokens: ParsedToken[];
}

/**
 * Parse a task name string for natural language date, goal, estimate, and recurrence tokens.
 * Todoist-style syntax:
 * - Date: "today", "tomorrow"/"tom", "next monday", "jan 15", "in 3 days", "in 2 weeks"
 * - Goal link query: "@goalname"
 * - Estimate: "min45" (sets estimated minutes to 45)
 * - Recurrence: "every day", "every weekday", "every monday", "every mon, wed, fri", "every 3 days"
 */
export function parseTaskInput(input: string, referenceDate?: Date): ParseResult {
  const today = startOfDay(referenceDate ?? new Date());
  const tokens: ParsedToken[] = [];

  // --- Goal query: @goalname ---
  let match: RegExpExecArray | null;
  const goalRegex = /(?:^|\s)(@([a-zA-Z0-9_-]+))(?=\s|$)/g;
  while ((match = goalRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    tokens.push({ raw, start: idx, end: idx + raw.length, type: "goal", value: match[2] });
  }

  // --- Estimate: minNN, NNmin, NNh, NNhr, NNhrs ---
  const estimateRegex = /(?:^|\s)(min(\d+)|(\d+)min|(\d+(?:\.\d+)?)h(?:rs?)?|h(\d+(?:\.\d+)?))(?=\s|$)/gi;
  while ((match = estimateRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    // Hour patterns: "1.5h", "2hrs", "h3"
    const hourVal = match[4] ?? match[5];
    let mins: number;
    if (hourVal) {
      mins = Math.round(parseFloat(hourVal) * 60);
    } else {
      mins = parseInt(match[2] ?? match[3], 10);
    }
    if (!Number.isNaN(mins) && mins > 0) {
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "estimate", value: mins });
    }
  }

  // --- Recurrence expressions (must be checked before date expressions) ---

  // Monthly: "every N months on the Nth" (most specific, check first)
  const everyNMonthsOnRegex = /(?:^|\s)(every\s+(\d+)\s+months?\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th))(?=\s|$)/gi;
  while ((match = everyNMonthsOnRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const n = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (day >= 1 && day <= 31 && n >= 1) {
      const rule: RecurrenceRule = { type: "monthly", day_of_month: day, interval_months: n };
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
    }
  }

  // Monthly: "on the Nth of every month"
  const onTheNthOfEveryMonthRegex = /(?:^|\s)(on\s+the\s+(\d{1,2})(?:st|nd|rd|th)\s+of\s+every\s+month)(?=\s|$)/gi;
  while ((match = onTheNthOfEveryMonthRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const day = parseInt(match[2], 10);
    if (day >= 1 && day <= 31) {
      const rule: RecurrenceRule = { type: "monthly", day_of_month: day, interval_months: 1 };
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
    }
  }

  // Monthly: "every Nth" (e.g., "every 1st", "every 15th")
  const everyNthRegex = /(?:^|\s)(every\s+(\d{1,2})(?:st|nd|rd|th))(?=\s|$)/gi;
  while ((match = everyNthRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const day = parseInt(match[2], 10);
    if (day >= 1 && day <= 31) {
      const rule: RecurrenceRule = { type: "monthly", day_of_month: day, interval_months: 1 };
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
    }
  }

  // Monthly: "every N months" (e.g., "every 2 months")
  const everyNMonthsRegex = /(?:^|\s)(every\s+(\d+)\s+months?)(?=\s|$)/gi;
  while ((match = everyNMonthsRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const n = parseInt(match[2], 10);
    if (n >= 1) {
      const rule: RecurrenceRule = { type: "monthly", day_of_month: today.getDate(), interval_months: n };
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
    }
  }

  // Monthly: "every month"
  const everyMonthRegex = /(?:^|\s)(every\s+month)(?=\s|$)/gi;
  while ((match = everyMonthRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const rule: RecurrenceRule = { type: "monthly", day_of_month: today.getDate(), interval_months: 1 };
    tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
  }

  // "every day" / "every weekday" / "every week"
  const everyDayRegex = /(?:^|\s)(every\s+(day|weekday|week))(?=\s|$)/gi;
  while ((match = everyDayRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const keyword = match[2].toLowerCase();
    const rule: RecurrenceRule = keyword === "weekday"
      ? { type: "fixed_weekly", days_of_week: [1, 2, 3, 4, 5] }
      : keyword === "week"
        ? { type: "interval", interval_days: 7 }
        : { type: "daily" };
    tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
  }

  // "every N days" / "every N weeks"
  const everyIntervalRegex = /(?:^|\s)(every\s+(\d+)\s+(days?|weeks?))(?=\s|$)/gi;
  while ((match = everyIntervalRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const n = parseInt(match[2], 10);
    const unit = match[3].toLowerCase();
    const intervalDays = unit.startsWith("week") ? n * 7 : n;
    const rule: RecurrenceRule = { type: "interval", interval_days: intervalDays };
    tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
  }

  // "every second wed" / "every 2nd wed" / "every other wednesday"
  const everyOrdinalDayNameRegex = new RegExp(
    `(?:^|\\s)(every\\s+((?:\\d+(?:st|nd|rd|th)?|other|second|third|fourth|fifth))\\s+(${DAY_NAMES_PATTERN}))(?=\\s|$)`,
    "gi"
  );
  while ((match = everyOrdinalDayNameRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const ordinalRaw = match[2].toLowerCase();
    const dayRaw = match[3].toLowerCase();
    const dayIdx = DAY_MAP[dayRaw];
    const parsedNum = parseInt(ordinalRaw, 10);
    const intervalWeeks = Number.isFinite(parsedNum) && parsedNum > 0
      ? parsedNum
      : (RECURRENCE_ORDINAL_MAP[ordinalRaw] ?? 0);

    if (dayIdx !== undefined && intervalWeeks >= 2) {
      const rule: RecurrenceRule = { type: "interval", interval_days: intervalWeeks * 7 };
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
    }
  }

  // "every monday" / "every mon, wed, fri" / "every tue and thu"
  const everyDayNameRegex = new RegExp(
    `(?:^|\\s)(every\\s+((?:(?:${DAY_NAMES_PATTERN})(?:\\s*[,&]\\s*|\\s+and\\s+|\\s+)?)+))(?=\\s|$)`,
    "gi"
  );
  while ((match = everyDayNameRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    // Parse day names from the captured group
    const daysPart = match[2].toLowerCase();
    const dayNameRegex = new RegExp(`(${DAY_NAMES_PATTERN})`, "gi");
    const days: number[] = [];
    let dayMatch: RegExpExecArray | null;
    while ((dayMatch = dayNameRegex.exec(daysPart)) !== null) {
      const dayIdx = DAY_MAP[dayMatch[1].toLowerCase()];
      if (dayIdx !== undefined && !days.includes(dayIdx)) {
        days.push(dayIdx);
      }
    }
    if (days.length > 0) {
      days.sort((a, b) => a - b);
      const rule: RecurrenceRule = { type: "fixed_weekly", days_of_week: days };
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "recurrence", value: rule });
    }
  }

  // --- Date expressions ---
  // "today"
  const todayRegex = /(?:^|\s)(today|tod)(?=\s|$)/gi;
  while ((match = todayRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(today, "yyyy-MM-dd") });
  }

  // "tomorrow" / "tom"
  const tomorrowRegex = /(?:^|\s)(tomorrow|tom)(?=\s|$)/gi;
  while ((match = tomorrowRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(addDays(today, 1), "yyyy-MM-dd") });
  }

  // "next monday", "next fri", etc.
  const nextDayRegex = new RegExp(`(?:^|\\s)(next\\s+(${DAY_NAMES_PATTERN}))(?=\\s|$)`, "gi");
  while ((match = nextDayRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const dayIdx = DAY_MAP[match[2].toLowerCase()];
    if (dayIdx !== undefined) {
      const d = nextDay(today, dayIdx);
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(d, "yyyy-MM-dd") });
    }
  }

  // "in N days" / "in N weeks"
  const relativeRegex = /(?:^|\s)(in\s+(\d+)\s+(days?|weeks?))(?=\s|$)/gi;
  while ((match = relativeRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const n = parseInt(match[2], 10);
    const unit = match[3].toLowerCase();
    const d = unit.startsWith("week") ? addWeeks(today, n) : addDays(today, n);
    tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(d, "yyyy-MM-dd") });
  }

  // "jan 15", "march 3", etc.
  const monthNames = Object.keys(MONTH_MAP).join("|");
  const monthDateRegex = new RegExp(`(?:^|\\s)((${monthNames})\\s+(\\d{1,2}))(?=\\s|$)`, "gi");
  while ((match = monthDateRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const monthIdx = MONTH_MAP[match[2].toLowerCase()];
    const dayNum = parseInt(match[3], 10);
    if (monthIdx !== undefined && dayNum >= 1 && dayNum <= 31) {
      let year = today.getFullYear();
      let candidate = new Date(year, monthIdx, dayNum);
      // If the date has passed this year, use next year
      if (isBefore(candidate, today)) {
        year += 1;
        candidate = new Date(year, monthIdx, dayNum);
      }
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(candidate, "yyyy-MM-dd") });
    }
  }

  // Numeric dates: "DD.MM.YYYY" or "DD/MM/YYYY" (full form, checked first to avoid partial match)
  const numericDateFullRegex = /(?:^|\s)((\d{1,2})[./](\d{1,2})[./](\d{4}))(?=\s|$)/g;
  while ((match = numericDateFullRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const dayNum = parseInt(match[2], 10);
    const monthNum = parseInt(match[3], 10);
    const yearNum = parseInt(match[4], 10);
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
      const candidate = new Date(yearNum, monthNum - 1, dayNum);
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(candidate, "yyyy-MM-dd") });
    }
  }

  // Numeric dates: "DD.MM" or "DD/MM" (short form)
  const numericDateShortRegex = /(?:^|\s)((\d{1,2})[./](\d{1,2}))(?=\s|$)/g;
  while ((match = numericDateShortRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const dayNum = parseInt(match[2], 10);
    const monthNum = parseInt(match[3], 10);
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
      let year = today.getFullYear();
      let candidate = new Date(year, monthNum - 1, dayNum);
      if (isBefore(candidate, today)) {
        year += 1;
        candidate = new Date(year, monthNum - 1, dayNum);
      }
      tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(candidate, "yyyy-MM-dd") });
    }
  }

  // Bare day names: "wed", "friday", etc. (without "every" or "next" prefix)
  // These resolve to the closest occurrence (today if today is that day)
  const bareDayRegex = new RegExp(`(?:^|\\s)(${DAY_NAMES_PATTERN})(?=\\s|$)`, "gi");
  while ((match = bareDayRegex.exec(input)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    const dayIdx = DAY_MAP[raw.toLowerCase()];
    if (dayIdx !== undefined) {
      const todayDay = getDay(today); // 0=Sun
      if (todayDay === dayIdx) {
        tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(today, "yyyy-MM-dd") });
      } else {
        // Find the next occurrence of this day
        const d = nextDay(today, dayIdx);
        tokens.push({ raw, start: idx, end: idx + raw.length, type: "date", value: format(d, "yyyy-MM-dd") });
      }
    }
  }

  // Sort tokens by start position (for clean stripping)
  tokens.sort((a, b) => a.start - b.start);

  // Remove overlapping tokens (keep first match)
  const filtered: ParsedToken[] = [];
  let lastEnd = -1;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      filtered.push(t);
      lastEnd = t.end;
    }
  }

  // Build clean name by stripping tokens
  let cleanName = input;
  for (let i = filtered.length - 1; i >= 0; i--) {
    const t = filtered[i];
    cleanName = cleanName.slice(0, t.start) + cleanName.slice(t.end);
  }
  cleanName = cleanName.replace(/\s{2,}/g, " ").trim();

  // Extract resolved values
  const dateTokens = filtered.filter((t) => t.type === "date");
  const goalTokens = filtered.filter((t) => t.type === "goal");
  const recurrenceTokens = filtered.filter((t) => t.type === "recurrence");
  const estimateTokens = filtered.filter((t) => t.type === "estimate");

  // Detect conflicts: for single-value types, all tokens except the last are inactive
  const inactiveTokens: ParsedToken[] = [];
  const singleValueTypes: ParsedToken["type"][] = ["date", "recurrence", "estimate", "goal"];
  for (const type of singleValueTypes) {
    const tokensOfType = filtered.filter((t) => t.type === type);
    if (tokensOfType.length > 1) {
      // All except the last are inactive
      inactiveTokens.push(...tokensOfType.slice(0, -1));
    }
  }

  return {
    cleanName,
    date: dateTokens.length > 0 ? (dateTokens[dateTokens.length - 1].value as string) : null,
    goalQuery: goalTokens.length > 0 ? String(goalTokens[goalTokens.length - 1].value) : null,
    recurrence: recurrenceTokens.length > 0 ? (recurrenceTokens[recurrenceTokens.length - 1].value as RecurrenceRule) : null,
    estimatedMinutes: estimateTokens.length > 0 ? (estimateTokens[estimateTokens.length - 1].value as number) : null,
    tokens: filtered,
    inactiveTokens,
  };
}

/**
 * Replace, insert, or remove a token of the given type in the text.
 * - If a token of this type exists: replaces the last one with newRaw (or removes if null)
 * - If no token exists and newRaw is provided: appends to end
 * - Returns the updated text string
 */
export function replaceTokenInText(
  text: string,
  tokens: ParsedToken[],
  tokenType: ParsedToken["type"],
  newRaw: string | null
): string {
  const matching = tokens.filter((t) => t.type === tokenType);

  if (matching.length > 0) {
    // Replace or remove the last token of this type
    const target = matching[matching.length - 1];
    if (newRaw !== null) {
      // Replace
      const result = text.slice(0, target.start) + newRaw + text.slice(target.end);
      return result.replace(/\s{2,}/g, " ").trim();
    } else {
      // Remove
      const result = text.slice(0, target.start) + text.slice(target.end);
      return result.replace(/\s{2,}/g, " ").trim();
    }
  }

  // No existing token of this type
  if (newRaw !== null) {
    // Append
    return (text + " " + newRaw).trim();
  }

  return text;
}

const REVERSE_DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Convert a RecurrenceRule back to natural language text */
export function recurrenceToToken(rule: RecurrenceRule): string {
  if (rule.type === "daily") return "every day";
  if (rule.type === "fixed_weekly") {
    const days = (rule.days_of_week ?? []);
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "every weekday";
    return "every " + days.map((d) => REVERSE_DAY_NAMES[d]).join(", ");
  }
  if (rule.type === "interval") {
    const n = rule.interval_days ?? 1;
    if (n === 7) return "every week";
    if (n % 7 === 0 && n > 0) return `every ${n / 7} weeks`;
    return `every ${n} days`;
  }
  if (rule.type === "monthly") {
    const day = rule.day_of_month;
    const interval = rule.interval_months ?? 1;
    const suffix = (n: number) => {
      if (n >= 11 && n <= 13) return `${n}th`;
      const last = n % 10;
      if (last === 1) return `${n}st`;
      if (last === 2) return `${n}nd`;
      if (last === 3) return `${n}rd`;
      return `${n}th`;
    };
    if (interval === 1 && day) return `every ${suffix(day)}`;
    if (interval === 1) return "every month";
    if (day) return `every ${interval} months on the ${suffix(day)}`;
    return `every ${interval} months`;
  }
  return "every day";
}
