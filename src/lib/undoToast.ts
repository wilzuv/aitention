import { createElement, Fragment, type ReactNode } from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { QueryClient } from "@tanstack/react-query";

/** Truncate a string with ellipsis */
export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/** Show a toast with an Undo action button */
export function undoToast(opts: {
  title: ReactNode;
  description?: string;
  onUndo: () => void;
}) {
  toast({
    title: opts.title,
    description: opts.description,
    action: createElement(
      ToastAction,
      { altText: "Undo", onClick: opts.onUndo },
      "Undo",
    ),
  });
}

/**
 * Build a toast title with an optional clickable link.
 * If `onClick` is provided, `text` becomes an underlined button; otherwise plain string.
 */
export function toastTitle(
  text: string,
  suffix: string,
  onClick?: () => void,
): ReactNode {
  if (!onClick) return `${text} ${suffix}`;
  return createElement(
    Fragment,
    null,
    createElement(
      "button",
      {
        onClick,
        className:
          "underline underline-offset-2 hover:text-primary cursor-pointer text-left",
      },
      text,
    ),
    ` ${suffix}`,
  );
}

/** Find an item by id in the TanStack Query cache */
export function findInCache<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: string[],
  id: string,
): T | null {
  const allData = queryClient.getQueriesData<T[]>({ queryKey });
  for (const [, data] of allData) {
    const found = data?.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}
