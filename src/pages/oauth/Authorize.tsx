// /oauth/authorize — Stytch Connected Apps consent screen.
//
// Where this fits: claude.ai (or any MCP-capable client) discovers our PRM
// doc at /functions/v1/mcp/.well-known/oauth-protected-resource, follows it
// to the Stytch authorization server, and Stytch redirects the user here
// with OAuth params (client_id, redirect_uri, scope, state, code_challenge).
//
// This page does three things:
//   1. Confirm the user is signed into Aitention via Supabase Auth.
//   2. Pass the Supabase JWT to Stytch as a Trusted Auth Token — Stytch's
//      profile (configured in U4) validates it and links it to a Stytch user
//      with `supabase_uid` set from the Supabase `sub` claim.
//   3. Render Stytch's <IdentityProvider /> which handles the consent UI
//      and the post-approval redirect back to claude.ai.
//
// Route is public so the OAuth query params survive any auth round-trip.

import { IdentityProvider } from "@stytch/react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  stytchClient,
  STYTCH_TRUSTED_TOKEN_PROFILE_ID,
} from "@/lib/stytch";

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">{children}</div>
    </div>
  );
}

export default function AuthorizePage() {
  const { session, loading } = useAuth();

  // Stytch not configured for this environment — surface the misconfig
  // rather than rendering a broken consent screen.
  if (!stytchClient || !STYTCH_TRUSTED_TOKEN_PROFILE_ID) {
    return (
      <FullPageMessage>
        <h1 className="font-display text-2xl font-bold text-foreground">
          External access not configured
        </h1>
        <p className="text-sm text-muted-foreground">
          Stytch credentials (VITE_STYTCH_PUBLIC_TOKEN,
          VITE_STYTCH_TRUSTED_TOKEN_PROFILE_ID) aren&apos;t set on this build.
        </p>
      </FullPageMessage>
    );
  }

  if (loading) {
    return (
      <FullPageMessage>
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </FullPageMessage>
    );
  }

  // Not signed in: show sign-in inline so the OAuth query params on the
  // current URL survive the round-trip back from Google. Supabase will
  // bring the user back to window.location.href and the page re-renders
  // with a valid session.
  if (!session) {
    const handleSignIn = async () => {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
    };

    return (
      <FullPageMessage>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Sign in to authorize
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A third-party app is requesting access to your Aitention data.
            Sign in first so you can review and approve.
          </p>
        </div>
        <button
          onClick={handleSignIn}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          Continue with Google
        </button>
      </FullPageMessage>
    );
  }

  // Stytch IdP renders the consent UI and handles the redirect back to the
  // requesting OAuth client. The trustedAuthToken is the Supabase JWT;
  // tokenProfileID tells Stytch which validation profile to apply.
  return (
    <IdentityProvider
      authTokenParams={{
        trustedAuthToken: session.access_token,
        tokenProfileID: STYTCH_TRUSTED_TOKEN_PROFILE_ID,
      }}
    />
  );
}
