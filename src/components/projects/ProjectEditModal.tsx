import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Archive, ArchiveRestore } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/services/projectService";

interface ProjectEditModalProps {
  project?: Project | null;
  onClose: () => void;
  // Called after a delete so a detail page can navigate away.
  onDeleted?: () => void;
}

export function ProjectEditModal({ project, onClose, onDeleted }: ProjectEditModalProps) {
  const isEdit = !!project;
  const { createProject, updateProject, deleteProject } = useProjects();

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const isArchived = project?.status === "archived";

  async function handleSave() {
    setSaving(true);
    try {
      if (isEdit) {
        await updateProject.mutateAsync({
          id: project.id,
          name: name.trim() || null,
          description: description.trim() || null,
        });
      } else {
        await createProject.mutateAsync({
          name: name.trim() || null,
          description: description.trim() || null,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive() {
    if (!project) return;
    setSaving(true);
    try {
      await updateProject.mutateAsync({
        id: project.id,
        status: isArchived ? "active" : "archived",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    await deleteProject.mutateAsync(project.id);
    onClose();
    onDeleted?.();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="sm:max-w-lg"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit project details" : "Create a new project"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What is this project? (optional)"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A line on what this is about (optional)"
                className="min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-2">
            {isEdit ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleToggleArchive}
                  disabled={saving}
                >
                  {isArchived ? (
                    <ArchiveRestore className="h-4 w-4 mr-1.5" />
                  ) : (
                    <Archive className="h-4 w-4 mr-1.5" />
                  )}
                  {isArchived ? "Restore" : "Archive"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project. Items filed under it are kept —
              they'll just no longer belong to a project. To hide a project without
              losing the grouping, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
