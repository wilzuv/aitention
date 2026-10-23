import type { Task } from "@/types/daily";

export type TaskSortOption =
  | "due_date_asc"
  | "due_date_desc"
  | "created_at_desc"
  | "created_at_asc";

export const DEFAULT_TASK_SORT: TaskSortOption = "due_date_asc";

export const TASK_SORT_OPTIONS: ReadonlyArray<{ value: TaskSortOption; label: string }> = [
  { value: "due_date_asc", label: "Due date (soonest first)" },
  { value: "due_date_desc", label: "Due date (latest first)" },
  { value: "created_at_desc", label: "Created (newest first)" },
  { value: "created_at_asc", label: "Created (oldest first)" },
];

export function isTaskSortOption(value: unknown): value is TaskSortOption {
  return TASK_SORT_OPTIONS.some((option) => option.value === value);
}

function compareNullableDates(a: string | null, b: string | null, ascending: boolean): number {
  if (a && b) {
    return ascending ? a.localeCompare(b) : b.localeCompare(a);
  }
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function compareDueDate(a: Task, b: Task, ascending: boolean): number {
  const dateComparison = compareNullableDates(a.due_date, b.due_date, ascending);
  if (dateComparison !== 0) return dateComparison;

  const scheduledComparison = ascending
    ? a.scheduled_date.localeCompare(b.scheduled_date)
    : b.scheduled_date.localeCompare(a.scheduled_date);
  if (scheduledComparison !== 0) return scheduledComparison;

  return ascending
    ? a.created_at.localeCompare(b.created_at)
    : b.created_at.localeCompare(a.created_at);
}

export function compareTasksBySort(a: Task, b: Task, sort: TaskSortOption): number {
  switch (sort) {
    case "due_date_asc":
      return compareDueDate(a, b, true);
    case "due_date_desc":
      return compareDueDate(a, b, false);
    case "created_at_desc":
      return b.created_at.localeCompare(a.created_at);
    case "created_at_asc":
      return a.created_at.localeCompare(b.created_at);
    default:
      return compareDueDate(a, b, true);
  }
}
