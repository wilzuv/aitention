import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetadataChipProps {
  icon: ReactNode;
  /** Shown when no value is set */
  label: string;
  /** Shown when a value is set (replaces label) */
  value?: string;
  /** Render smaller and more muted (for deadline, recurrence) */
  muted?: boolean;
  /** Show only the icon when unset (for deadline, recurrence) */
  iconOnly?: boolean;
  /** Whether the chip's popover is currently open */
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MetadataChip({
  icon,
  label,
  value,
  muted,
  iconOnly,
  active,
  onClick,
  className,
}: MetadataChipProps) {
  const hasValue = Boolean(value);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border transition-colors",
        "text-xs leading-none whitespace-nowrap",
        muted ? "px-1.5 py-0.5" : "px-2 py-0.5",
        hasValue
          ? "bg-secondary/50 text-foreground border-border hover:bg-secondary/70"
          : "text-muted-foreground border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:text-foreground",
        active && "ring-1 ring-ring",
        className
      )}
    >
      {icon}
      {hasValue ? value : !iconOnly ? label : null}
    </button>
  );
}
