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
  TableHead,
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
import { useDecisions } from "@/hooks/useDecisions";
import type { Decision } from "@/services/decisionService";
import { DecisionFormModal } from "./DecisionFormModal";

const statusOptions = [
  { value: "open", label: "Open", defaultActive: true },
  { value: "needs_review", label: "Needs review" },
  { value: "decided", label: "Decided" },
  { value: "abandoned", label: "Abandoned" },
];

const statusColors: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  decided: "bg-emerald-500/10 text-emerald-600",
  abandoned: "bg-muted text-muted-foreground",
};

const outcomeColors: Record<string, string> = {
  good_call: "bg-emerald-500/10 text-emerald-600",
  wrong_call: "bg-rose-500/10 text-rose-600",
  partial: "bg-amber-500/10 text-amber-600",
  inconclusive: "bg-muted text-muted-foreground",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
}

export function DecisionListPage() {
  const { decisions, isLoading } = useDecisions();
  const [editing, setEditing] = useState<Decision | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || decisions.length === 0) return;
    const d = decisions.find((x) => x.id === openId);
    if (d) setEditing(d);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, decisions, setSearchParams]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(getDefaultValues(statusOptions));

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const needsReview = (d: Decision) =>
    d.status === "decided" &&
    !d.reviewed_at &&
    d.review_date != null &&
    d.review_date <= todayStr;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decisions.filter((d) => {
      if (statusFilter.length > 0) {
        const matchesStatus = statusFilter.includes(d.status);
        const matchesNeedsReview =
          statusFilter.includes("needs_review") && needsReview(d);
        if (!matchesStatus && !matchesNeedsReview) return false;
      }
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [decisions, search, statusFilter, todayStr]);

  const sort = useTableSort(
    filtered,
    {
      title: (d) => d.title,
      status: (d) => d.status,
      decided: (d) => d.decided_at,
      updated: (d) => d.updated_at,
    },
    { key: "updated", dir: "desc" },
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Decisions
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New decision
        </Button>
      </div>

      <ListToolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search decisions…" />
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
        ) : decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No decisions yet.
          </p>
        ) : sort.sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No decisions match your filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="title" label="Title" sort={sort} />
                <SortableTableHead sortKey="status" label="Status" sort={sort} />
                <TableHead>Chosen option</TableHead>
                <SortableTableHead sortKey="decided" label="Decided" sort={sort} />
                <TableHead>Review outcome</TableHead>
                <SortableTableHead sortKey="updated" label="Updated" sort={sort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sort.sorted.map((d) => (
                <TableRow
                  key={d.id}
                  onClick={() => setEditing(d)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium max-w-xs">
                    <span className="line-clamp-2">{d.title}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${statusColors[d.status] ?? ""}`}
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {d.chosen_option ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(d.decided_at)}
                  </TableCell>
                  <TableCell>
                    {d.review_outcome ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${outcomeColors[d.review_outcome] ?? ""}`}
                      >
                        {d.review_outcome.replace("_", " ")}
                      </Badge>
                    ) : needsReview(d) ? (
                      <Badge
                        variant="outline"
                        className="text-xs bg-amber-500/10 text-amber-600"
                      >
                        needs review
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(d.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {creating && <DecisionFormModal onClose={() => setCreating(false)} />}
      {editing && (
        <DecisionFormModal decision={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
