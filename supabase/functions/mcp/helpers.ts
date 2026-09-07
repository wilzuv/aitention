// Shared utilities for MCP tool handlers (read + write).
//
// Logic mirrored from the in-app implementations in src/services/. When
// behaviour drifts there it must be re-applied here too — the source-of-truth
// file:line refs sit on each helper.

/** Format a YYYY-MM-DD date string offset by `n` days. */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isoNow(): string {
  return new Date().toISOString();
}

// ── Errors ────────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ── Priority word ⇄ number ────────────────────────────────────────────────
// The tasks.priority column stores a number; the convention is
// 1=low, 2=medium, 3=high (src/types/daily.ts:87). LLMs reliably confuse the
// numeric mapping, so the MCP surface speaks the *words* and maps at the
// boundary — DB and UI stay numeric, the agent never has to remember which
// number is which.

export type PriorityWord = "high" | "medium" | "low";

const PRIORITY_WORD_TO_NUM: Record<PriorityWord, number> = {
  low: 1,
  medium: 2,
  high: 3,
};
const PRIORITY_NUM_TO_WORD: Record<number, PriorityWord> = {
  1: "low",
  2: "medium",
  3: "high",
};

/** Map a priority word to its stored number. Throws on an unrecognised value. */
export function priorityWordToNum(value: unknown): number {
  const key = String(value).toLowerCase();
  const n = PRIORITY_WORD_TO_NUM[key as PriorityWord];
  if (n === undefined) {
    throw new ValidationError(
      `priority must be one of "high", "medium", "low" (got ${JSON.stringify(value)})`,
    );
  }
  return n;
}

/** Map a stored priority number back to its word (for read output). */
export function priorityNumToWord(value: unknown): PriorityWord | null {
  if (value == null) return null;
  return PRIORITY_NUM_TO_WORD[Number(value)] ?? null;
}

// ── Schedule history dedup ────────────────────────────────────────────────
// Mirrors src/services/taskService.ts:228-238 (rescheduleTask).
// Caps to one reschedule entry per calendar day — keeping the latest. Filters
// out misclick noise while preserving the signal of multi-day postponements.

export interface ScheduleHistoryEntry {
  from: string;
  to: string;
  changed_at: string;
}

export function dedupScheduleHistory(
  current: ScheduleHistoryEntry[],
  next: ScheduleHistoryEntry,
): ScheduleHistoryEntry[] {
  const day = next.changed_at.slice(0, 10);
  return [...current.filter((e) => e.changed_at.slice(0, 10) !== day), next];
}
