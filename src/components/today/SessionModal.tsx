import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Check, SkipForward, ArrowLeft, Clock, Pencil } from "lucide-react";
import { TaskCheckbox } from "@/components/ui/TaskCheckbox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface LinkedTask {
  id: string;
  title: string;
  status: string;
}

export interface SessionModalProps {
  /** Display name for the session (primary task name or summary) */
  taskName: string;
  /** Tasks linked to this session via session_tasks */
  linkedTasks?: LinkedTask[];
  /** Pre-session notes written before starting */
  preSessionNotes?: string;
  /** Duration in seconds (from timer or computed from manual input) */
  durationSeconds: number;
  /** Focus session row ID */
  sessionId: string;
  /** When the session started (ISO string) */
  startedAt?: string;
  /** Called with reflection data when user clicks Save */
  onSave: (reflection: {
    note: string;
    enjoyment: number;
    completedTaskIds: string[];
    durationMinutes: number;
  }) => void;
  /** Called when user clicks Skip — saves duration only */
  onSkip: () => void;
  /** Called when user clicks "Back to session" — resumes the timer */
  onBackToSession?: () => void;
  /**
   * "post-session" — shown right after finishing the timer.
   *   Shows "Back to session" + "Skip" buttons.
   * "edit" — editing an already-saved session.
   *   Hides "Back to session" and "Skip".
   */
  mode?: "post-session" | "edit";
  /** Pre-fill post-session notes (for edit mode) */
  initialNote?: string;
  /** Pre-fill enjoyment (for edit mode) */
  initialEnjoyment?: number;
  /** Whether the session data is still loading (show transition) */
  isLoading?: boolean;
}

function formatDurationFromSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const ENJOYMENT_LABELS: Record<number, string> = {
  1: "Draining",
  2: "Tedious",
  3: "Meh",
  4: "Neutral",
  5: "Decent",
  6: "Engaging",
  7: "Flow state",
};

export function SessionModal({
  taskName,
  linkedTasks = [],
  preSessionNotes,
  durationSeconds,
  startedAt,
  onSave,
  onSkip,
  onBackToSession,
  mode = "post-session",
  initialNote = "",
  initialEnjoyment = 4,
  isLoading = false,
}: SessionModalProps) {
  const [note, setNote] = useState(initialNote);
  const [enjoyment, setEnjoyment] = useState<number>(initialEnjoyment);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
  const [editableDuration, setEditableDuration] = useState(durationMinutes.toString());
  const [editingStartTime, setEditingStartTime] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState(
    startedAt ? format(new Date(startedAt), "HH:mm") : "",
  );

  // Sync when durationSeconds changes (e.g. mode transition)
  useEffect(() => {
    setEditableDuration(Math.max(1, Math.ceil(durationSeconds / 60)).toString());
  }, [durationSeconds]);

  const toggleTaskDone = (id: string) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    onSave({
      note,
      enjoyment,
      completedTaskIds: [...completedTaskIds],
      durationMinutes: parseInt(editableDuration) || durationMinutes,
    });
  };

  return (
    <>
      {/* Scrim */}
      <div className="fixed inset-0 z-[80] bg-background/65" />

      {/* Dialog — same overlay style as FocusOverlay */}
      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-[90] w-[440px] max-h-[85vh] overflow-y-auto",
          "-translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border bg-card p-6",
          "shadow-[0_0_40px_-10px_hsl(174_62%_47%_/_0.25)]",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        {/* Loading transition */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Saving session...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div>
              <div className="flex items-center gap-1.5 text-primary text-sm font-medium mb-1">
                <Clock className="h-4 w-4" />
                {mode === "post-session" ? "Session complete" : "Edit session"}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{taskName}</span>
                <span className="text-xs text-muted-foreground">{formatDurationFromSeconds(durationSeconds)}</span>
              </div>
              {/* Start time (small, editable) */}
              {startedAt && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] text-muted-foreground/60">
                    Started at
                  </span>
                  {editingStartTime ? (
                    <Input
                      type="time"
                      value={startTimeInput}
                      onChange={(e) => setStartTimeInput(e.target.value)}
                      onBlur={() => setEditingStartTime(false)}
                      className="h-5 w-20 text-[11px] px-1"
                      autoFocus
                    />
                  ) : (
                    <button
                      className="text-[11px] text-muted-foreground/60 hover:text-foreground inline-flex items-center gap-0.5 transition-colors"
                      onClick={() => setEditingStartTime(true)}
                    >
                      {format(new Date(startedAt), "HH:mm")}
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Linked tasks with TaskCheckbox */}
            {linkedTasks.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Linked tasks
                </span>
                {linkedTasks.map((task) => {
                  const alreadyDone = task.status === "done";
                  const isChecked = completedTaskIds.has(task.id) || alreadyDone;
                  return (
                    <div key={task.id} className="flex items-center gap-2 py-0.5">
                      <TaskCheckbox
                        checked={isChecked}
                        onChange={() => !alreadyDone && toggleTaskDone(task.id)}
                        disabled={alreadyDone}
                        size="sm"
                      />
                      <span className={`text-sm ${isChecked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {task.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Duration (editable) */}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Duration</span>
              <Input
                type="number"
                value={editableDuration}
                onChange={(e) => setEditableDuration(e.target.value)}
                className="w-16 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>

            {/* Pre-session notes (read-only) */}
            {preSessionNotes && (
              <div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-0.5">
                  Pre-session notes
                </span>
                <p className="text-xs text-muted-foreground/80">{preSessionNotes}</p>
              </div>
            )}

            {/* Post-session notes */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                How did it go?
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Post-session notes..."
                className="min-h-[60px] text-sm bg-secondary/30 resize-none"
                autoFocus
              />
            </div>

            {/* Enjoyment / flow rating — 7-point scale */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-2">
                Enjoyment — {ENJOYMENT_LABELS[enjoyment] ?? enjoyment}
              </label>
              <div className="flex gap-1">
                {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setEnjoyment(n)}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      n === enjoyment
                        ? "bg-primary text-primary-foreground"
                        : n <= enjoyment
                          ? "bg-primary/20 text-primary hover:bg-primary/30"
                          : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-2">
              <div>
                {mode === "post-session" && onBackToSession && (
                  <Button size="sm" variant="ghost" onClick={onBackToSession} className="text-xs gap-1">
                    <ArrowLeft className="w-3 h-3" />
                    Back to session
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {mode === "post-session" && (
                  <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs gap-1">
                    <SkipForward className="w-3 h-3" />
                    Skip
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} className="text-xs gap-1">
                  <Check className="w-3 h-3" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
