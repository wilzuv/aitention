import { useState, useCallback } from "react";
import { startOfWeek } from "date-fns";

export function useWeekNavigation() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const goToWeek = useCallback((date: Date) => {
    setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
  }, []);

  return { weekStart, goToWeek };
}
