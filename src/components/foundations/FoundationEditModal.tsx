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
import { Trash2 } from "lucide-react";
import { useFoundations } from "@/hooks/useFoundations";
import type { Foundation } from "@/services/foundationService";

interface FoundationEditModalProps {
  foundation?: Foundation | null;
  onClose: () => void;
}

export function FoundationEditModal({ foundation, onClose }: FoundationEditModalProps) {
  const isEdit = !!foundation;
  const { createFoundation, updateFoundation, deleteFoundation } = useFoundations();

  const [title, setTitle] = useState(foundation?.title ?? "");
  const [description, setDescription] = useState(foundation?.description ?? "");
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      if (isEdit) {
        await updateFoundation.mutateAsync({
          id: foundation.id,
          title,
          description: description || null,
        });
      } else {
        await createFoundation.mutateAsync({
          title,
          description: description || undefined,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!foundation) return;
    await deleteFoundation.mutateAsync(foundation.id);
    onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="sm:max-w-lg"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Foundation" : "New Foundation"}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit foundation details" : "Create a new foundation"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Value</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Something you care about"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A line on what this means to you (optional)"
                className="min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-2">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete foundation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{foundation?.title}". Goals linked to it
              are kept, but they'll no longer point at this foundation.
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
