import { useState, useEffect } from "react";
import { Play, Clock, Check, Timer, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/formatDuration";
import type { Task } from "@/hooks/useTasks";

interface FocusSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  dateStr: string;
  isPastDate?: boolean;
  /** Called when user clicks "Start session". May return a Promise — modal stays open until it resolves. */
  onStart: (
    name: string,
    source: string,
    sourceId?: string,
    criteria?: string,
    targetSeconds?: number,
  ) => void | Promise<void>;
  onLogManualSession?: (session: {
    taskIds: string[];
    durationMinutes: number;
    startedAt?: string;
    entryDate?: string;
  }) => void;
  /** Called after starting or logging, so Today can track linked task IDs */
  onFocusStarted?: (taskIds: string[]) => void;
  /** Pre-select tasks when opened from a task's play button */
  initialSelectedTaskIds?: string[];
}

export function FocusSessionModal({
  open,
  onOpenChange,
  tasks,
  dateStr,
  isPastDate,
  onStart,
  onLogManualSession,
  onFocusStarted,
  initialSelectedTaskIds,
}: FocusSessionModalProps) {
  const [mode, setMode] = useState<"choose" | "start" | "log">(
    isPastDate ? "log" : "choose",
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const [targetMinutes, setTargetMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [preSessionNotes, setPreSessionNotes] = useState("");

  // Manual / log past session state
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualStartTime, setManualStartTime] = useState("");
  const [manualDate, setManualDate] = useState(dateStr);

  const openTasks = tasks.filter((t) => t.status === "open");

  // When opened from a task's play button, pre-select those tasks and skip to "start" mode
  useEffect(() => {
    if (open && initialSelectedTaskIds && initialSelectedTaskIds.length > 0) {
      setSelectedTaskIds(new Set(initialSelectedTaskIds));
      setMode("start");
    }
  }, [open, initialSelectedTaskIds]);

  const reset = () => {
    setMode(isPastDate ? "log" : "choose");
    setSelectedTaskIds(new Set());
    setTargetMinutes(null);
    setCustomMinutes("");
    setPreSessionNotes("");
    setManualMinutes("");
    setManualStartTime("");
    setManualDate(dateStr);
  };

  const toggleTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    if (selectedTaskIds.size === 0) return;
    const primaryId = [...selectedTaskIds][0];
    const primaryTask = openTasks.find((t) => t.id === primaryId);
    if (!primaryTask) return;
    const targetSecs =
      targetMinutes != null ? targetMinutes * 60 : undefined;
    setStarting(true);
    try {
      await onStart(
        primaryTask.title,
        "task",
        primaryId,
        preSessionNotes.trim() || undefined,
        targetSecs,
      );
      onFocusStarted?.([...selectedTaskIds]);
      reset();
      onOpenChange(false);
    } catch {
      // Error toast is shown by the caller — just stay in the modal
    } finally {
      setStarting(false);
    }
  };

  const handleLogPast = () => {
    if (selectedTaskIds.size === 0 || !manualMinutes) return;
    const mins = parseInt(manualMinutes, 10);
    if (isNaN(mins) || mins <= 0) return;

    let startedAt: string | undefined;
    if (manualDate && manualStartTime) {
      startedAt = new Date(`${manualDate}T${manualStartTime}`).toISOString();
    }

    onLogManualSession?.({
      taskIds: [...selectedTaskIds],
      durationMinutes: mins,
      startedAt,
      entryDate: manualDate,
    });
    reset();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  // ── Choose mode: two entry points ──────────────────────────────────

  const chooseView = (
    <div className="space-y-2">
      {!isPastDate && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setMode("start")}
            className="gap-1.5 flex-1"
          >
            <Play className="w-3.5 h-3.5" />
            Start session
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMode("log")}
            className="gap-1.5 flex-1"
          >
            <Clock className="w-3.5 h-3.5" />
            Log past session
          </Button>
        </div>
      )}
      {isPastDate && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode("log")}
          className="gap-1.5 w-full"
        >
          <Clock className="w-3.5 h-3.5" />
          Log a session
        </Button>
      )}
    </div>
  );

  // ── Task selector + settings (shared by start & log) ───────────────

  const setupView = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {mode === "start" ? "Start session" : "Log past session"}
        </span>
        <button
          onClick={() => {
            setMode("choose");
            setSelectedTaskIds(new Set());
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
      </div>

      {/* Task selector */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">
          Select task
          {selectedTaskIds.size > 0 ? `s (${selectedTaskIds.size})` : "s"} — at
          least one required
        </span>
        <div className="rounded-lg border border-border/50 bg-secondary/10 max-h-48 overflow-y-auto">
          {openTasks.length > 0 ? (
            openTasks.map((task) => {
              const isSelected = selectedTaskIds.has(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 transition-colors ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-sm text-foreground truncate">
                    {task.title}
                  </span>
                  {task.estimated_minutes && (
                    <span className="text-xs text-muted-foreground/50 ml-auto shrink-0">
                      ~{formatDuration(task.estimated_minutes)}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground p-3">
              No open tasks for today. Add tasks first.
            </p>
          )}
        </div>
      </div>

      {/* Timer duration (start mode only) */}
      {mode === "start" && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Timer className="w-3 h-3" />
            Set a timer (optional)
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[25, 45, 60].map((min) => (
              <button
                key={min}
                onClick={() => {
                  setTargetMinutes(targetMinutes === min ? null : min);
                  setCustomMinutes("");
                }}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                  targetMinutes === min
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-primary/50"
                }`}
              >
                {min}m
              </button>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={customMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomMinutes(v);
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n > 0) setTargetMinutes(n);
                  else if (v === "") setTargetMinutes(null);
                }}
                placeholder="custom"
                className="w-16 h-7 text-xs"
                min={1}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            {targetMinutes != null && (
              <button
                onClick={() => {
                  setTargetMinutes(null);
                  setCustomMinutes("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60">
            {targetMinutes != null
              ? `Timer set for ${targetMinutes} min — you'll hear a chime when time is up.`
              : "Skip this to just run the clock and stop whenever you're done."}
          </p>
        </div>
      )}

      {/* Pre-session notes (start mode only) */}
      {mode === "start" && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Pre-session notes (optional)
          </span>
          <Textarea
            value={preSessionNotes}
            onChange={(e) => setPreSessionNotes(e.target.value)}
            placeholder="What's your plan? Success criteria, what you'll focus on..."
            className="min-h-[60px] text-xs bg-secondary/30 resize-none"
          />
        </div>
      )}

      {/* Fields for log past session */}
      {mode === "log" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              Duration
            </span>
            <Input
              type="number"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              placeholder="min"
              className="w-20 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">minutes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              Start time
            </span>
            <Input
              type="time"
              value={manualStartTime}
              onChange={(e) => setManualStartTime(e.target.value)}
              className="w-28 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              Date
            </span>
            <Input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="w-36 h-8 text-xs"
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {mode === "start" && (
        <Button
          onClick={handleStart}
          disabled={selectedTaskIds.size === 0 || starting}
          className="gap-1.5 w-full"
        >
          <Play className="w-3.5 h-3.5" />
          {starting ? "Starting..." : "Start session"}
        </Button>
      )}
      {mode === "log" && (
        <Button
          onClick={handleLogPast}
          disabled={
            selectedTaskIds.size === 0 ||
            !manualMinutes ||
            parseInt(manualMinutes) <= 0
          }
          className="gap-1.5 w-full"
        >
          <Check className="w-3.5 h-3.5" />
          Log session
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Focus Session</DialogTitle>
        </DialogHeader>
        {mode === "choose" ? chooseView : setupView}
      </DialogContent>
    </Dialog>
  );
}
