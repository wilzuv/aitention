import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchFoundations,
  createFoundation as createFoundationService,
  updateFoundation as updateFoundationService,
  deleteFoundation as deleteFoundationService,
} from "@/services/foundationService";
import type { Foundation, CreateFoundationInput } from "@/services/foundationService";

export type { Foundation };

export function useFoundations() {
  const queryClient = useQueryClient();

  const { data: foundations = [], isLoading } = useQuery({
    queryKey: ["foundations"],
    queryFn: () => fetchFoundations(supabase),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["foundations"] });

  const createFoundation = useMutation({
    mutationFn: (input: CreateFoundationInput) =>
      createFoundationService(supabase, input),
    onSuccess: invalidate,
  });

  const updateFoundation = useMutation({
    mutationFn: ({
      id,
      ...updates
    }: { id: string } & Partial<{ title: string; description: string | null }>) =>
      updateFoundationService(supabase, id, updates),
    onSuccess: invalidate,
  });

  const deleteFoundation = useMutation({
    mutationFn: (id: string) => deleteFoundationService(supabase, id),
    onSuccess: () => {
      invalidate();
      // Goals may have been orphaned (foundation_id set to null).
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  return { foundations, isLoading, createFoundation, updateFoundation, deleteFoundation };
}
