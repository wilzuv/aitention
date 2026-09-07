import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import {
  fetchGoals,
  createGoal as createGoalService,
  updateGoal as updateGoalService,
  deleteGoal as deleteGoalService,
} from "@/services/goalService";
import type { Goal, GoalStatus } from "@/services/goalService";

export type { Goal, GoalStatus };
export type GoalInsert = TablesInsert<"goals">;
export type GoalUpdate = TablesUpdate<"goals">;

interface UseGoalsOptions {
  status?: GoalStatus | null;
  open?: boolean;
  parentGoalId?: string | null;
  reviewBefore?: string;
  reviewAfter?: string;
  /** Defer the fetch — for consumers behind a closed modal that only need the mutations. */
  enabled?: boolean;
}

export function useGoals(opts: UseGoalsOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = ["goals", opts.status, opts.open, opts.parentGoalId, opts.reviewBefore, opts.reviewAfter];

  const { data: goals = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchGoals(supabase, opts),
    enabled: opts.enabled ?? true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["goals"] });

  const createGoal = useMutation({
    mutationFn: async (goal: GoalInsert) => {
      return createGoalService(supabase, {
        title: goal.title,
        notes: goal.notes ?? undefined,
        parentGoalId: goal.parent_goal_id ?? undefined,
        reviewDate: goal.review_date ?? undefined,
        foundationId: goal.foundation_id ?? undefined,
      });
    },
    onSuccess: invalidate,
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: GoalUpdate & { id: string }) => {
      return updateGoalService(supabase, id, {
        title: updates.title ?? undefined,
        notes: updates.notes,
        status: updates.status as GoalStatus | null | undefined,
        parentGoalId: updates.parent_goal_id,
        reviewDate: updates.review_date,
        foundationId: updates.foundation_id,
      });
    },
    onSuccess: invalidate,
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      return deleteGoalService(supabase, id, "unlink");
    },
    onSuccess: invalidate,
  });

  return { goals, isLoading, createGoal, updateGoal, deleteGoal };
}
