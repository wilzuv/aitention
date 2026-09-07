import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createGoal, updateGoal, deleteGoal } from "@/services/goalService";
import type { Goal, GoalStatus } from "@/services/goalService";
import { useFoundations } from "@/hooks/useFoundations";
import { GoalLogList } from "./GoalLogList";

const NO_FOUNDATION = "__none__";

interface GoalEditModalProps {
  goal?: Goal | null;
  onClose: () => void;
}

export function GoalEditModal({ goal, onClose }: GoalEditModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!goal;

  const { foundations } = useFoundations();

  const [title, setTitle] = useState(goal?.title ?? "");
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [status, setStatus] = useState<string>(goal?.status ?? "open");
  const [reviewDate, setReviewDate] = useState(goal?.review_date ?? "");
  const [foundationId, setFoundationId] = useState<string>(
    goal?.foundation_id ?? NO_FOUNDATION
  );

  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const foundation = foundationId === NO_FOUNDATION ? null : foundationId;
      if (isEdit) {
        await updateGoal(supabase, goal.id, {
          title,
          notes: notes || null,
          status: status === "open" ? null : (status as GoalStatus),
          reviewDate: reviewDate || null,
          foundationId: foundation,
        });
      } else {
        await createGoal(supabase, {
          title,
          notes: notes || undefined,
          reviewDate: reviewDate || undefined,
          foundationId: foundation,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!goal) return;
    await deleteGoal(supabase, goal.id, "unlink");
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Goal" : "New Goal"}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit goal details" : "Create a new goal"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Resolution criteria</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What does done look like?"
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Foundation</label>
              <Select value={foundationId} onValueChange={setFoundationId}>
                <SelectTrigger>
                  <SelectValue placeholder="The value this serves (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOUNDATION}>None</SelectItem>
                  {foundations.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEdit && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Review date</label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                />
                {reviewDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setReviewDate("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {isEdit && goal && (
              <div className="border-t pt-3">
                <GoalLogList goalId={goal.id} />
              </div>
            )}
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
            <AlertDialogTitle>Delete goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{goal?.title}". This action cannot be undone.
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
