export type TaskPriority = 1 | 2 | 3;

type TaskPriorityLabel = "Low" | "Medium" | "High";

export interface TaskPriorityMeta {
  value: TaskPriority;
  label: TaskPriorityLabel;
  textClass: string;
  dotClass: string;
  borderClass: string;
  selectedClass: string;
  subtleBgClass: string;
}

const PRIORITY_META: Record<TaskPriority, TaskPriorityMeta> = {
  1: {
    value: 1,
    label: "Low",
    textClass: "text-zinc-600 dark:text-zinc-400",
    dotClass: "bg-zinc-400 dark:bg-zinc-500",
    borderClass: "border-zinc-400 dark:border-zinc-500",
    selectedClass: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
    subtleBgClass: "bg-zinc-500/10",
  },
  2: {
    value: 2,
    label: "Medium",
    textClass: "text-violet-600 dark:text-violet-400",
    dotClass: "bg-violet-400 dark:bg-violet-500",
    borderClass: "border-violet-400 dark:border-violet-500",
    selectedClass: "bg-violet-400/15 text-violet-600 dark:text-violet-400 border-violet-400/40",
    subtleBgClass: "bg-violet-400/15",
  },
  3: {
    value: 3,
    label: "High",
    textClass: "text-rose-600 dark:text-rose-400",
    dotClass: "bg-rose-400 dark:bg-rose-500",
    borderClass: "border-rose-400 dark:border-rose-500",
    selectedClass: "bg-rose-400/10 text-rose-600 dark:text-rose-400 border-rose-400/40",
    subtleBgClass: "bg-rose-400/10",
  },
};

export const TASK_PRIORITY_ASC: readonly TaskPriority[] = [1, 2, 3];
export const TASK_PRIORITY_DESC: readonly TaskPriority[] = [3, 2, 1];

function normalizePriority(priority: number): TaskPriority {
  if (priority === 1 || priority === 2 || priority === 3) return priority;
  return 2;
}

export function getTaskPriorityMeta(priority: number): TaskPriorityMeta {
  return PRIORITY_META[normalizePriority(priority)];
}
