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
