// src/contexts/FocusSessionContext.tsx — Global focus session state
//
// Hoists the focus timer above the router so the running overlay and
// reflection modal survive route changes. The provider owns the timer
// hook, all related session bookkeeping state, and renders the overlay
// + post-session reflection modal itself.
//
// The session *setup* modal (FocusSessionModal) still lives on the Today
// page because that's the only place sessions get started from.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { format } from "date-fns";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { useTasks } from "@/hooks/useTasks";
import { toast } from "@/hooks/use-toast";
import { FocusOverlay } from "@/components/today/FocusOverlay";
import { SessionModal } from "@/components/today/SessionModal";
import { RecoveryTaskPickerModal } from "@/components/today/RecoveryTaskPickerModal";

interface LinkedTask {
  id: string;
  title: string;
  status: string;
}

interface CompletedSessionData {
  taskName: string;
  successCriteria?: string;
  taskSourceId?: string;
  durationSeconds: number;
  sessionId: string;
  reason: "post-session" | "recover" | "manual-log";
  entryDate?: string;
  startedAt?: string;
  linkedTasks?: LinkedTask[];
}

interface ManualLogInput {
  sessionId: string;
  taskName: string;
  taskSourceId?: string;
  durationSeconds: number;
  startedAt?: string;
  entryDate?: string;
  linkedTasks?: LinkedTask[];
  preSessionNotes?: string;
}

interface FocusSessionContextValue {
  // Timer state
  isRunning: boolean;
  isPaused: boolean;
  hasActiveSession: boolean;

  // Unclosed session (from a previous app load that wasn't finished)
  unclosedSession: ReturnType<typeof useFocusSessions>["unclosedSession"];

  // Actions
  startSession: (
    name: string,
    source: string,
    sourceId?: string,
    criteria?: string,
    targetSeconds?: number,
  ) => Promise<void>;
  setLinkedTaskIds: (ids: string[]) => void;
  openRecoveryModal: () => void;
  openReflectionForManualLog: (input: ManualLogInput) => void;

  // Callback for after reflection saves on a recovered session
  onAfterRecovery: (fn: (() => void) | null) => void;
}

const FocusSessionContext = createContext<FocusSessionContextValue | null>(null);

export function FocusSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Computed live — stable string within a single day, refreshes on next
  // render after midnight. The timer drives re-renders every second while
  // a session is active, so writes around midnight land on the correct date.
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");

  const { tasks, logTime, completeTask } = useTasks({
    date: today,
    includeOverdue: true,
  });
  const {
    createSession,
    completeSession,
    deleteSession,
    unclosedSession,
  } = useFocusSessions(dateStr);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [focusLinkedTaskIds, setFocusLinkedTaskIdsState] = useState<string[]>([]);
  const [completedDuringSession, setCompletedDuringSession] = useState<
    Set<string>
  >(new Set());
  const [completedSessionData, setCompletedSessionData] =
    useState<CompletedSessionData | null>(null);
  const [recoveryPickerOpen, setRecoveryPickerOpen] = useState(false);

  // Optional callback: invoked after the user saves/skips the reflection
  // modal for a recovered session. The Today page uses this to re-open
  // the FocusSessionModal setup flow.
  const [afterRecoveryFn, setAfterRecoveryFn] = useState<(() => void) | null>(
    null,
  );
  const onAfterRecovery = useCallback((fn: (() => void) | null) => {
    setAfterRecoveryFn(() => fn);
  }, []);

  const onSessionComplete = useCallback(
    (session: {
      task_name: string;
      task_source_id?: string;
      success_criteria?: string;
      duration_seconds: number;
    }) => {
      if (!activeSessionId) {
        console.error(
          "No active session ID — session was not saved to DB at start time",
        );
        toast({
          title: "Session not saved",
          description: "Something went wrong. The session was not recorded.",
          variant: "destructive",
        });
        return;
      }
      setCompletedSessionData({
        taskName: session.task_name,
        successCriteria: session.success_criteria,
        taskSourceId: session.task_source_id,
        durationSeconds: session.duration_seconds,
        sessionId: activeSessionId,
        reason: "post-session",
      });
    },
    [activeSessionId],
  );

  const {
    isRunning,
    isPaused,
    taskName,
    elapsedSeconds,
    remainingSeconds,
    targetSeconds,
    startedAt,
    start,
    stop,
    pause,
    resume,
    resumeFromFinish,
    clear,
    discard,
  } = useFocusTimer({ onSessionComplete });

  const linkedTasks = useMemo(
    () => tasks.filter((t) => focusLinkedTaskIds.includes(t.id)),
    [tasks, focusLinkedTaskIds],
  );

  const setLinkedTaskIds = useCallback((ids: string[]) => {
    setFocusLinkedTaskIdsState(ids);
    setCompletedDuringSession(new Set());
  }, []);

  const startSession = useCallback(
    async (
      name: string,
      source: string,
      sourceId?: string,
      criteria?: string,
      targetSecs?: number,
    ) => {
      try {
        const result = await createSession.mutateAsync({
          taskIds: sourceId ? [sourceId] : [],
          preSessionNotes: criteria,
          entryDate: dateStr,
          startedAt: new Date().toISOString(),
        });
        setActiveSessionId(result.id);
        start(name, source, sourceId, criteria, targetSecs);
      } catch (err) {
        console.error("Failed to start focus session:", err);
        toast({
          title: "Failed to start session",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
        throw err;
      }
    },
    [start, createSession, dateStr],
  );

  const handleCompleteTaskDuringSession = useCallback(
    (taskId: string) => {
      // Route through completeTask so recurring tasks are rescheduled
      // (via recurrence_completions) and One Thing status stays in sync.
      completeTask.mutate(taskId);
      setCompletedDuringSession((prev) => new Set(prev).add(taskId));
    },
    [completeTask],
  );

  const handleDiscard = useCallback(() => {
    if (activeSessionId) deleteSession.mutate(activeSessionId);
    setActiveSessionId(null);
    setFocusLinkedTaskIdsState([]);
    setCompletedDuringSession(new Set());
    discard();
  }, [activeSessionId, deleteSession, discard]);

  // Open the recovery reflection flow for an unclosed session. If the
  // session has no primary task, show the picker first so time can still
  // be credited somewhere (or the user can skip).
  const openRecoveryModal = useCallback(() => {
    if (!unclosedSession) return;
    const primaryTask = unclosedSession.session_tasks?.find(
      (st) => st.is_primary,
    );
    if (!primaryTask) {
      setRecoveryPickerOpen(true);
      return;
    }
    const durationSec =
      unclosedSession.duration_minutes != null
        ? unclosedSession.duration_minutes * 60
        : Math.floor(
            (Date.now() - new Date(unclosedSession.started_at).getTime()) /
              1000,
          );
    setCompletedSessionData({
      taskName: primaryTask.task?.title ?? "Untitled session",
      successCriteria: unclosedSession.pre_session_notes ?? undefined,
      taskSourceId: primaryTask.task?.id,
      durationSeconds: durationSec,
      sessionId: unclosedSession.id,
      reason: "recover",
      entryDate: unclosedSession.entry_date,
      startedAt: unclosedSession.started_at ?? undefined,
    });
  }, [unclosedSession]);

  // Called after the user picks a task (or skips) in the recovery picker.
  // Opens the reflection modal with taskSourceId either set or undefined.
  const handleRecoveryPick = useCallback(
    (taskId: string | null) => {
      if (!unclosedSession) {
        setRecoveryPickerOpen(false);
        return;
      }
      const durationSec =
        unclosedSession.duration_minutes != null
          ? unclosedSession.duration_minutes * 60
          : Math.floor(
              (Date.now() - new Date(unclosedSession.started_at).getTime()) /
                1000,
            );
      const pickedTask = taskId ? tasks.find((t) => t.id === taskId) : undefined;
      setRecoveryPickerOpen(false);
      setCompletedSessionData({
        taskName: pickedTask?.title ?? "Untitled session",
        successCriteria: unclosedSession.pre_session_notes ?? undefined,
        taskSourceId: taskId ?? undefined,
        durationSeconds: durationSec,
        sessionId: unclosedSession.id,
        reason: "recover",
        entryDate: unclosedSession.entry_date,
        startedAt: unclosedSession.started_at ?? undefined,
      });
    },
    [unclosedSession, tasks],
  );

  // Exposed to Today's manual-log flow: after the session row is created
  // (but not yet completed), open the reflection modal so the user can
  // add note/rating just like a regular post-session.
  const openReflectionForManualLog = useCallback((input: ManualLogInput) => {
    setCompletedSessionData({
      taskName: input.taskName,
      successCriteria: input.preSessionNotes,
      taskSourceId: input.taskSourceId,
      durationSeconds: input.durationSeconds,
      sessionId: input.sessionId,
      reason: "manual-log",
      entryDate: input.entryDate,
      startedAt: input.startedAt,
      linkedTasks: input.linkedTasks,
    });
  }, []);

  const handleReflectionSave = useCallback(
    async (reflection: {
      note: string;
      enjoyment: number;
      completedTaskIds: string[];
      durationMinutes: number;
    }) => {
      if (!completedSessionData) return;

      try {
        await completeSession.mutateAsync({
          id: completedSessionData.sessionId,
          durationMinutes: reflection.durationMinutes,
          postSessionNotes: reflection.note,
          enjoymentRating: reflection.enjoyment,
          entryDate: completedSessionData.entryDate,
        });
      } catch (err) {
        console.error("Failed to save session reflection:", err);
        toast({
          title: "Couldn't save session",
          description:
            err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
        // Leave completedSessionData set so the user can retry.
        return;
      }

      if (completedSessionData.taskSourceId) {
        logTime.mutate({
          id: completedSessionData.taskSourceId,
          minutes: reflection.durationMinutes,
        });
      }

      // Route each completed task through completeTask so recurring tasks
      // reschedule and One Thing status syncs.
      for (const taskId of reflection.completedTaskIds) {
        completeTask.mutate(taskId);
      }

      const reason = completedSessionData.reason;
      setCompletedSessionData(null);
      setActiveSessionId(null);
      if (reason === "post-session") {
        clear();
        setFocusLinkedTaskIdsState([]);
        setCompletedDuringSession(new Set());
      } else if (reason === "recover" && afterRecoveryFn) {
        afterRecoveryFn();
      }
    },
    [
      completedSessionData,
      completeSession,
      logTime,
      completeTask,
      clear,
      afterRecoveryFn,
    ],
  );

  const handleReflectionSkip = useCallback(async () => {
    if (!completedSessionData) return;
    const durationMinutes = Math.max(
      1,
      Math.ceil(completedSessionData.durationSeconds / 60),
    );

    try {
      await completeSession.mutateAsync({
        id: completedSessionData.sessionId,
        durationMinutes,
        entryDate: completedSessionData.entryDate,
      });
    } catch (err) {
      console.error("Failed to close session:", err);
      toast({
        title: "Couldn't save session",
        description:
          err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (completedSessionData.taskSourceId) {
      logTime.mutate({
        id: completedSessionData.taskSourceId,
        minutes: durationMinutes,
      });
    }
    const reason = completedSessionData.reason;
    setCompletedSessionData(null);
    setActiveSessionId(null);
    if (reason === "post-session") {
      clear();
      setFocusLinkedTaskIdsState([]);
      setCompletedDuringSession(new Set());
    } else if (reason === "recover" && afterRecoveryFn) {
      afterRecoveryFn();
    }
  }, [
    completedSessionData,
    completeSession,
    logTime,
    clear,
    afterRecoveryFn,
  ]);

  const handleBackToSession = useCallback(() => {
    if (!completedSessionData) return;
    setCompletedSessionData(null);
    resumeFromFinish();
  }, [completedSessionData, resumeFromFinish]);

  const hasActiveSession =
    isRunning || isPaused || completedSessionData !== null;

  const value = useMemo<FocusSessionContextValue>(
    () => ({
      isRunning,
      isPaused,
      hasActiveSession,
      unclosedSession,
      startSession,
      setLinkedTaskIds,
      openRecoveryModal,
      openReflectionForManualLog,
      onAfterRecovery,
    }),
    [
      isRunning,
      isPaused,
      hasActiveSession,
      unclosedSession,
      startSession,
      setLinkedTaskIds,
      openRecoveryModal,
      openReflectionForManualLog,
      onAfterRecovery,
    ],
  );

  // Linked tasks for the reflection modal. For manual-log, use the explicit
  // list passed in. For recovery, pull from the unclosed session's DB links.
  // Otherwise use the in-memory tasks the user linked at session start.
  const modalLinkedTasks =
    completedSessionData?.linkedTasks ??
    (completedSessionData?.reason === "recover" &&
    unclosedSession?.session_tasks
      ? unclosedSession.session_tasks
          .filter((st) => st.task)
          .map((st) => ({
            id: st.task!.id,
            title: st.task!.title,
            status: st.task!.status,
          }))
      : linkedTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })));

  // Tasks to show in the recovery picker: linked session tasks (if any)
  // plus today's open tasks as fallback.
  const recoveryPickerSessionTasks =
    unclosedSession?.session_tasks
      ?.filter((st) => st.task)
      .map((st) => ({ id: st.task!.id, title: st.task!.title })) ?? [];
  const recoveryPickerTodayTasks = tasks
    .filter((t) => t.status === "open")
    .map((t) => ({ id: t.id, title: t.title }));

  return (
    <FocusSessionContext.Provider value={value}>
      {children}

      {/* Focus Overlay — shown when timer is running */}
      {(isRunning || isPaused) && (
        <FocusOverlay
          isRunning={isRunning}
          isPaused={isPaused}
          elapsedSeconds={elapsedSeconds}
          remainingSeconds={remainingSeconds}
          targetSeconds={targetSeconds}
          taskName={taskName}
          linkedTasks={linkedTasks}
          preSessionNotes=""
          completedTaskIds={completedDuringSession}
          onPause={pause}
          onResume={resume}
          onFinish={stop}
          onDiscard={handleDiscard}
          onCompleteTaskDuringSession={handleCompleteTaskDuringSession}
        />
      )}

      {/* Recovery Task Picker — shown when an unclosed session has no primary */}
      {recoveryPickerOpen && (
        <RecoveryTaskPickerModal
          sessionTasks={recoveryPickerSessionTasks}
          todayTasks={recoveryPickerTodayTasks}
          durationSeconds={
            unclosedSession?.duration_minutes != null
              ? unclosedSession.duration_minutes * 60
              : unclosedSession?.started_at
                ? Math.floor(
                    (Date.now() -
                      new Date(unclosedSession.started_at).getTime()) /
                      1000,
                  )
                : 0
          }
          onPick={(taskId) => handleRecoveryPick(taskId)}
          onSkip={() => handleRecoveryPick(null)}
        />
      )}

      {/* Session Reflection Modal */}
      {completedSessionData && (
        <SessionModal
          taskName={completedSessionData.taskName}
          linkedTasks={modalLinkedTasks}
          preSessionNotes={completedSessionData.successCriteria}
          durationSeconds={completedSessionData.durationSeconds}
          sessionId={completedSessionData.sessionId}
          startedAt={
            completedSessionData.startedAt ??
            (completedSessionData.reason === "recover"
              ? unclosedSession?.started_at
              : startedAt ?? undefined)
          }
          onSave={handleReflectionSave}
          onSkip={handleReflectionSkip}
          onBackToSession={
            completedSessionData.reason === "post-session"
              ? handleBackToSession
              : undefined
          }
          isLoading={completeSession.isPending}
          mode="post-session"
        />
      )}
    </FocusSessionContext.Provider>
  );
}

export function useFocusSession() {
  const ctx = useContext(FocusSessionContext);
  if (!ctx)
    throw new Error("useFocusSession must be used within FocusSessionProvider");
  return ctx;
}
