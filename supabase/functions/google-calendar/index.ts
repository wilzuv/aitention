import { corsHeaders as configuredCorsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface GoogleCalendarRequestBody {
  provider_token?: string;
  time_min?: string;
  time_max?: string;
}

interface GoogleCalendarListItem {
  id?: string;
  summary?: string;
  backgroundColor?: string;
  primary?: boolean;
}

interface GoogleCalendarEventDate {
  dateTime?: string;
  date?: string;
}

interface GoogleCalendarEventItem {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleCalendarEventDate;
  end?: GoogleCalendarEventDate;
  htmlLink?: string;
  colorId?: string;
  status?: string;
  organizer?: { email?: string };
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarListItem[];
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEventItem[];
}

function getCorsHeaders(req: Request) {
  return configuredCorsHeaders(req, Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8080");
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract the user's Google provider token from the request
    const { provider_token, time_min, time_max } = await req.json() as GoogleCalendarRequestBody;

    if (!provider_token) {
      throw new Error('Google provider token is required. Please sign out and sign in again.');
    }

    // Fetch events from Google Calendar API
    const params = new URLSearchParams({
      timeMin: time_min || new Date().toISOString(),
      timeMax: time_max || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });

    // Fetch primary calendar events
    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${provider_token}` },
      }
    );

    if (!eventsRes.ok) {
      const body = await eventsRes.text();
      throw new Error(`Google Calendar API error [${eventsRes.status}]: ${body}`);
    }

    const eventsData = await eventsRes.json() as GoogleCalendarEventsResponse;

    // Also fetch calendar list for filtering
    const calendarsRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
      {
        headers: { Authorization: `Bearer ${provider_token}` },
      }
    );

    let calendars: Array<{ id: string; summary: string; backgroundColor: string | undefined; primary: boolean }> = [];
    if (calendarsRes.ok) {
      const calendarsData = await calendarsRes.json() as GoogleCalendarListResponse;
      calendars = (calendarsData.items || []).map((c) => ({
        id: c.id ?? "",
        summary: c.summary ?? "",
        backgroundColor: c.backgroundColor,
        primary: c.primary || false,
      }));
    }

    // Simplify event data
    const events = (eventsData.items || []).map((e) => ({
      id: e.id ?? "",
      summary: e.summary || '(No title)',
      description: e.description || null,
      location: e.location || null,
      start: e.start?.dateTime || e.start?.date || null,
      end: e.end?.dateTime || e.end?.date || null,
      allDay: !e.start?.dateTime,
      htmlLink: e.htmlLink,
      colorId: e.colorId || null,
      status: e.status,
      organizer: e.organizer?.email || null,
    }));

    return new Response(JSON.stringify({ events, calendars }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching Google Calendar:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
