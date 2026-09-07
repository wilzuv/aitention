// src/hooks/useTodayAgenda.ts
//
// Aggregates non-task primitives that are "due" or "up for review" around a
// given day, so the Today page can surface them alongside tasks. Each item is
// bucketed relative to the anchor date into one of three time windows:
//
//   • overdue  — past due (before the anchor day), still open
//   • today    — due on the anchor day
//   • upcoming — due within the next 3 days
//
// Each primitive carries its own date semantics:
//
//   • Goals       — review_date    (a goal scheduled for review)
//   • Decisions   — review_date    (a committed decision scheduled for review)
//   • Predictions — resolution_date (a prediction due to be resolved)
//   • Experiments — end_date       (a running experiment due to conclude)
//
// All of these are thin React Query wrappers already; here we just compose them
// and normalize the matches into a single flat list for presentation.

import { useMemo } from "react";
import { useGoals } from "./useGoals";
import { useDecisions } from "./useDecisions";
import { usePredictions } from "./usePredictions";
import { useExperiments } from "./useExperiments";

export type AgendaKind = "goal" | "decision" | "prediction" | "experiment";
export type AgendaBucket = "overdue" | "today" | "upcoming";

/** How many days ahead of the anchor day count as "upcoming". */
const UPCOMING_DAYS = 3;

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  /** Short reason this item is on the agenda, e.g. "Review due". */
  reason: string;
  /** Route the item links to. */
  to: string;
  /** The item's due/review date (YYYY-MM-DD). */
  date: string;
  /** Time bucket relative to the anchor day. */
  bucket: AgendaBucket;
}

/** Add `days` to a YYYY-MM-DD date string, returning YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ISO date strings (YYYY-MM-DD) compare correctly with lexical <, so bucketing
// is a plain string comparison against the anchor day and the upcoming cutoff.
function bucketFor(
  date: string,
  today: string,
  upcomingEnd: string,
): AgendaBucket | null {
  if (date < today) return "overdue";
  if (date === today) return "today";
  if (date <= upcomingEnd) return "upcoming";
  return null;
}

export function useTodayAgenda(dateStr: string) {
  const upcomingEnd = addDays(dateStr, UPCOMING_DAYS);

  // Active goals with a review scheduled on or before the upcoming cutoff
  // (no lower bound, so past-due reviews surface as overdue).
  const { goals, isLoading: goalsLoading } = useGoals({
    open: true,
    reviewBefore: upcomingEnd,
  });

  // Decisions: fetch all and filter to those with a pending review in range.
  const { decisions, isLoading: decisionsLoading } = useDecisions();

  // Predictions still awaiting resolution.
  const { predictions, isLoading: predictionsLoading } = usePredictions({
    outcome: "unresolved",
  });

  // Experiments currently running.
  const { experiments, isLoading: experimentsLoading } = useExperiments({
    status: "running",
  });

  const items = useMemo<AgendaItem[]>(() => {
    const out: AgendaItem[] = [];

    for (const goal of goals) {
      const bucket =
        goal.review_date && bucketFor(goal.review_date, dateStr, upcomingEnd);
      if (bucket) {
        out.push({
          id: goal.id,
          kind: "goal",
          title: goal.title,
          reason: "Review due",
          to: "/goals",
          date: goal.review_date!,
          bucket,
        });
      }
    }

    for (const decision of decisions) {
      if (decision.reviewed_at || decision.status === "abandoned") continue;
      const bucket =
        decision.review_date &&
        bucketFor(decision.review_date, dateStr, upcomingEnd);
      if (bucket) {
        out.push({
          id: decision.id,
          kind: "decision",
          title: decision.title,
          reason: "Review due",
          to: "/decisions",
          date: decision.review_date!,
          bucket,
        });
      }
    }

    for (const prediction of predictions) {
      const bucket =
        prediction.resolution_date &&
        bucketFor(prediction.resolution_date, dateStr, upcomingEnd);
      if (bucket) {
        out.push({
          id: prediction.id,
          kind: "prediction",
          title: prediction.prediction,
          reason: "Resolve",
          to: "/predictions",
          date: prediction.resolution_date!,
          bucket,
        });
      }
    }

    for (const experiment of experiments) {
      const bucket =
        experiment.end_date &&
        bucketFor(experiment.end_date, dateStr, upcomingEnd);
      if (bucket) {
        out.push({
          id: experiment.id,
          kind: "experiment",
          title: experiment.title,
          reason: "Conclude",
          to: "/experiments",
          date: experiment.end_date!,
          bucket,
        });
      }
    }

    return out;
  }, [goals, decisions, predictions, experiments, dateStr, upcomingEnd]);

  const isLoading =
    goalsLoading || decisionsLoading || predictionsLoading || experimentsLoading;

  return { items, isLoading };
}
