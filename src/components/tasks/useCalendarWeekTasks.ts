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
  stats: Record<string, DayStats>;
}

export function useCalendarWeekTasks(tasks: Task[], weekStart: Date): CalendarWeekData {
  return useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) =>
      format(addDays(weekStart, i), "yyyy-MM-dd")
    );

    const byDay: Record<string, Task[]> = {};
    days.forEach((d) => (byDay[d] = []));

    for (const task of tasks) {
      if (days.includes(task.scheduled_date)) {
        byDay[task.scheduled_date].push(task);
      }
    }

    // Sort tasks within each day by creation date
    for (const day of days) {
      byDay[day].sort((a, b) => a.created_at.localeCompare(b.created_at));
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

    return { days, byDay, stats };
  }, [tasks, weekStart]);
}
