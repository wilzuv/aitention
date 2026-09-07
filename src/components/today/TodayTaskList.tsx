import { memo, useCallback, useMemo, useState } from "react";
import { CheckSquare, ChevronRight, Play, ArrowUpDown, Target, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TaskCheckbox } from "@/components/ui/TaskCheckbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/daily";
import {
  compareTasksBySort,
  isTaskSortOption,
  TASK_SORT_OPTIONS,
  DEFAULT_TASK_SORT,
  type TaskSortOption,
} from "@/lib/taskSort";
import { getTaskPriorityMeta } from "@/lib/taskPriority";
import { formatDuration } from "@/lib/formatDuration";

const SORT_STORAGE_KEY = "today.tasks.sort.v1";

function loadSortPreference(): TaskSortOption {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored && isTaskSortOption(stored)) return stored;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_TASK_SORT;
}

function saveSortPreference(sort: TaskSortOption) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  } catch {
    // ignore
  }
}

// ─── Priority bar ────────────────────────────────────────────────────────────

function priorityBarClass(priority: number): string {
  return getTaskPriorityMeta(priority).dotClass;
}

// ─── Overdue helper ──────────────────────────────────────────────────────────

function getOverdueDate(task: Task): string | null {
  if (task.status !== "open") return null;
  const today = new Date().toISOString().slice(0, 10);
  if (task.due_date && task.due_date < today) return task.due_date;
  if (task.scheduled_date && task.scheduled_date < today) return task.scheduled_date;
  return null;
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  onToggle: (taskId: string, done: boolean) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskIds: string[]) => void;
}

const TaskRow = memo(function TaskRow({
  task,
  onToggle,
  onOpenDetail,
  onStartFocus,
}: TaskRowProps) {
  const isDone = task.status === "done";
  const priorityMeta = getTaskPriorityMeta(task.priority);
  const overdueDate = getOverdueDate(task);

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 px-3 py-2 rounded-md transition-colors",
        "hover:bg-surface-hover",
        isDone && "opacity-50"
      )}
    >
      {/* Priority bar — 3px left strip */}
      <div
        className={cn(
          "absolute left-0 top-2 bottom-2 w-[3px] rounded-full",
          overdueDate ? "bg-destructive/70" : priorityBarClass(task.priority)
        )}
        aria-hidden
      />

      {/* Checkbox */}
      <div className="mt-0.5 ml-1">
        <TaskCheckbox
          checked={isDone}
          onChange={(checked) => onToggle(task.id, checked)}
          priorityBorderClass={isDone ? undefined : priorityMeta.borderClass}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <button
          className={cn(
            "w-full text-left text-sm font-medium leading-snug truncate block",
            "hover:text-primary transition-colors",
            isDone && "line-through text-muted-foreground"
          )}
          onClick={() => onOpenDetail(task.id)}
          title={task.title}
        >
          {task.title}
        </button>

        {/* Meta row */}
        {(task.estimated_minutes || task.goal_id || overdueDate) && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {overdueDate && (
              <span className="flex items-center gap-0.5 text-xs text-destructive font-medium">
                <AlertTriangle className="w-3 h-3" />
                Overdue · {format(parseISO(overdueDate), "MMM d")}
              </span>
            )}
            {task.estimated_minutes && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(task.estimated_minutes)}
              </span>
            )}
            {task.goal_id && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Target className="w-3 h-3" />
                Goal
              </span>
            )}
          </div>
        )}
      </div>

      {/* Play button — only for open tasks, shown on hover */}
      {!isDone && (
        <button
          className={cn(
            "flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
            "p-1 rounded-md hover:bg-primary/10 hover:text-primary text-muted-foreground"
          )}
          onClick={() => onStartFocus([task.id])}
          title="Start focus session"
          aria-label={`Start focus session for "${task.title}"`}
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

// ─── TodayTaskList ────────────────────────────────────────────────────────────

interface TodayTaskListProps {
  className?: string;
  tasks: Task[];
  onToggleTask: (taskId: string, done: boolean) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onStartFocus: (taskIds: string[]) => void;
}

export function TodayTaskList({
  className,
  tasks,
  onToggleTask,
  onOpenTaskDetail,
  onStartFocus,
}: TodayTaskListProps) {
  const [sort, setSort] = useState<TaskSortOption>(loadSortPreference);
  const [doneExpanded, setDoneExpanded] = useState(false);

  const handleSortChange = useCallback((value: string) => {
    if (!isTaskSortOption(value)) return;
    setSort(value);
    saveSortPreference(value);
  }, []);

  const openTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "open")
        .sort((a, b) => compareTasksBySort(a, b, sort)),
    [tasks, sort],
  );

  const doneTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "done")
        .sort((a, b) => compareTasksBySort(a, b, sort)),
    [tasks, sort],
  );

  const currentSortLabel =
    TASK_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";

  const renderTask = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      onToggle={onToggleTask}
      onOpenDetail={onOpenTaskDetail}
      onStartFocus={onStartFocus}
    />
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header — stays pinned outside the scroll area */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckSquare className="w-4 h-4 text-primary" />
          Tasks
          {openTasks.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {openTasks.length} open
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Sort dropdown */}
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger
              className="h-7 text-xs gap-1 border-none shadow-none bg-transparent hover:bg-surface-hover w-auto px-2"
              aria-label="Sort tasks"
            >
              <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
              <SelectValue>{currentSortLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {TASK_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task items — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {openTasks.length === 0 && doneTasks.length === 0 && (
          <p className="text-sm text-muted-foreground px-4 py-3">No tasks for today.</p>
        )}

        <div className="space-y-0.5">{openTasks.map((task) => renderTask(task))}</div>

        {/* Done section */}
        {doneTasks.length > 0 && (
          <div className="mt-1">
            <button
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setDoneExpanded((prev) => !prev)}
              aria-expanded={doneExpanded}
            >
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition-transform",
                  doneExpanded && "rotate-90"
                )}
              />
              {doneTasks.length} done
            </button>

            {doneExpanded && (
              <div>
                {doneTasks.map((task) => renderTask(task))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
