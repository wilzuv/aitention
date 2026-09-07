import { useState } from "react";
import { Plus, X, Flag, Check, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUnassignedItems } from "@/hooks/useProjects";
import {
  ITEM_TYPE_LABELS,
  type ProjectItem,
  type ProjectItemType,
  type Milestone,
} from "@/services/projectService";
import { ProjectItemEditor } from "./ProjectItemEditor";

interface ProjectItemSectionProps {
  type: ProjectItemType;
  items: ProjectItem[];
  milestones: Milestone[];
  showCompleted: boolean;
  onAttach: (type: ProjectItemType, id: string) => void;
  onDetach: (type: ProjectItemType, id: string) => void;
  onCreate: (type: ProjectItemType, title: string) => void;
  onSetMilestone: (
    type: ProjectItemType,
    id: string,
    milestoneId: string | null
  ) => void;
}

// Singular, plain-English noun for the quick-create placeholder ("New task…").
const ITEM_TYPE_NOUN: Record<ProjectItemType, string> = {
  task: "task",
  goal: "goal",
  hypothesis: "hypothesis",
  decision: "decision",
  experiment: "experiment",
  prediction: "prediction",
};

export function ProjectItemSection({
  type,
  items,
  milestones,
  showCompleted,
  onAttach,
  onDetach,
  onCreate,
  onSetMilestone,
}: ProjectItemSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { items: candidates, isLoading } = useUnassignedItems(type, pickerOpen);

  function submitDraft() {
    const title = draft.trim();
    if (!title) return;
    onCreate(type, title);
    setDraft("");
  }

  // Open items by default; completed/terminal ones only when the page-level
  // toggle is on. A section with nothing open collapses to its empty state
  // unless the user has chosen to reveal completed work.
  const visibleItems = showCompleted ? items : items.filter((i) => i.open);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {ITEM_TYPE_LABELS[type]}
          {visibleItems.length > 0 && (
            <span className="ml-1.5 text-muted-foreground">{visibleItems.length}</span>
          )}
          {hiddenCount > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              · {hiddenCount} done
            </span>
          )}
        </h2>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder={`Add a ${type}…`} />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? "Loading…" : "Nothing unassigned to add."}
                </CommandEmpty>
                {candidates.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.title} ${c.id}`}
                    onSelect={() => {
                      onAttach(type, c.id);
                      setPickerOpen(false);
                    }}
                  >
                    <span className="truncate">{c.title}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick-create a new item of this type, born linked to the project. */}
      <div className="relative mb-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitDraft();
            }
          }}
          placeholder={`New ${ITEM_TYPE_NOUN[type]}…`}
          aria-label={`New ${ITEM_TYPE_NOUN[type]}`}
          className="h-9 pr-9 text-sm"
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={submitDraft}
            aria-label={`Create ${ITEM_TYPE_NOUN[type]}`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
          {hiddenCount > 0
            ? `No open ${ITEM_TYPE_LABELS[type].toLowerCase()} — ${hiddenCount} completed hidden.`
            : `No ${ITEM_TYPE_LABELS[type].toLowerCase()} in this project yet.`}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visibleItems.map((item) => {
            const milestone = item.milestoneId
              ? milestones.find((m) => m.id === item.milestoneId) ?? null
              : null;
            return (
              <li
                key={item.id}
                className="group flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                <button
                  onClick={() => setEditingId(item.id)}
                  className="flex-1 truncate text-left text-sm text-foreground hover:text-primary hover:underline"
                  title={`Edit ${item.title}`}
                >
                  {item.title}
                </button>

                {milestone && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 gap-1 text-[10px] font-normal"
                    title={`Milestone: ${milestone.name}`}
                  >
                    <Flag className="h-2.5 w-2.5" />
                    <span className="max-w-[8rem] truncate">{milestone.name}</span>
                  </Badge>
                )}
                {item.status && (
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                    {item.status}
                  </Badge>
                )}

                {milestones.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="Assign milestone"
                        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs">Milestone</DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() => onSetMilestone(item.type, item.id, null)}
                        className="text-muted-foreground"
                      >
                        <span className="flex-1">No milestone</span>
                        {!item.milestoneId && <Check className="h-3.5 w-3.5" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {milestones.map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          onSelect={() => onSetMilestone(item.type, item.id, m.id)}
                        >
                          <span className="flex-1 truncate">{m.name}</span>
                          {item.milestoneId === m.id && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <button
                  onClick={() => onDetach(item.type, item.id)}
                  aria-label="Remove from project"
                  className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editingId && (
        <ProjectItemEditor
          type={type}
          id={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </section>
  );
}
