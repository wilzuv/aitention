// src/pages/Today.tsx — Orchestrator for the redesigned Today page
//
// This component owns all hooks and state, then passes data + callbacks
// down to the presentation components in a two-column, task-centric layout.

import { useState, useCallback, useMemo, useEffect } from "react";
import { format, isToday } from "date-fns";
import { BarChart3 } from "lucide-react";

// ── Hooks ────────────────────────────────────────────────────────────
import { useQuickAdd } from "@/contexts/QuickAddContext";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useTasks } from "@/hooks/useTasks";
import { useMoodLogs } from "@/hooks/useMoodLogs";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { useOuraData } from "@/hooks/useOuraData";
import { useTodayAgenda } from "@/hooks/useTodayAgenda";

// ── UI primitives ────────────────────────────────────────────────────
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ── Today-page components ────────────────────────────────────────────
import { TodayTaskList } from "@/components/today/TodayTaskList";
import { TodayAgenda } from "@/components/today/TodayAgenda";
import { StatsPanel } from "@/components/today/StatsPanel";
import { TaskDetailModal } from "@/components/today/TaskDetailModal";
import { FocusSessionModal } from "@/components/today/FocusSessionModal";
import { MoodCheckInDialog } from "@/components/journal/MoodCheckInDialog";
import { QuickNoteDialog } from "@/components/journal/QuickNoteDialog";

// =====================================================================
// Today Page
// =====================================================================

const Today = () => {
  // ── Date state ──────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // ── Modal / overlay state ──────────────────────────────────────────
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);

  // Task detail modal (edit or create)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // Tasks that were pre-selected when opening the focus setup modal
  const [focusModalPreselectedTaskIds, setFocusModalPreselectedTaskIds] = useState<string[]>([]);

  // ── Hooks ───────────────────────────────────────────────────────────

  const {
    tasks,
    isLoading: tasksLoading,
    recurringCompletionCount,
    updateTask,
    completeTask,
    rescheduleTask,
    discardTask,
    deleteTask,
  } = useTasks({
    date: selectedDate,
    includeOverdue: true,
    onOpenTask: (id) => setDetailTaskId(id),
  });

  const {
    moodLogs,
    logMood,
  } = useMoodLogs(dateStr);

  const {
    journalEntries,
    addFreeEntry,
  } = useJournalEntries(dateStr);

  const {
    sessions,
    createSession,
  } = useFocusSessions(dateStr);

  const { data: ouraData } = useOuraData(selectedDate);

  // Non-task primitives (goals, decisions, predictions, experiments) that are
  // overdue, due on the selected day, or upcoming within the next 3 days.
  const { items: agendaItems, isLoading: agendaLoading } = useTodayAgenda(dateStr);

  // ── Focus session (global state — survives route changes) ──────────

  const {
    isRunning,
    isPaused,
    unclosedSession,
    startSession,
    setLinkedTaskIds,
    openRecoveryModal,
    openReflectionForManualLog,
    onAfterRecovery,
  } = useFocusSession();

  // ── Derived values ──────────────────────────────────────────────────

  const detailTask = tasks.find((t) => t.id === detailTaskId) ?? null;

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "done"),
    [tasks],
  );

  const totalFocusMinutes = useMemo(
    () =>
      (sessions ?? []).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0),
    [sessions],
  );

  // ── Handler: toggle task completion ─────────────────────────────────

  const handleToggleTask = useCallback(
    (taskId: string, done: boolean) => {
      if (done) {
        completeTask.mutate(taskId);
      } else {
        updateTask.mutate({
          id: taskId,
          updates: { status: "open", completed_at: null },
        });
      }
    },
    [completeTask, updateTask],
  );

  // ── Handler: open focus modal (checks for unclosed sessions first) ──
  //
  // Focus session state (timer, overlay, reflection modal) lives in
  // FocusSessionContext. This page owns the *setup* modal — the UI for
  // picking tasks + timer length before a session starts.

  const openFocusModal = useCallback(
    (preselectedTaskIds?: string[]) => {
      if (unclosedSession) {
        if (preselectedTaskIds) setFocusModalPreselectedTaskIds(preselectedTaskIds);
        openRecoveryModal();
        return;
      }
      if (preselectedTaskIds) setFocusModalPreselectedTaskIds(preselectedTaskIds);
      setFocusModalOpen(true);
    },
    [unclosedSession, openRecoveryModal],
  );

  // After the recovery reflection modal closes, re-open the setup modal
  // so the user can start a fresh session.
  useEffect(() => {
    onAfterRecovery(() => setFocusModalOpen(true));
    return () => onAfterRecovery(null);
  }, [onAfterRecovery]);

  // ── Handler: start focus from task list ─────────────────────────────

  const handleStartFocus = useCallback(
    (taskIds: string[]) => {
      openFocusModal(taskIds);
    },
    [openFocusModal],
  );

  // Stable identity so memoized task rows don't re-render on every parent render.
  const handleOpenTaskDetail = useCallback((taskId: string) => setDetailTaskId(taskId), []);

  // ── Quick-add mood / note modals ─────────────────────────────────────

  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);

  const { registerActions } = useQuickAdd();

  const handleOpenMoodModal = useCallback(() => setMoodModalOpen(true), []);
  const handleOpenNoteModal = useCallback(() => setNoteModalOpen(true), []);
  const handleStartFocusFromQuickAdd = useCallback(() => openFocusModal(), [openFocusModal]);

  useEffect(() => {
    return registerActions({
      onLogMood: handleOpenMoodModal,
      onAddNote: handleOpenNoteModal,
      onStartFocus: handleStartFocusFromQuickAdd,
    });
  }, [registerActions, handleOpenMoodModal, handleOpenNoteModal, handleStartFocusFromQuickAdd]);

  // ── Loading skeleton ────────────────────────────────────────────────

  if (tasksLoading) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-3 sm:px-6 sm:py-4 lg:py-6">
        <div className="mb-5 sm:mb-8">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="min-w-0 space-y-4 lg:w-[58%]">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="hidden min-w-0 flex-1 lg:block">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-3 py-3 sm:px-6 sm:py-4 lg:py-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-8 sm:items-center">
        {/* Left: date title + date picker */}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {format(selectedDate, "EEEE, MMMM d")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(selectedDate, "yyyy")}
            {!isToday(selectedDate) && (
              <button
                onClick={() => setSelectedDate(new Date())}
                className="ml-2 text-primary hover:underline"
              >
                Back to today
              </button>
            )}
          </p>
        </div>

        {/* Right: action pills. Stats/timeline collapse into a single pill that
            opens a modal; the focus action lives in the sidebar quick-add. */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded-full px-2.5 text-xs"
            onClick={() => setStatsModalOpen(true)}
          >
            <BarChart3 className="h-3 w-3" />
            Stats
          </Button>
        </div>
      </div>

      {/* ── Two-column layout: tasks + everything-else agenda ──────── */}
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Left column — tasks. Narrowed ~15% from its previous footprint to
            make room for the agenda column. */}
        <div className="min-w-0 flex flex-col gap-4 lg:w-[58%] lg:max-h-[calc(100vh-10rem)] lg:pr-2">
          <TodayTaskList
            className="flex-1 min-h-0"
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onOpenTaskDetail={handleOpenTaskDetail}
            onStartFocus={handleStartFocus}
          />
        </div>

        {/* Right column — other primitives, grouped by overdue / today / upcoming */}
        <div className="min-w-0 flex-1 lg:max-h-[calc(100vh-10rem)]">
          <TodayAgenda
            className="lg:max-h-[calc(100vh-10rem)]"
            items={agendaItems}
            isLoading={agendaLoading}
          />
        </div>
      </div>

      {/* ── Modals & Overlays ──────────────────────────────────────── */}

      {/* Stats + timeline — collapsed out of the layout into a modal */}
      <Dialog open={statsModalOpen} onOpenChange={setStatsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Today's stats</DialogTitle>
          </DialogHeader>
          <StatsPanel
            sleepHours={
              ouraData?.sleep_hours != null ? String(ouraData.sleep_hours) : null
            }
            sleepScore={ouraData?.sleep_score ?? null}
            readinessScore={ouraData?.readiness_score ?? null}
            totalFocusMinutes={totalFocusMinutes}
            sessionCount={(sessions ?? []).filter((s) => s.ended_at != null).length}
            tasksDone={completedTasks.length + recurringCompletionCount}
            moodLogs={moodLogs ?? []}
            journalEntries={journalEntries ?? []}
            sessions={sessions ?? []}
            completedTasks={completedTasks}
            showCalendar={showCalendar}
            onToggleCalendar={() => setShowCalendar((v) => !v)}
          />
        </DialogContent>
      </Dialog>

      {/* Focus Session Modal — setup flow for starting/logging sessions.
          The running overlay and reflection modal live in
          FocusSessionContext so they persist across route changes. */}
      <FocusSessionModal
        open={focusModalOpen}
        onOpenChange={(open) => {
          setFocusModalOpen(open);
          if (!open) setFocusModalPreselectedTaskIds([]);
        }}
        tasks={tasks}
        dateStr={dateStr}
        isPastDate={!isToday(selectedDate)}
        initialSelectedTaskIds={focusModalPreselectedTaskIds}
        onStart={startSession}
        onLogManualSession={async (session) => {
          try {
            const created = await createSession.mutateAsync({
              taskIds: session.taskIds,
              startedAt: session.startedAt,
              entryDate: session.entryDate ?? dateStr,
              skipActiveCheck: true,
            });
            // Open the reflection modal so the user can add a note / rating
            // just like a normal post-session. Reflection save completes the
            // session; skip closes it with duration only.
            const primaryTaskId = session.taskIds[0];
            const linkedTasks = session.taskIds
              .map((id) => tasks.find((t) => t.id === id))
              .filter((t): t is NonNullable<typeof t> => !!t)
              .map((t) => ({ id: t.id, title: t.title, status: t.status }));
            const primaryTask = primaryTaskId
              ? tasks.find((t) => t.id === primaryTaskId)
              : undefined;
            openReflectionForManualLog({
              sessionId: created.id,
              taskName: primaryTask?.title ?? "Manual session",
              taskSourceId: primaryTaskId,
              durationSeconds: session.durationMinutes * 60,
              startedAt: session.startedAt,
              entryDate: session.entryDate ?? dateStr,
              linkedTasks,
            });
          } catch (err) {
            console.error("Failed to log past session:", err);
            toast({ title: "Failed to log session", description: "Please try again.", variant: "destructive" });
          }
        }}
        onFocusStarted={(taskIds) => setLinkedTaskIds(taskIds)}
      />

      {/* Task Detail Modal — edit mode (opened from task list) */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          open={!!detailTaskId}
          onOpenChange={(open) => {
            if (!open) setDetailTaskId(null);
          }}
          onUpdate={(id, updates) => updateTask.mutate({ id, updates })}
          onComplete={(id) => completeTask.mutate(id)}
          onReschedule={(id, toDate) => rescheduleTask.mutate({ id, toDate })}
          onDiscard={(id) => discardTask.mutate(id)}
          onDelete={(id) => deleteTask.mutate(id)}
          onOpenTask={(id) => setDetailTaskId(id)}
          mode="edit"
        />
      )}

      {/* Task Detail Modal — create mode (opened from FAB) */}
      <TaskDetailModal
        task={null}
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onOpenTask={(id) => {
          setCreateTaskOpen(false);
          setDetailTaskId(id);
        }}
        mode="create"
        defaultDate={dateStr}
      />

      {/* Quick mood check-in dialog */}
      <MoodCheckInDialog
        open={moodModalOpen}
        onOpenChange={setMoodModalOpen}
        onSave={(mood, energy, note) => {
          logMood.mutate({
            mood_rating: mood,
            energy_rating: energy,
            note,
            context: "manual",
          });
        }}
      />

      {/* Quick note dialog */}
      <QuickNoteDialog
        open={noteModalOpen}
        onOpenChange={setNoteModalOpen}
        onSave={(content) => {
          addFreeEntry.mutate({ content });
        }}
      />

    </div>
  );
};

export default Today;
