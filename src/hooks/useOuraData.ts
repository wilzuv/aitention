import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface OuraDayData {
  readiness_score: number | null;
  sleep_score: number | null;
  sleep_hours: number | null;
  steps: number | null;
  synced_at: string | null;
}

// Six hours — after this, we'll try to re-sync in the background
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

function isStaleOrMissing(data: OuraDayData | null): boolean {
  if (!data) return true;
  if (!data.synced_at) return true;
  return Date.now() - new Date(data.synced_at).getTime() > STALE_THRESHOLD_MS;
}

export function useOuraData(date: Date) {
  const dateStr = format(date, "yyyy-MM-dd");
  const queryClient = useQueryClient();
  const hasAutoSynced = useRef<string | null>(null);

  // Is Oura connected for this user?
  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ["oura_integration"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("connected_at")
        .eq("provider", "oura")
        .maybeSingle();
      return data;
    },
    staleTime: 60 * 1000,
  });

  const isConnected = !!integration;

  // Today's Oura record from our DB
  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ["oura_daily", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oura_daily_records")
        .select("readiness_score, sleep_score, sleep_hours, steps, synced_at")
        .eq("date", dateStr)
        .maybeSingle();
      if (error) throw error;
      return data as OuraDayData | null;
    },
    enabled: isConnected,
    staleTime: 5 * 60 * 1000,
  });

  // Manual or auto-triggered sync
  const sync = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.functions.invoke("oura-sync", {
        body: { date: dateStr },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      return result as OuraDayData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oura_daily", dateStr] });
    },
  });

  // Auto-sync once per date if data is stale and not already syncing
  useEffect(() => {
    if (
      isConnected &&
      !integrationLoading &&
      !dataLoading &&
      !sync.isPending &&
      isStaleOrMissing(data ?? null) &&
      hasAutoSynced.current !== dateStr
    ) {
      hasAutoSynced.current = dateStr;
      sync.mutate();
    }
  }, [isConnected, integrationLoading, dataLoading, data, dateStr, sync.isPending]);

  return {
    data: data ?? null,
    isConnected,
    isLoading: integrationLoading || dataLoading,
    isSyncing: sync.isPending,
    sync,
  };
}
