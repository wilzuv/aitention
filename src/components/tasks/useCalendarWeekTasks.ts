import { useMemo } from "react";
import { addDays, format } from "date-fns";
import type { Task } from "@/types/daily";

export interface DayStats {
  count: number;
  totalMinutes: number;
  unestimated: number;
}

export interface CalendarWeekData {
  days: string[];
  byDay: Record<string, Task[]>;
  unscheduled: Task[];
  stats: Record<string, DayStats>;
}

export function useCalendarWeekTasks(tasks: Task[], weekStart: Date): CalendarWeekData {
  return useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) =>
      format(addDays(weekStart, i), "yyyy-MM-dd")
    );

    const byDay: Record<string, Task[]> = {};
    days.forEach((d) => (byDay[d] = []));
    const unscheduled: Task[] = [];

    for (const task of tasks) {
      if (task.scheduled_date && days.includes(task.scheduled_date)) {
        byDay[task.scheduled_date].push(task);
      } else if (!task.scheduled_date) {
        unscheduled.push(task);
      }
    }

    // Sort tasks within each day: high priority first, then by creation date
    for (const day of days) {
      byDay[day].sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.created_at.localeCompare(b.created_at);
      });
    }

    const stats: Record<string, DayStats> = {};
    for (const day of days) {
      const dayTasks = byDay[day];
      stats[day] = {
        count: dayTasks.length,
        totalMinutes: dayTasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0),
        unestimated: dayTasks.filter((t) => t.estimated_minutes == null).length,
      };
    }

    return { days, byDay, unscheduled, stats };
  }, [tasks, weekStart]);
}
