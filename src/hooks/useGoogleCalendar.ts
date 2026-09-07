import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStoredProviderToken } from "@/hooks/useAuth";
import { startOfWeek, endOfWeek } from "date-fns";

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
  htmlLink: string;
  colorId: string | null;
  status: string;
  organizer: string | null;
}

export interface CalendarInfo {
  id: string;
  summary: string;
  backgroundColor: string;
  primary: boolean;
}

async function fetchCalendarEvents(weekStart: Date): Promise<{ events: CalendarEvent[]; calendars: CalendarInfo[] }> {
  // Try session first, fall back to stored token
  const session = await supabase.auth.getSession();
  const providerToken = session.data.session?.provider_token || getStoredProviderToken();

  if (!providerToken) {
    throw new Error("No Google provider token. Please sign out and sign in again.");
  }

  const timeMin = startOfWeek(weekStart, { weekStartsOn: 1 }).toISOString();
  const timeMax = endOfWeek(weekStart, { weekStartsOn: 1 }).toISOString();

  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: { provider_token: providerToken, time_min: timeMin, time_max: timeMax },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return { events: data.events || [], calendars: data.calendars || [] };
}

export function useGoogleCalendar(weekStart: Date) {
  return useQuery({
    queryKey: ["google-calendar", weekStart.toISOString()],
    enabled: import.meta.env.VITE_ENABLE_GOOGLE_CALENDAR === "true",
    queryFn: () => fetchCalendarEvents(weekStart),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
