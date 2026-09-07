import { useState, useRef, useCallback, useEffect } from "react";

interface CompletedSession {
  task_name: string;
  task_source: string;
  task_source_id?: string;
  success_criteria?: string;
  duration_seconds: number;
  started_at: string;
}

interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  taskName: string;
  taskSource: string;
  taskSourceId?: string;
  successCriteria?: string;
  targetSeconds?: number;
  startedAt: Date | null;
  pausedAt: Date | null;
  totalPausedMs: number;
  elapsedSeconds: number;
}

interface UseFocusTimerOptions {
  onSessionComplete: (session: CompletedSession) => void;
}

export function useFocusTimer({ onSessionComplete }: UseFocusTimerOptions) {
  const [state, setState] = useState<TimerState>({
    isRunning: false,
    isPaused: false,
    taskName: "",
    taskSource: "manual",
    elapsedSeconds: 0,
    startedAt: null,
    pausedAt: null,
    totalPausedMs: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recalculate elapsed from wall-clock (shared by interval tick and visibility handler)
  const recalcElapsed = useCallback(() => {
    setState((prev) => {
      if (!prev.isRunning || !prev.startedAt) return prev;
      // When paused, don't count time since pausedAt
      const currentPauseGap = prev.isPaused && prev.pausedAt
        ? Date.now() - prev.pausedAt.getTime()
        : 0;
      return {
        ...prev,
        elapsedSeconds: Math.floor(
          (Date.now() - prev.startedAt.getTime() - prev.totalPausedMs - currentPauseGap) / 1000
        ),
      };
    });
  }, []);

  // Tick the timer every second (only when running and not paused)
  useEffect(() => {
    if (state.isRunning && !state.isPaused && state.startedAt) {
      intervalRef.current = setInterval(recalcElapsed, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning, state.isPaused, state.startedAt, recalcElapsed]);

  // Fix: recalculate when tab regains focus (setInterval is throttled in background tabs)
  useEffect(() => {
    if (!state.isRunning) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        recalcElapsed();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state.isRunning, recalcElapsed]);

  const warn10FiredRef = useRef(false);
  const warn3FiredRef = useRef(false);
  const endFiredRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = useCallback((chimeCount: number) => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      for (let i = 0; i < chimeCount; i++) {
        const startTime = ctx.currentTime + i * 0.35;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, startTime);
        osc.frequency.exponentialRampToValueAtTime(440, startTime + 0.25);
        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
        osc.start(startTime);
        osc.stop(startTime + 0.3);
      }
    } catch {
      // Audio not available — silently skip
    }
  }, []);

  const start = useCallback(
    (taskName: string, taskSource = "manual", taskSourceId?: string, successCriteria?: string, targetSeconds?: number) => {
      warn10FiredRef.current = false;
      warn3FiredRef.current = false;
      endFiredRef.current = false;
      setState({
        isRunning: true,
        isPaused: false,
        taskName,
        taskSource,
        taskSourceId,
        successCriteria,
        targetSeconds,
        startedAt: new Date(),
        pausedAt: null,
        totalPausedMs: 0,
        elapsedSeconds: 0,
      });
    },
    []
  );

  const pause = useCallback(() => {
    if (!state.isRunning || state.isPaused) return;
    setState((prev) => ({
      ...prev,
      isPaused: true,
      pausedAt: new Date(),
    }));
  }, [state.isRunning, state.isPaused]);

  const resume = useCallback(() => {
    if (!state.isRunning || !state.isPaused || !state.pausedAt) return;
    setState((prev) => ({
      ...prev,
      isPaused: false,
      totalPausedMs: prev.totalPausedMs + (Date.now() - prev.pausedAt!.getTime()),
      pausedAt: null,
    }));
  }, [state.isRunning, state.isPaused, state.pausedAt]);

  // stop pauses the timer and fires the callback but keeps state intact
  // so the user can "go back to session" if they clicked Finish too early.
  const stop = useCallback(() => {
    if (!state.isRunning || !state.startedAt) return;

    // Account for any current pause
    const finalPausedMs = state.isPaused && state.pausedAt
      ? state.totalPausedMs + (Date.now() - state.pausedAt.getTime())
      : state.totalPausedMs;

    const durationSeconds = Math.floor(
      (Date.now() - state.startedAt.getTime() - finalPausedMs) / 1000
    );

    onSessionComplete({
      task_name: state.taskName,
      task_source: state.taskSource,
      task_source_id: state.taskSourceId,
      success_criteria: state.successCriteria,
      duration_seconds: durationSeconds,
      started_at: state.startedAt.toISOString(),
    });

    // Mark as finished-but-resumable: not running, but startedAt preserved
    setState((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      // Keep startedAt, taskName, etc. so we can resume
    }));
  }, [state, onSessionComplete]);

  // Fully clear timer state — call after the reflection modal is saved/skipped
  const clear = useCallback(() => {
    setState({
      isRunning: false,
      isPaused: false,
      taskName: "",
      taskSource: "manual",
      elapsedSeconds: 0,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
  }, []);

  // Resume the timer after Finish was clicked (user wants to go back)
  const resumeFromFinish = useCallback(() => {
    if (!state.startedAt) return;
    setState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      // Treat the time spent in the modal as paused time
      totalPausedMs: prev.totalPausedMs + (prev.pausedAt ? Date.now() - prev.pausedAt.getTime() : 0),
      pausedAt: null,
    }));
  }, [state.startedAt]);

  const discard = useCallback(() => {
    setState({
      isRunning: false,
      isPaused: false,
      taskName: "",
      taskSource: "manual",
      elapsedSeconds: 0,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
  }, []);

  // Play warning chimes at 10 min remaining (1 chime), 3 min remaining (2
  // chimes), and end (3 chimes). Each fires at most once per session.
  useEffect(() => {
    if (!state.isRunning || state.targetSeconds == null) return;
    const remaining = state.targetSeconds - state.elapsedSeconds;

    // 10-min warning — only if the target is longer than 10 min
    if (
      !warn10FiredRef.current &&
      state.targetSeconds > 600 &&
      remaining <= 600 &&
      remaining > 180
    ) {
      warn10FiredRef.current = true;
      playChime(1);
    }

    // 3-min warning — only if the target is longer than 3 min
    if (
      !warn3FiredRef.current &&
      state.targetSeconds > 180 &&
      remaining <= 180 &&
      remaining > 0
    ) {
      warn3FiredRef.current = true;
      playChime(2);
    }

    // End chime — fires when the target is reached
    if (!endFiredRef.current && remaining <= 0) {
      endFiredRef.current = true;
      playChime(3);
    }
  }, [state.isRunning, state.targetSeconds, state.elapsedSeconds, playChime]);

  // Clean up the shared AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
    };
  }, []);

  // Can we resume from a finished state? (startedAt exists but not running)
  const canResumeFromFinish = !state.isRunning && state.startedAt != null;

  const targetSeconds = state.targetSeconds;
  const remainingSeconds = targetSeconds != null ? targetSeconds - state.elapsedSeconds : null;

  return {
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    taskName: state.taskName,
    elapsedSeconds: state.elapsedSeconds,
    targetSeconds,
    remainingSeconds,
    canResumeFromFinish,
    startedAt: state.startedAt?.toISOString() ?? null,
    start,
    stop,
    pause,
    resume,
    resumeFromFinish,
    clear,
    discard,
  };
}
