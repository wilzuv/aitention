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
import { usePredictions } from "@/hooks/usePredictions";
import type {
  Prediction,
  PredictionOutcome,
} from "@/services/predictionService";

interface PredictionFormModalProps {
  /** Provide an existing prediction to edit; omit to create a new one. */
  prediction?: Prediction | null;
  onClose: () => void;
}

const NONE = "__none__";

function clampConfidence(value: string): number {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PredictionFormModal({
  prediction,
  onClose,
}: PredictionFormModalProps) {
  const isEdit = !!prediction;
  // Content fields lock once an outcome is set (DB trigger enforces it).
  const contentLocked = !!prediction?.outcome;
  const { createPrediction, updatePrediction, deletePrediction } =
    usePredictions();

  const [text, setText] = useState(prediction?.prediction ?? "");
  const [confidence, setConfidence] = useState(
    String(prediction?.confidence ?? 50),
  );
  const [reasoning, setReasoning] = useState(prediction?.reasoning ?? "");
  const [dueDate, setDueDate] = useState(
    prediction?.resolution_date ?? today(),
  );
  const [outcome, setOutcome] = useState<PredictionOutcome | "">(
    prediction?.outcome ?? "",
  );
  const [resolution, setResolution] = useState(prediction?.resolution ?? "");

  const [showDelete, setShowDelete] = useState(false);
  const saving = createPrediction.isPending || updatePrediction.isPending;

  async function handleSave() {
    if (isEdit) {
      await updatePrediction.mutateAsync({
        id: prediction.id,
        patch: {
          // Skip content fields when locked so the trigger never rejects.
          ...(contentLocked
            ? {}
            : {
                prediction: text,
                confidence: clampConfidence(confidence),
                reasoning: reasoning || null,
                resolution_date: dueDate,
              }),
          outcome: outcome || null,
          resolution: resolution || null,
        },
      });
    } else {
      await createPrediction.mutateAsync({
        prediction: text,
        confidence: clampConfidence(confidence),
        reasoning: reasoning || null,
        resolution_date: dueDate,
      });
    }
    onClose();
  }

  async function handleDelete() {
    if (!prediction) return;
    await deletePrediction.mutateAsync(prediction.id);
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
              {isEdit ? "Edit prediction" : "New prediction"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit prediction details" : "Create a new prediction"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {contentLocked && (
              <p className="text-xs text-muted-foreground">
                This prediction is resolved — its statement, confidence, and
                reasoning are locked. You can still adjust the outcome and
                resolution.
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Prediction</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="A falsifiable forecast..."
                className="min-h-[60px]"
                disabled={contentLocked}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confidence (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                disabled={contentLocked}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reasoning</label>
              <Textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Why you expect this (optional)"
                className="min-h-[48px]"
                disabled={contentLocked}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Resolution date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={contentLocked}
              />
            </div>

            {isEdit && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Outcome</label>
                  <Select
                    value={outcome || NONE}
                    onValueChange={(v) =>
                      setOutcome(v === NONE ? "" : (v as PredictionOutcome))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unresolved" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unresolved</SelectItem>
                      <SelectItem value="hit">Hit</SelectItem>
                      <SelectItem value="miss">Miss</SelectItem>
                      <SelectItem value="unresolvable">Unresolvable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {outcome && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Resolution</label>
                    <Textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="How it actually turned out"
                      className="min-h-[60px]"
                    />
                  </div>
                )}
              </>
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
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !text.trim() || !dueDate}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prediction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this prediction. This action cannot be
              undone.
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
