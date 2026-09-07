import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Inbox as InboxIcon, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskCheckbox } from "@/components/ui/TaskCheckbox";
import { TaskDetailModal } from "@/components/today/TaskDetailModal";
import { useTasks, type TaskUpdate } from "@/hooks/useTasks";
import { useGoals } from "@/hooks/useGoals";
import { getTaskPriorityMeta } from "@/lib/taskPriority";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return format(new Date(value + "T00:00:00"), "MMM d");
}

const Inbox = () => {
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

  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const goalTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of goals) map.set(g.id, g.title);
    return map;
  }, [goals]);

  const inboxTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status === "open" && !t.scheduled_date)
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.created_at.localeCompare(b.created_at);
      });
  }, [tasks]);

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

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Inbox
          </h1>
          {inboxTasks.length > 0 && (
            <Badge variant="secondary" className="text-xs tabular-nums">
              {inboxTasks.length}
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New task
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </div>
      ) : inboxTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <InboxIcon className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            No unscheduled tasks. Everything is planned.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Task</TableHead>
                <TableHead className="w-20">Priority</TableHead>
                <TableHead className="w-24">Due</TableHead>
                <TableHead className="w-32">Goal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inboxTasks.map((task) => {
                const priority = getTaskPriorityMeta(task.priority);
                const goalTitle = task.goal_id
                  ? goalTitleById.get(task.goal_id)
                  : null;
                const overdue =
                  task.due_date && task.due_date < todayStr;
                return (
                  <TableRow
                    key={task.id}
                    onClick={() => setDetailTaskId(task.id)}
                    className="cursor-pointer"
                  >
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="pr-0"
                    >
                      <TaskCheckbox
                        checked={false}
                        onChange={(done) => handleToggle(task.id, done)}
                        priorityBorderClass={priority.borderClass}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="line-clamp-1">{task.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${priority.selectedClass}`}
                      >
                        {priority.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <span className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {formatDate(task.due_date)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {goalTitle ? (
                        <span className="line-clamp-1" title={goalTitle}>
                          {goalTitle}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailModal
        task={null}
        mode="create"
        open={creating}
        onOpenChange={setCreating}
        onOpenTask={(id) => setDetailTaskId(id)}
      />

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
};

export default Inbox;
