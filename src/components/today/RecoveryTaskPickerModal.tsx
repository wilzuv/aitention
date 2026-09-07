import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface Task {
  id: string;
  title: string;
}

export interface RecoveryTaskPickerModalProps {
  sessionTasks: Task[];
  todayTasks: Task[];
  durationSeconds: number;
  onPick: (taskId: string) => void;
  onSkip: () => void;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function RecoveryTaskPickerModal({
  sessionTasks,
  todayTasks,
  durationSeconds,
  onPick,
  onSkip,
}: RecoveryTaskPickerModalProps) {
  const sessionTaskIds = new Set(sessionTasks.map((t) => t.id));
  const otherTasks = todayTasks.filter((t) => !sessionTaskIds.has(t.id));

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-background/65" />
      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-[90] w-[440px] max-h-[85vh] overflow-y-auto",
          "-translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border bg-card p-6",
          "shadow-[0_0_40px_-10px_hsl(174_62%_47%_/_0.25)]",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-primary text-sm font-medium mb-1">
              <Clock className="h-4 w-4" />
              Which task was this?
            </div>
            <p className="text-xs text-muted-foreground">
              Pick a task to credit {formatDuration(durationSeconds)} to, or skip to just close the session.
            </p>
          </div>

          {sessionTasks.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                From this session
              </span>
              {sessionTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm bg-secondary/30 hover:bg-secondary transition-colors"
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}

          {otherTasks.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Today's tasks
              </span>
              {otherTasks.slice(0, 10).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm bg-secondary/30 hover:bg-secondary transition-colors"
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs">
              Don't log time
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
