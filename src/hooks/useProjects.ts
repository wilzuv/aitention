import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProjects,
  fetchProject,
  fetchProjectItems,
  fetchUnassignedItems,
  createProject as createProjectService,
  updateProject as updateProjectService,
  deleteProject as deleteProjectService,
  setItemProject as setItemProjectService,
  createProjectItem as createProjectItemService,
  fetchMilestones,
  createMilestone as createMilestoneService,
  updateMilestone as updateMilestoneService,
  deleteMilestone as deleteMilestoneService,
  reorderMilestones as reorderMilestonesService,
  setItemMilestone as setItemMilestoneService,
} from "@/services/projectService";
import type {
  Project,
  ProjectStatus,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectItemType,
  Milestone,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "@/services/projectService";

export type { Project, Milestone };

// React Query key for whichever primitive a project item belongs to, so an
// attach/detach refreshes that primitive's own pages too (tasks, goals, ...).
const ITEM_QUERY_KEY: Record<ProjectItemType, string> = {
  task: "tasks",
  goal: "goals",
  hypothesis: "hypotheses",
  decision: "decisions",
  experiment: "experiments",
  prediction: "predictions",
};

export function useProjects(opts: { status?: ProjectStatus } = {}) {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", opts.status ?? "all"],
    queryFn: () => fetchProjects(supabase, opts),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["projects"] });

  const createProject = useMutation({
    mutationFn: (input: CreateProjectInput) => createProjectService(supabase, input),
    onSuccess: invalidate,
  });

  const updateProject = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & UpdateProjectInput) =>
      updateProjectService(supabase, id, updates),
    onSuccess: invalidate,
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => deleteProjectService(supabase, id),
    onSuccess: () => {
      invalidate();
      // Items may have been orphaned (project_id set to null).
      queryClient.invalidateQueries({ queryKey: ["project-items"] });
    },
  });

  return { projects, isLoading, createProject, updateProject, deleteProject };
}

export function useProject(id: string | undefined) {
  const { data: project, isLoading } = useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: () => fetchProject(supabase, id!),
    enabled: !!id,
  });
  return { project: project ?? null, isLoading };
}

// Items filed under a project, grouped by type, plus the attach/detach verbs
// used by the project detail view.
export function useProjectItems(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["project-items", projectId],
    queryFn: () => fetchProjectItems(supabase, projectId!),
    enabled: !!projectId,
  });

  const setItemProject = useMutation({
    mutationFn: ({
      type,
      id,
      projectId: target,
    }: {
      type: ProjectItemType;
      id: string;
      projectId: string | null;
    }) => setItemProjectService(supabase, type, id, target),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-items"] });
      queryClient.invalidateQueries({ queryKey: ["project-unassigned", vars.type] });
      queryClient.invalidateQueries({ queryKey: [ITEM_QUERY_KEY[vars.type]] });
    },
  });

  const setItemMilestone = useMutation({
    mutationFn: ({
      type,
      id,
      milestoneId,
    }: {
      type: ProjectItemType;
      id: string;
      milestoneId: string | null;
    }) => setItemMilestoneService(supabase, type, id, milestoneId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-items"] });
      queryClient.invalidateQueries({ queryKey: [ITEM_QUERY_KEY[vars.type]] });
    },
  });

  // Quick-create a new primitive already filed under this project (and
  // optionally a milestone), then refresh the project view and the primitive's
  // own pages.
  const createItem = useMutation({
    mutationFn: ({
      type,
      title,
      milestoneId,
    }: {
      type: ProjectItemType;
      title: string;
      milestoneId?: string | null;
    }) =>
      createProjectItemService(supabase, type, title, projectId!, milestoneId ?? null),
    onSuccess: (_id, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-items"] });
      queryClient.invalidateQueries({ queryKey: ["project-unassigned", vars.type] });
      queryClient.invalidateQueries({ queryKey: [ITEM_QUERY_KEY[vars.type]] });
    },
  });

  return { items, isLoading, setItemProject, setItemMilestone, createItem };
}

// Milestones for a project, plus the create/update/delete/reorder verbs used by
// the project detail view.
export function useMilestones(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => fetchMilestones(supabase, projectId!),
    enabled: !!projectId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["milestones", projectId] });

  const createMilestone = useMutation({
    mutationFn: (input: CreateMilestoneInput) =>
      createMilestoneService(supabase, input),
    onSuccess: invalidate,
  });

  const updateMilestone = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & UpdateMilestoneInput) =>
      updateMilestoneService(supabase, id, updates),
    onSuccess: invalidate,
  });

  const deleteMilestone = useMutation({
    mutationFn: (id: string) => deleteMilestoneService(supabase, id),
    onSuccess: () => {
      invalidate();
      // Items may have been unfiled (milestone_id set to null).
      queryClient.invalidateQueries({ queryKey: ["project-items"] });
    },
  });

  const reorderMilestones = useMutation({
    mutationFn: (orderedIds: string[]) =>
      reorderMilestonesService(supabase, orderedIds),
    onSuccess: invalidate,
  });

  return {
    milestones,
    isLoading,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    reorderMilestones,
  };
}

// Candidate pool for the "Add to project" picker: items of one type not yet
// assigned to any project. Disabled until the picker is actually opened.
export function useUnassignedItems(type: ProjectItemType, enabled: boolean) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["project-unassigned", type],
    queryFn: () => fetchUnassignedItems(supabase, type),
    enabled,
  });
  return { items, isLoading };
}
