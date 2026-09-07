import { useMemo, useState } from "react";
import { useGoogleCalendar, CalendarEvent } from "@/hooks/useGoogleCalendar";
import { Calendar, ExternalLink, Clock, MapPin, RefreshCw, AlertCircle } from "lucide-react";
import {
  format,
  parseISO,
  startOfWeek,
  addDays,
  isSameDay,
  differenceInMinutes,
  isToday,
} from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const HOUR_HEIGHT = 48; // px per hour
const START_HOUR = 7;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EVENT_COLORS = [
  "bg-primary/20 border-primary/40 text-primary",
  "bg-blue-500/20 border-blue-500/40 text-blue-400",
  "bg-purple-500/20 border-purple-500/40 text-purple-400",
  "bg-amber-500/20 border-amber-500/40 text-amber-400",
  "bg-rose-500/20 border-rose-500/40 text-rose-400",
  "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
];

function getEventColor(index: number) {
  return EVENT_COLORS[index % EVENT_COLORS.length];
}

function EventBlock({ event, dayStart, colorIndex }: { event: CalendarEvent; dayStart: Date; colorIndex: number }) {
  if (!event.start || !event.end) return null;

  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const topMinutes = differenceInMinutes(start, new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), START_HOUR));
  const durationMinutes = Math.max(differenceInMinutes(end, start), 15);

  const top = Math.max(0, (topMinutes / 60) * HOUR_HEIGHT);
  const height = Math.max(18, (durationMinutes / 60) * HOUR_HEIGHT - 2);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`absolute left-0.5 right-0.5 rounded-md border px-1.5 py-0.5 text-left overflow-hidden cursor-pointer transition-opacity hover:opacity-80 ${getEventColor(colorIndex)}`}
          style={{ top, height, fontSize: height < 30 ? 10 : 11 }}
        >
          <span className="font-medium leading-tight line-clamp-2">{event.summary}</span>
          {height >= 36 && (
            <span className="block text-xs opacity-70 leading-tight mt-0.5">
              {format(start, "HH:mm")} – {format(end, "HH:mm")}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" side="left" align="start">
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">{event.summary}</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{format(start, "EEE, MMM d · HH:mm")} – {format(end, "HH:mm")}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
            {event.description && (
              <p className="text-muted-foreground/80 line-clamp-3 pt-1 border-t border-border">
                {event.description}
              </p>
            )}
          </div>
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open in Google Calendar
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AllDayBanner({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="flex gap-1 px-1 py-0.5 min-h-[20px]">
      {events.map((e, i) => (
        <a
          key={e.id}
          href={e.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-medium px-1.5 py-0.5 rounded truncate max-w-full ${getEventColor(i)}`}
        >
          {e.summary}
        </a>
      ))}
    </div>
  );
}

export function InteractiveCalendar() {
  const [weekOffset] = useState(0);
  const now = new Date();
  const weekStart = startOfWeek(addDays(now, weekOffset * 7), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data, isLoading, error, refetch, isRefetching } = useGoogleCalendar(weekStart);
  const events = data?.events || [];

  const { timedByDay, allDayByDay } = useMemo(() => {
    const timed: Record<string, CalendarEvent[]> = {};
    const allDay: Record<string, CalendarEvent[]> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      timed[key] = [];
      allDay[key] = [];
    });
    events.forEach((e) => {
      if (!e.start) return;
      const key = format(parseISO(e.start), "yyyy-MM-dd");
      if (e.allDay) {
        allDay[key]?.push(e);
      } else {
        timed[key]?.push(e);
      }
    });
    return { timedByDay: timed, allDayByDay: allDay };
  }, [events, days]);

  // Current time indicator position
  const nowMinutesFromStart = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  const nowTop = (nowMinutesFromStart / 60) * HOUR_HEIGHT;
  const showNowLine = now.getHours() >= START_HOUR && now.getHours() < END_HOUR;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-5 w-32 rounded bg-muted mb-4" />
        <div className="h-[400px] rounded bg-muted" />
      </div>
    );
  }

  if (error) {
    const isTokenError = (error as Error)?.message?.includes("provider token") || (error as Error)?.message?.includes("401");
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Calendar</h2>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            {isTokenError ? (
              <p>Calendar access expired. Please sign out and sign back in to reconnect.</p>
            ) : (
              <p>{(error as Error)?.message || "Failed to load calendar"}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Calendar</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-border">
        <div />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={`text-center py-1.5 text-xs font-medium ${
              isToday(d) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <div>{DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
            <div
              className={`text-sm font-semibold mt-0.5 ${
                isToday(d) ? "bg-primary text-primary-foreground w-6 h-6 rounded-full mx-auto flex items-center justify-center" : ""
              }`}
            >
              {format(d, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events */}
      {Object.values(allDayByDay).some((arr) => arr.length > 0) && (
        <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-border">
          <div className="text-xs text-muted-foreground flex items-center justify-center">all</div>
          {days.map((d) => (
            <AllDayBanner key={d.toISOString()} events={allDayByDay[format(d, "yyyy-MM-dd")] || []} />
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
        <div className="grid grid-cols-[40px_repeat(7,1fr)] relative">
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map((h) => (
              <div key={h} className="flex items-start justify-end pr-2" style={{ height: HOUR_HEIGHT }}>
                <span className="text-xs text-muted-foreground -mt-1.5">{`${h}:00`}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, dayIdx) => {
            const key = format(d, "yyyy-MM-dd");
            const dayEvents = timedByDay[key] || [];
            return (
              <div
                key={key}
                className={`relative border-l border-border ${isToday(d) ? "bg-primary/[0.03]" : ""}`}
                style={{ height: HOURS.length * HOUR_HEIGHT }}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/50"
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}

                {/* Current time line */}
                {showNowLine && isToday(d) && (
                  <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
                    <div className="w-2 h-2 rounded-full bg-destructive -ml-1" />
                    <div className="flex-1 h-[1.5px] bg-destructive" />
                  </div>
                )}

                {/* Events */}
                {dayEvents.map((event, i) => (
                  <EventBlock key={event.id} event={event} dayStart={d} colorIndex={dayIdx + i} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
