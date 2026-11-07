import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ListToolbar,
  SearchInput,
  SortableTableHead,
} from "@/components/crud/ListControls";
import { useTableSort } from "@/components/crud/useTableSort";
import { useHypotheses } from "@/hooks/useHypotheses";
import type { Hypothesis } from "@/services/hypothesisService";
import { HypothesisFormModal } from "./HypothesisFormModal";

export function HypothesisListPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { hypotheses, isLoading } = useHypotheses({ archived: showArchived });
  const [editing, setEditing] = useState<Hypothesis | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || hypotheses.length === 0) return;
    const h = hypotheses.find((x) => x.id === openId);
    if (h) setEditing(h);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, hypotheses, setSearchParams]);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hypotheses.filter((h) => {
      if (q && !h.statement.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [hypotheses, search]);

  const sort = useTableSort(
    filtered,
    {
      statement: (h) => h.statement,
      credence: (h) => h.current_credence,
      updated: (h) => h.updated_at,
    },
    { key: "updated", dir: "desc" },
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Hypotheses
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New hypothesis
        </Button>
      </div>

      <ListToolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search hypotheses…"
        />
        <Button
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Showing archived" : "Show archived"}
        </Button>
      </ListToolbar>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-1 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : hypotheses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            {showArchived ? "No archived hypotheses." : "No hypotheses yet."}
          </p>
        ) : sort.sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No hypotheses match your search.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  sortKey="statement"
                  label="Statement"
                  sort={sort}
                />
                <SortableTableHead
                  sortKey="credence"
                  label="Existing estimate"
                  sort={sort}
                />
                <SortableTableHead
                  sortKey="updated"
                  label="Updated"
                  sort={sort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sort.sorted.map((h) => (
                <TableRow
                  key={h.id}
                  onClick={() => setEditing(h)}
                  className={`cursor-pointer ${h.archived_at ? "opacity-60" : ""}`}
                >
                  <TableCell className="font-medium max-w-md">
                    <span className="line-clamp-2">{h.statement}</span>
                    {h.basis && (
                      <span className="block text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {h.basis}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${h.current_credence}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-sm">
                        {h.current_credence}%
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Agent:{" "}
                      {h.agent_credence == null
                        ? "Unquantified"
                        : `${h.agent_credence}%`}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(new Date(h.updated_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {creating && <HypothesisFormModal onClose={() => setCreating(false)} />}
      {editing && (
        <HypothesisFormModal
          hypothesis={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
