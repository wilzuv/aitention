import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types/daily";
import { TaskCheckbox } from "@/components/ui/TaskCheckbox";
import { getTaskPriorityMeta } from "@/lib/taskPriority";

interface DraggableTaskCardProps {
  task: Task;
  onToggle: (id: string, done: boolean) => void;
  onClick: (id: string) => void;
  overlay?: boolean;
}

export function DraggableTaskCard({ task, onToggle, onClick, overlay }: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const priority = getTaskPriorityMeta(task.priority);

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={`
        group rounded-md border bg-card px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing
        transition-shadow
        ${overlay ? "shadow-lg ring-2 ring-primary/20" : ""}
        ${isDragging ? "opacity-30" : ""}
        ${task.status === "done" ? "opacity-60" : ""}
      `}
      {...(overlay ? {} : { ...listeners, ...attributes })}
    >
      <div className="flex items-start gap-1.5">
        <div
          className="shrink-0 mt-[1px]"
          onClick={(e) => e.stopPropagation()}
        >
          <TaskCheckbox
            checked={task.status === "done"}
            onChange={(done) => onToggle(task.id, done)}
            disabled={task.status === "discarded"}
            priorityBorderClass={task.status !== "done" ? priority.borderClass : undefined}
          />
        </div>
        <button
          className={`flex-1 min-w-0 text-left leading-snug ${
            task.status === "done"
              ? "text-muted-foreground line-through"
              : task.status === "discarded"
                ? "text-muted-foreground/50 italic"
                : "text-foreground"
          }`}
          onClick={(e) => { e.stopPropagation(); onClick(task.id); }}
        >
          <span className="line-clamp-2">{task.title}</span>
        </button>
        {task.estimated_minutes != null && (
          <span className="shrink-0 text-[10px] text-muted-foreground/60 mt-0.5">
            {task.estimated_minutes}m
          </span>
        )}
      </div>
    </div>
  );
}
