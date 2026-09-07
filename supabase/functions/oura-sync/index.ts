import { corsHeaders as configuredCorsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OURA_BASE = 'https://api.ouraring.com/v2/usercollection';

function getCorsHeaders(req: Request) {
  return configuredCorsHeaders(req, Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8080");
}

async function ouraFetch(endpoint: string, token: string) {
  const res = await fetch(`${OURA_BASE}/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`Oura API error: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
}

async function refreshToken(refreshToken: string) {
  const res = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: Deno.env.get('OURA_CLIENT_ID')!,
      client_secret: Deno.env.get('OURA_CLIENT_SECRET')!,
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed — user must reconnect Oura');
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Date to sync — defaults to today in UTC
    const url = new URL(req.url);
    const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0];

    // Load the user's Oura integration (RLS ensures it's theirs)
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('access_token, refresh_token, token_expires_at')
      .eq('provider', 'oura')
      .maybeSingle();

    if (intError || !integration) return json({ error: 'Oura not connected' }, 404);

    let { access_token, refresh_token } = integration;

    // Refresh expired token if we have a refresh token
    if (
      integration.token_expires_at &&
      new Date(integration.token_expires_at) <= new Date()
    ) {
      if (!refresh_token) return json({ error: 'Oura token expired — please reconnect' }, 401);
      const newTokens = await refreshToken(refresh_token);
      access_token = newTokens.access_token;
      refresh_token = newTokens.refresh_token ?? refresh_token;
      await supabase.from('user_integrations').update({
        access_token,
        refresh_token,
        token_expires_at: newTokens.expires_in
          ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
          : null,
      }).eq('provider', 'oura');
    }

    // Fetch all three endpoints in parallel — a missing score is not fatal
    const params = `start_date=${date}&end_date=${date}`;
    const [readinessRes, sleepRes, activityRes] = await Promise.allSettled([
      ouraFetch(`daily_readiness?${params}`, access_token),
      ouraFetch(`daily_sleep?${params}`, access_token),
      ouraFetch(`daily_activity?${params}`, access_token),
    ]);

    const readiness = readinessRes.status === 'fulfilled' ? (readinessRes.value?.data?.[0] ?? null) : null;
    const sleep = sleepRes.status === 'fulfilled' ? (sleepRes.value?.data?.[0] ?? null) : null;
    const activity = activityRes.status === 'fulfilled' ? (activityRes.value?.data?.[0] ?? null) : null;

    const record = {
      user_id: user.id,
      date,
      readiness_score: readiness?.score ?? null,
      sleep_score: sleep?.score ?? null,
      sleep_hours: sleep?.total_sleep_duration != null
        ? Number((sleep.total_sleep_duration / 3600).toFixed(2))
        : null,
      steps: activity?.steps ?? null,
      raw: { readiness, sleep, activity },
      synced_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('oura_daily_records')
      .upsert(record, { onConflict: 'date,user_id' });

    if (upsertError) throw upsertError;

    return json(record);
  } catch (err) {
    console.error('oura-sync error:', err);
    return json({ error: String(err) }, 500);
  }
});
