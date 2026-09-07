import { createContext, useCallback, useContext, useRef } from "react";

interface QuickAddActions {
  onAddTask: () => void;
  onLogMood: (() => void) | null;
  onAddNote: (() => void) | null;
  onStartFocus: (() => void) | null;
}

type RegisterableActions = Pick<QuickAddActions, "onLogMood" | "onAddNote" | "onStartFocus">;

interface QuickAddContextValue {
  actions: React.RefObject<QuickAddActions>;
  registerActions: (a: Partial<RegisterableActions>) => () => void;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function QuickAddProvider({
  onAddTask,
  children,
}: {
  onAddTask: () => void;
  children: React.ReactNode;
}) {
  const actions = useRef<QuickAddActions>({
    onAddTask,
    onLogMood: null,
    onAddNote: null,
    onStartFocus: null,
  });

  // Keep onAddTask in sync
  actions.current.onAddTask = onAddTask;

  const registerActions = useCallback(
    (a: Partial<RegisterableActions>) => {
      if (a.onLogMood) actions.current.onLogMood = a.onLogMood;
      if (a.onAddNote) actions.current.onAddNote = a.onAddNote;
      if (a.onStartFocus) actions.current.onStartFocus = a.onStartFocus;
      return () => {
        if (a.onLogMood) actions.current.onLogMood = null;
        if (a.onAddNote) actions.current.onAddNote = null;
        if (a.onStartFocus) actions.current.onStartFocus = null;
      };
    },
    [],
  );

  return (
    <QuickAddContext.Provider value={{ actions, registerActions }}>
      {children}
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}
