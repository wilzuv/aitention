interface TaskCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function TaskCheckbox({
  checked,
  onChange,
  disabled = false,
  size = "sm",
  className = "",
}: TaskCheckboxProps) {
  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const checkDim = size === "sm" ? 10 : 13;

  const handleClick = () => {
    if (disabled) return;
    onChange(!checked);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`flex-shrink-0 ${dim} rounded-full border-2 transition-colors flex items-center justify-center ${
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/40 hover:border-primary/60"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && (
        <svg width={checkDim} height={checkDim} viewBox="0 0 12 12" fill="none">
          {/* pathLength="1" normalizes the stroke length, so the dash offset in
              the draw-stroke keyframes runs cleanly from 1 to 0 regardless of
              the path's real geometry. */}
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={1}
            className="animate-draw-stroke motion-reduce:animate-none"
          />
        </svg>
      )}
    </button>
  );
}
