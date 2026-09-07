import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ListToolbar,
  MultiFilterSelect,
  SearchInput,
  SortableTableHead,
  getDefaultValues,
} from "@/components/crud/ListControls";
import { useTableSort } from "@/components/crud/useTableSort";
import { TaskCheckbox } from "@/components/ui/TaskCheckbox";
import { TaskDetailModal } from "@/components/today/TaskDetailModal";
import { useTasks, type TaskUpdate } from "@/hooks/useTasks";
import { useGoals } from "@/hooks/useGoals";
import { getTaskPriorityMeta } from "@/lib/taskPriority";
import { isOverdue } from "@/lib/taskUtils";

const statusOptions = [
  { value: "open", label: "Open", defaultActive: true },
  { value: "done", label: "Done" },
  { value: "discarded", label: "Discarded" },
];

const priorityOptions = [
  { value: "3", label: "High" },
  { value: "2", label: "Medium" },
  { value: "1", label: "Low" },
];

const statusColors: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  done: "bg-emerald-500/10 text-emerald-600",
  discarded: "bg-muted text-muted-foreground",
};

function formatScheduled(value: string | null): string {
  if (!value) return "—";
  return format(new Date(value + "T00:00:00"), "MMM d");
}

export function TaskListPage() {
  const {
    tasks,
    isLoading,
    updateTask,
    deleteTask,
    completeTask,
    rescheduleTask,
    discardTask,
  } = useTasks({});
  const { goals } = useGoals({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(getDefaultValues(statusOptions));
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || tasks.length === 0) return;
    if (tasks.some((t) => t.id === openId)) setDetailTaskId(openId);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, tasks, setSearchParams]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const goalTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of goals) map.set(g.id, g.title);
    return map;
  }, [goals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter.length > 0 && !statusFilter.includes(task.status)) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(String(task.priority))) return false;
      if (q && !task.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const sort = useTableSort(
    filtered,
    {
      title: (t) => t.title,
      priority: (t) => t.priority,
      scheduled: (t) => t.scheduled_date,
      status: (t) => t.status,
    },
    { key: "scheduled", dir: "asc" },
  );

  const handleToggle = (id: string, done: boolean) => {
    if (done) {
      completeTask.mutate(id);
    } else {
      updateTask.mutate({ id, updates: { status: "open", completed_at: null } });
    }
  };

  const handleUpdate = (id: string, updates: TaskUpdate) => {
    updateTask.mutate({ id, updates });
  };

  const detailTask = tasks.find((t) => t.id === detailTaskId) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Tasks
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New task
        </Button>
      </div>

      <ListToolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" />
        <MultiFilterSelect
          values={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          label="Status"
          ariaLabel="Filter by status"
        />
        <MultiFilterSelect
          values={priorityFilter}
          onChange={setPriorityFilter}
          options={priorityOptions}
          label="Priority"
          ariaLabel="Filter by priority"
        />
      </ListToolbar>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-1 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No tasks yet.
          </p>
        ) : sort.sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No tasks match your filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <SortableTableHead sortKey="title" label="Title" sort={sort} />
                <SortableTableHead sortKey="priority" label="Priority" sort={sort} />
                <TableHead>Goal</TableHead>
                <SortableTableHead sortKey="scheduled" label="Scheduled" sort={sort} />
                <TableHead>Est</TableHead>
                <SortableTableHead sortKey="status" label="Status" sort={sort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sort.sorted.map((task) => {
                const priority = getTaskPriorityMeta(task.priority);
                const goalTitle = task.goal_id ? goalTitleById.get(task.goal_id) : null;
                return (
                  <TableRow
                    key={task.id}
                    onClick={() => setDetailTaskId(task.id)}
                    className="cursor-pointer"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()} className="pr-0">
                      <TaskCheckbox
                        checked={task.status === "done"}
                        onChange={(done) => handleToggle(task.id, done)}
                        disabled={task.status === "discarded"}
                        priorityBorderClass={
                          task.status !== "done" ? priority.borderClass : undefined
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`line-clamp-2 ${
                            task.status === "done"
                              ? "text-muted-foreground line-through"
                              : task.status === "discarded"
                                ? "text-muted-foreground/60 italic"
                                : ""
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.recurrence_rule && (
                          <Repeat className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${priority.selectedClass}`}
                      >
                        {priority.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                      {goalTitle && task.goal_id ? (
                        <Link
                          to={`/goals?open=${task.goal_id}`}
                          className="line-clamp-1 text-primary/70 hover:text-primary hover:underline"
                          title={goalTitle}
                        >
                          {goalTitle}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatScheduled(task.scheduled_date)}
                      {isOverdue(task, todayStr) && (
                        <span className="ml-1.5 text-[10px] font-medium text-destructive">
                          overdue
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {task.estimated_minutes != null
                        ? `${task.actual_minutes > 0 ? `${task.actual_minutes}/` : ""}${task.estimated_minutes}m`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${statusColors[task.status] ?? ""}`}
                      >
                        {task.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create */}
      <TaskDetailModal
        task={null}
        mode="create"
        open={creating}
        onOpenChange={setCreating}
        onOpenTask={(id) => setDetailTaskId(id)}
      />

      {/* Detail / edit */}
      <TaskDetailModal
        task={detailTask}
        open={!!detailTaskId}
        onOpenChange={(open) => {
          if (!open) setDetailTaskId(null);
        }}
        onUpdate={handleUpdate}
        onComplete={(id) => handleToggle(id, true)}
        onReschedule={(id, toDate) => rescheduleTask.mutate({ id, toDate })}
        onDiscard={(id) => discardTask.mutate(id)}
        onDelete={(id) => deleteTask.mutate(id)}
      />
    </div>
  );
}
