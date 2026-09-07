import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MetadataChip } from "@/components/tasks/MetadataChip";
import { Repeat, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_NAMES, describeRecurrence } from "@/components/tasks/TaskInputHelpers";
import type { RecurrenceRule } from "@/lib/recurrence";

interface RecurrencePopoverProps {
  recType: RecurrenceRule["type"];
  daysOfWeek: number[];
  intervalDays: string;
  dayOfMonth: string;
  intervalMonths: string;
  anchor: "scheduled" | "completion";
  /** Whether there is an active recurrence rule to display */
  isActive: boolean;
  /** Text to show on the chip (e.g. "every monday") */
  displayValue: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeChange: (type: RecurrenceRule["type"]) => void;
  onDaysOfWeekChange: (days: number[]) => void;
  onIntervalDaysChange: (value: string) => void;
  onDayOfMonthChange: (value: string) => void;
  onIntervalMonthsChange: (value: string) => void;
  onAnchorChange: (anchor: "scheduled" | "completion") => void;
  onRemove: () => void;
}

export function RecurrencePopover({
  recType,
  daysOfWeek,
  intervalDays,
  dayOfMonth,
  intervalMonths,
  anchor,
  isActive,
  displayValue,
  open,
  onOpenChange,
  onTypeChange,
  onDaysOfWeekChange,
  onIntervalDaysChange,
  onDayOfMonthChange,
  onIntervalMonthsChange,
  onAnchorChange,
  onRemove,
}: RecurrencePopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span>
          <MetadataChip
            icon={<Repeat className="w-3 h-3" />}
            label="Repeat"
            value={displayValue}
            muted
            iconOnly={!isActive}
            active={open}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-violet-600 dark:text-violet-400 font-medium">
              Repeat
            </span>
            {isActive && (
              <button
                type="button"
                onClick={onRemove}
                className="text-muted-foreground/50 hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Select value={recType} onValueChange={(v) => onTypeChange(v as RecurrenceRule["type"])}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Every day</SelectItem>
              <SelectItem value="fixed_weekly">Specific days of week</SelectItem>
              <SelectItem value="interval">Every N days</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          {recType === "fixed_weekly" && (
            <div className="flex gap-1.5">
              {DAY_NAMES.map((dayName, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const next = daysOfWeek.includes(i)
                      ? daysOfWeek.filter((x) => x !== i)
                      : [...daysOfWeek, i].sort();
                    onDaysOfWeekChange(next);
                  }}
                  className={cn(
                    "w-8 h-7 rounded-md text-xs font-medium transition-colors",
                    daysOfWeek.includes(i)
                      ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                      : "text-muted-foreground hover:text-foreground bg-secondary/30"
                  )}
                >
                  {dayName}
                </button>
              ))}
            </div>
          )}

          {recType === "interval" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Every</span>
              <Input
                type="number"
                className="h-7 w-16 text-xs"
                value={intervalDays}
                onChange={(e) => onIntervalDaysChange(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          )}

          {recType === "monthly" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Day</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  className="h-7 w-16 text-xs"
                  value={dayOfMonth}
                  onChange={(e) => onDayOfMonthChange(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">of month</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Every</span>
                <Input
                  type="number"
                  min={1}
                  className="h-7 w-16 text-xs"
                  value={intervalMonths}
                  onChange={(e) => onIntervalMonthsChange(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  month{parseInt(intervalMonths, 10) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          <Select value={anchor} onValueChange={(v) => onAnchorChange(v as "scheduled" | "completion")}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Next task on scheduled date</SelectItem>
              <SelectItem value="completion">Next task after I complete this</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
