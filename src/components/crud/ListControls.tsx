import { useMemo } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ListFilter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TableSort } from "./useTableSort";

/** Horizontal bar that holds the search box and filter dropdowns. */
export function ListToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

/** Text search input with a leading magnifier icon. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

/**
 * A single filter dropdown. The sentinel value "all" clears the filter — pass
 * `value=""` for "no filter" and it maps to/from "all" internally (Radix Select
 * cannot use an empty-string item value).
 */
export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
  ariaLabel: string;
}) {
  return (
    <Select
      value={value === "" ? "all" : value}
      onValueChange={(v) => onChange(v === "all" ? "" : v)}
    >
      <SelectTrigger className="h-9 w-full sm:w-[160px]" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="capitalize">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface FilterOption {
  value: string;
  label: string;
  /** When true, this option is selected by default on page load. */
  defaultActive?: boolean;
}

export function getDefaultValues(options: FilterOption[]): string[] {
  return options.filter((o) => o.defaultActive).map((o) => o.value);
}

/**
 * Multi-select filter dropdown. Renders a popover with checkboxes so the user
 * can select multiple values at once. The trigger shows a count badge when
 * filters are active.
 *
 * When options include `defaultActive` flags, the footer shows a smart toggle:
 * "Show all" when at defaults (clears filter), "Reset" otherwise (restores defaults).
 */
export function MultiFilterSelect({
  values,
  onChange,
  options,
  label,
  ariaLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: FilterOption[];
  label: string;
  ariaLabel: string;
}) {
  const defaults = useMemo(
    () => options.filter((o) => o.defaultActive).map((o) => o.value),
    [options],
  );

  const isAtDefaults =
    defaults.length > 0 &&
    values.length === defaults.length &&
    defaults.every((d) => values.includes(d));

  const toggle = (val: string) => {
    onChange(
      values.includes(val) ? values.filter((v) => v !== val) : [...values, val],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            values.length > 0
              ? "border-primary/50 text-foreground"
              : "text-muted-foreground",
          )}
          aria-label={ariaLabel}
        >
          <ListFilter className="h-3.5 w-3.5" />
          {label}
          {values.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 min-w-[20px] justify-center px-1 text-[10px] font-semibold"
            >
              {values.length}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1.5">
        <div className="space-y-0.5">
          {options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(opt.value)}
                />
                <span className="capitalize">{opt.label}</span>
              </label>
            );
          })}
        </div>
        {defaults.length > 0 ? (
          <button
            type="button"
            className="mt-1.5 w-full rounded-sm px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange(isAtDefaults ? [] : defaults)}
          >
            {isAtDefaults ? "Show all" : "Reset"}
          </button>
        ) : (
          values.length > 0 && (
            <button
              type="button"
              className="mt-1.5 w-full rounded-sm px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          )
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A sortable table column header. Clicking toggles the sort key/direction via
 * the shared {@link TableSort} state and shows the active direction.
 */
export function SortableTableHead({
  sortKey,
  label,
  sort,
  className,
}: {
  sortKey: string;
  label: string;
  sort: TableSort;
  className?: string;
}) {
  const active = sort.sortKey === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => sort.toggle(sortKey)}
        className={cn(
          "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-50")} />
      </button>
    </TableHead>
  );
}
