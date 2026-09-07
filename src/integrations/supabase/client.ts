import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// In dev we disable autoRefreshToken so a stale localStorage token doesn't
// spam the console with "Failed to fetch" retries while iterating on the
// prototype (which uses mock data and doesn't need a session at all).
// Sign-in via /auth still works; the session simply won't auto-refresh
// across long idle periods.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: !import.meta.env.DEV,
  }
});