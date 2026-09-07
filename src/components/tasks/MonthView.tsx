import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  getISOWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Task } from "@/types/daily";
import type { PlanningMarker } from "@/hooks/usePlanningMarkers";
import { MARKER_STYLES } from "@/hooks/usePlanningMarkers";
import { formatDuration } from "@/lib/formatDuration";

interface MonthViewProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  tasks: Task[];
  markersByDate: Map<string, PlanningMarker[]>;
  onCellClick: (dateStr: string) => void;
  onClickTask: (id: string) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthWeeks(month: Date): Date[][] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });

  const weeks: Date[][] = [];
  let current = gridStart;

  while (current <= monthEnd || current.getDay() !== 1) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(current);
      current = addDays(current, 1);
    }
    weeks.push(week);
    if (current > monthEnd && current.getDay() === 1) break;
  }

  return weeks;
}

export function MonthView({
  month,
  onMonthChange,
  tasks,
  markersByDate,
  onCellClick,
  onClickTask,
}: MonthViewProps) {
  const weeks = useMemo(() => getMonthWeeks(month), [month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.scheduled_date) continue;
      const existing = map.get(task.scheduled_date) ?? [];
      existing.push(task);
      map.set(task.scheduled_date, existing);
    }
    return map;
  }, [tasks]);

  const isCurrentMonth = isSameMonth(month, new Date());

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(subMonths(month, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {format(month, "MMMM yyyy")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isCurrentMonth && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => onMonthChange(startOfMonth(new Date()))}
          >
            Today
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-center"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-border last:border-b-0"
          >
            {week.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, month);
              const today = isToday(day);
              const dayTasks = tasksByDate.get(dateStr) ?? [];
              const dayMarkers = markersByDate.get(dateStr) ?? [];
              const openTasks = dayTasks.filter((t) => t.status === "open");
              const totalMinutes = openTasks.reduce(
                (sum, t) => sum + (t.estimated_minutes ?? 0),
                0
              );
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <button
                  key={dateStr}
                  onClick={() => onCellClick(dateStr)}
                  className={`
                    relative flex flex-col p-1.5 min-h-[100px] text-left
                    border-r border-border last:border-r-0
                    hover:bg-accent/30 transition-colors
                    ${!inMonth ? "bg-muted/20" : isWeekend ? "bg-muted/10" : ""}
                    ${today ? "ring-1 ring-inset ring-primary" : ""}
                  `}
                >
                  {/* Day number + load */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs leading-none ${
                        today
                          ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-medium"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {openTasks.length > 0 && (
                      <span
                        className={`text-[9px] tabular-nums ${
                          totalMinutes > 960
                            ? "text-amber-500 font-medium"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {openTasks.length}t
                        {totalMinutes > 0 && (
                          <> · {formatDuration(totalMinutes)}</>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Task bars (up to 2) */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    {dayTasks.slice(0, 2).map((task) => {
                      const priorityColor =
                        task.priority === 3
                          ? "bg-red-500"
                          : task.priority === 2
                            ? "bg-amber-500"
                            : "bg-transparent";
                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClickTask(task.id);
                          }}
                          className={`flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/50 ${
                            task.status === "done"
                              ? "opacity-50"
                              : ""
                          }`}
                        >
                          <div
                            className={`w-1 h-3 rounded-full shrink-0 ${priorityColor}`}
                          />
                          <span
                            className={`text-[10px] leading-tight truncate ${
                              task.status === "done"
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                      );
                    })}
                    {dayTasks.length > 2 && (
                      <span className="text-[9px] text-muted-foreground/50 px-1">
                        +{dayTasks.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Markers */}
                  {dayMarkers.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {dayMarkers.map((marker) => (
                        <Tooltip key={marker.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${MARKER_STYLES[marker.type].dot}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            <span className="font-medium">
                              {MARKER_STYLES[marker.type].label}:
                            </span>{" "}
                            {marker.title}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
