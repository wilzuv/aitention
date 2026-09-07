import { useQueryClient } from "@tanstack/react-query";
import { useTasks, type TaskUpdate } from "@/hooks/useTasks";
import { useGoals } from "@/hooks/useGoals";
import { useHypotheses } from "@/hooks/useHypotheses";
import { useDecisions } from "@/hooks/useDecisions";
import { useExperiments } from "@/hooks/useExperiments";
import { usePredictions } from "@/hooks/usePredictions";
import { TaskDetailModal } from "@/components/today/TaskDetailModal";
import { GoalEditModal } from "@/components/goals/GoalEditModal";
import { HypothesisFormModal } from "@/components/hypotheses/HypothesisFormModal";
import { DecisionFormModal } from "@/components/decisions/DecisionFormModal";
import { ExperimentFormModal } from "@/components/experiments/ExperimentFormModal";
import { PredictionFormModal } from "@/components/predictions/PredictionFormModal";
import type { ProjectItemType } from "@/services/projectService";

// Opens a linked primitive's existing edit surface in-place on the project page.
// Each primitive type already has a self-contained edit modal keyed by its full
// row, so we load that row from the primitive's own list hook and hand it over.
// Only the active type's sub-component is mounted, so just one list query fires
// per edit rather than all six. Closing refreshes the project's item list so any
// title/status change shows up immediately.

interface ProjectItemEditorProps {
  type: ProjectItemType;
  id: string;
  onClose: () => void;
}

export function ProjectItemEditor({ type, id, onClose }: ProjectItemEditorProps) {
  switch (type) {
    case "task":
      return <TaskItemEditor id={id} onClose={onClose} />;
    case "goal":
      return <GoalItemEditor id={id} onClose={onClose} />;
    case "hypothesis":
      return <HypothesisItemEditor id={id} onClose={onClose} />;
    case "decision":
      return <DecisionItemEditor id={id} onClose={onClose} />;
    case "experiment":
      return <ExperimentItemEditor id={id} onClose={onClose} />;
    case "prediction":
      return <PredictionItemEditor id={id} onClose={onClose} />;
    default:
      return null;
  }
}

interface SubEditorProps {
  id: string;
  onClose: () => void;
}

// Wrap onClose so the project's grouped item list refetches — an edit may have
// changed the title or status shown in the section.
function useCloseAndRefresh(onClose: () => void) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["project-items"] });
    onClose();
  };
}

function TaskItemEditor({ id, onClose }: SubEditorProps) {
  const close = useCloseAndRefresh(onClose);
  const { tasks, updateTask, deleteTask, completeTask, rescheduleTask, discardTask } =
    useTasks({});
  const task = tasks.find((t) => t.id === id) ?? null;

  return (
    <TaskDetailModal
      task={task}
      open={!!task}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onUpdate={(taskId, updates: TaskUpdate) =>
        updateTask.mutate({ id: taskId, updates })
      }
      onComplete={(taskId) => completeTask.mutate(taskId)}
      onReschedule={(taskId, toDate) => rescheduleTask.mutate({ id: taskId, toDate })}
      onDiscard={(taskId) => discardTask.mutate(taskId)}
      onDelete={(taskId) => deleteTask.mutate(taskId)}
    />
  );
}

function GoalItemEditor({ id, onClose }: SubEditorProps) {
  const close = useCloseAndRefresh(onClose);
  const { goals } = useGoals({});
  const goal = goals.find((g) => g.id === id) ?? null;
  if (!goal) return null;
  return <GoalEditModal goal={goal} onClose={close} />;
}

function HypothesisItemEditor({ id, onClose }: SubEditorProps) {
  const close = useCloseAndRefresh(onClose);
  const { hypotheses } = useHypotheses({});
  const hypothesis = hypotheses.find((h) => h.id === id) ?? null;
  if (!hypothesis) return null;
  return <HypothesisFormModal hypothesis={hypothesis} onClose={close} />;
}

function DecisionItemEditor({ id, onClose }: SubEditorProps) {
  const close = useCloseAndRefresh(onClose);
  const { decisions } = useDecisions();
  const decision = decisions.find((d) => d.id === id) ?? null;
  if (!decision) return null;
  return <DecisionFormModal decision={decision} onClose={close} />;
}

function ExperimentItemEditor({ id, onClose }: SubEditorProps) {
  const close = useCloseAndRefresh(onClose);
  const { experiments } = useExperiments({});
  const experiment = experiments.find((e) => e.id === id) ?? null;
  if (!experiment) return null;
  return <ExperimentFormModal experiment={experiment} onClose={close} />;
}

function PredictionItemEditor({ id, onClose }: SubEditorProps) {
  const close = useCloseAndRefresh(onClose);
  const { predictions } = usePredictions({});
  const prediction = predictions.find((p) => p.id === id) ?? null;
  if (!prediction) return null;
  return <PredictionFormModal prediction={prediction} onClose={close} />;
}
