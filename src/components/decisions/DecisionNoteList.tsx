import { useState } from "react";
import { format } from "date-fns";
import { useDecisionNotes } from "@/hooks/useDecisionNotes";

interface DecisionNoteListProps {
  decisionId: string;
}

function formatCreatedAt(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

export function DecisionNoteList({ decisionId }: DecisionNoteListProps) {
  const { notes, isLoading, appendNote } = useDecisionNotes(decisionId);
  const [note, setNote] = useState("");
  const saving = appendNote.isPending;

  async function handleLog() {
    const trimmed = note.trim();
    if (!trimmed) return;
    await appendNote.mutateAsync(trimmed);
    setNote("");
  }

  const ordered = [...notes].reverse();

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Log a consideration..."
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
        <p className="text-xs text-muted-foreground py-1">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border">
          {ordered.map((n) => (
            <li key={n.id} className="flex items-start gap-2 px-2.5 py-2">
              <span className="text-xs text-muted-foreground shrink-0 w-24 pt-0.5">
                {formatCreatedAt(n.created_at)}
              </span>
              <span className="text-xs text-foreground/80 break-words whitespace-pre-wrap">
                {n.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
