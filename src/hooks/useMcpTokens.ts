import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  createToken,
  listTokens,
  revokeToken,
  type CreatedMcpToken,
  type McpToken,
} from "@/services/mcpTokenService";

const KEY = ["mcp_tokens"] as const;

export function useMcpTokens() {
  const qc = useQueryClient();

  const tokens = useQuery<McpToken[]>({
    queryKey: KEY,
    queryFn: () => listTokens(supabase),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (name: string) => createToken(supabase, name),
    onSuccess: (_data: CreatedMcpToken) => {
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(`Failed to create token: ${e.message}`),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeToken(supabase, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Token revoked");
    },
    onError: (e: Error) => toast.error(`Failed to revoke: ${e.message}`),
  });

  return { tokens, create, revoke };
}
