/** Returns true if the task's scheduled_date or due_date is before `today` and status is open */
export function isOverdue(
  task: { scheduled_date: string | null; due_date: string | null; status: string },
  today: string,
): boolean {
  if (task.status !== "open") return false;
  return (
    (task.scheduled_date != null && task.scheduled_date < today) ||
    (task.due_date != null && task.due_date < today)
  );
}

/** Returns the original date string for an overdue task (prefers scheduled_date) */
export function overdueDate(task: { scheduled_date: string | null; due_date: string | null }): string | null {
  return task.scheduled_date ?? task.due_date;
}
