import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProject, useProjectItems, useMilestones } from "@/hooks/useProjects";
import {
  PROJECT_ITEM_TYPES,
  computeMilestoneProgress,
  type ProjectItemType,
} from "@/services/projectService";
import { ProjectEditModal } from "./ProjectEditModal";
import { ProjectItemSection } from "./ProjectItemSection";
import { ProjectMilestones } from "./ProjectMilestones";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project, isLoading } = useProject(id);
  const { items, setItemProject, setItemMilestone, createItem } = useProjectItems(id);
  const { milestones } = useMilestones(id);
  const [editing, setEditing] = useState(false);
  // Show only open/active items by default; reveal completed work on demand.
  const [showCompleted, setShowCompleted] = useState(false);

  // Per-milestone completion, recomputed from the current grouped items.
  const progressById = items
    ? computeMilestoneProgress(items)
    : {};

  function attach(type: ProjectItemType, itemId: string) {
    if (!id) return;
    setItemProject.mutate({ type, id: itemId, projectId: id });
  }
  function detach(type: ProjectItemType, itemId: string) {
    setItemProject.mutate({ type, id: itemId, projectId: null });
  }
  function create(type: ProjectItemType, title: string) {
    createItem.mutate({ type, title });
  }
  function assignMilestone(
    type: ProjectItemType,
    itemId: string,
    milestoneId: string | null
  ) {
    setItemMilestone.mutate({ type, id: itemId, milestoneId });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <button
        onClick={() => navigate("/projects")}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Projects
      </button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !project ? (
        <p className="text-sm text-muted-foreground">Project not found.</p>
      ) : (
        <>
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {project.name?.trim() || "Untitled project"}
              </h1>
              {project.status === "archived" && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          </div>
          {project.description && (
            <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
              {project.description}
            </p>
          )}

          {id && (
            <div className="mt-6">
              <ProjectMilestones
                projectId={id}
                milestones={milestones}
                progressById={progressById}
              />
            </div>
          )}

          <div className="mt-2 flex items-center justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setShowCompleted((v) => !v)}
                >
                  {showCompleted ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  Completed
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showCompleted ? "Hide completed items" : "Show completed items"}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="mt-3 space-y-6">
            {PROJECT_ITEM_TYPES.map((type) => (
              <ProjectItemSection
                key={type}
                type={type}
                items={items?.[type] ?? []}
                milestones={milestones}
                showCompleted={showCompleted}
                onAttach={attach}
                onDetach={detach}
                onCreate={create}
                onSetMilestone={assignMilestone}
              />
            ))}
          </div>

          {editing && (
            <ProjectEditModal
              project={project}
              onClose={() => setEditing(false)}
              onDeleted={() => navigate("/projects")}
            />
          )}
        </>
      )}
    </div>
  );
}
