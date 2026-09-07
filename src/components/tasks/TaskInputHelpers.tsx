import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import type { ParsedToken } from "@/lib/taskParser";
import type { RecurrenceRule } from "@/lib/recurrence";

// ── Goal autocomplete dropdown ────────────────────────────────────────

export interface GoalOption {
  id: string;
  title: string;
}

export function GoalAutocomplete({
  query,
  goals,
  selectedGoalId,
  onSelect,
  visible,
  emptyLabel = "No goals found",
  activeIdx: controlledIdx,
}: {
  query: string;
  goals: GoalOption[];
  selectedGoalId?: string | null;
  onSelect: (goal: GoalOption) => void;
  visible: boolean;
  emptyLabel?: string;
  activeIdx?: number;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return goals
      .filter((g) => g.id !== selectedGoalId)
      .filter((g) => (q ? g.title.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [query, goals, selectedGoalId]);

  const activeIdx = controlledIdx ?? 0;

  if (!visible) return null;

  return (
    <div className="absolute z-50 mt-1 w-72 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
      {filtered.map((goal, i) => (
        <button
          key={goal.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(goal);
          }}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${
            i === activeIdx ? "bg-accent" : ""
          }`}
        >
          <span className="truncate block">{goal.title}</span>
        </button>
      ))}
      {filtered.length === 0 && (
        <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  );
}

/** Get filtered goal count for keyboard navigation */
export function getGoalAutocompleteCount(query: string, goals: GoalOption[], selectedGoalId?: string | null): number {
  const q = query.trim().toLowerCase();
  return goals.filter((g) => g.id !== selectedGoalId).filter((g) => (q ? g.title.toLowerCase().includes(q) : true)).slice(0, 8).length;
}

/** Get goal at a specific index */
export function getGoalAtIndex(query: string, goals: GoalOption[], selectedGoalId: string | null | undefined, idx: number): GoalOption | null {
  const q = query.trim().toLowerCase();
  const filtered = goals.filter((g) => g.id !== selectedGoalId).filter((g) => (q ? g.title.toLowerCase().includes(q) : true)).slice(0, 8);
  return filtered[idx] ?? null;
}

// ── Highlighted name input ────────────────────────────────────────────

export function HighlightedInput({
  value,
  tokens,
  inactiveTokens,
  onChange,
  onKeyDown,
  onCaretChange,
  onFocus,
  onBlur,
  inputRef,
  placeholder,
}: {
  value: string;
  tokens: ParsedToken[];
  inactiveTokens?: ParsedToken[];
  onChange: (val: string, caret: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCaretChange: (caret: number) => void;
  onFocus: () => void;
  onBlur: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}) {
  const inactiveSet = useMemo(
    () => new Set((inactiveTokens ?? []).map((t) => `${t.start}:${t.end}`)),
    [inactiveTokens]
  );

  const segments = useMemo(() => {
    const parts: { text: string; highlighted: boolean; inactive: boolean; type?: string }[] = [];
    let lastIdx = 0;
    for (const t of tokens) {
      if (t.start > lastIdx) {
        parts.push({ text: value.slice(lastIdx, t.start), highlighted: false, inactive: false });
      }
      const isInactive = inactiveSet.has(`${t.start}:${t.end}`);
      parts.push({ text: value.slice(t.start, t.end), highlighted: !isInactive, inactive: isInactive, type: t.type });
      lastIdx = t.end;
    }
    if (lastIdx < value.length) {
      parts.push({ text: value.slice(lastIdx), highlighted: false, inactive: false });
    }
    return parts;
  }, [value, tokens, inactiveSet]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={onKeyDown}
        onClick={(e) => onCaretChange(e.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(e) => onCaretChange(e.currentTarget.selectionStart ?? value.length)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder ?? "Task name (try: Buy milk tomorrow !1)"}
        className="text-sm relative z-10 bg-transparent caret-foreground"
        autoFocus
      />
      {tokens.length > 0 && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center px-3 text-sm overflow-hidden whitespace-pre"
          aria-hidden
        >
          {segments.map((seg, i) => (
            <span
              key={i}
              className={
                seg.inactive
                  ? "rounded text-transparent"
                  : seg.highlighted
                    ? `rounded ${tokenTypeColor(seg.type)}`
                    : "text-transparent"
              }
            >
              {seg.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline context detection helpers ──────────────────────────────────

export function getNameGoalContext(value: string, caret: number): { query: string; queryStart: number; queryEnd: number } | null {
  const beforeCaret = value.slice(0, caret);
  const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  if (!match) return null;

  const atIndex = beforeCaret.lastIndexOf("@");
  if (atIndex < 0) return null;

  return {
    query: match[1].toLowerCase(),
    queryStart: atIndex + 1,
    queryEnd: caret,
  };
}

export function normalizeGoalLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function toGoalToken(title: string): string {
  const token = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return token || "goal";
}

export function stripGoalTokensFromName(value: string, tokens: ParsedToken[]): string {
  const goalTokens = tokens
    .filter((token) => token.type === "goal")
    .sort((a, b) => b.start - a.start);

  if (goalTokens.length === 0) return value;

  let next = value;
  for (const token of goalTokens) {
    next = `${next.slice(0, token.start)}${next.slice(token.end)}`;
  }

  return next.replace(/\s{2,}/g, " ").trim();
}

// ── Recurrence description helper ────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export { DAY_NAMES };

function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.type === "daily") return "Every day";
  if (rule.type === "fixed_weekly") {
    const days = (rule.days_of_week ?? []).map((d) => DAY_NAMES[d]).join(", ");
    return days || "Specific days";
  }
  if (rule.type === "interval") {
    const n = rule.interval_days ?? 1;
    return n % 7 === 0 ? `Every ${n / 7} week${n / 7 === 1 ? "" : "s"}` : `Every ${n} day${n === 1 ? "" : "s"}`;
  }
  if (rule.type === "monthly") {
    const day = rule.day_of_month;
    const interval = rule.interval_months ?? 1;
    const dayStr = day ? `on the ${ordinalSuffix(day)}` : "";
    if (interval === 1) {
      return day ? `Every month ${dayStr}` : "Every month";
    }
    return day ? `Every ${interval} months ${dayStr}` : `Every ${interval} months`;
  }
  return "Recurring";
}

// ── Token pill display helpers ───────────────────────────────────────

export function tokenLabel(t: ParsedToken): string {
  switch (t.type) {
    case "date": return `Date: ${t.value}`;
    case "goal": return `Goal: @${t.value}`;
    case "priority": return `Priority: ${t.value === 3 ? "High" : t.value === 1 ? "Low" : "Medium"}`;
    case "estimate": return `Estimate: ${t.value} min`;
    case "recurrence": return `Repeat: ${describeRecurrence(t.value as RecurrenceRule)}`;
  }
}

export function tokenTypeColor(type?: string): string {
  switch (type) {
    case "date": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "goal": return "bg-pink-500/10 text-pink-700 dark:text-pink-400";
    case "priority": return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "estimate": return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "recurrence": return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    default: return "";
  }
}
