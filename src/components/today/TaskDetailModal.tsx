import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TaskCheckbox } from "@/components/ui/TaskCheckbox";
import { useGoals } from "@/hooks/useGoals";
import { supabase } from "@/integrations/supabase/client";
import { PriorityPicker } from "@/components/ui/PriorityPicker";
import { CalendarIcon, Clock, ExternalLink, Flag, History, Plus, Target, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MetadataChip } from "@/components/tasks/MetadataChip";
import { RecurrencePopover } from "@/components/tasks/RecurrencePopover";
import { TaskLogList } from "@/components/tasks/TaskLogList";
import { getTaskPriorityMeta } from "@/lib/taskPriority";
import { format, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/utils";
import { parseTaskInput, replaceTokenInText, priorityToToken, recurrenceToToken } from "@/lib/taskParser";
import { getDefaultScheduledDate, type RecurrenceRule } from "@/lib/recurrence";
import { formatDuration } from "@/lib/formatDuration";
import { useTasks } from "@/hooks/useTasks";
import type { Task, TaskUpdate } from "@/hooks/useTasks";
import {
  GoalAutocomplete,
  HighlightedInput,
  getNameGoalContext,
  normalizeGoalLookup,
  toGoalToken,
  stripGoalTokensFromName,
  tokenLabel,
  tokenTypeColor,
  describeRecurrence,
  getGoalAutocompleteCount,
  getGoalAtIndex,
  type GoalOption,
} from "@/components/tasks/TaskInputHelpers";

// ── Shared date helpers ──────────────────────────────────────────────

function parseDate(dateStr: string | null): Date | undefined {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatDateWithRelative(dateStr: string | null): string {
  const date = parseDate(dateStr);
  if (!date) return "Not set";
  if (isToday(date)) return `Today (${format(date, "MMM d")})`;
  if (isTomorrow(date)) return `Tomorrow (${format(date, "MMM d")})`;
  return format(date, "MMM d, yyyy");
}

// ── Props ────────────────────────────────────────────────────────────

interface TaskDetailModalProps {
  /** Pass a task for edit mode; null + mode="create" for create mode */
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit-mode callbacks */
  onUpdate?: (id: string, updates: TaskUpdate) => void;
  onComplete?: (id: string) => void;
  onReschedule?: (id: string, toDate: string) => void;
  onDiscard?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Callback to open a task (e.g. in a detail modal) — used for clickable undo toasts */
  onOpenTask?: (id: string) => void;
  /** Create-mode options */
  mode?: "edit" | "create";
  defaultDate?: string;
}

interface TaskEnjoyment {
  average: number | null;
  count: number;
}

// ── Component ────────────────────────────────────────────────────────

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onUpdate,
  onComplete,
  onReschedule,
  onDiscard,
  onDelete,
  onOpenTask,
  mode = "edit",
  defaultDate,
}: TaskDetailModalProps) {
  const isCreateMode = mode === "create" && !task;

  // ── Create-mode hooks (called unconditionally for Rules of Hooks) ──
  const navigateTo = useNavigate();
  // Only the createTask mutation is used here — skipList keeps this modal (which
  // AppLayout mounts on every route) from fetching the entire tasks table.
  const { createTask } = useTasks({ onOpenTask, skipList: true });
  // One query for whichever list this mode actually shows, and only once the
  // modal is open — it stays mounted (and closed) on every route otherwise.
  const { goals: goalsForPicker } = useGoals(
    isCreateMode ? { open: true, enabled: open } : { enabled: open },
  );

  const sortedGoals = useMemo(() => {
    return [...goalsForPicker].sort((a, b) => {
      const aOpen = a.status === null;
      const bOpen = b.status === null;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [goalsForPicker]);

  // ── Helpers ─────────────────────────────────────────────────────────
  /** Parse an estimate string like "90", "1.5h", "2h" into minutes, or NaN */
  const parseEstimateInput = (raw: string): number => {
    const trimmed = raw.trim().toLowerCase();
    const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)h(?:rs?)?$/);
    if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);
    return parseInt(trimmed, 10);
  };

  const formatEstimateDisplay = (mins: number): string => {
    if (mins >= 60 && mins % 60 === 0) return `${mins / 60}h`;
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
  };

  // ── Shared state ───────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  // ── Edit-mode state ────────────────────────────────────────────────
  const [notesOpen, setNotesOpen] = useState(false);

  // ── Create-mode state ──────────────────────────────────────────────
  const [dirty, setDirty] = useState(false);
  const [manualPriority, setManualPriority] = useState<number | null>(null);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [manualGoalId, setManualGoalId] = useState<string | null | undefined>(undefined);
  const [manualDeadline, setManualDeadline] = useState<string | null>(null);
  const [showSuccessCriteria, setShowSuccessCriteria] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [openChip, setOpenChip] = useState<string | null>(null);

  // Recurrence
  const [showRecurrenceSection, setShowRecurrenceSection] = useState(false);
  const [hasManualRecurrenceEdits, setHasManualRecurrenceEdits] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceRule["type"]>("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [intervalDays, setIntervalDays] = useState("7");
  const [dayOfMonth, setDayOfMonth] = useState(String(new Date().getDate()));
  const [intervalMonths, setIntervalMonths] = useState("1");
  const [anchor, setAnchor] = useState<"scheduled" | "completion">("scheduled");

  // Inline autocomplete
  const [nameGoalQuery, setNameGoalQuery] = useState("");
  const [showNameGoalDropdown, setShowNameGoalDropdown] = useState(false);
  const [goalSearchInput, setGoalSearchInput] = useState("");
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const [goalActiveIdx, setGoalActiveIdx] = useState(0);

  useEffect(() => { setGoalActiveIdx(0); }, [nameGoalQuery, showNameGoalDropdown]);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous re-entry guard for create submit. `createTask.isPending` flips
  // on re-render, which is too late to stop a same-tick double-fire (Enter key
  // + button click, or any rapid double trigger) — the exact pattern that
  // produced 4 identical inserts 2.6ms apart. A ref blocks the second call
  // before React re-renders.
  const submittingRef = useRef(false);

  // ── NLP parsing ────────────────────────────────────────────────────
  const parsed = useMemo(() => parseTaskInput(title), [title]);
  const goalOptions = useMemo<GoalOption[]>(() => {
    return sortedGoals.map((g) => ({ id: g.id, title: g.title }));
  }, [sortedGoals]);

  const parsedGoalId = useMemo(() => {
    if (!parsed.goalQuery) return null;
    const normalizedQuery = normalizeGoalLookup(parsed.goalQuery);
    if (!normalizedQuery) return null;
    const exact = goalOptions.find(
      (g) => normalizeGoalLookup(g.title) === normalizedQuery || normalizeGoalLookup(g.id) === normalizedQuery
    );
    if (exact) return exact.id;
    const partial = goalOptions.find((g) => normalizeGoalLookup(g.title).includes(normalizedQuery));
    return partial?.id ?? null;
  }, [parsed.goalQuery, goalOptions]);

  // Effective values for create mode
  const effectivePriority = manualPriority ?? parsed.priority ?? 2;
  const effectiveDate = manualDate ?? parsed.date ?? (defaultDate || "");
  const effectiveRecurrence = parsed.recurrence ?? null;
  const effectiveGoalId = manualGoalId !== undefined ? manualGoalId : parsedGoalId;
  const effectiveEstimatedMinutes = parsed.estimatedMinutes ?? null;
  const isRecurring = effectiveRecurrence !== null || showRecurrenceSection;
  const selectedGoal = useMemo(
    () => goalOptions.find((g) => g.id === effectiveGoalId) ?? null,
    [goalOptions, effectiveGoalId]
  );

  // ── Edit-mode: linked goal ─────────────────────────────────────────
  const linkedGoal = useMemo(
    () => sortedGoals.find((g) => g.id === task?.goal_id) ?? null,
    [sortedGoals, task?.goal_id]
  );

  // ── Enjoyment query (edit mode only) ───────────────────────────────
  const { data: enjoyment } = useQuery<TaskEnjoyment>({
    queryKey: ["task", "detail", "enjoyment", task?.id],
    enabled: Boolean(task?.id && open && !isCreateMode),
    queryFn: async () => {
      if (!task?.id) return { average: null, count: 0 };
      const { data, error } = await supabase
        .from("session_tasks")
        .select("focus_sessions!inner(enjoyment_rating)")
        .eq("task_id", task.id)
        .not("focus_sessions.enjoyment_rating", "is", null);
      if (error) throw error;
      const ratings: number[] = [];
      for (const row of data ?? []) {
        const session = row.focus_sessions as unknown as { enjoyment_rating: number } | null;
        if (session && typeof session.enjoyment_rating === "number") {
          ratings.push(session.enjoyment_rating);
        }
      }
      if (ratings.length === 0) return { average: null, count: 0 };
      const average = ratings.reduce((sum, v) => sum + v, 0) / ratings.length;
      return { average, count: ratings.length };
    },
  });

  // ── Session time query (edit mode only) ─────────────────────────────
  const { data: sessionStats } = useQuery<{ totalMinutes: number; sessionCount: number }>({
    queryKey: ["task", "detail", "sessionStats", task?.id],
    enabled: Boolean(task?.id && open && !isCreateMode),
    queryFn: async () => {
      if (!task?.id) return { totalMinutes: 0, sessionCount: 0 };
      const { data, error } = await supabase
        .from("session_tasks")
        .select("focus_sessions!inner(duration_minutes)")
        .eq("task_id", task.id)
        .not("focus_sessions.duration_minutes", "is", null);
      if (error) throw error;
      let total = 0;
      for (const row of data ?? []) {
        const session = row.focus_sessions as unknown as { duration_minutes: number } | null;
        if (session && typeof session.duration_minutes === "number") {
          total += session.duration_minutes;
        }
      }
      return { totalMinutes: total, sessionCount: (data ?? []).length };
    },
  });

  const editRecurrenceRule = task?.recurrence_rule ?? null;

  // ── Edit-mode recurrence form state ────────────────────────────────
  const [editRecType, setEditRecType] = useState<RecurrenceRule["type"]>("daily");
  const [editDaysOfWeek, setEditDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editIntervalDays, setEditIntervalDays] = useState("7");
  const [editDayOfMonth, setEditDayOfMonth] = useState(String(new Date().getDate()));
  const [editIntervalMonths, setEditIntervalMonths] = useState("1");
  const [editAnchor, setEditAnchor] = useState<"scheduled" | "completion">("scheduled");

  // Sync edit recurrence form state when popover opens
  const initEditRecurrenceForm = useCallback((rule: RecurrenceRule | null) => {
    if (rule) {
      setEditRecType(rule.type);
      setEditDaysOfWeek(rule.days_of_week ?? [1, 2, 3, 4, 5]);
      setEditIntervalDays(String(rule.interval_days ?? 7));
      setEditDayOfMonth(String(rule.day_of_month ?? new Date().getDate()));
      setEditIntervalMonths(String(rule.interval_months ?? 1));
      setEditAnchor(rule.anchor ?? "scheduled");
    } else {
      setEditRecType("daily");
      setEditDaysOfWeek([1, 2, 3, 4, 5]);
      setEditIntervalDays("7");
      setEditDayOfMonth(String(new Date().getDate()));
      setEditIntervalMonths("1");
      setEditAnchor("scheduled");
    }
  }, []);

  const buildEditRecurrenceRule = useCallback((): RecurrenceRule => {
    const rule: RecurrenceRule = { type: editRecType, anchor: editAnchor };
    if (editRecType === "fixed_weekly") rule.days_of_week = editDaysOfWeek;
    if (editRecType === "interval") rule.interval_days = parseInt(editIntervalDays, 10) || 7;
    if (editRecType === "monthly") {
      rule.day_of_month = parseInt(editDayOfMonth, 10) || new Date().getDate();
      rule.interval_months = parseInt(editIntervalMonths, 10) || 1;
    }
    return rule;
  }, [editRecType, editAnchor, editDaysOfWeek, editIntervalDays, editDayOfMonth, editIntervalMonths]);

  // ── Reset: edit mode (when task changes) ───────────────────────────
  // Clean up blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (task && !isCreateMode) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
      setSuccessCriteria(task.success_criteria ?? "");
      setEstimatedMinutes(task.estimated_minutes?.toString() ?? "");
      setNotesOpen(!!task.notes);
      setOpenChip(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  // ── Reset: create mode (when dialog opens) ─────────────────────────
  useEffect(() => {
    if (open && isCreateMode) {
      setTitle("");
      setNotes("");
      setSuccessCriteria("");
      setEstimatedMinutes("");
      setDirty(false);
      setManualPriority(null);
      setManualDate(null);
      setManualGoalId(undefined);
      setManualDeadline(null);
      setNameGoalQuery("");
      setShowNameGoalDropdown(false);
      setGoalSearchInput("");
      setShowGoalDropdown(false);
      setGoalActiveIdx(0);
      setShowSuccessCriteria(false);
      setShowRecurrenceSection(false);
      setHasManualRecurrenceEdits(false);
      setRecurrenceType("daily");
      setDaysOfWeek([1, 2, 3, 4, 5]);
      setIntervalDays("7");
      setDayOfMonth(String(new Date().getDate()));
      setIntervalMonths("1");
      setAnchor("scheduled");
      setOpenChip(null);
      submittingRef.current = false;
    }
  }, [open, isCreateMode]);

  // ── Create-mode helpers ────────────────────────────────────────────

  const markDirty = useCallback(() => {
    if (!dirty) setDirty(true);
  }, [dirty]);

  const toggleChip = (chip: string) => setOpenChip((prev) => (prev === chip ? null : chip));

  const handleNameInlineContext = useCallback((val: string, caret: number) => {
    const goalContext = getNameGoalContext(val, caret);

    if (goalContext) {
      setNameGoalQuery(goalContext.query);
      setShowNameGoalDropdown(true);
      return;
    }
    setShowNameGoalDropdown(false);
    setNameGoalQuery("");
  }, []);

  const handleNameChange = (val: string, caret: number) => {
    setTitle(val);
    handleNameInlineContext(val, caret);
    markDirty();
  };

  // Clear manual goal when NLP detects a new goal token
  useEffect(() => {
    if (isCreateMode && parsed.goalQuery && manualGoalId !== undefined && manualGoalId !== null) {
      setManualGoalId(undefined);
    }
  }, [isCreateMode, parsed.goalQuery, manualGoalId]);

  // Clear manual date when user types a different date in text
  useEffect(() => {
    if (isCreateMode && parsed.date && manualDate !== null && parsed.date !== manualDate) {
      setManualDate(null);
    }
  }, [isCreateMode, parsed.date, manualDate]);

  // Clear manual priority when user types a different priority in text
  useEffect(() => {
    if (isCreateMode && parsed.priority !== null && manualPriority !== null && parsed.priority !== manualPriority) {
      setManualPriority(null);
    }
  }, [isCreateMode, parsed.priority, manualPriority]);

  const insertNameGoal = (goal: GoalOption) => {
    const input = nameInputRef.current;
    const caret = input?.selectionStart ?? title.length;
    const context = getNameGoalContext(title, caret);
    if (!context) return;
    const token = toGoalToken(goal.title);
    const replacedName = `${title.slice(0, context.queryStart)}${token}${title.slice(context.queryEnd)}`;
    const addTrailingSpace = context.queryEnd === title.length;
    const nextName = addTrailingSpace ? `${replacedName} ` : replacedName;
    setTitle(nextName);
    setShowNameGoalDropdown(false);
    setNameGoalQuery("");
    setManualGoalId(undefined);
    markDirty();
    requestAnimationFrame(() => {
      if (!input) return;
      const nextCaret = context.queryStart + token.length + (addTrailingSpace ? 1 : 0);
      input.focus();
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const selectGoalFromField = (goal: GoalOption) => {
    setManualGoalId(goal.id);
    setGoalSearchInput("");
    setShowGoalDropdown(false);
    markDirty();
  };

  const clearGoalSelection = () => {
    setTitle((prev) => stripGoalTokensFromName(prev, parsed.tokens));
    setManualGoalId(null);
    setGoalSearchInput("");
    setShowGoalDropdown(false);
    markDirty();
  };

  const buildRecurrenceRule = (): RecurrenceRule => {
    const rule: RecurrenceRule = { type: recurrenceType, anchor };
    if (recurrenceType === "fixed_weekly") rule.days_of_week = daysOfWeek;
    if (recurrenceType === "interval") rule.interval_days = parseInt(intervalDays, 10) || 7;
    if (recurrenceType === "monthly") {
      rule.day_of_month = parseInt(dayOfMonth, 10) || new Date().getDate();
      rule.interval_months = parseInt(intervalMonths, 10) || 1;
    }
    return rule;
  };

  const handleCreateSubmit = () => {
    const cleanName = parsed.cleanName;
    if (!cleanName.trim()) return;
    // Block re-entry while a create is already in flight (see submittingRef).
    if (submittingRef.current) return;
    submittingRef.current = true;
    // Manual estimate field takes priority over NLP-parsed value
    const manualMins = parseEstimateInput(estimatedMinutes);
    const finalEstimate = !isNaN(manualMins) && manualMins > 0 ? manualMins : effectiveEstimatedMinutes;

    const recurrenceRule = showRecurrenceSection ? buildRecurrenceRule() : effectiveRecurrence;
    let scheduledDate = effectiveDate || null;
    if (recurrenceRule && !scheduledDate) {
      scheduledDate = getDefaultScheduledDate(recurrenceRule);
    }

    createTask.mutate(
      {
        title: cleanName.trim(),
        priority: effectivePriority,
        goal_id: effectiveGoalId ?? null,
        estimated_minutes: finalEstimate,
        success_criteria: successCriteria.trim() || null,
        notes: notes.trim() || null,
        scheduled_date: scheduledDate,
        due_date: manualDeadline || null,
        recurrence_rule: recurrenceRule ?? null,
        status: "open",
      },
      {
        onSuccess: () => { submittingRef.current = false; onOpenChange(false); },
        onError: (err) => { submittingRef.current = false; showErrorToast("Could not create task", err); },
      }
    );
  };

  const handleCreateClose = (newOpen: boolean) => {
    if (!newOpen && dirty) {
      setShowDiscard(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showNameGoalDropdown && e.key === "Escape") {
      setShowNameGoalDropdown(false);
      return;
    }

    // Arrow navigation for goal dropdown
    if (showNameGoalDropdown) {
      const totalGoalItems = getGoalAutocompleteCount(nameGoalQuery, goalOptions, effectiveGoalId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setGoalActiveIdx((prev) => (prev + 1) % Math.max(1, totalGoalItems));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setGoalActiveIdx((prev) => (prev - 1 + Math.max(1, totalGoalItems)) % Math.max(1, totalGoalItems));
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        const goal = getGoalAtIndex(nameGoalQuery, goalOptions, effectiveGoalId, goalActiveIdx);
        if (goal) {
          e.preventDefault();
          insertNameGoal(goal);
          setGoalActiveIdx(0);
          return;
        }
      }
    }

    if (e.key === "Enter") { e.preventDefault(); handleCreateSubmit(); }
  };

  const handleAddRecurrence = () => {
    if (!hasManualRecurrenceEdits && parsed.recurrence) {
      setRecurrenceType(parsed.recurrence.type);
      setDaysOfWeek(parsed.recurrence.days_of_week ?? [1, 2, 3, 4, 5]);
      setIntervalDays(String(parsed.recurrence.interval_days ?? 7));
      setAnchor(parsed.recurrence.anchor ?? "scheduled");
    }
    setShowRecurrenceSection(true);
    setHasManualRecurrenceEdits(true);
    markDirty();
  };

  const handleRemoveRecurrence = () => {
    // Remove recurrence token from text
    setTitle((prev) => replaceTokenInText(prev, parseTaskInput(prev).tokens, "recurrence", null));
    setShowRecurrenceSection(false);
    setHasManualRecurrenceEdits(false);
    markDirty();
  };

  /** Sync recurrence chip state back to text */
  const syncRecurrenceToText = (rule: RecurrenceRule) => {
    const token = recurrenceToToken(rule);
    setTitle((prev) => replaceTokenInText(prev, parseTaskInput(prev).tokens, "recurrence", token));
  };

  // ── Edit-mode handlers ─────────────────────────────────────────────

  const handleSaveTitle = () => {
    if (!task || !onUpdate) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    // Parse for NLP tokens so editing supports the same shortcuts as creation
    const editParsed = parseTaskInput(trimmed);
    const updates: TaskUpdate = {};

    // Only strip tokens we actually persist — leave unhandled tokens in the title
    const persistedTypes = new Set<string>();
    if (editParsed.date) persistedTypes.add("date");
    if (editParsed.priority !== null) persistedTypes.add("priority");
    if (editParsed.estimatedMinutes !== null) persistedTypes.add("estimate");
    if (editParsed.recurrence) persistedTypes.add("recurrence");

    // Build clean title by only stripping persisted token types
    const persistedTokens = editParsed.tokens.filter((t) => persistedTypes.has(t.type));
    let cleanTitle = trimmed;
    for (let i = persistedTokens.length - 1; i >= 0; i--) {
      const t = persistedTokens[i];
      cleanTitle = cleanTitle.slice(0, t.start) + cleanTitle.slice(t.end);
    }
    cleanTitle = cleanTitle.replace(/\s{2,}/g, " ").trim();

    // If stripping leaves no title text, keep the original title and still apply metadata
    const finalTitle = cleanTitle || task.title;
    if (finalTitle !== task.title) updates.title = finalTitle;

    // Route date through the reschedule flow to preserve schedule history
    if (editParsed.date && onReschedule) {
      onReschedule(task.id, editParsed.date);
    }

    if (editParsed.priority !== null) updates.priority = editParsed.priority;
    if (editParsed.estimatedMinutes !== null) updates.estimated_minutes = editParsed.estimatedMinutes;
    if (editParsed.recurrence) updates.recurrence_rule = editParsed.recurrence;

    if (Object.keys(updates).length > 0) {
      onUpdate(task.id, updates);
    }

    // Always reset input to clean title so tokens don't re-trigger on next blur
    if (persistedTokens.length > 0) {
      setTitle(finalTitle);
    }
  };

  const handleSaveNotes = () => {
    if (!task || !onUpdate) return;
    const trimmed = notes.trim();
    if (trimmed !== (task.notes ?? "")) onUpdate(task.id, { notes: trimmed || null });
  };

  const handleSaveCriteria = () => {
    if (!task || !onUpdate) return;
    const trimmed = successCriteria.trim();
    if (trimmed !== (task.success_criteria ?? "")) onUpdate(task.id, { success_criteria: trimmed || null });
  };

  const handleSaveEstimate = () => {
    if (!task || !onUpdate) return;
    const mins = parseEstimateInput(estimatedMinutes);
    if (!isNaN(mins) && mins > 0 && mins !== task.estimated_minutes) {
      onUpdate(task.id, { estimated_minutes: mins });
      return;
    }
    if (estimatedMinutes.trim() === "" && task.estimated_minutes !== null) {
      onUpdate(task.id, { estimated_minutes: null });
    }
  };

  // ── Create-mode derived UI values ───────────────────────────────────

  const createGoalButtonLabel = selectedGoal?.title ?? "No goal";
  const createGoalButtonHint = selectedGoal ? "Linked to goal" : "Link this task to a goal";
  const selectedCreateScheduledDate = parseDate(effectiveDate || null);

  // ── Render: Create mode ────────────────────────────────────────────

  if (isCreateMode) {
    return (
      <>
        <Dialog open={open && !showDiscard} onOpenChange={handleCreateClose}>
          <DialogContent className="max-w-lg" onPointerDownOutside={(e) => {
            if (dirty) { e.preventDefault(); setShowDiscard(true); }
          }}>
            <DialogHeader>
              <DialogTitle className="sr-only">Add task</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Title with NLP highlighting + inline autocomplete */}
              <div className="min-w-0">
                <HighlightedInput
                  value={title}
                  tokens={parsed.tokens}
                  inactiveTokens={parsed.inactiveTokens}
                  onChange={handleNameChange}
                  onKeyDown={handleNameKeyDown}
                  onCaretChange={(caret) => handleNameInlineContext(title, caret)}
                  onFocus={() => handleNameInlineContext(title, nameInputRef.current?.selectionStart ?? title.length)}
                  onBlur={() => {
                    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                    blurTimeoutRef.current = setTimeout(() => {
                      setShowNameGoalDropdown(false);
                      blurTimeoutRef.current = null;
                    }, 150);
                  }}
                  inputRef={nameInputRef as React.RefObject<HTMLInputElement>}
                  placeholder="Task name (try: Buy milk tomorrow !1)"
                />
                <GoalAutocomplete
                  query={nameGoalQuery}
                  goals={goalOptions}
                  selectedGoalId={effectiveGoalId}
                  onSelect={insertNameGoal}
                  visible={showNameGoalDropdown}
                  emptyLabel={goalOptions.length === 0 ? "No active weekly goals" : "No goals found"}
                  activeIdx={goalActiveIdx}
                />
                {parsed.tokens.length > 0 && (
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {parsed.tokens
                      .filter((t) => !parsed.inactiveTokens.some((it) => it.start === t.start && it.end === t.end))
                      .map((t, i) => (
                        <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${tokenTypeColor(t.type)}`}>
                          {tokenLabel(t)}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* ── Chip row ─────────────────────────────────────── */}
              <div className="flex flex-wrap gap-1.5 items-center">
                {/* Date chip */}
                <Popover open={openChip === "date"} onOpenChange={(o) => setOpenChip(o ? "date" : null)}>
                  <PopoverTrigger asChild>
                    <span className="inline-flex"><MetadataChip
                      icon={<CalendarIcon className="w-3 h-3" />}
                      label="Schedule"
                      value={effectiveDate ? formatDateWithRelative(effectiveDate) : undefined}
                      active={openChip === "date"}
                    /></span>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedCreateScheduledDate}
                      onSelect={(date) => {
                        if (date) {
                          const dateStr = format(date, "yyyy-MM-dd");
                          // Only update text if there's already a date token typed by the user
                          const currentTokens = parseTaskInput(title).tokens;
                          const hasDateToken = currentTokens.some((t) => t.type === "date");
                          if (hasDateToken) {
                            const dateToken = format(date, "d.M");
                            setTitle((prev) => replaceTokenInText(prev, parseTaskInput(prev).tokens, "date", dateToken));
                          }
                          setManualDate(dateStr);
                          markDirty();
                        }
                        setOpenChip(null);
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                {/* Deadline chip */}
                <Popover open={openChip === "deadline"} onOpenChange={(o) => setOpenChip(o ? "deadline" : null)}>
                  <PopoverTrigger asChild>
                    <span className="inline-flex"><MetadataChip
                      icon={<CalendarIcon className="w-3 h-3" />}
                      label="Deadline"
                      value={manualDeadline ? formatDateWithRelative(manualDeadline) : undefined}
                      muted
                      active={openChip === "deadline"}
                    /></span>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDate(manualDeadline)}
                      onSelect={(date) => {
                        if (date) { setManualDeadline(format(date, "yyyy-MM-dd")); markDirty(); }
                        setOpenChip(null);
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                    {manualDeadline && (
                      <div className="px-3 pb-2">
                        <Button variant="ghost" size="sm" className="h-6 text-xs w-full" onClick={() => { setManualDeadline(null); markDirty(); setOpenChip(null); }}>
                          Clear deadline
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Priority chip */}
                <Popover open={openChip === "priority"} onOpenChange={(o) => setOpenChip(o ? "priority" : null)}>
                  <PopoverTrigger asChild>
                    <span className="inline-flex"><MetadataChip
                      icon={<span className={cn("w-2 h-2 rounded-full inline-block", getTaskPriorityMeta(effectivePriority).dotClass)} />}
                      label={getTaskPriorityMeta(effectivePriority).label}
                      value={getTaskPriorityMeta(effectivePriority).label}
                      active={openChip === "priority"}
                    /></span>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <PriorityPicker value={effectivePriority} onChange={(val) => {
                      // Only update text if there's already a priority token typed by the user
                      const currentTokens = parseTaskInput(title).tokens;
                      const hasPriorityToken = currentTokens.some((t) => t.type === "priority");
                      if (hasPriorityToken) {
                        setTitle((prev) => replaceTokenInText(prev, parseTaskInput(prev).tokens, "priority", priorityToToken(val)));
                      }
                      setManualPriority(val);
                      markDirty();
                      setOpenChip(null);
                    }} />
                  </PopoverContent>
                </Popover>

                {/* Estimate chip */}
                <Popover open={openChip === "estimate"} onOpenChange={(o) => setOpenChip(o ? "estimate" : null)}>
                  <PopoverTrigger asChild>
                    <span className="inline-flex"><MetadataChip
                      icon={<Clock className="w-3 h-3" />}
                      label="Estimate"
                      value={(() => {
                        const mins = parseEstimateInput(estimatedMinutes);
                        if (!isNaN(mins) && mins > 0) return formatEstimateDisplay(mins);
                        if (effectiveEstimatedMinutes) return formatEstimateDisplay(effectiveEstimatedMinutes);
                        return undefined;
                      })()}
                      active={openChip === "estimate"}
                    /></span>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="space-y-2">
                      <div className="flex gap-1.5">
                        {[30, 60, 180].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => { setEstimatedMinutes(String(mins)); markDirty(); setOpenChip(null); }}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                              parseEstimateInput(estimatedMinutes) === mins
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                            )}
                          >
                            {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="text"
                          value={estimatedMinutes}
                          onChange={(e) => { setEstimatedMinutes(e.target.value); markDirty(); }}
                          placeholder="e.g. 45 or 1.5h"
                          className="w-24 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            const mins = parseEstimateInput(estimatedMinutes);
                            return !isNaN(mins) && mins > 0 && estimatedMinutes.toLowerCase().includes("h")
                              ? `= ${mins}min`
                              : "min";
                          })()}
                        </span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Goal chip */}
                <Popover open={openChip === "goal"} onOpenChange={(o) => setOpenChip(o ? "goal" : null)}>
                  <PopoverTrigger asChild>
                    <span className="inline-flex"><MetadataChip
                      icon={<Target className="w-3 h-3" />}
                      label="Goal"
                      value={selectedGoal?.title ?? undefined}
                      active={openChip === "goal"}
                    /></span>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[280px]" align="start">
                    <Command>
                      <CommandInput placeholder="Search goals..." />
                      <CommandList>
                        <CommandEmpty>{goalOptions.length === 0 ? "No active weekly goals" : "No goals found"}</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => { clearGoalSelection(); setOpenChip(null); }}>No goal</CommandItem>
                          {sortedGoals.map((goal) => (
                            <CommandItem
                              key={goal.id}
                              value={`${goal.title} ${goal.status ?? "open"}`}
                              onSelect={() => { selectGoalFromField({ id: goal.id, title: goal.title }); setOpenChip(null); }}
                            >
                              <div className="flex w-full items-center justify-between gap-2">
                                <span className="truncate text-xs">{goal.title}</span>
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">{goal.status ?? "open"}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Recurrence chip */}
                <RecurrencePopover
                  recType={showRecurrenceSection || effectiveRecurrence ? (showRecurrenceSection ? recurrenceType : effectiveRecurrence?.type ?? "daily") : "daily"}
                  daysOfWeek={daysOfWeek}
                  intervalDays={intervalDays}
                  dayOfMonth={dayOfMonth}
                  intervalMonths={intervalMonths}
                  anchor={anchor}
                  isActive={showRecurrenceSection || !!effectiveRecurrence}
                  displayValue={
                    showRecurrenceSection
                      ? describeRecurrence(buildRecurrenceRule())
                      : effectiveRecurrence
                        ? describeRecurrence(effectiveRecurrence)
                        : undefined
                  }
                  open={openChip === "recurrence"}
                  onOpenChange={(o) => setOpenChip(o ? "recurrence" : null)}
                  onTypeChange={(newType) => {
                    if (!showRecurrenceSection) handleAddRecurrence();
                    setRecurrenceType(newType);
                    setHasManualRecurrenceEdits(true);
                    const tmpRule: RecurrenceRule = { type: newType, anchor };
                    if (newType === "fixed_weekly") tmpRule.days_of_week = daysOfWeek;
                    if (newType === "interval") tmpRule.interval_days = parseInt(intervalDays, 10) || 7;
                    if (newType === "monthly") { tmpRule.day_of_month = parseInt(dayOfMonth, 10) || new Date().getDate(); tmpRule.interval_months = parseInt(intervalMonths, 10) || 1; }
                    syncRecurrenceToText(tmpRule);
                    markDirty();
                  }}
                  onDaysOfWeekChange={(next) => { if (!showRecurrenceSection) handleAddRecurrence(); setDaysOfWeek(next); setHasManualRecurrenceEdits(true); markDirty(); }}
                  onIntervalDaysChange={(v) => { if (!showRecurrenceSection) handleAddRecurrence(); setIntervalDays(v); setHasManualRecurrenceEdits(true); markDirty(); }}
                  onDayOfMonthChange={(v) => { if (!showRecurrenceSection) handleAddRecurrence(); setDayOfMonth(v); setHasManualRecurrenceEdits(true); markDirty(); }}
                  onIntervalMonthsChange={(v) => { if (!showRecurrenceSection) handleAddRecurrence(); setIntervalMonths(v); setHasManualRecurrenceEdits(true); markDirty(); }}
                  onAnchorChange={(v) => { if (!showRecurrenceSection) handleAddRecurrence(); setAnchor(v); setHasManualRecurrenceEdits(true); markDirty(); }}
                  onRemove={() => { handleRemoveRecurrence(); setOpenChip(null); }}
                />
              </div>

              {/* ── Success criteria (always visible) ───────────── */}
              <Textarea
                value={successCriteria}
                onChange={(e) => { setSuccessCriteria(e.target.value); markDirty(); }}
                placeholder="This is done when..."
                className="min-h-[70px] text-sm resize-none"
              />

              {/* Notes (optional) */}
              {notesOpen || notes ? (
                <Textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); markDirty(); }}
                  placeholder="Add context, links, or details..."
                  className="min-h-[70px] text-sm resize-none"
                />
              ) : (
                <button
                  onClick={() => setNotesOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-dashed border-border hover:border-foreground/30"
                >
                  <Plus className="w-3 h-3" />
                  Add notes
                </button>
              )}

              {/* Submit */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  <kbd className="px-1 py-0.5 rounded bg-muted text-xs font-mono">Enter</kbd> to save
                  {" · "}
                  <kbd className="px-1 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+Alt+N</kbd> from anywhere
                </span>
                <Button size="sm" onClick={handleCreateSubmit} disabled={!parsed.cleanName.trim() || createTask.isPending} className="text-xs">
                  {isRecurring ? "Create recurring" : "Create task"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Discard confirmation */}
        <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard changes?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to discard them?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDiscard(false)}>Keep editing</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowDiscard(false); setDirty(false); onOpenChange(false); }}>
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ── Render: Edit mode ──────────────────────────────────────────────

  if (!task) return null;

  const isDone = task.status === "done";
  const isDiscarded = task.status === "discarded";
  const rescheduleCount = task.schedule_history?.length ?? 0;
  const hasEnjoyment = Boolean(enjoyment?.count && enjoyment.average !== null);
  const prettyEnjoyment = hasEnjoyment && enjoyment?.average !== null ? enjoyment.average.toFixed(1) : null;
  const sessionsText = enjoyment?.count === 1 ? "session" : "sessions";

  const selectedScheduledDate = parseDate(task.scheduled_date);
  const selectedDueDate = parseDate(task.due_date);

  const completeAndClose = (checked: boolean) => {
    if (!checked || isDone || isDiscarded) return;
    onComplete?.(task.id);
    onOpenChange(false);
  };


  const handleEditRecurrenceChange = (rule: RecurrenceRule) => {
    if (!task || !onUpdate) return;
    onUpdate(task.id, { recurrence_rule: rule });
  };

  const handleEditRecurrenceRemove = () => {
    if (!task || !onUpdate) return;
    onUpdate(task.id, { recurrence_rule: null });
  };

  const clearEditGoal = () => {
    onUpdate?.(task.id, { goal_id: null });
    setOpenChip(null);
  };

  const selectEditGoal = (goalId: string) => {
    onUpdate?.(task.id, { goal_id: goalId });
    setOpenChip(null);
  };

  const handleEditTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Dismiss dropdowns on Escape
    if (showNameGoalDropdown && e.key === "Escape") {
      setShowNameGoalDropdown(false);
      return;
    }

    // Arrow navigation for goal dropdown
    if (showNameGoalDropdown) {
      const totalGoalItems = getGoalAutocompleteCount(nameGoalQuery, goalOptions, effectiveGoalId);
      if (e.key === "ArrowDown") { e.preventDefault(); setGoalActiveIdx((prev) => (prev + 1) % Math.max(1, totalGoalItems)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setGoalActiveIdx((prev) => (prev - 1 + Math.max(1, totalGoalItems)) % Math.max(1, totalGoalItems)); return; }
      if (e.key === "Tab" || e.key === "Enter") {
        const goal = getGoalAtIndex(nameGoalQuery, goalOptions, effectiveGoalId, goalActiveIdx);
        if (goal) { e.preventDefault(); insertNameGoal(goal); setGoalActiveIdx(0); return; }
      }
    }

    if (e.key === "Enter") { e.preventDefault(); handleSaveTitle(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onPointerDownOutside={() => { handleSaveTitle(); handleSaveEstimate(); }}>
        <DialogHeader>
          <DialogTitle className="sr-only">Task details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title with checkbox */}
          <div className="flex items-start gap-2.5 min-w-0">
            <TaskCheckbox
              checked={isDone}
              onChange={completeAndClose}
              disabled={isDone || isDiscarded}
              size="md"
              className="mt-1.5 shrink-0"
              priorityBorderClass={!isDone ? getTaskPriorityMeta(task.priority).borderClass : undefined}
            />
            <div className="min-w-0 flex-1">
              <HighlightedInput
                value={title}
                tokens={parsed.tokens}
                onChange={(val) => { setTitle(val); handleNameInlineContext(val, nameInputRef.current?.selectionStart ?? val.length); }}
                onKeyDown={handleEditTitleKeyDown}
                onCaretChange={(caret) => handleNameInlineContext(title, caret)}
                onFocus={() => handleNameInlineContext(title, nameInputRef.current?.selectionStart ?? title.length)}
                onBlur={() => {
                  if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                  blurTimeoutRef.current = setTimeout(() => {
                    setShowNameGoalDropdown(false);
                    blurTimeoutRef.current = null;
                  }, 150);
                  handleSaveTitle();
                }}
                inputRef={nameInputRef as React.RefObject<HTMLInputElement>}
                placeholder="Task name"
              />
              <GoalAutocomplete
                query={nameGoalQuery}
                goals={goalOptions}
                selectedGoalId={effectiveGoalId}
                onSelect={insertNameGoal}
                visible={showNameGoalDropdown}
                emptyLabel={goalOptions.length === 0 ? "No active weekly goals" : "No goals found"}
                activeIdx={goalActiveIdx}
              />
            </div>
          </div>

          {/* ── Chip row ─────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Date chip */}
            <Popover open={openChip === "date"} onOpenChange={(o) => setOpenChip(o ? "date" : null)}>
              <PopoverTrigger asChild>
                <span className="inline-flex"><MetadataChip
                  icon={<CalendarIcon className="w-3 h-3" />}
                  label="Schedule"
                  value={task.scheduled_date ? formatDateWithRelative(task.scheduled_date) : undefined}
                  active={openChip === "date"}
                /></span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedScheduledDate}
                  onSelect={(date) => {
                    if (date) onReschedule?.(task.id, format(date, "yyyy-MM-dd"));
                    setOpenChip(null);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Deadline chip */}
            <Popover open={openChip === "deadline"} onOpenChange={(o) => setOpenChip(o ? "deadline" : null)}>
              <PopoverTrigger asChild>
                <span className="inline-flex"><MetadataChip
                  icon={<CalendarIcon className="w-3 h-3" />}
                  label="Deadline"
                  value={task.due_date ? formatDateWithRelative(task.due_date) : undefined}
                  muted
                  active={openChip === "deadline"}
                /></span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDueDate}
                  onSelect={(date) => {
                    if (date) onUpdate?.(task.id, { due_date: format(date, "yyyy-MM-dd") });
                    setOpenChip(null);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
                {task.due_date && (
                  <div className="px-3 pb-2">
                    <Button variant="ghost" size="sm" className="h-6 text-xs w-full" onClick={() => { onUpdate?.(task.id, { due_date: null }); setOpenChip(null); }}>
                      Clear deadline
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Priority chip */}
            <Popover open={openChip === "priority"} onOpenChange={(o) => setOpenChip(o ? "priority" : null)}>
              <PopoverTrigger asChild>
                <span className="inline-flex"><MetadataChip
                  icon={<span className={cn("w-2 h-2 rounded-full inline-block", getTaskPriorityMeta(task.priority).dotClass)} />}
                  label={getTaskPriorityMeta(task.priority).label}
                  value={getTaskPriorityMeta(task.priority).label}
                  active={openChip === "priority"}
                /></span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <PriorityPicker value={task.priority} onChange={(p) => { onUpdate?.(task.id, { priority: p }); setOpenChip(null); }} />
              </PopoverContent>
            </Popover>

            {/* Estimate chip */}
            <Popover open={openChip === "estimate"} onOpenChange={(o) => { if (!o) handleSaveEstimate(); setOpenChip(o ? "estimate" : null); }}>
              <PopoverTrigger asChild>
                <span className="inline-flex"><MetadataChip
                  icon={<Clock className="w-3 h-3" />}
                  label="Estimate"
                  value={(() => {
                    const mins = parseEstimateInput(estimatedMinutes);
                    if (!isNaN(mins) && mins > 0) return formatEstimateDisplay(mins);
                    return undefined;
                  })()}
                  active={openChip === "estimate"}
                /></span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    {[30, 60, 180].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => { setEstimatedMinutes(String(mins)); onUpdate?.(task.id, { estimated_minutes: mins }); setOpenChip(null); }}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                          parseEstimateInput(estimatedMinutes) === mins
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                        )}
                      >
                        {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="text"
                      value={estimatedMinutes}
                      onChange={(e) => setEstimatedMinutes(e.target.value)}
                      onBlur={() => {
                        const mins = parseEstimateInput(estimatedMinutes);
                        if (!isNaN(mins) && mins > 0) {
                          onUpdate?.(task.id, { estimated_minutes: mins });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const mins = parseEstimateInput(estimatedMinutes);
                          if (!isNaN(mins) && mins > 0) {
                            onUpdate?.(task.id, { estimated_minutes: mins });
                          }
                          setOpenChip(null);
                        }
                      }}
                      placeholder="e.g. 45 or 1.5h"
                      className="w-24 h-7 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const mins = parseEstimateInput(estimatedMinutes);
                        return !isNaN(mins) && mins > 0 && estimatedMinutes.toLowerCase().includes("h")
                          ? `= ${mins}min`
                          : "min";
                      })()}
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Goal chip */}
            <div className="inline-flex items-center gap-0.5">
              <Popover open={openChip === "goal"} onOpenChange={(o) => setOpenChip(o ? "goal" : null)}>
                <PopoverTrigger asChild>
                  <span className="inline-flex"><MetadataChip
                    icon={<Target className="w-3 h-3" />}
                    label="Goal"
                    value={linkedGoal?.title ?? undefined}
                    active={openChip === "goal"}
                  /></span>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]" align="start">
                  <Command>
                    <CommandInput placeholder="Search goals..." />
                    <CommandList>
                      <CommandEmpty>No goals found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={clearEditGoal}>No goal</CommandItem>
                        {sortedGoals.map((goal) => (
                          <CommandItem
                            key={goal.id}
                            value={`${goal.title} ${goal.status ?? "open"}`}
                            onSelect={() => selectEditGoal(goal.id)}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate text-xs">{goal.title}</span>
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">{goal.status ?? "open"}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {linkedGoal && (
                <button
                  type="button"
                  onClick={() => navigateTo(`/goals?open=${linkedGoal.id}`)}
                  className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors"
                  title="Open goal"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Recurrence chip — always visible for all tasks */}
            <RecurrencePopover
              recType={editRecType}
              daysOfWeek={editDaysOfWeek}
              intervalDays={editIntervalDays}
              dayOfMonth={editDayOfMonth}
              intervalMonths={editIntervalMonths}
              anchor={editAnchor}
              isActive={!!editRecurrenceRule}
              displayValue={editRecurrenceRule ? describeRecurrence(editRecurrenceRule) : undefined}
              open={openChip === "recurrence"}
              onOpenChange={(o) => {
                if (o) initEditRecurrenceForm(editRecurrenceRule);
                setOpenChip(o ? "recurrence" : null);
              }}
              onTypeChange={(newType) => {
                setEditRecType(newType);
                if (newType === "fixed_weekly" && editDaysOfWeek.length === 0) setEditDaysOfWeek([1, 2, 3, 4, 5]);
                const rule: RecurrenceRule = { type: newType, anchor: editAnchor };
                if (newType === "fixed_weekly") rule.days_of_week = editDaysOfWeek.length > 0 ? editDaysOfWeek : [1, 2, 3, 4, 5];
                if (newType === "interval") rule.interval_days = parseInt(editIntervalDays, 10) || 7;
                if (newType === "monthly") { rule.day_of_month = parseInt(editDayOfMonth, 10) || new Date().getDate(); rule.interval_months = parseInt(editIntervalMonths, 10) || 1; }
                handleEditRecurrenceChange(rule);
              }}
              onDaysOfWeekChange={(next) => {
                setEditDaysOfWeek(next);
                const rule = buildEditRecurrenceRule();
                rule.days_of_week = next;
                handleEditRecurrenceChange(rule);
              }}
              onIntervalDaysChange={(v) => {
                setEditIntervalDays(v);
                const val = parseInt(v, 10);
                if (!isNaN(val) && val > 0) {
                  const rule = buildEditRecurrenceRule();
                  rule.interval_days = val;
                  handleEditRecurrenceChange(rule);
                }
              }}
              onDayOfMonthChange={(v) => {
                setEditDayOfMonth(v);
                const val = parseInt(v, 10);
                if (!isNaN(val) && val >= 1 && val <= 31) {
                  const rule = buildEditRecurrenceRule();
                  rule.day_of_month = val;
                  handleEditRecurrenceChange(rule);
                }
              }}
              onIntervalMonthsChange={(v) => {
                setEditIntervalMonths(v);
                const val = parseInt(v, 10);
                if (!isNaN(val) && val > 0) {
                  const rule = buildEditRecurrenceRule();
                  rule.interval_months = val;
                  handleEditRecurrenceChange(rule);
                }
              }}
              onAnchorChange={(newAnchor) => {
                setEditAnchor(newAnchor);
                const rule = buildEditRecurrenceRule();
                rule.anchor = newAnchor;
                handleEditRecurrenceChange(rule);
              }}
              onRemove={() => { handleEditRecurrenceRemove(); setOpenChip(null); }}
            />
          </div>

          {/* Reschedule count indicator */}
          {rescheduleCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <History className="w-3 h-3" />
              rescheduled {rescheduleCount}x
            </div>
          )}

          {/* Enjoyment stats */}
          {hasEnjoyment && (
            <div className="flex items-center gap-2 rounded-md bg-secondary/30 px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">Enjoyment</span>
              <span className="text-xs font-medium">{prettyEnjoyment}/7</span>
              <span className="text-xs text-muted-foreground">
                avg from {enjoyment?.count} {sessionsText}
              </span>
            </div>
          )}

          {/* Time spent stats */}
          {sessionStats && sessionStats.totalMinutes > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-secondary/30 px-2.5 py-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Time spent</span>
              <span className="text-xs font-medium">
                {formatDuration(sessionStats.totalMinutes)}
              </span>
              <span className="text-xs text-muted-foreground">
                from {sessionStats.sessionCount} {sessionStats.sessionCount === 1 ? "session" : "sessions"}
              </span>
            </div>
          )}

          {/* ── Success criteria (always visible) ───────────── */}
          <Textarea
            value={successCriteria}
            onChange={(e) => setSuccessCriteria(e.target.value)}
            onBlur={handleSaveCriteria}
            placeholder="This is done when..."
            className="min-h-[70px] text-sm resize-none"
          />

          {/* Notes (optional) */}
          {notesOpen || notes ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add context, links, or details..."
              className="min-h-[70px] text-sm resize-none"
            />
          ) : (
            <button
              onClick={() => setNotesOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-dashed border-border hover:border-foreground/30"
            >
              <Plus className="w-3 h-3" />
              Add notes
            </button>
          )}

          {/* Activity log */}
          <TaskLogList taskId={task.id} />

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {!isDone && !isDiscarded && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirmDiscard(true)}
                className="text-xs gap-1 text-muted-foreground"
              >
                <X className="w-3 h-3" />
                Discard
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowConfirmDelete(true)}
                className="text-xs gap-1 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </Button>
            )}
          </div>
        </div>
        <AlertDialog open={showConfirmDiscard} onOpenChange={setShowConfirmDiscard}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard this task?</AlertDialogTitle>
              <AlertDialogDescription>You can still see it later in discarded tasks.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { onDiscard?.(task.id); onOpenChange(false); }}>Discard</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {task.recurrence_rule
                  ? "Delete this recurring task?"
                  : "Delete this task permanently?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {task.recurrence_rule
                  ? "This will permanently delete this recurring task and its completion history. This action cannot be undone."
                  : "This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete?.(task.id);
                  onOpenChange(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// ── Global keyboard shortcut hook ────────────────────────────────────

export function useQuickAddShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}
