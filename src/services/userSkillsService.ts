import { SupabaseClient } from "@supabase/supabase-js";

export interface UserSkill {
  id: string;
  skill_name: string;
  content: string;
  is_override: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchUserSkills(
  supabase: SupabaseClient,
): Promise<UserSkill[]> {
  const { data, error } = await supabase
    .from("user_skills")
    .select("*")
    .order("skill_name");
  if (error) throw error;
  return data as UserSkill[];
}

export async function upsertUserSkill(
  supabase: SupabaseClient,
  skill: { skill_name: string; content: string; is_override: boolean },
): Promise<void> {
  const { error } = await supabase.from("user_skills").upsert(
    {
      skill_name: skill.skill_name,
      content: skill.content,
      is_override: skill.is_override,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,skill_name" },
  );
  if (error) throw error;
}

export async function deleteUserSkill(
  supabase: SupabaseClient,
  skillName: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_skills")
    .delete()
    .eq("skill_name", skillName);
  if (error) throw error;
}
