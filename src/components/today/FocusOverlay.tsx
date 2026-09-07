import { useState } from "react";
import { Clock, Minus, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/ui/TaskCheckbox";
import { FocusMinimizedWidget } from "./FocusMinimizedWidget";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/formatDuration";
import type { Task } from "@/types/daily";

interface FocusOverlayProps {
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  targetSeconds: number | undefined;
  taskName: string;
  linkedTasks: Task[];
  preSessionNotes: string;
  completedTaskIds: Set<string>;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onCompleteTaskDuringSession: (taskId: string) => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusOverlay({
  isRunning,
  isPaused,
  elapsedSeconds,
  remainingSeconds,
  targetSeconds,
  taskName,
  linkedTasks,
  preSessionNotes,
  completedTaskIds,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onCompleteTaskDuringSession,
}: FocusOverlayProps) {
  const [minimized, setMinimized] = useState(false);

  if (!isRunning && !isPaused) return null;

  if (minimized) {
    return (
      <FocusMinimizedWidget
        elapsedSeconds={elapsedSeconds}
        taskName={taskName}
        onExpand={() => setMinimized(false)}
      />
    );
  }

  const displaySeconds =
    remainingSeconds !== null ? remainingSeconds : elapsedSeconds;

  const targetLabel =
    targetSeconds !== undefined
      ? `of ${Math.round(targetSeconds / 60)} minutes`
      : "open-ended";

  return (
    <>
      {/* Scrim */}
      <div className="fixed inset-0 z-[80] bg-background/65" />

      {/* Dialog */}
      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-[90] w-[440px]",
          "-translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border bg-card p-6",
          "shadow-[0_0_40px_-10px_hsl(174_62%_47%_/_0.25)]"
        )}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
            <Clock className="h-4 w-4" />
            Focus Session
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMinimized(true)}
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>

        {/* Timer */}
        <div className="text-center mb-1">
          <span className="font-display text-4xl font-bold text-primary">
            {formatTimer(displaySeconds)}
          </span>
        </div>

        {/* Target label */}
        <div className="text-center text-xs text-muted-foreground mb-6">
          {targetLabel}
        </div>

        {/* Linked tasks */}
        {linkedTasks.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4">
            {linkedTasks.map((task) => {
              const done = completedTaskIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
                >
                  <TaskCheckbox
                    checked={done}
                    onChange={() => onCompleteTaskDuringSession(task.id)}
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm truncate",
                      done && "line-through text-muted-foreground"
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {done
                      ? "done"
                      : task.estimated_minutes
                        ? formatDuration(task.estimated_minutes)
                        : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pre-session note */}
        {preSessionNotes && (
          <div className="rounded-lg bg-muted px-3 py-2 mb-5 text-sm">
            <span className="font-bold">Pre-session note: </span>
            <span className="text-muted-foreground">{preSessionNotes}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {isPaused && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
              onClick={onDiscard}
            >
              Discard session
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={isPaused ? onResume : onPause}
            aria-label={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
          <Button
            className="rounded-full px-6"
            onClick={onFinish}
          >
            Finish session
          </Button>
        </div>
      </div>
    </>
  );
}
