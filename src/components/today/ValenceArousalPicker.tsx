import type { CSSProperties } from "react";

interface ScaleOption {
  value: number;
  label: string;
  color: string;
}

const VALENCE_SCALE: ScaleOption[] = [
  { value: 1, label: "Awful", color: "hsl(var(--valence-1))" },
  { value: 2, label: "Bad", color: "hsl(var(--valence-2))" },
  { value: 3, label: "Low", color: "hsl(var(--valence-3))" },
  { value: 4, label: "Neutral", color: "hsl(var(--valence-4))" },
  { value: 5, label: "Good", color: "hsl(var(--valence-5))" },
  { value: 6, label: "Great", color: "hsl(var(--valence-6))" },
  { value: 7, label: "Excellent", color: "hsl(var(--valence-7))" },
];

const AROUSAL_SCALE: ScaleOption[] = [
  { value: 1, label: "Depleted", color: "hsl(var(--arousal-1))" },
  { value: 2, label: "Drained", color: "hsl(var(--arousal-2))" },
  { value: 3, label: "Low", color: "hsl(var(--arousal-3))" },
  { value: 4, label: "Neutral", color: "hsl(var(--arousal-4))" },
  { value: 5, label: "Energised", color: "hsl(var(--arousal-5))" },
  { value: 6, label: "Activated", color: "hsl(var(--arousal-6))" },
  { value: 7, label: "Wired", color: "hsl(var(--arousal-7))" },
];

interface PickerProps {
  type: "valence" | "arousal";
  value: number | null;
  onChange: (v: number) => void;
  compact?: boolean;
}

export function ValenceArousalPicker({ type, value, onChange, compact }: PickerProps) {
  const scale = type === "valence" ? VALENCE_SCALE : AROUSAL_SCALE;
  const label = type === "valence" ? "Mood" : "Energy";
  type RingStyle = CSSProperties & { "--tw-ring-color": string };

  return (
    <div className="space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <div className={`flex ${compact ? "gap-1" : "flex-wrap gap-1.5 sm:flex-nowrap sm:gap-2"}`}>
        {scale.map((opt) => {
          const isSelected = value === opt.value;
          const buttonStyle: RingStyle = {
            backgroundColor: isSelected ? opt.color + "22" : "transparent",
            "--tw-ring-color": isSelected ? opt.color : "transparent",
          };
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              title={opt.label}
              className={`relative flex flex-col items-center gap-0.5 rounded-md transition-all ${
                compact ? "px-1.5 py-1" : "w-14 px-1.5 py-1.5"
              } ${
                isSelected
                  ? "ring-1 ring-offset-1 ring-offset-background"
                  : "opacity-50 hover:opacity-80"
              }`}
              style={buttonStyle}
            >
              <div
                className={`rounded-full ${compact ? "w-4 h-4" : "w-5 h-5"}`}
                style={{ backgroundColor: opt.color }}
              />
              {!compact && (
                <span
                  className="text-xs font-medium leading-tight text-center"
                  style={{ color: isSelected ? opt.color : "hsl(var(--muted-foreground))" }}
                >
                  {opt.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
