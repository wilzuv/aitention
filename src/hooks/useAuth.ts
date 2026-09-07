import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const PROVIDER_TOKEN_KEY = "google_provider_token";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Capture provider_token when available (only right after OAuth callback)
        if (session?.provider_token) {
          localStorage.setItem(PROVIDER_TOKEN_KEY, session.provider_token);
        }
        if (!session) {
          localStorage.removeItem(PROVIDER_TOKEN_KEY);
        }
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token) {
        localStorage.setItem(PROVIDER_TOKEN_KEY, session.provider_token);
      }
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    localStorage.removeItem(PROVIDER_TOKEN_KEY);
    await supabase.auth.signOut();
  };

  return { session, user: session?.user ?? null, loading, signOut };
}

export function getStoredProviderToken(): string | null {
  return localStorage.getItem(PROVIDER_TOKEN_KEY);
}
