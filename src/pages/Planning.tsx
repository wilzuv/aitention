import { useState, useMemo } from "react";
import { startOfMonth } from "date-fns";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTasks, type TaskUpdate } from "@/hooks/useTasks";
import { usePlanningMarkers } from "@/hooks/usePlanningMarkers";
import { CalendarWeekView } from "@/components/tasks/CalendarWeekView";
import { MonthView } from "@/components/tasks/MonthView";
import { TaskDetailModal } from "@/components/today/TaskDetailModal";

type PlanningView = "week" | "month";

const Planning = () => {
  const [view, setView] = useState<PlanningView>("week");
  const [hideDone, setHideDone] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const {
    tasks,
    updateTask,
    deleteTask,
    completeTask,
    rescheduleTask,
    discardTask,
  } = useTasks({});

  const { markersByDate } = usePlanningMarkers();

  const calendarTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === "discarded") return false;
      if (hideDone && t.status === "done") return false;
      return true;
    });
  }, [tasks, hideDone]);

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

  const handleReschedule = (id: string, toDate: string | null) => {
    rescheduleTask.mutate({ id, toDate });
  };

  const handleMonthCellClick = (dateStr: string) => {
    setView("week");
  };

  const detailTask = tasks.find((t) => t.id === detailTaskId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Planning
        </h1>

        <div className="flex items-center gap-2">
          {/* Hide done toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={() => setHideDone(!hideDone)}
              >
                {hideDone ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                Done
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hideDone ? "Show completed tasks" : "Hide completed tasks"}
            </TooltipContent>
          </Tooltip>

          {/* View toggle */}
          <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => setView("week")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                view === "week"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                view === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar views */}
      {view === "week" ? (
        <CalendarWeekView
          tasks={calendarTasks}
          markersByDate={markersByDate}
          onReschedule={handleReschedule}
          onToggle={handleToggle}
          onClickTask={(id) => setDetailTaskId(id)}
        />
      ) : (
        <MonthView
          month={monthAnchor}
          onMonthChange={setMonthAnchor}
          tasks={calendarTasks}
          markersByDate={markersByDate}
          onCellClick={handleMonthCellClick}
          onClickTask={(id) => setDetailTaskId(id)}
        />
      )}

      <TaskDetailModal
        task={detailTask}
        open={!!detailTaskId}
        onOpenChange={(open) => {
          if (!open) setDetailTaskId(null);
        }}
        onUpdate={handleUpdate}
        onComplete={(id) => handleToggle(id, true)}
        onReschedule={handleReschedule}
        onDiscard={(id) => discardTask.mutate(id)}
        onDelete={(id) => deleteTask.mutate(id)}
      />
    </div>
  );
};

export default Planning;
