import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Link, Unlink, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import * as settingsService from "@/services/settingsService";
import { McpTokensPanel } from "@/components/settings/McpTokensPanel";

const MCP_ENABLED = import.meta.env.VITE_ENABLE_MCP === "true";

// ── Oura connection helpers ──────────────────────────────────────────────────

function useOuraIntegration() {
  const queryClient = useQueryClient();

  const { data: integration, isLoading } = useQuery({
    queryKey: ["oura_integration"],
    queryFn: () => settingsService.fetchOuraIntegration(supabase),
    staleTime: 30 * 1000,
  });

  const disconnect = useMutation({
    mutationFn: () => settingsService.disconnectOura(supabase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oura_integration"] });
      queryClient.invalidateQueries({ queryKey: ["oura_daily"] });
      toast.success("Oura disconnected");
    },
    onError: (e) => toast.error(`Failed to disconnect: ${e.message}`),
  });

  const connect = async () => {
    const clientId = import.meta.env.VITE_OURA_CLIENT_ID;
    if (!clientId) {
      toast.error("Oura client ID not configured (VITE_OURA_CLIENT_ID)");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not signed in"); return; }

    const redirectUri = `${window.location.origin}/auth/oura/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem(`oura_oauth_${state}`, session.access_token);

    const authUrl = new URL("https://cloud.ouraring.com/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "daily heartrate session spo2");
    authUrl.searchParams.set("state", state);

    window.location.href = authUrl.toString();
  };

  return { integration, isLoading, connect, disconnect };
}

// ── Main component ───────────────────────────────────────────────────────────

const Settings = () => {
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { integration: ouraIntegration, isLoading: ouraLoading, connect: connectOura, disconnect: disconnectOura } = useOuraIntegration();

  // Handle redirect back from Oura OAuth
  useEffect(() => {
    const oura = searchParams.get("oura");
    const ouraError = searchParams.get("oura_error");
    if (oura === "connected") toast.success("Oura connected successfully");
    if (ouraError) toast.error(`Oura connection failed: ${ouraError.replace(/_/g, " ")}`);
  }, [searchParams]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <h1 className="mb-10 font-display text-2xl font-bold tracking-tight text-foreground">Settings</h1>

      <div className="space-y-8">

        {/* ── Appearance ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Appearance</h2>
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">
                {theme === "dark" ? "Dark mode is on" : "Light mode is on"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="gap-2 shrink-0"
            >
              {theme === "dark" ? (
                <><Sun className="h-3.5 w-3.5" /> Light mode</>
              ) : (
                <><Moon className="h-3.5 w-3.5" /> Dark mode</>
              )}
            </Button>
          </div>
        </section>

        <Separator />

        {/* ── Integrations ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Integrations</h2>

          <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-medium text-foreground">Oura Ring</p>
              {ouraLoading ? (
                <p className="text-xs text-muted-foreground">Checking connection…</p>
              ) : ouraIntegration ? (
                <p className="text-xs text-muted-foreground">
                  Connected{" "}
                  {new Date(ouraIntegration.connected_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Syncs readiness, sleep, and steps to your daily entry.
                </p>
              )}
            </div>

            {ouraIntegration ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectOura.mutate()}
                disabled={disconnectOura.isPending}
                className="gap-2 shrink-0 text-destructive hover:text-destructive"
              >
                <Unlink className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={connectOura}
                className="gap-2 shrink-0"
              >
                <Link className="h-3.5 w-3.5" />
                Connect Oura
              </Button>
            )}
          </div>
        </section>

        <Separator />

        {MCP_ENABLED && (
          <>
            <McpTokensPanel />
            <Separator />
          </>
        )}

        {/* ── Account ── */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Account</h2>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{user?.email || "Signed in"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Signed in with Google</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2 text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Settings;
