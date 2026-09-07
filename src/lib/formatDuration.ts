/**
 * Formats a duration in minutes as a human-readable string.
 *
 * Examples:
 *   0  → "--"
 *   30 → "30m"
 *   60 → "1h"
 *   90 → "1h 30m"
 */
export function formatDuration(minutes: number): string {
  if (minutes === 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
