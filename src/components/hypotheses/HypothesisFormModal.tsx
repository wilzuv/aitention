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
import { Separator } from "@/components/ui/separator";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useHypotheses } from "@/hooks/useHypotheses";
import type { Hypothesis } from "@/services/hypothesisService";

interface HypothesisFormModalProps {
  hypothesis?: Hypothesis | null;
  onClose: () => void;
}

function clampCredence(value: string): number {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function HypothesisFormModal({
  hypothesis,
  onClose,
}: HypothesisFormModalProps) {
  const isEdit = !!hypothesis;
  const {
    createHypothesis,
    updateHypothesis,
    deleteHypothesis,
    appendEvidence,
  } = useHypotheses();

  const [statement, setStatement] = useState(hypothesis?.statement ?? "");
  const [credence, setCredence] = useState(
    String(hypothesis?.current_credence ?? 50),
  );
  const [basis, setBasis] = useState(hypothesis?.basis ?? "");

  const [evidenceNote, setEvidenceNote] = useState("");
  const [newCredence, setNewCredence] = useState(
    String(hypothesis?.current_credence ?? 50),
  );

  const [showDelete, setShowDelete] = useState(false);
  const saving =
    createHypothesis.isPending ||
    updateHypothesis.isPending ||
    appendEvidence.isPending;

  async function handleSave() {
    if (isEdit) {
      await updateHypothesis.mutateAsync({
        id: hypothesis.id,
        patch: {
          statement,
          current_credence: clampCredence(credence),
          basis: basis || null,
        },
      });
    } else {
      await createHypothesis.mutateAsync({
        statement,
        current_credence: clampCredence(credence),
        basis: basis || null,
      });
    }
    onClose();
  }

  async function handleAppendEvidence() {
    if (!hypothesis || !evidenceNote.trim()) return;
    await appendEvidence.mutateAsync({
      hypothesis_id: hypothesis.id,
      note: evidenceNote,
      posterior_credence: clampCredence(newCredence),
    });
    onClose();
  }

  async function handleArchive() {
    if (!hypothesis) return;
    await updateHypothesis.mutateAsync({
      id: hypothesis.id,
      patch: { archived: !hypothesis.archived_at },
    });
    onClose();
  }

  async function handleDelete() {
    if (!hypothesis) return;
    await deleteHypothesis.mutateAsync(hypothesis.id);
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
            <DialogTitle>
              {isEdit ? "Edit hypothesis" : "New hypothesis"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit hypothesis details" : "Create a new hypothesis"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Statement</label>
              <Textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="A falsifiable claim..."
                className="min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Credence (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={credence}
                  onChange={(e) => setCredence(e.target.value)}
                />
              </div>
              <div />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Basis</label>
              <Textarea
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                placeholder="Prior conditioning — what led to this credence..."
                className="min-h-[48px]"
              />
            </div>

            {isEdit && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-sm font-medium">Log evidence</label>
                  <Textarea
                    value={evidenceNote}
                    onChange={(e) => setEvidenceNote(e.target.value)}
                    placeholder="What changed and why..."
                    className="min-h-[48px]"
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      New credence after this evidence
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={newCredence}
                      onChange={(e) => setNewCredence(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAppendEvidence}
                    disabled={saving || !evidenceNote.trim()}
                  >
                    Log evidence
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-2">
            {isEdit ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleArchive}
                >
                  {hypothesis?.archived_at ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-1.5" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-1.5" />
                      Archive
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !statement.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete hypothesis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this hypothesis and its evidence. This
              action cannot be undone.
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
