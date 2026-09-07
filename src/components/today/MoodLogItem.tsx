import { Pencil, X, Trash2, Check } from "lucide-react";
import { ValenceArousalPicker } from "./ValenceArousalPicker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MoodLog } from "@/types/daily";

const valenceLabels: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Slightly low",
  4: "Neutral",
  5: "Slightly good",
  6: "Good",
  7: "Great",
};

const arousalLabels: Record<number, string> = {
  1: "Very calm",
  2: "Calm",
  3: "Slightly calm",
  4: "Neutral",
  5: "Slightly energized",
  6: "Energized",
  7: "Very energized",
};

interface MoodLogItemProps {
  log: MoodLog;
  isEditing?: boolean;
  editMood?: number | null;
  editEnergy?: number | null;
  editNote?: string;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  onDelete?: () => void;
  onEditMoodChange?: (v: number) => void;
  onEditEnergyChange?: (v: number) => void;
  onEditNoteChange?: (v: string) => void;
}

export function MoodLogItem({
  log,
  isEditing,
  editMood,
  editEnergy,
  editNote,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditMoodChange,
  onEditEnergyChange,
  onEditNoteChange,
}: MoodLogItemProps) {
  const time = new Date(log.logged_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isEditing) {
    return (
      <div className="py-3 px-1 space-y-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-muted-foreground/50 shrink-0 w-12">{time}</span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Editing mood</span>
          <button
            className="ml-auto p-1 rounded hover:bg-secondary/50 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            onClick={onCancelEdit}
            title="Cancel editing"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          <ValenceArousalPicker
            type="valence"
            value={editMood ?? null}
            onChange={(v) => onEditMoodChange?.(v)}
            compact
          />
          <ValenceArousalPicker
            type="arousal"
            value={editEnergy ?? null}
            onChange={(v) => onEditEnergyChange?.(v)}
            compact
          />
          <Input
            value={editNote ?? ""}
            onChange={(e) => onEditNoteChange?.(e.target.value)}
            placeholder="Optional note..."
            className="text-sm bg-secondary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSaveEdit?.();
              if (e.key === "s" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSaveEdit?.(); }
              if (e.key === "Escape") onCancelEdit?.();
            }}
          />
        </div>
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-xs text-destructive hover:text-destructive gap-1">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <Button size="sm" onClick={onSaveEdit} className="text-xs gap-1">
            <Check className="w-3 h-3" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 px-1 group">
      <span className="text-xs text-muted-foreground/50 shrink-0 w-12">
        {time}
      </span>
      {log.mood_rating != null && (
        <span className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: `hsl(var(--valence-${log.mood_rating}))` }}
          />
          <span className="text-xs text-foreground/80">
            {valenceLabels[log.mood_rating] ?? `Mood ${log.mood_rating}`}
          </span>
        </span>
      )}
      {log.energy_rating != null && (
        <span className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: `hsl(var(--arousal-${log.energy_rating}))` }}
          />
          <span className="text-xs text-foreground/80">
            {arousalLabels[log.energy_rating] ?? `Energy ${log.energy_rating}`}
          </span>
        </span>
      )}
      {log.note && (
        <span className="text-xs text-muted-foreground italic truncate">
          {log.note}
        </span>
      )}
      {onEdit && (
        <button
          className="ml-auto p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary/50 text-muted-foreground/50 hover:text-muted-foreground transition-all"
          onClick={onEdit}
          title="Edit mood"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
