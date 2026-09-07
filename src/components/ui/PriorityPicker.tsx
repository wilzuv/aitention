import { TASK_PRIORITY_ASC, getTaskPriorityMeta } from "@/lib/taskPriority";

interface PriorityPickerProps {
  value: number;
  onChange: (priority: number) => void;
}

export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  return (
    <div className="flex gap-1">
      {TASK_PRIORITY_ASC.map((priorityValue) => {
        const priority = getTaskPriorityMeta(priorityValue);
        return (
          <button
            key={priority.value}
            onClick={() => onChange(priority.value)}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
              value === priority.value
                ? priority.selectedClass
                : "border-border text-muted-foreground hover:border-foreground/20"
            }`}
          >
            {priority.label}
          </button>
        );
      })}
    </div>
  );
}
