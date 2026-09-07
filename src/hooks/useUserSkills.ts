import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as userSkillsService from "@/services/userSkillsService";

const QUERY_KEY = ["user-skills"];

export function useUserSkills() {
  const queryClient = useQueryClient();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => userSkillsService.fetchUserSkills(supabase),
  });

  const upsert = useMutation({
    mutationFn: (skill: {
      skill_name: string;
      content: string;
      is_override: boolean;
    }) => userSkillsService.upsertUserSkill(supabase, skill),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: (skillName: string) =>
      userSkillsService.deleteUserSkill(supabase, skillName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return { skills, isLoading, upsert, remove };
}
