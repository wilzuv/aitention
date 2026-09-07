import { Moon, Clock, Check, Smile, Zap, Calendar, CalendarDays, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TimelineFeed } from "./TimelineFeed";
import { InteractiveCalendar } from "./InteractiveCalendar";
import { formatDuration } from "@/lib/formatDuration";
import type { MoodLog, JournalEntry, FocusSession, Task } from "@/types/daily";

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatsPanelProps {
  sleepHours: string | null;
  sleepScore: number | null;
  readinessScore: number | null;
  totalFocusMinutes: number;
  sessionCount: number;
  tasksDone: number;
  moodLogs: MoodLog[];
  // Timeline data
  journalEntries: JournalEntry[];
  sessions: FocusSession[];
  completedTasks: Task[];
  // Calendar
  showCalendar: boolean;
  onToggleCalendar: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Computes the average of a numeric field across mood logs, ignoring nulls. */
function avgRating(logs: MoodLog[], field: "mood_rating" | "energy_rating"): number | null {
  const values = logs.map((l) => l[field]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

// formatDuration imported from @/lib/formatDuration

const MOOD_LABELS = ["", "Awful", "Bad", "Poor", "Okay", "Good", "Great", "Excellent"];
const ENERGY_LABELS = ["", "Depleted", "Low", "Calm", "Medium", "Alert", "High", "Wired"];

/** Returns the closest label for a decimal average (e.g. 5.3 → "Good"). */
function closestLabel(avg: number, labels: string[]): string {
  const idx = Math.round(Math.min(Math.max(avg, 1), 7));
  return labels[idx] || "";
}

/** Maps a 1–7 mood average to a Tailwind color class. */
function moodColor(avg: number): string {
  if (avg <= 2) return "text-red-400";
  if (avg <= 3) return "text-orange-400";
  if (avg <= 4) return "text-yellow-400";
  if (avg <= 5) return "text-lime-400";
  return "text-green-400";
}

// ─── StatRow ──────────────────────────────────────────────────────────────────

interface StatRowProps {
  icon: React.ReactNode;
  iconBg: string;       // e.g. "bg-violet-500/15"
  label: string;
  value: string;
  valueColor?: string;  // optional Tailwind text-* class
  secondary?: string;
}

function StatRow({ icon, iconBg, label, value, valueColor, secondary }: StatRowProps) {
  return (
    <div className="flex items-center gap-3 py-1">
      {/* Icon square */}
      <div className={`flex items-center justify-center rounded-md shrink-0 ${iconBg}`} style={{ width: 26, height: 26 }}>
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={`text-[14px] font-semibold font-display leading-none ${valueColor ?? "text-foreground"}`}>
            {value}
          </span>
          {secondary && (
            <span className="text-[11px] text-muted-foreground leading-none">{secondary}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── StatsPanel ───────────────────────────────────────────────────────────────

export function StatsPanel({
  sleepHours,
  sleepScore,
  readinessScore,
  totalFocusMinutes,
  sessionCount,
  tasksDone,
  moodLogs,
  journalEntries,
  sessions,
  completedTasks,
  showCalendar,
  onToggleCalendar,
}: StatsPanelProps) {
  const avgMood = avgRating(moodLogs, "mood_rating");
  const avgEnergy = avgRating(moodLogs, "energy_rating");

  // ── Calendar overlay ────────────────────────────────────────────────────────
  if (showCalendar) {
    return (
      <div className="sticky top-20 rounded-xl border border-border bg-card p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground tracking-tight">Calendar</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleCalendar}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <InteractiveCalendar />
      </div>
    );
  }

  // ── Normal panel ────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      {/* Calendar + Week links */}
      <div className="flex items-center justify-end gap-1 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onToggleCalendar}
        >
          <Calendar className="h-3.5 w-3.5" />
          Calendar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link
            to="/tasks"
            onClick={() => {
              try { localStorage.setItem("tasks.viewMode.v1", "calendar"); } catch { /* ignore */ }
            }}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Week
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="stats">
        <TabsList className="h-7 w-full bg-muted p-0.5 mb-3">
          <TabsTrigger value="stats" className="h-6 flex-1 text-[11px]">
            Stats
          </TabsTrigger>
          <TabsTrigger value="timeline" className="h-6 flex-1 text-[11px]">
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* ── Stats tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="stats" className="mt-0">
          <div className="space-y-2.5">
            {/* Sleep / Readiness */}
            <StatRow
              icon={<Moon className="w-3.5 h-3.5 text-violet-400" />}
              iconBg="bg-violet-500/15"
              label="Sleep / Readiness"
              value={
                [
                  sleepScore != null ? `Sleep ${sleepScore}` : null,
                  readinessScore != null ? `Readiness ${readinessScore}` : null,
                ].filter(Boolean).join(" · ") || "--"
              }
              secondary={sleepHours ? `${sleepHours}h sleep` : undefined}
            />

            {/* Focus Time */}
            <StatRow
              icon={<Clock className="w-3.5 h-3.5 text-primary" />}
              iconBg="bg-primary/15"
              label="Focus Time"
              value={formatDuration(totalFocusMinutes)}
              secondary={sessionCount > 0 ? `${sessionCount} session${sessionCount !== 1 ? "s" : ""}` : undefined}
            />

            {/* Tasks Done */}
            <StatRow
              icon={<Check className="w-3.5 h-3.5 text-green-400" />}
              iconBg="bg-green-500/15"
              label="Tasks Done"
              value={String(tasksDone)}
            />

            {/* Avg Mood */}
            <StatRow
              icon={<Smile className="w-3.5 h-3.5 text-yellow-400" />}
              iconBg="bg-yellow-500/15"
              label="Mood"
              value={avgMood != null ? closestLabel(avgMood, MOOD_LABELS) : "--"}
              valueColor={avgMood != null ? moodColor(avgMood) : undefined}
              secondary={avgMood != null ? String(avgMood) : undefined}
            />

            {/* Avg Energy */}
            <StatRow
              icon={<Zap className="w-3.5 h-3.5 text-sky-400" />}
              iconBg="bg-sky-500/15"
              label="Energy"
              value={avgEnergy != null ? closestLabel(avgEnergy, ENERGY_LABELS) : "--"}
              valueColor="text-sky-400"
              secondary={avgEnergy != null ? String(avgEnergy) : undefined}
            />
          </div>
        </TabsContent>

        {/* ── Timeline tab ──────────────────────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-0">
          <div className="overflow-y-auto max-h-[420px] -mx-1 px-1">
            <TimelineFeed
              moodLogs={moodLogs}
              journalEntries={journalEntries}
              sessions={sessions}
              completedTasks={completedTasks}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
