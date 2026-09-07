import { useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TaskDetailModal, useQuickAddShortcut } from "@/components/today/TaskDetailModal";
import { QuickAddProvider } from "@/contexts/QuickAddContext";
import { FocusSessionProvider } from "@/contexts/FocusSessionContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);

  useQuickAddShortcut(openQuickAdd);

  return (
    <SidebarProvider>
      <QuickAddProvider onAddTask={openQuickAdd}>
        <FocusSessionProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-12 flex items-center border-b border-border">
                <SidebarTrigger className="ml-2" />
              </header>
              <main className="flex-1">{children}</main>
            </div>
          </div>
          <TaskDetailModal task={null} mode="create" open={quickAddOpen} onOpenChange={setQuickAddOpen} />
        </FocusSessionProvider>
      </QuickAddProvider>
    </SidebarProvider>
  );
}
