// src/components/journal/JournalPage.tsx
//
// Dedicated page for capturing and reviewing mood + journal entries over time.
// Mood logs and free-text notes are merged into a single timeline grouped by
// day, newest first. Add via the dialogs; edit/delete inline.

import { useMemo, useState } from "react";
import { format, parseISO, isToday, isYesterday, subDays } from "date-fns";
import { Smile, FileText, Pencil, Trash2, Check, X } from "lucide-react";

import { useJournalTimeline } from "@/hooks/useJournalTimeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoodLogItem } from "@/components/today/MoodLogItem";
import { MoodCheckInDialog } from "@/components/journal/MoodCheckInDialog";
import { QuickNoteDialog } from "@/components/journal/QuickNoteDialog";
import type { MoodLog, JournalEntry } from "@/types/daily";

const RANGE_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

// A flat, normalized timeline item — either a mood log or a journal entry.
type TimelineItem =
  | { kind: "mood"; ts: number; day: string; log: MoodLog }
  | { kind: "note"; ts: number; day: string; entry: JournalEntry };

function dayHeading(day: string): string {
  const d = parseISO(day);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMMM d");
}

export function JournalPage() {
  const [rangeDays, setRangeDays] = useState(30);

  const dateTo = format(new Date(), "yyyy-MM-dd");
  const dateFrom = format(subDays(new Date(), rangeDays - 1), "yyyy-MM-dd");

  const {
    moodLogs,
    journalEntries,
    isLoading,
    logMood,
    updateMood,
    deleteMood,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useJournalTimeline(dateFrom, dateTo);

  // ── Add dialogs ─────────────────────────────────────────────────────
  const [moodOpen, setMoodOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // ── Mood editing state ──────────────────────────────────────────────
  const [editingMoodId, setEditingMoodId] = useState<string | null>(null);
  const [editMood, setEditMood] = useState<number | null>(null);
  const [editEnergy, setEditEnergy] = useState<number | null>(null);
  const [editMoodNote, setEditMoodNote] = useState("");

  const startEditMood = (log: MoodLog) => {
    setEditingMoodId(log.id);
    setEditMood(log.mood_rating);
    setEditEnergy(log.energy_rating);
    setEditMoodNote(log.note ?? "");
  };
  const saveEditMood = (id: string) => {
    updateMood.mutate({
      id,
      mood_rating: editMood,
      energy_rating: editEnergy,
      note: editMoodNote.trim() || null,
    });
    setEditingMoodId(null);
  };

  // ── Note editing state ──────────────────────────────────────────────
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  const startEditNote = (entry: JournalEntry) => {
    setEditingNoteId(entry.id);
    setEditNoteContent(entry.content);
  };
  const saveEditNote = (id: string) => {
    const content = editNoteContent.trim();
    if (content) updateEntry.mutate({ id, content });
    setEditingNoteId(null);
  };

  // ── Build grouped timeline (newest day first) ───────────────────────
  const groups = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const log of moodLogs) {
      items.push({
        kind: "mood",
        ts: new Date(log.logged_at).getTime(),
        day: format(new Date(log.logged_at), "yyyy-MM-dd"),
        log,
      });
    }
    for (const entry of journalEntries) {
      items.push({
        kind: "note",
        ts: new Date(entry.created_at).getTime(),
        day: entry.entry_date,
        entry,
      });
    }

    const byDay = new Map<string, TimelineItem[]>();
    for (const item of items) {
      const bucket = byDay.get(item.day);
      if (bucket) bucket.push(item);
      else byDay.set(item.day, [item]);
    }

    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest day first
      .map(([day, dayItems]) => ({
        day,
        items: dayItems.sort((a, b) => b.ts - a.ts), // newest within day first
      }));
  }, [moodLogs, journalEntries]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-3 sm:px-6 sm:py-4 lg:py-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-8 sm:items-center">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Journal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your mood and notes over time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setMoodOpen(true)}
          >
            <Smile className="h-4 w-4 text-yellow-500" />
            Add mood
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setNoteOpen(true)}
          >
            <FileText className="h-4 w-4 text-blue-500" />
            Add note
          </Button>
        </div>
      </div>

      {/* ── Range selector ─────────────────────────────────────────── */}
      <div className="mb-4 flex justify-end">
        <ToggleGroup
          type="single"
          value={String(rangeDays)}
          onValueChange={(v) => v && setRangeDays(Number(v))}
          variant="outline"
          size="sm"
        >
          {RANGE_OPTIONS.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* ── Timeline ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No mood or journal entries in this range yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Use “Add mood” or “Add note” above to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ day, items }) => (
            <section key={day}>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {dayHeading(day)}
              </h2>
              <div className="divide-y divide-border/60">
                {items.map((item) =>
                  item.kind === "mood" ? (
                    <MoodLogItem
                      key={item.log.id}
                      log={item.log}
                      isEditing={editingMoodId === item.log.id}
                      editMood={editMood}
                      editEnergy={editEnergy}
                      editNote={editMoodNote}
                      onEdit={() => startEditMood(item.log)}
                      onCancelEdit={() => setEditingMoodId(null)}
                      onSaveEdit={() => saveEditMood(item.log.id)}
                      onDelete={() => {
                        deleteMood.mutate(item.log);
                        setEditingMoodId(null);
                      }}
                      onEditMoodChange={setEditMood}
                      onEditEnergyChange={setEditEnergy}
                      onEditNoteChange={setEditMoodNote}
                    />
                  ) : (
                    <JournalEntryItem
                      key={item.entry.id}
                      entry={item.entry}
                      isEditing={editingNoteId === item.entry.id}
                      editContent={editNoteContent}
                      onEdit={() => startEditNote(item.entry)}
                      onCancelEdit={() => setEditingNoteId(null)}
                      onSaveEdit={() => saveEditNote(item.entry.id)}
                      onDelete={() => deleteEntry.mutate(item.entry)}
                      onEditContentChange={setEditNoteContent}
                    />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Add dialogs ────────────────────────────────────────────── */}
      <MoodCheckInDialog
        open={moodOpen}
        onOpenChange={setMoodOpen}
        onSave={(mood, energy, note) =>
          logMood.mutate({
            mood_rating: mood ?? undefined,
            energy_rating: energy ?? undefined,
            note: note ?? undefined,
            context: "manual",
          })
        }
      />
      <QuickNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        onSave={(content) => addEntry.mutate({ date: dateTo, content })}
      />
    </div>
  );
}

// ── Journal entry row ─────────────────────────────────────────────────

interface JournalEntryItemProps {
  entry: JournalEntry;
  isEditing: boolean;
  editContent: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onEditContentChange: (v: string) => void;
}

function JournalEntryItem({
  entry,
  isEditing,
  editContent,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditContentChange,
}: JournalEntryItemProps) {
  const time = new Date(entry.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isEditing) {
    return (
      <div className="space-y-2 px-1 py-3">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-muted-foreground/50">{time}</span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Editing note
          </span>
          <button
            className="ml-auto rounded p-1 text-muted-foreground/50 transition-colors hover:bg-secondary/50 hover:text-muted-foreground"
            onClick={onCancelEdit}
            title="Cancel editing"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <Textarea
          value={editContent}
          onChange={(e) => onEditContentChange(e.target.value)}
          rows={3}
          autoFocus
          className="bg-secondary/30 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
        />
        <div className="flex justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="gap-1 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" onClick={onSaveEdit} className="gap-1 text-xs" disabled={!editContent.trim()}>
            <Check className="h-3 w-3" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 px-1 py-2">
      <span className="w-12 shrink-0 pt-0.5 text-xs text-muted-foreground/50">{time}</span>
      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-foreground/90">
        {entry.content}
      </p>
      <button
        className="rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-secondary/50 hover:text-muted-foreground group-hover:opacity-100"
        onClick={onEdit}
        title="Edit note"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
