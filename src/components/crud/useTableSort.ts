import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** Pulls a comparable value out of a row for a given sort key. */
export type SortAccessor<T> = (item: T) => string | number | null | undefined;

export interface TableSort {
  sortKey: string;
  sortDir: SortDir;
  /** Click handler for a column header: same key flips direction, new key resets. */
  toggle: (key: string) => void;
}

export interface UseTableSortResult<T> extends TableSort {
  sorted: T[];
}

const isEmpty = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "";

/**
 * Compares two non-empty accessor values. Numbers compare numerically;
 * everything else compares as a case-insensitive string, which also gives
 * correct ordering for ISO date strings.
 */
function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Generic client-side table sorting. Pass the rows and a map of sort keys to
 * value accessors; get back the sorted rows plus the header click handler.
 */
export function useTableSort<T>(
  items: T[],
  accessors: Record<string, SortAccessor<T>>,
  initial: { key: string; dir?: SortDir },
): UseTableSortResult<T> {
  const [sortKey, setSortKey] = useState(initial.key);
  const [sortDir, setSortDir] = useState<SortDir>(initial.dir ?? "asc");

  const toggle = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const accessor = accessors[sortKey];
    if (!accessor) return items;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      // Empty values always sink to the bottom, regardless of direction.
      const aEmpty = isEmpty(av);
      const bEmpty = isEmpty(bv);
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return 0;
        return aEmpty ? 1 : -1;
      }
      return compareValues(av!, bv!) * dir;
    });
  }, [items, accessors, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle };
}
