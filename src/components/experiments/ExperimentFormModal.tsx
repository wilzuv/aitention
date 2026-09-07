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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, ChevronsUpDown } from "lucide-react";
import { useExperiments } from "@/hooks/useExperiments";
import { useHypotheses } from "@/hooks/useHypotheses";
import { ExperimentLogList } from "./ExperimentLogList";
import type { Experiment, ExperimentStatus } from "@/services/experimentService";

interface ExperimentFormModalProps {
  experiment?: Experiment | null;
  onClose: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExperimentFormModal({
  experiment,
  onClose,
}: ExperimentFormModalProps) {
  const isEdit = !!experiment;
  const { createExperiment, updateExperiment, deleteExperiment } =
    useExperiments();
  const { hypotheses } = useHypotheses();

  const [title, setTitle] = useState(experiment?.title ?? "");
  const [protocol, setProtocol] = useState(experiment?.protocol ?? "");
  const [successCriteria, setSuccessCriteria] = useState(
    experiment?.success_criteria ?? "",
  );
  const [hypothesisIds, setHypothesisIds] = useState<string[]>(
    experiment?.hypothesis_ids ?? [],
  );
  const [startDate, setStartDate] = useState(experiment?.start_date ?? today());
  const [endDate, setEndDate] = useState(experiment?.end_date ?? "");
  const [status, setStatus] = useState<ExperimentStatus>(
    experiment?.status ?? "running",
  );
  const [conclusion, setConclusion] = useState(experiment?.conclusion ?? "");

  const [showDelete, setShowDelete] = useState(false);
  const saving = createExperiment.isPending || updateExperiment.isPending;

  const linkedHypotheses = hypotheses.filter((h) =>
    hypothesisIds.includes(h.id),
  );

  const toggleHypothesis = (id: string) => {
    setHypothesisIds((prev) =>
      prev.includes(id) ? prev.filter((hid) => hid !== id) : [...prev, id],
    );
  };

  async function handleSave() {
    if (isEdit) {
      await updateExperiment.mutateAsync({
        id: experiment.id,
        patch: {
          title,
          protocol,
          success_criteria: successCriteria || null,
          hypothesis_ids: hypothesisIds,
          start_date: startDate,
          end_date: endDate || null,
          status,
          conclusion: conclusion || null,
          concluded_at:
            (status === "concluded" || status === "abandoned") &&
            !experiment.concluded_at
              ? new Date().toISOString()
              : experiment.concluded_at,
        },
      });
    } else {
      await createExperiment.mutateAsync({
        title,
        protocol,
        success_criteria: successCriteria || null,
        hypothesis_ids: hypothesisIds,
        start_date: startDate,
        end_date: endDate || null,
      });
    }
    onClose();
  }

  async function handleDelete() {
    if (!experiment) return;
    await deleteExperiment.mutateAsync(experiment.id);
    onClose();
  }

  const concluded = status === "concluded" || status === "abandoned";

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit experiment" : "New experiment"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit experiment details" : "Create a new experiment"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Protocol</label>
              <Textarea
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                placeholder="What, how, and how long — one paragraph..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Success criteria</label>
              <Textarea
                value={successCriteria}
                onChange={(e) => setSuccessCriteria(e.target.value)}
                placeholder="What would convince you? (optional)"
                className="min-h-[48px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hypotheses</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <span className="truncate text-muted-foreground">
                      {hypothesisIds.length === 0
                        ? "None"
                        : `${hypothesisIds.length} selected`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                  {hypotheses.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 px-1">
                      No hypotheses yet.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {hypotheses.map((h) => (
                        <label
                          key={h.id}
                          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={hypothesisIds.includes(h.id)}
                            onCheckedChange={() => toggleHypothesis(h.id)}
                            className="mt-0.5"
                          />
                          <span className="line-clamp-2 leading-snug">
                            {h.statement}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {linkedHypotheses.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {linkedHypotheses.map((h) => (
                    <p key={h.id}>
                      {h.statement.slice(0, 60)}
                      {h.statement.length > 60 ? "…" : ""} — {h.current_credence}%
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">End date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {isEdit && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as ExperimentStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="concluded">Concluded</SelectItem>
                      <SelectItem value="abandoned">Abandoned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {concluded && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Conclusion</label>
                    <Textarea
                      value={conclusion}
                      onChange={(e) => setConclusion(e.target.value)}
                      placeholder="What did you learn?"
                      className="min-h-[60px]"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observations</label>
                  <ExperimentLogList experimentId={experiment.id} />
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
                disabled={
                  saving || !title.trim() || !protocol.trim() || !startDate
                }
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
            <AlertDialogTitle>Delete experiment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{experiment?.title}" and its
              observations. This action cannot be undone.
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
