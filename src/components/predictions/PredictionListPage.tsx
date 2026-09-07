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
  MultiFilterSelect,
  SearchInput,
  SortableTableHead,
  getDefaultValues,
} from "@/components/crud/ListControls";
import { useTableSort } from "@/components/crud/useTableSort";
import { usePredictions } from "@/hooks/usePredictions";
import type { Prediction } from "@/services/predictionService";
import { PredictionFormModal } from "./PredictionFormModal";

const outcomeColors: Record<string, string> = {
  hit: "bg-emerald-500/10 text-emerald-600",
  miss: "bg-rose-500/10 text-rose-600",
  unresolvable: "bg-muted text-muted-foreground",
};

// Includes an explicit "open" choice for predictions with no recorded outcome.
const outcomeOptions = [
  { value: "open", label: "Open", defaultActive: true },
  { value: "hit", label: "Hit" },
  { value: "miss", label: "Miss" },
  { value: "unresolvable", label: "Unresolvable" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
}

export function PredictionListPage() {
  const { predictions, isLoading } = usePredictions();
  const [editing, setEditing] = useState<Prediction | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || predictions.length === 0) return;
    const p = predictions.find((x) => x.id === openId);
    if (p) setEditing(p);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, predictions, setSearchParams]);

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string[]>(getDefaultValues(outcomeOptions));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return predictions.filter((p) => {
      if (outcomeFilter.length > 0 && !outcomeFilter.includes(p.outcome ?? "open")) return false;
      if (q && !p.prediction.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [predictions, search, outcomeFilter]);

  const sort = useTableSort(
    filtered,
    {
      prediction: (p) => p.prediction,
      confidence: (p) => p.confidence,
      outcome: (p) => p.outcome,
      due: (p) => p.resolution_date,
      resolved: (p) => p.resolved_at,
    },
    { key: "due", dir: "asc" },
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Predictions
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New prediction
        </Button>
      </div>

      <ListToolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search predictions…" />
        <MultiFilterSelect
          values={outcomeFilter}
          onChange={setOutcomeFilter}
          options={outcomeOptions}
          label="Outcome"
          ariaLabel="Filter by outcome"
        />
      </ListToolbar>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-1 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : predictions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No predictions yet.
          </p>
        ) : sort.sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No predictions match your filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="prediction" label="Prediction" sort={sort} />
                <SortableTableHead sortKey="confidence" label="Confidence" sort={sort} />
                <SortableTableHead sortKey="outcome" label="Outcome" sort={sort} />
                <SortableTableHead sortKey="due" label="Due" sort={sort} />
                <SortableTableHead sortKey="resolved" label="Resolved" sort={sort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sort.sorted.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => setEditing(p)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium max-w-md">
                    <span className="line-clamp-2">{p.prediction}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{p.confidence}%</TableCell>
                  <TableCell>
                    {p.outcome ? (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${outcomeColors[p.outcome] ?? ""}`}
                      >
                        {p.outcome}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">open</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(p.resolution_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(p.resolved_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {creating && <PredictionFormModal onClose={() => setCreating(false)} />}
      {editing && (
        <PredictionFormModal
          prediction={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
