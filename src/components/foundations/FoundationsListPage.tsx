import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFoundations } from "@/hooks/useFoundations";
import { useGoals } from "@/hooks/useGoals";
import { FoundationEditModal } from "./FoundationEditModal";
import type { Foundation } from "@/services/foundationService";

export function FoundationsListPage() {
  const { foundations, isLoading } = useFoundations();
  // Open goals only — to show which values are actually getting attention.
  const goalsQuery = useGoals({ open: true });
  const navigate = useNavigate();

  const [editing, setEditing] = useState<Foundation | null>(null);
  const [creating, setCreating] = useState(false);

  const openGoalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const goal of goalsQuery.goals) {
      if (goal.foundation_id) {
        counts[goal.foundation_id] = (counts[goal.foundation_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [goalsQuery.goals]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Foundations
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New foundation
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        The values your goals ladder up to — the something bigger behind the work.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : foundations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-12 px-4 text-center">
          <Compass className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No foundations yet. Name a value your goals serve.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {foundations.map((foundation) => {
            const count = openGoalCounts[foundation.id] ?? 0;
            return (
              <button
                key={foundation.id}
                onClick={() => setEditing(foundation)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/50"
              >
                <h2 className="font-medium text-foreground">{foundation.title}</h2>
                {foundation.description && (
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {foundation.description}
                  </p>
                )}
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/goals");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate("/goals");
                    }
                  }}
                  className={`mt-2 inline-block text-[11px] uppercase tracking-wider ${
                    count === 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground/70 hover:text-foreground"
                  }`}
                >
                  {count === 0
                    ? "no goals serving"
                    : `${count} open goal${count === 1 ? "" : "s"} serving`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {creating && <FoundationEditModal onClose={() => setCreating(false)} />}
      {editing && (
        <FoundationEditModal foundation={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
