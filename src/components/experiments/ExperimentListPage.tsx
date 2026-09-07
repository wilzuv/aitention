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
import { useExperiments } from "@/hooks/useExperiments";
import type { Experiment } from "@/services/experimentService";
import { ExperimentFormModal } from "./ExperimentFormModal";

const statusColors: Record<string, string> = {
  running: "bg-primary/10 text-primary",
  concluded: "bg-emerald-500/10 text-emerald-600",
  abandoned: "bg-muted text-muted-foreground",
};

const statusOptions = [
  { value: "running", label: "Running", defaultActive: true },
  { value: "concluded", label: "Concluded" },
  { value: "abandoned", label: "Abandoned" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
}

export function ExperimentListPage() {
  const { experiments, isLoading } = useExperiments();
  const [editing, setEditing] = useState<Experiment | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || experiments.length === 0) return;
    const e = experiments.find((x) => x.id === openId);
    if (e) setEditing(e);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, experiments, setSearchParams]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(getDefaultValues(statusOptions));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return experiments.filter((e) => {
      if (statusFilter.length > 0 && !statusFilter.includes(e.status)) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [experiments, search, statusFilter]);

  const sort = useTableSort(
    filtered,
    {
      title: (e) => e.title,
      status: (e) => e.status,
      start: (e) => e.start_date,
      end: (e) => e.end_date,
      concluded: (e) => e.concluded_at,
    },
    { key: "start", dir: "desc" },
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Experiments
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New experiment
        </Button>
      </div>

      <ListToolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search experiments…" />
        <MultiFilterSelect
          values={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          label="Status"
          ariaLabel="Filter by status"
        />
      </ListToolbar>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-1 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : experiments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No experiments yet.
          </p>
        ) : sort.sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No experiments match your filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="title" label="Title" sort={sort} />
                <SortableTableHead sortKey="status" label="Status" sort={sort} />
                <SortableTableHead sortKey="start" label="Start" sort={sort} />
                <SortableTableHead sortKey="end" label="End" sort={sort} />
                <SortableTableHead sortKey="concluded" label="Concluded" sort={sort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sort.sorted.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={() => setEditing(e)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium max-w-xs">
                    <span className="line-clamp-2">{e.title}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${statusColors[e.status] ?? ""}`}
                    >
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(e.start_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(e.end_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(e.concluded_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {creating && <ExperimentFormModal onClose={() => setCreating(false)} />}
      {editing && (
        <ExperimentFormModal
          experiment={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
