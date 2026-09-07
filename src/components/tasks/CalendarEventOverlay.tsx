import { format, parseISO } from "date-fns";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";

const EVENT_COLORS = [
  "bg-primary/10 border-primary/30 text-primary",
  "bg-blue-500/10 border-blue-500/30 text-blue-400",
  "bg-purple-500/10 border-purple-500/30 text-purple-400",
  "bg-teal-500/10 border-teal-500/30 text-teal-400",
  "bg-amber-500/10 border-amber-500/30 text-amber-400",
  "bg-pink-500/10 border-pink-500/30 text-pink-400",
];

interface CalendarEventOverlayProps {
  events: CalendarEvent[];
  dayDate: string; // YYYY-MM-DD
}

export function CalendarEventOverlay({ events, dayDate }: CalendarEventOverlayProps) {
  const dayEvents = events.filter((e) => {
    if (e.allDay) {
      const startDate = e.start?.split("T")[0] ?? "";
      return startDate === dayDate;
    }
    if (!e.start) return false;
    try {
      return format(parseISO(e.start), "yyyy-MM-dd") === dayDate;
    } catch {
      return false;
    }
  });

  if (dayEvents.length === 0) return null;

  return (
    <div className="space-y-0.5 mb-1">
      {dayEvents.map((event, i) => {
        const colorClass = EVENT_COLORS[i % EVENT_COLORS.length];
        const timeStr = event.allDay
          ? "All day"
          : event.start
            ? format(parseISO(event.start), "h:mm a")
            : "";

        return (
          <div
            key={event.id}
            className={`rounded px-1.5 py-0.5 text-[10px] border-l-2 truncate ${colorClass}`}
            title={`${event.summary}${timeStr ? ` - ${timeStr}` : ""}`}
          >
            <span className="font-medium truncate">{event.summary}</span>
            {timeStr && (
              <span className="text-muted-foreground/60 ml-1">{timeStr}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
