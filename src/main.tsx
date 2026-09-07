import { createRoot } from "react-dom/client";
import { StytchProvider } from "@stytch/react";
import { lazy, Suspense } from "react";
const App = lazy(() => import("./App.tsx"));
import { stytchClient } from "./lib/stytch";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

// Stytch provider is opt-in via env. When the token isn't set we skip the
// wrapper entirely so dev environments boot without configuring Stytch.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  root.render(
    <main className="mx-auto max-w-xl p-8 space-y-4">
      <h1 className="text-2xl font-bold">Set up Aitention</h1>
      <p>Follow the README to create your Supabase database and configure this deployment.</p>
      <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then rebuild the app.</p>
    </main>,
  );
} else if (stytchClient) {
  root.render(
    <StytchProvider stytch={stytchClient}>
      <Suspense fallback={<p>Loading…</p>}><App /></Suspense>
    </StytchProvider>,
  );
} else {
  root.render(<App />);
}
