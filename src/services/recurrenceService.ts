import { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { getNextRecurringDate, getRecurrenceAnchor, type RecurrenceRule } from "@/lib/recurrence";

// ── DB operations ──

/**
 * Complete a recurring task: log the completion, then shift the date forward.
 * The task stays open with a new scheduled_date — Todoist-style.
 */
export async function completeRecurring(
  supabase: SupabaseClient,
  task: { id: string; recurrence_rule: RecurrenceRule; scheduled_date: string }
): Promise<string> {
  const rule = task.recurrence_rule;
  const referenceDate =
    getRecurrenceAnchor(rule) === "completion"
      ? format(new Date(), "yyyy-MM-dd")
      : task.scheduled_date;
  const nextDate = getNextRecurringDate({ rule, referenceDate });

  // Log the completion
  const { error: logError } = await supabase
    .from("recurrence_completions")
    .insert({
      task_id: task.id,
      scheduled_for: task.scheduled_date,
    });
  if (logError) throw logError;

  // Shift the task to the next occurrence
  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      scheduled_date: nextDate,
      completed_at: null,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id);
  if (updateError) throw updateError;

  return nextDate;
}
