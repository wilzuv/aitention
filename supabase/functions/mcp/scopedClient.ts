// Privileged MCP queries bypass RLS. This wrapper scopes root rows to the verified user.
// Compound foreign keys in schema.sql enforce ownership of related rows for every caller.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class ScopedClient {
  constructor(
    public readonly userId: string,
    private readonly client: SupabaseClient,
  ) {}

  from(table: string) {
    const qb = this.client.from(table);
    const userId = this.userId;

    return {
      select(columns: string = "*") {
        return qb.select(columns).eq("user_id", userId);
      },

      insert(values: Record<string, unknown> | Record<string, unknown>[]) {
        const withUserId = Array.isArray(values)
          ? values.map((v) => ({ ...v, user_id: userId }))
          : { ...values, user_id: userId };
        return qb.insert(withUserId);
      },

      update(values: Record<string, unknown>) {
        // Strip any caller-supplied user_id so a request can't reassign rows
        // to another user even by accident.
        const { user_id: _ignored, ...safe } = values;
        return qb.update(safe).eq("user_id", userId);
      },

      delete() {
        return qb.delete().eq("user_id", userId);
      },
    };
  }
}
