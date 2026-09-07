import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Called from the app's /auth/oura/callback page after Oura redirects back.
// Accepts POST { code, state } — state contains the user's Supabase access token
// (base64-encoded) so we can identify them without relying on cookies/session.
Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8080");
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: cors,
    });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const { code, state, redirect_uri } = await req.json();

    if (!code || !state) return json({ error: 'missing_params' }, 400);

    // Decode state to get the user's Supabase access token, then verify it
    const userAccessToken = atob(state);
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await adminClient.auth.getUser(userAccessToken);
    if (authError || !user) return json({ error: 'invalid_session' }, 401);

    // Exchange auth code for Oura tokens
    const clientId = Deno.env.get('OURA_CLIENT_ID')!;
    const clientSecret = Deno.env.get('OURA_CLIENT_SECRET')!;

    // The redirect_uri here must exactly match what was sent in the authorization request.
    // It comes from the frontend so we trust the state token to identify the user instead.
    if (!redirect_uri) return json({ error: 'missing_redirect_uri' }, 400);

    const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
      }),
    });

    if (!tokenRes.ok) {
      console.error('Oura token exchange failed:', await tokenRes.text());
      return json({ error: 'token_exchange_failed' }, 502);
    }

    const tokens = await tokenRes.json();

    const { error: upsertError } = await adminClient
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        provider: 'oura',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (upsertError) {
      console.error('Failed to store Oura tokens:', upsertError);
      return json({ error: 'storage_failed' }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error('oura-oauth-callback error:', err);
    return json({ error: String(err) }, 500);
  }
});
