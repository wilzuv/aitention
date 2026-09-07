import { Clock, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FocusMinimizedWidgetProps {
  elapsedSeconds: number;
  taskName: string;
  onExpand: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusMinimizedWidget({
  elapsedSeconds,
  taskName,
  onExpand,
}: FocusMinimizedWidgetProps) {
  return (
    <button
      onClick={onExpand}
      className={cn(
        "fixed bottom-5 left-5 z-[90]",
        "flex items-center gap-2 px-3 py-2",
        "rounded-xl border bg-card shadow-lg",
        "hover:border-primary transition-colors",
        "cursor-pointer"
      )}
      aria-label="Expand focus session"
    >
      <Clock className="h-4 w-4 text-primary flex-shrink-0" />
      <div className="flex flex-col items-start min-w-0">
        <span className="font-display font-bold text-primary text-sm leading-tight">
          {formatTimer(elapsedSeconds)}
        </span>
        <span
          className="text-muted-foreground leading-tight max-w-[120px] truncate"
          style={{ fontSize: "10px" }}
        >
          {taskName}
        </span>
      </div>
      <Maximize2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
