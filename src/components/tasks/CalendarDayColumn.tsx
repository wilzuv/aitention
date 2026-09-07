import { useDroppable } from "@dnd-kit/core";
import { format, isToday, parseISO } from "date-fns";
import { Target, GitBranch, FlaskConical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Task } from "@/types/daily";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { PlanningMarker } from "@/hooks/usePlanningMarkers";
import { MARKER_STYLES } from "@/hooks/usePlanningMarkers";
import { formatDuration } from "@/lib/formatDuration";
import type { DayStats } from "./useCalendarWeekTasks";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { CalendarEventOverlay } from "./CalendarEventOverlay";

const MARKER_ICONS = {
  goal_review: Target,
  decision_review: GitBranch,
  experiment_end: FlaskConical,
} as const;

interface CalendarDayColumnProps {
  dateStr: string;
  tasks: Task[];
  stats: DayStats;
  calendarEvents?: CalendarEvent[];
  markers?: PlanningMarker[];
  onToggle: (id: string, done: boolean) => void;
  onClickTask: (id: string) => void;
}

function TaskCard({ task, onToggle, onClickTask }: { task: Task; onToggle: (id: string, done: boolean) => void; onClickTask: (id: string) => void }) {
  return (
    <DraggableTaskCard
      task={task}
      onToggle={onToggle}
      onClick={onClickTask}
    />
  );
}

export function CalendarDayColumn({
  dateStr,
  tasks,
  stats,
  calendarEvents,
  markers,
  onToggle,
  onClickTask,
}: CalendarDayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateStr}` });
  const date = parseISO(dateStr);
  const today = isToday(date);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col min-w-0 flex-1 border-r border-border last:border-r-0
        ${isOver ? "bg-primary/5" : ""}
        ${today ? "bg-accent/30" : ""}
      `}
    >
      {/* Day header */}
      <div className={`px-2 py-1.5 border-b border-border ${today ? "bg-primary/10" : "bg-muted/30"}`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${today ? "text-primary" : "text-foreground"}`}>
            {format(date, "EEE")}
          </span>
          <span
            className={`text-xs ${
              today
                ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-medium"
                : "text-muted-foreground"
            }`}
          >
            {format(date, "d")}
          </span>
        </div>
        {/* Compact metadata */}
        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
          {stats.count > 0 ? (
            <>
              {stats.count} task{stats.count !== 1 ? "s" : ""}
              {stats.totalMinutes > 0 && <> · {formatDuration(stats.totalMinutes)}</>}
              {stats.unestimated > 0 && <> · {stats.unestimated} unest</>}
            </>
          ) : (
            <span className="invisible">-</span>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 p-1 overflow-y-auto min-h-[120px]">
        {/* Google Calendar events */}
        {calendarEvents && calendarEvents.length > 0 && (
          <CalendarEventOverlay events={calendarEvents} dayDate={dateStr} />
        )}

        {/* Planning markers */}
        {markers && markers.length > 0 && (
          <div className="space-y-0.5 mb-1.5">
            {markers.map((marker) => {
              const Icon = MARKER_ICONS[marker.type];
              const style = MARKER_STYLES[marker.type];
              return (
                <Tooltip key={marker.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px] leading-tight ${style.chip}`}
                    >
                      <Icon className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{marker.title}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {style.label}: {marker.title}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Tasks */}
        <div className="space-y-1">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggle} onClickTask={onClickTask} />
          ))}
        </div>

        {/* Empty drop zone indicator */}
        {tasks.length === 0 && (!markers || markers.length === 0) && (
          <div className={`flex-1 min-h-[60px] rounded border border-dashed transition-colors ${
            isOver ? "border-primary/40" : "border-transparent"
          }`} />
        )}
      </div>
    </div>
  );
}
