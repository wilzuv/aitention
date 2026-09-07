import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  current: { user: { id: "alice" } as { id: string } | null, loading: false },
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ ...auth.current, session: auth.current.user ? {} : null }),
}));
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({}) }));
vi.mock("@/components/ui/toaster", async () => {
  const { useToast } = await import("@/hooks/use-toast");
  return { Toaster: function ToastActions() {
    const { toasts } = useToast();
    return <>{toasts.map(item => <div key={item.id}>{item.title}{item.action}</div>)}</>;
  } };
});
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/tooltip", () => ({ TooltipProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/pages/Today", async () => {
  const { useState } = await import("react");
  const { useQuery, useQueryClient } = await import("@tanstack/react-query");
  return { default: function Page() {
    const client = useQueryClient();
    const [draft, setDraft] = useState("");
    const userId = auth.current.user!.id;
    const { data } = useQuery({ queryKey: ["tasks"], queryFn: async () => userId });
    return <>
      <div data-testid="tasks">{data ?? "loading"}</div>
      <input aria-label="draft" value={draft} onChange={event => setDraft(event.target.value)} />
      <button onClick={() => client.setQueryData(["tasks"], "private cached task")}>cache</button>
    </>;
  } };
});
vi.mock("@/pages/Auth", async () => {
  const { useQueryClient } = await import("@tanstack/react-query");
  return { default: function Login() {
    const client = useQueryClient();
    return <div data-testid="login">{String(client.getQueryData(["tasks"]) ?? "empty")}</div>;
  } };
});

import App from "@/App";
import { toast, clearToasts } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

afterEach(() => {
  cleanup();
  clearToasts();
  auth.current = { user: { id: "alice" }, loading: false };
  window.history.replaceState({}, "", "/");
});

describe("account isolation", () => {
  it("replaces cached records and UI drafts on an in-place account switch", async () => {
    const view = render(<App />);
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("alice"));
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "private draft" } });
    fireEvent.click(screen.getByText("cache"));
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("private cached task"));

    auth.current = { user: { id: "bob" }, loading: false };
    view.rerender(<App />);
    expect(screen.getByLabelText("draft")).toHaveValue("");
    expect(screen.getByTestId("tasks")).not.toHaveTextContent("private cached task");
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("bob"));
  });

  it("discards private cache on logout and on returning to the same account", async () => {
    const view = render(<App />);
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("alice"));
    fireEvent.click(screen.getByText("cache"));
    auth.current = { user: null, loading: false };
    view.rerender(<App />);
    expect(screen.getByTestId("login")).toHaveTextContent("empty");
    auth.current = { user: { id: "alice" }, loading: false };
    act(() => { window.history.replaceState({}, "", "/"); });
    view.rerender(<App />);
    expect(screen.getByTestId("tasks")).not.toHaveTextContent("private cached task");
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("alice"));
  });

  it("removes prior-account Undo actions from both notification stores", async () => {
    const view = render(<App />);
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("alice"));
    const undo = vi.fn();
    act(() => {
      toast({ title: "Private task deleted", action: <button onClick={undo}>Undo private task</button> });
      sonnerToast("Private notification", { action: { label: "Undo", onClick: undo } });
    });
    expect(screen.getByRole("button", { name: "Undo private task" })).toBeInTheDocument();
    expect(sonnerToast.getToasts()).toHaveLength(1);

    auth.current = { user: { id: "bob" }, loading: false };
    view.rerender(<App />);
    expect(screen.queryByRole("button", { name: "Undo private task" })).not.toBeInTheDocument();
    expect(screen.queryByText("Private task deleted")).not.toBeInTheDocument();
    expect(sonnerToast.getToasts()).toHaveLength(0);
    expect(undo).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("bob"));
  });
  it("preserves the cache and draft when the same user's session refreshes", async () => {
    const view = render(<App />);
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("alice"));
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "keep draft" } });
    fireEvent.click(screen.getByText("cache"));
    auth.current = { user: { id: "alice" }, loading: false };
    view.rerender(<App />);
    expect(screen.getByLabelText("draft")).toHaveValue("keep draft");
    await waitFor(() => expect(screen.getByTestId("tasks")).toHaveTextContent("private cached task"));
  });
});

