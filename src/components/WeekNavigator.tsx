import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameWeek } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

interface WeekNavigatorProps {
  weekStart: Date;
  onWeekChange: (weekStart: Date) => void;
  allowFuture?: boolean;
}

export function WeekNavigator({ weekStart, onWeekChange, allowFuture = false }: WeekNavigatorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const isCurrentWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 });
  const disableNext = !allowFuture && isCurrentWeek;

  const handlePrev = () => onWeekChange(subWeeks(weekStart, 1));
  const handleNext = () => {
    if (!disableNext) onWeekChange(addWeeks(weekStart, 1));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-0 flex-1 justify-start gap-2 sm:flex-none sm:min-w-[180px]">
            <CalendarIcon className="h-4 w-4" />
            {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={weekStart}
            onSelect={(date) => {
              if (date) {
                onWeekChange(startOfWeek(date, { weekStartsOn: 1 }));
                setCalendarOpen(false);
              }
            }}
            disabled={allowFuture ? undefined : (date) => date > new Date()}
            numberOfMonths={1}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleNext}
        disabled={disableNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentWeek && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Today
        </Button>
      )}
    </div>
  );
}
