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
import { useDecisions } from "@/hooks/useDecisions";
import { DecisionNoteList } from "./DecisionNoteList";
import type {
  Decision,
  DecisionOption,
  DecisionReviewOutcome,
  DecisionStatus,
} from "@/services/decisionService";

interface DecisionFormModalProps {
  /** Provide an existing decision to edit; omit to create a new one. */
  decision?: Decision | null;
  onClose: () => void;
}

const NONE = "__none__";

function optionsToText(options: DecisionOption[]): string {
  return options.map((o) => o.name).join("\n");
}

function textToOptions(text: string): DecisionOption[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function DecisionFormModal({ decision, onClose }: DecisionFormModalProps) {
  const isEdit = !!decision;
  const { createDecision, updateDecision, deleteDecision } = useDecisions();

  const [title, setTitle] = useState(decision?.title ?? "");
  const [context, setContext] = useState(decision?.context ?? "");
  const [optionsText, setOptionsText] = useState(
    optionsToText(decision?.options ?? []),
  );
  const [status, setStatus] = useState<DecisionStatus>(decision?.status ?? "open");
  const [chosenOption, setChosenOption] = useState(decision?.chosen_option ?? "");
  const [rationale, setRationale] = useState(decision?.rationale ?? "");
  const [reviewDate, setReviewDate] = useState(decision?.review_date ?? "");
  const [reviewOutcome, setReviewOutcome] = useState<DecisionReviewOutcome | "">(
    decision?.review_outcome ?? "",
  );
  const [reviewNotes, setReviewNotes] = useState(decision?.review_notes ?? "");

  const [showDelete, setShowDelete] = useState(false);
  const saving = createDecision.isPending || updateDecision.isPending;

  async function handleSave() {
    if (isEdit) {
      await updateDecision.mutateAsync({
        id: decision.id,
        patch: {
          title,
          context,
          options: textToOptions(optionsText),
          status,
          chosen_option: chosenOption || null,
          rationale: rationale || null,
          decided_at:
            status === "decided" && !decision.decided_at
              ? new Date().toISOString()
              : decision.decided_at,
          review_date: reviewDate || null,
          review_outcome: reviewOutcome || null,
          review_notes: reviewNotes || null,
          reviewed_at:
            reviewOutcome && !decision.reviewed_at
              ? new Date().toISOString()
              : decision.reviewed_at,
        },
      });
    } else {
      await createDecision.mutateAsync({
        title,
        context,
        options: textToOptions(optionsText),
        review_date: reviewDate || null,
      });
    }
    onClose();
  }

  async function handleDelete() {
    if (!decision) return;
    await deleteDecision.mutateAsync(decision.id);
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
            <DialogTitle>{isEdit ? "Edit decision" : "New decision"}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit decision details" : "Create a new decision"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Context</label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="The situation in 1-3 sentences..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Options</label>
              <Textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="One option per line..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Review date</label>
              <Input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </div>

            {isEdit && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as DecisionStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="decided">Decided</SelectItem>
                      <SelectItem value="abandoned">Abandoned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {status === "decided" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Chosen option</label>
                      <Input
                        value={chosenOption}
                        onChange={(e) => setChosenOption(e.target.value)}
                        placeholder="Which option you committed to"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Rationale</label>
                      <Textarea
                        value={rationale}
                        onChange={(e) => setRationale(e.target.value)}
                        placeholder="Why this one..."
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Review outcome</label>
                      <Select
                        value={reviewOutcome || NONE}
                        onValueChange={(v) =>
                          setReviewOutcome(
                            v === NONE ? "" : (v as DecisionReviewOutcome),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Not reviewed yet" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Not reviewed yet</SelectItem>
                          <SelectItem value="good_call">Good call</SelectItem>
                          <SelectItem value="wrong_call">Wrong call</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="inconclusive">Inconclusive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {reviewOutcome && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Review notes</label>
                        <Textarea
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          className="min-h-[60px]"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-1.5 border-t border-border pt-4">
                  <label className="text-sm font-medium">Consideration notes</label>
                  <p className="text-xs text-muted-foreground">
                    Append-only log of your running thinking on this decision.
                  </p>
                  <DecisionNoteList decisionId={decision.id} />
                </div>
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
                disabled={saving || !title.trim() || !context.trim()}
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
            <AlertDialogTitle>Delete decision?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{decision?.title}" and its
              consideration notes. This action cannot be undone.
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
