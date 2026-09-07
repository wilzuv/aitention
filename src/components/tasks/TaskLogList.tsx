import { useState } from "react";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTaskLogs } from "@/hooks/useTaskLogs";

interface TaskLogListProps {
  taskId: string;
}

function formatLoggedAt(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

export function TaskLogList({ taskId }: TaskLogListProps) {
  const { logs, isLoading, insertLog } = useTaskLogs(taskId);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const saving = insertLog.isPending;

  async function handleLog() {
    const trimmed = note.trim();
    if (!trimmed) return;
    await insertLog.mutateAsync({ task_id: taskId, note: trimmed });
    setNote("");
  }

  const ordered = [...logs].reverse();
  const last = logs[logs.length - 1];
  const summary =
    logs.length === 0
      ? "No activity yet"
      : `${logs.length} ${logs.length === 1 ? "entry" : "entries"}${
          last ? ` · last ${format(new Date(last.logged_at), "MMM d")}` : ""
        }`;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-sm font-medium">
        <ChevronRight
          className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span>History</span>
        <span className="text-xs font-normal text-muted-foreground">
          {summary}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3">
        <div className="flex gap-2">
          <textarea
            className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Log an update..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleLog();
            }}
          />
          <button
            onClick={handleLog}
            disabled={saving || !note.trim()}
            className="self-end px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "…" : "Log"}
          </button>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground py-1">Loading…</p>
        ) : ordered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border">
            {ordered.map((log) => (
              <li key={log.id} className="flex items-start gap-2 px-2.5 py-2">
                <span className="text-xs text-muted-foreground shrink-0 w-24 pt-0.5">
                  {formatLoggedAt(log.logged_at)}
                </span>
                <span className="text-xs text-foreground/80 break-words whitespace-pre-wrap">
                  {log.note}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
