import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderKanban, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjects } from "@/hooks/useProjects";
import { ProjectEditModal } from "./ProjectEditModal";
import type { ProjectStatus } from "@/services/projectService";

type ViewMode = "grid" | "list";
const VIEW_KEY = "projects:view";

function projectLabel(name: string | null): string {
  return name?.trim() || "Untitled project";
}

export function ProjectsListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProjectStatus>("active");
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || "grid"
  );
  const [creating, setCreating] = useState(false);

  const { projects, isLoading } = useProjects({ status: tab });

  function changeView(next: ViewMode) {
    if (!next) return; // toggle-group emits "" when clicking the active item
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Projects
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New project
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Group related work — tasks, goals, and the thinking around them — under one roof.
      </p>

      <div className="mb-5 flex items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ProjectStatus)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => changeView(v as ViewMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-12 px-4 text-center">
          <FolderKanban className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === "active"
              ? "No projects yet. Create one to group related work."
              : "No archived projects."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="flex h-full flex-col rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium text-foreground">{projectLabel(p.name)}</h2>
                {p.status === "archived" && (
                  <Badge variant="secondary" className="shrink-0">Archived</Badge>
                )}
              </div>
              {p.description && (
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium text-foreground">{projectLabel(p.name)}</h2>
                {p.status === "archived" && (
                  <Badge variant="secondary" className="shrink-0">Archived</Badge>
                )}
              </div>
              {p.description && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {creating && <ProjectEditModal onClose={() => setCreating(false)} />}
    </div>
  );
}
