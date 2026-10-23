import { useState } from "react";
import { Home, Target, CheckSquare, CalendarRange, Settings, Plus, ListPlus, Smile, FileText, Play, Lightbulb, GitBranch, TrendingUp, FlaskConical, Compass, BookOpen, BookText, FolderKanban } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarSeparator,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuickAdd } from "@/contexts/QuickAddContext";

const dataPages = [
  { title: "Today", url: "/", icon: Home },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Journal", url: "/journal", icon: BookText },
  { title: "Planning", url: "/planning", icon: CalendarRange },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Foundations", url: "/foundations", icon: Compass },
  { title: "Hypotheses", url: "/hypotheses", icon: Lightbulb },
  { title: "Decisions", url: "/decisions", icon: GitBranch },
  { title: "Predictions", url: "/predictions", icon: TrendingUp },
  { title: "Experiments", url: "/experiments", icon: FlaskConical },
  { title: "Skills", url: "/skills", icon: BookOpen },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { actions } = useQuickAdd();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const quickAddOptions = [
    {
      label: "Add task",
      icon: ListPlus,
      iconClass: "text-primary",
      action: () => actions.current.onAddTask(),
      alwaysAvailable: true,
    },
    {
      label: "Add mood",
      icon: Smile,
      iconClass: "text-yellow-500",
      action: () => actions.current.onLogMood?.(),
      alwaysAvailable: false,
    },
    {
      label: "Add note",
      icon: FileText,
      iconClass: "text-blue-500",
      action: () => actions.current.onAddNote?.(),
      alwaysAvailable: false,
    },
    {
      label: "Start focus",
      icon: Play,
      iconClass: "text-primary",
      action: () => actions.current.onStartFocus?.(),
      alwaysAvailable: false,
    },
  ];

  // Filter to only show options that have registered handlers (task is always available)
  const actionMap: Record<string, (() => void) | null> = {
    "Add mood": actions.current.onLogMood,
    "Add note": actions.current.onAddNote,
    "Start focus": actions.current.onStartFocus,
  };
  const availableOptions = quickAddOptions.filter(
    (opt) => opt.alwaysAvailable || actionMap[opt.label],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-4">
          {!collapsed && (
            <h2 className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">
              Aitention
            </h2>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Add"
                      className="border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      {!collapsed && <span>Add</span>}
                    </SidebarMenuButton>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="w-44 p-1">
                    {availableOptions.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => {
                          opt.action();
                          setPopoverOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                      >
                        <opt.icon className={`h-4 w-4 ${opt.iconClass}`} />
                        {opt.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
              <SidebarSeparator className="my-1" />
              {dataPages.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  );
}
