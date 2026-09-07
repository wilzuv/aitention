import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Oura redirects the user's browser here after they approve access.
// We read the code + state from the URL, call the edge function to exchange
// them for tokens, then navigate the user back to settings.
export default function OuraCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code || !state) {
      navigate(`/settings?oura_error=${error ?? "missing_params"}`, { replace: true });
      return;
    }

    // Retrieve the access token stored before the OAuth redirect
    const accessToken = sessionStorage.getItem(`oura_oauth_${state}`);
    sessionStorage.removeItem(`oura_oauth_${state}`);
    if (!accessToken) {
      navigate("/settings?oura_error=session_expired", { replace: true });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/oura/callback`;

    supabase.functions
      .invoke("oura-oauth-callback", {
        body: { code, state: btoa(accessToken), redirect_uri: redirectUri },
      })
      .then(({ data, error: fnError }) => {
        if (fnError || data?.error) {
          const msg = fnError?.message ?? data?.error ?? "unknown";
          navigate(`/settings?oura_error=${msg}`, { replace: true });
        } else {
          navigate("/settings?oura=connected", { replace: true });
        }
      })
      .catch((err) => {
        navigate(`/settings?oura_error=${String(err)}`, { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground animate-pulse">
        Connecting your Oura account…
      </p>
    </div>
  );
}
