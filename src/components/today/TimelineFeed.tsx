import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { formatDuration } from "@/lib/formatDuration";
import type { MoodLog, JournalEntry, FocusSession, Task } from "@/types/daily";

// Maps 1-7 ratings to human-readable labels. Index 0 is intentionally empty
// so we can index directly by rating number (1-7).
const moodLabels = ["", "Awful", "Bad", "Poor", "Okay", "Good", "Great", "Excellent"];
const energyLabels = ["", "Depleted", "Low", "Calm", "Medium", "Alert", "High", "Wired"];

interface TimelineFeedProps {
  moodLogs: MoodLog[];
  journalEntries: JournalEntry[];
  sessions: FocusSession[];
  completedTasks: Task[];
}

// A flat, normalized entry that the feed renders. Each item needs:
// - a sortable timestamp
// - a display time string (HH:mm)
// - a dot color class
// - a short label
// - optional detail text
interface TimelineEntry {
  timestamp: number; // unix ms for sorting
  time: string;      // HH:mm for display
  dotColor: string;  // Tailwind bg-* class
  label: string;
  detail?: string;
  onClick?: () => void;
}

function truncate(text: string, max = 60): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function TimelineFeed({
  moodLogs,
  journalEntries,
  sessions,
  completedTasks,
}: TimelineFeedProps) {
  const entries: TimelineEntry[] = [];

  // Mood logs
  for (const log of moodLogs) {
    const d = new Date(log.logged_at);
    const moodLabel = log.mood_rating != null ? moodLabels[log.mood_rating] : null;
    const energyLabel = log.energy_rating != null ? energyLabels[log.energy_rating] : null;

    const parts: string[] = [];
    if (moodLabel) parts.push(`Mood: ${moodLabel}`);
    if (energyLabel) parts.push(`Energy: ${energyLabel}`);

    entries.push({
      timestamp: d.getTime(),
      time: format(d, "HH:mm"),
      dotColor: "bg-yellow-400",
      label: "Mood check-in",
      detail: [parts.join(" · "), log.note ? truncate(log.note) : undefined]
        .filter(Boolean)
        .join(" — ") || undefined,
    });
  }

  // Journal entries
  for (const entry of journalEntries) {
    const d = new Date(entry.created_at);
    entries.push({
      timestamp: d.getTime(),
      time: format(d, "HH:mm"),
      dotColor: "bg-blue-400",
      label: "Note",
      detail: truncate(entry.content),
    });
  }

  // Focus sessions — skip any that haven't ended yet (no duration_minutes)
  for (const session of sessions) {
    if (session.duration_minutes == null) continue;
    const d = new Date(session.started_at);

    // Build a label from the primary task title if available
    const primaryTask = session.session_tasks?.find((st) => st.is_primary)?.task;
    const taskTitle = primaryTask?.title;

    entries.push({
      timestamp: d.getTime(),
      time: format(d, "HH:mm"),
      dotColor: "bg-primary",
      label: taskTitle ? `Focus: ${truncate(taskTitle, 40)}` : "Focus session",
      detail: formatDuration(session.duration_minutes),
    });
  }

  // Completed tasks
  for (const task of completedTasks) {
    if (!task.completed_at) continue;
    const d = new Date(task.completed_at);
    entries.push({
      timestamp: d.getTime(),
      time: format(d, "HH:mm"),
      dotColor: "bg-green-500",
      label: truncate(task.title, 50),
      detail: "Completed",
    });
  }

  // Sort chronologically
  entries.sort((a, b) => a.timestamp - b.timestamp);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No activity yet today
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {entries.map((entry, i) => {
        const Wrapper = entry.onClick ? "button" : "div";
        return (
          <Wrapper
            key={i}
            className={`flex items-start gap-3 py-1.5 px-1 w-full text-left ${
              entry.onClick
                ? "hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                : ""
            }`}
            onClick={entry.onClick}
          >
            {/* Time stamp — fixed width keeps dots aligned */}
            <span className="text-xs text-muted-foreground/50 shrink-0 w-10 pt-0.5">
              {entry.time}
            </span>

            {/* Colored dot */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${entry.dotColor}`}
            />

            {/* Label + optional detail */}
            <div className="min-w-0 flex-1">
              <span className="text-xs text-foreground/80">{entry.label}</span>
              {entry.detail && (
                <span className={`text-xs ml-1.5 ${entry.onClick ? "text-primary/60" : "text-muted-foreground"}`}>
                  {entry.detail}
                </span>
              )}
            </div>

            {/* Pen icon for editable entries */}
            {entry.onClick && (
              <Pencil className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground/50" />
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}
