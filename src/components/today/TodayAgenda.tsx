// src/components/today/TodayAgenda.tsx
//
// Surfaces non-task primitives that are due or up for review — goals,
// decisions, predictions and experiments — grouped into Overdue / Today /
// Upcoming (next 3 days) sections. Tasks have their own dedicated list
// (TodayTaskList); this is everything else on the agenda.

import { Link } from "react-router-dom";
import {
  CalendarClock,
  Target,
  Compass,
  TrendingUp,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaItem, AgendaKind, AgendaBucket } from "@/hooks/useTodayAgenda";

// Per-kind presentation: icon, accent color and a human label for grouping.
const KIND_META: Record<
  AgendaKind,
  { icon: typeof Target; label: string; barClass: string; iconClass: string }
> = {
  goal: {
    icon: Target,
    label: "Goals",
    barClass: "bg-emerald-500/70",
    iconClass: "text-emerald-400",
  },
  decision: {
    icon: Compass,
    label: "Decisions",
    barClass: "bg-amber-500/70",
    iconClass: "text-amber-400",
  },
  prediction: {
    icon: TrendingUp,
    label: "Predictions",
    barClass: "bg-sky-500/70",
    iconClass: "text-sky-400",
  },
  experiment: {
    icon: FlaskConical,
    label: "Experiments",
    barClass: "bg-violet-500/70",
    iconClass: "text-violet-400",
  },
};

// Stable display order for the kind groups.
const KIND_ORDER: AgendaKind[] = ["goal", "decision", "prediction", "experiment"];

// Time buckets: primary grouping, ordered soonest-consequence first.
const BUCKET_ORDER: AgendaBucket[] = ["overdue", "today", "upcoming"];

const BUCKET_META: Record<AgendaBucket, { label: string; headClass: string }> = {
  overdue: { label: "Overdue", headClass: "text-destructive" },
  today: { label: "Today", headClass: "text-primary" },
  upcoming: { label: "Upcoming", headClass: "text-muted-foreground" },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format a YYYY-MM-DD date as a short "Mon D" label for the row. */
function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

interface AgendaRowProps {
  item: AgendaItem;
}

function AgendaRow({ item }: AgendaRowProps) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;

  // For overdue/upcoming rows, append the date so the "when" is explicit;
  // "today" rows need no date qualifier.
  const reason =
    item.bucket === "today"
      ? item.reason
      : `${item.reason} · ${formatShortDate(item.date)}`;

  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-start gap-2 px-3 py-2 rounded-md transition-colors",
        "hover:bg-surface-hover",
      )}
    >
      {/* Accent bar — mirrors the priority strip on task rows */}
      <div
        className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-full", meta.barClass)}
        aria-hidden
      />

      <Icon className={cn("mt-0.5 ml-1 h-4 w-4 shrink-0", meta.iconClass)} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate" title={item.title}>
          {item.title}
        </p>
        <span className="text-xs text-muted-foreground">{reason}</span>
      </div>

      <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

interface TodayAgendaProps {
  className?: string;
  items: AgendaItem[];
  isLoading?: boolean;
}

export function TodayAgenda({ className, items, isLoading }: TodayAgendaProps) {
  // Primary grouping is the time bucket (Overdue / Today / Upcoming). Within a
  // bucket, order by kind then by date so related items sit together.
  const kindRank = (kind: AgendaKind) => KIND_ORDER.indexOf(kind);
  const groups = BUCKET_ORDER.map((bucket) => ({
    bucket,
    meta: BUCKET_META[bucket],
    items: items
      .filter((i) => i.bucket === bucket)
      .sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.date.localeCompare(b.date)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header — matches TodayTaskList */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="w-4 h-4 text-primary" />
          Agenda
          {items.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {items.length}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground px-4 py-3">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">
            Nothing on the agenda.
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.bucket}>
                <p
                  className={cn(
                    "flex items-center gap-1.5 px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    group.meta.headClass,
                  )}
                >
                  {group.meta.label}
                  <span className="text-muted-foreground/70">{group.items.length}</span>
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <AgendaRow key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
