import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { clearToasts } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

// Today and Auth stay statically imported — they are the two entry points
// (logged-in landing page and logged-out redirect target), so lazy-loading them
// would only add a round trip to the most common first paint.
import Today from "./pages/Today";
import Auth from "./pages/Auth";

// Everything else splits into its own chunk, fetched when its route matches.
// Routes carrying heavy route-exclusive dependencies are the real prize here —
// Planning and ProjectDetail pull in @dnd-kit, which no other route touches.
const Goals = lazy(() => import("./pages/Goals"));
const Foundations = lazy(() => import("./pages/Foundations"));
const Hypotheses = lazy(() => import("./pages/Hypotheses"));
const Decisions = lazy(() => import("./pages/Decisions"));
const Predictions = lazy(() => import("./pages/Predictions"));
const Experiments = lazy(() => import("./pages/Experiments"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Journal = lazy(() => import("./pages/Journal"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Planning = lazy(() => import("./pages/Planning"));
const Settings = lazy(() => import("./pages/Settings"));
const Skills = lazy(() => import("./pages/Skills"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const OuraCallback = lazy(() => import("./pages/OuraCallback"));
const Authorize = lazy(() => import("./pages/oauth/Authorize"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Applies the saved theme class to <html> on first render so the correct
// theme is active before any content paints.
function ThemeInitializer() {
  useTheme();
  return null;
}

// Shown while a lazily-loaded route chunk is in flight. Inside AppLayout this
// swaps only the content area, so the nav shell stays put during the fetch.
function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );
}

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppLayout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/foundations" element={<Foundations />} />
          <Route path="/hypotheses" element={<Hypotheses />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

// Remounted for each identity: caches and shared UI state never cross accounts.
function SessionApp() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 10 * 60 * 1000 },
    },
  }));

  useEffect(() => () => {
    // Cancel outstanding queries and release records owned by the old identity.
    queryClient.clear();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public routes — accessible without login */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/auth/oura/callback" element={<OuraCallback />} />
              {/* OAuth Connected Apps consent — public so OAuth query params
                  survive the Supabase sign-in round-trip. Auth check is done
                  inside the component itself. */}
              <Route path="/oauth/authorize" element={<Authorize />} />
              {/* Everything else requires auth */}
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );

}

function App() {
  const { user, loading } = useAuth();
  const identity = loading ? null : (user?.id ?? "anonymous");
  const [readyIdentity, setReadyIdentity] = useState<string | null>(null);

  useLayoutEffect(() => {
    // Toasts live outside React. Clear their actions before the new account's
    // subtree mounts, so even an old Undo button cannot cross the boundary.
    clearToasts();
    sonnerToast.getToasts().forEach(({ id }) => sonnerToast.dismiss(id));
    setReadyIdentity(identity);
  }, [identity]);

  // On identity change first unmount the old tree, then reset external stores.
  if (identity === null || readyIdentity !== identity) return <RouteFallback />;
  return <SessionApp key={identity} />;
}

export default App;
