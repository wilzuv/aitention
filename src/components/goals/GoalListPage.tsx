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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoals } from "@/hooks/useGoals";
import { GoalEditModal } from "./GoalEditModal";
import type { Goal } from "@/services/goalService";

const statusColors: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  done: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-red-500/10 text-red-600",
  dropped: "bg-amber-500/10 text-amber-600",
};

const statusOptions = [
  { value: "open", label: "Open", defaultActive: true },
  { value: "done", label: "Done" },
  { value: "failed", label: "Failed" },
  { value: "dropped", label: "Dropped" },
];

function displayStatus(goal: Goal): string {
  return goal.status ?? "open";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
}

export function GoalListPage() {
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const goalsQuery = useGoals({});
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || goalsQuery.goals.length === 0) return;
    const goal = goalsQuery.goals.find((g) => g.id === openId);
    if (goal) setEditingGoal(goal);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, goalsQuery.goals, setSearchParams]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(getDefaultValues(statusOptions));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return goalsQuery.goals.filter((goal) => {
      const status = displayStatus(goal);
      if (statusFilter.length > 0 && !statusFilter.includes(status)) return false;
      if (q && !goal.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [goalsQuery.goals, search, statusFilter]);

  const sort = useTableSort(
    filtered,
    {
      title: (g) => g.title,
      status: (g) => displayStatus(g),
      review: (g) => g.review_date,
      updated: (g) => g.updated_at,
    },
    { key: "updated", dir: "desc" },
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Goals
        </h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New goal
        </Button>
      </div>

      <ListToolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search goals…" />
        <MultiFilterSelect
          values={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          label="Status"
          ariaLabel="Filter by status"
        />
      </ListToolbar>

      <div className="rounded-lg border border-border bg-card">
        {goalsQuery.isLoading ? (
          <div className="space-y-1 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : goalsQuery.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No goals yet.
          </p>
        ) : sort.sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-4 text-center">
            No goals match your filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="title" label="Title" sort={sort} />
                <SortableTableHead sortKey="status" label="Status" sort={sort} />
                <SortableTableHead sortKey="review" label="Review date" sort={sort} />
                <SortableTableHead sortKey="updated" label="Updated" sort={sort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sort.sorted.map((goal) => {
                const status = displayStatus(goal);
                return (
                  <TableRow
                    key={goal.id}
                    onClick={() => setEditingGoal(goal)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium max-w-xs">
                      <span className="line-clamp-2">{goal.title}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={status}
                        onValueChange={(v) => {
                          goalsQuery.updateGoal.mutate({
                            id: goal.id,
                            status: v === "open" ? null : v,
                          });
                        }}
                      >
                        <SelectTrigger className="h-7 w-[100px] border-none bg-transparent p-0 shadow-none focus:ring-0">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${statusColors[status] ?? ""}`}
                          >
                            {status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="dropped">Dropped</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(goal.review_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(goal.updated_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {creating && <GoalEditModal onClose={() => setCreating(false)} />}
      {editingGoal && (
        <GoalEditModal goal={editingGoal} onClose={() => setEditingGoal(null)} />
      )}
    </div>
  );
}
