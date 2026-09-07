import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "@/hooks/use-toast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function showErrorToast(title: string, err: unknown) {
  let description = "Unknown error";
  if (err instanceof Error) {
    description = err.message;
  } else if (typeof err === "object" && err !== null && "message" in err) {
    description = String((err as { message: unknown }).message);
  }
  toast({ title, description, variant: "destructive" });
}
