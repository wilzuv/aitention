import { useMemo } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useDecisions } from "@/hooks/useDecisions";
import { useExperiments } from "@/hooks/useExperiments";

export type MarkerType = "goal_review" | "decision_review" | "experiment_end";

export interface PlanningMarker {
  date: string;
  type: MarkerType;
  title: string;
  id: string;
}

export const MARKER_STYLES: Record<MarkerType, { dot: string; chip: string; label: string }> = {
  goal_review: {
    dot: "bg-teal-500",
    chip: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    label: "Goal review",
  },
  decision_review: {
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    label: "Decision review",
  },
  experiment_end: {
    dot: "bg-purple-500",
    chip: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    label: "Experiment ends",
  },
};

export function usePlanningMarkers() {
  const { goals } = useGoals({ open: true });
  const { decisions } = useDecisions({ status: "decided" });
  const { experiments } = useExperiments({ status: "running" });

  const markers = useMemo(() => {
    const result: PlanningMarker[] = [];

    for (const g of goals) {
      if (g.review_date) {
        result.push({
          date: g.review_date,
          type: "goal_review",
          title: g.title,
          id: g.id,
        });
      }
    }

    for (const d of decisions) {
      if (d.review_date && !d.reviewed_at) {
        result.push({
          date: d.review_date,
          type: "decision_review",
          title: d.title,
          id: d.id,
        });
      }
    }

    for (const e of experiments) {
      if (e.end_date) {
        result.push({
          date: e.end_date,
          type: "experiment_end",
          title: e.title,
          id: e.id,
        });
      }
    }

    return result;
  }, [goals, decisions, experiments]);

  const markersByDate = useMemo(() => {
    const map = new Map<string, PlanningMarker[]>();
    for (const m of markers) {
      const existing = map.get(m.date) ?? [];
      existing.push(m);
      map.set(m.date, existing);
    }
    return map;
  }, [markers]);

  return { markers, markersByDate };
}
