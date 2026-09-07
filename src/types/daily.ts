import type { RecurrenceRule } from "@/lib/recurrence";

// --- Mood log types ---

export type MoodContext = "post_session" | "manual";

export interface MoodLog {
  id: string;
  user_id: string;
  logged_at: string;
  mood_rating: number | null;
  energy_rating: number | null;
  note: string | null;
  context: MoodContext;
  created_at: string;
  updated_at: string;
}

// --- Journal entry types ---

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// --- Session task link types ---

export interface SessionTask {
  id: string;
  user_id: string;
  session_id: string;
  task_id: string;
  is_primary: boolean;
  linked_when: "before" | "after";
}

// --- Focus session types ---

export interface FocusSession {
  id: string;
  user_id: string;
  entry_date: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  pre_session_notes: string | null;
  post_session_notes: string | null;
  enjoyment_rating: number | null;
  created_at: string;
  // Joined data (not stored on the session itself)
  session_tasks?: (SessionTask & { task?: Task })[];
}

// --- Task types ---

export interface ScheduleHistoryEntry {
  from: string;
  to: string;
  changed_at: string;
}

export interface Task {
  id: string;
  title: string;
  status: "open" | "done" | "discarded";
  priority: number;           // 1=low, 2=medium, 3=high
  due_date: string | null;
  scheduled_date: string | null;
  goal_id: string | null;
  estimated_minutes: number | null;
  actual_minutes: number;
  success_criteria: string | null;
  notes: string | null;
  reflection: string | null;
  recurrence_rule: RecurrenceRule | null;
  schedule_history: ScheduleHistoryEntry[];
  /** Number of times this task has been rescheduled (derived from schedule_history length) */
  reschedule_count: number;
  completed_at: string | null;
  discarded_at: string | null;
  created_at: string;
  updated_at: string;
  linear_ticket_id: string | null;
  /** Project this task belongs to, or null. Membership for the project view. */
  project_id: string | null;
  /** Milestone this task is filed under within its project, or null. */
  milestone_id: string | null;
}

// --- Oura daily record (agent-facing) ---

export interface OuraDailyRecord {
  date: string;
  readiness_score: number | null;
  sleep_score: number | null;
}

