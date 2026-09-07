import { useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMcpTokens } from "@/hooks/useMcpTokens";
import type { McpToken } from "@/services/mcpTokenService";

const FUNCTION_URL =
  (import.meta.env.VITE_SUPABASE_URL ?? "") + "/functions/v1/mcp";

function relativeTime(iso: string | null): string {
  if (!iso) return "never used";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildConnectionSnippet(plaintext: string): string {
  return JSON.stringify(
    {
      url: FUNCTION_URL,
      headers: { Authorization: `Bearer ${plaintext}` },
    },
    null,
    2
  );
}

export function McpTokensPanel() {
  const { tokens, create, revoke } = useMcpTokens();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ plaintext: string; name: string } | null>(null);

  const tokenList: McpToken[] = tokens.data ?? [];

  async function handleCreate() {
    if (!name.trim()) return;
    const result = await create.mutateAsync(name.trim());
    setCreated({ plaintext: result.plaintext, name: result.token.name });
    setName("");
    setCreating(false);
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold text-foreground">External access (MCP)</h2>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)} className="gap-2 shrink-0">
          <KeyRound className="h-3.5 w-3.5" /> New token
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Generate a bearer token to connect Claude Desktop, Codex, or any MCP-capable client. Each token
        scopes access to your account; revoking takes effect immediately.
      </p>

      <div className="space-y-2">
        {tokens.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : tokenList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 text-center">
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          </div>
        ) : (
          tokenList.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {t.token_prefix}… · last used {relativeTime(t.last_used_at)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => revoke.mutate(t.id)}
                disabled={revoke.isPending}
                className="gap-2 shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Revoke
              </Button>
            </div>
          ))
        )}
      </div>

      {/* New-token dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New MCP token</DialogTitle>
            <DialogDescription>
              Pick a recognisable name — usually the client + device, e.g. "Claude Desktop · laptop".
            </DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Claude Desktop · laptop"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time reveal dialog */}
      <Dialog
        open={created !== null}
        onOpenChange={(open) => {
          if (!open) setCreated(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Token created · {created?.name}</DialogTitle>
            <DialogDescription>
              Copy it now — for security, it will not be shown again. If you lose it, revoke and create
              a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Token</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
                  {created?.plaintext}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => created && copy(created.plaintext, "Token")}
                  className="gap-2 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Connection details</p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-48">
                  {created ? buildConnectionSnippet(created.plaintext) : ""}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    created && copy(buildConnectionSnippet(created.plaintext), "Snippet")
                  }
                  className="gap-2 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use the URL and bearer header in your MCP client's supported connection settings. Configuration format varies by client.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
