import { useState } from "react";
import { format } from "date-fns";
import { Plus, Pencil, CalendarDays, ChevronUp, ChevronDown, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMilestones } from "@/hooks/useProjects";
import type { Milestone, MilestoneProgress } from "@/services/projectService";
import { MilestoneEditModal } from "./MilestoneEditModal";

interface ProjectMilestonesProps {
  projectId: string;
  milestones: Milestone[];
  // Derived per-milestone completion, keyed by milestone id.
  progressById: Record<string, MilestoneProgress>;
}

function formatTarget(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "MMM d, yyyy");
}

// Local YYYY-MM-DD for "today", to flag overdue targets without a time component.
function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function ProjectMilestones({
  projectId,
  milestones,
  progressById,
}: ProjectMilestonesProps) {
  const { reorderMilestones } = useMilestones(projectId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);

  // Swap a milestone with its neighbour and persist the whole order.
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= milestones.length) return;
    const ids = milestones.map((m) => m.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMilestones.mutate(ids);
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Flag className="h-4 w-4 text-muted-foreground" />
          Milestones
          {milestones.length > 0 && (
            <span className="text-muted-foreground">{milestones.length}</span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add milestone
        </Button>
      </div>

      {milestones.length === 0 ? (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-md border border-dashed border-border px-3 py-3 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50"
        >
          No milestones yet. Break this project into checkpoints — "Beta", "v1",
          "first draft" — and file items under them to track progress.
        </button>
      ) : (
        <ul className="space-y-2">
          {milestones.map((m, index) => {
            const p = progressById[m.id] ?? { total: 0, done: 0 };
            const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
            const complete = p.total > 0 && p.done === p.total;
            const overdue = !!m.target_date && m.target_date < todayIso() && !complete;

            return (
              <li
                key={m.id}
                className="group rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-foreground">
                        {m.name}
                      </h3>
                      {m.target_date && (
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 text-xs ${
                            overdue ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          <CalendarDays className="h-3 w-3" />
                          {formatTarget(m.target_date)}
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      aria-label="Move milestone up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      aria-label="Move milestone down"
                      disabled={index === milestones.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      aria-label="Edit milestone"
                      onClick={() => setEditing(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  <Progress value={pct} className="h-1.5" />
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {p.total === 0 ? "No items" : `${p.done}/${p.total}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <MilestoneEditModal projectId={projectId} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <MilestoneEditModal
          projectId={projectId}
          milestone={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
