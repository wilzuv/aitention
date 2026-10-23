import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { getISOWeek } from "date-fns";
import type { Task } from "@/types/daily";
import type { PlanningMarker } from "@/hooks/usePlanningMarkers";
import { useWeekNavigation } from "@/hooks/useWeekNavigation";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { WeekNavigator } from "@/components/WeekNavigator";
import { useCalendarWeekTasks } from "./useCalendarWeekTasks";
import { CalendarDayColumn } from "./CalendarDayColumn";
import { DraggableTaskCard } from "./DraggableTaskCard";

interface CalendarWeekViewProps {
  tasks: Task[];
  markersByDate?: Map<string, PlanningMarker[]>;
  onReschedule: (id: string, toDate: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onClickTask: (id: string) => void;
}

export function CalendarWeekView({
  tasks,
  markersByDate,
  onReschedule,
  onToggle,
  onClickTask,
}: CalendarWeekViewProps) {
  const { weekStart, goToWeek } = useWeekNavigation();
  const { days, byDay, stats } = useCalendarWeekTasks(tasks, weekStart);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: gcalData } = useGoogleCalendar(weekStart);
  const gcalEvents = gcalData?.events ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const activeTask = activeId
    ? tasks.find((t) => t.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetId = over.id as string;

    if (targetId.startsWith("day-")) {
      const targetDate = targetId.replace("day-", "");
      const task = tasks.find((t) => t.id === taskId);
      if (task?.scheduled_date === targetDate) return;
      onReschedule(taskId, targetDate);
    }
  }

  const weekNumber = getISOWeek(weekStart);

  return (
    <div className="space-y-3">
      {/* Week navigation + week number */}
      <div className="flex items-center justify-between gap-2">
        <WeekNavigator weekStart={weekStart} onWeekChange={goToWeek} allowFuture />
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
          W{weekNumber}
        </span>
      </div>

      {/* Calendar grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex border border-border rounded-lg overflow-hidden bg-card">
          {/* Day columns */}
          <div className="flex flex-1 min-w-0">
            {days.map((day) => (
              <CalendarDayColumn
                key={day}
                dateStr={day}
                tasks={byDay[day]}
                stats={stats[day]}
                calendarEvents={gcalEvents}
                markers={markersByDate?.get(day)}
                onToggle={onToggle}
                onClickTask={onClickTask}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask ? (
            <DraggableTaskCard
              task={activeTask}
              onToggle={onToggle}
              onClick={onClickTask}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
