import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Flag } from "lucide-react";
import { useMilestones, useProjectItems } from "@/hooks/useProjects";
import {
  PROJECT_ITEM_TYPES,
  ITEM_TYPE_LABELS,
  type Milestone,
  type ProjectItem,
} from "@/services/projectService";

// Stable key for a project item across the six primitive types.
function itemKey(item: Pick<ProjectItem, "type" | "id">): string {
  return `${item.type}:${item.id}`;
}

interface MilestoneEditModalProps {
  projectId: string;
  // Present when editing an existing milestone; absent when creating a new one.
  milestone?: Milestone | null;
  onClose: () => void;
}

export function MilestoneEditModal({
  projectId,
  milestone,
  onClose,
}: MilestoneEditModalProps) {
  const isEdit = !!milestone;
  const { milestones, createMilestone, updateMilestone, deleteMilestone } =
    useMilestones(projectId);
  const { items, setItemMilestone } = useProjectItems(projectId);

  const [name, setName] = useState(milestone?.name ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  // <input type="date"> wants YYYY-MM-DD; target_date is stored exactly that way.
  const [targetDate, setTargetDate] = useState(milestone?.target_date ?? "");
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Every project item, flattened across the six primitive types — the pool a
  // milestone can carry. Order follows PROJECT_ITEM_TYPES so grouping is stable.
  const allItems: ProjectItem[] = PROJECT_ITEM_TYPES.flatMap(
    (t) => items?.[t] ?? []
  );

  // Working set of items filed under this milestone, keyed by type:id. Seeded
  // from the current assignment (edit) or empty (create), then applied on save.
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !items) return;
    const initial: Record<string, boolean> = {};
    for (const item of allItems) {
      initial[itemKey(item)] = !!milestone && item.milestoneId === milestone.id;
    }
    setSelected(initial);
    setSeeded(true);
    // allItems is derived from items; keying on items is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, seeded, milestone]);

  // Names of the project's other milestones, to flag items being pulled away
  // from a milestone they already belong to.
  const milestoneName: Record<string, string> = {};
  for (const m of milestones) milestoneName[m.id] = m.name;

  const canSave = name.trim().length > 0 && !saving;

  function toggle(item: ProjectItem) {
    setSelected((prev) => ({ ...prev, [itemKey(item)]: !prev[itemKey(item)] }));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      // Save the milestone first so a freshly created one has an id to file
      // items under.
      let targetId = milestone?.id ?? null;
      if (isEdit) {
        await updateMilestone.mutateAsync({
          id: milestone.id,
          name: name.trim(),
          description: description.trim() || null,
          targetDate: targetDate || null,
        });
      } else {
        const created = await createMilestone.mutateAsync({
          projectId,
          name: name.trim(),
          description: description.trim() || null,
          targetDate: targetDate || null,
        });
        targetId = created.id;
      }

      // Apply only the assignments that changed: file newly checked items under
      // this milestone, and unfile ones that were checked before and now aren't.
      if (targetId) {
        const ops: Promise<unknown>[] = [];
        for (const item of allItems) {
          const want = !!selected[itemKey(item)];
          const had = item.milestoneId === targetId;
          if (want && !had) {
            ops.push(
              setItemMilestone.mutateAsync({
                type: item.type,
                id: item.id,
                milestoneId: targetId,
              })
            );
          } else if (!want && had) {
            ops.push(
              setItemMilestone.mutateAsync({
                type: item.type,
                id: item.id,
                milestoneId: null,
              })
            );
          }
        }
        await Promise.all(ops);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!milestone) return;
    await deleteMilestone.mutateAsync(milestone.id);
    onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="sm:max-w-lg"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit milestone" : "New milestone"}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Edit milestone details" : "Create a new milestone"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beta, v1 launch, first draft"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Target date</label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-auto"
              />
              <p className="text-xs text-muted-foreground">Optional.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does reaching this milestone mean? (optional)"
                className="min-h-[60px]"
              />
            </div>

            {/* Link items to this milestone — any primitive in the project can
                be filed under it. */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                Items
              </label>
              {allItems.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                  This project has no items yet. Add tasks, goals, or other work
                  to the project, then file them under a milestone here.
                </p>
              ) : (
                <ScrollArea className="max-h-52 rounded-md border border-border">
                  <div className="p-1.5">
                    {PROJECT_ITEM_TYPES.map((t) => {
                      const group = items?.[t] ?? [];
                      if (group.length === 0) return null;
                      return (
                        <div key={t} className="mb-1 last:mb-0">
                          <p className="px-1.5 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {ITEM_TYPE_LABELS[t]}
                          </p>
                          {group.map((item) => {
                            const key = itemKey(item);
                            const otherMilestone =
                              item.milestoneId &&
                              (!milestone || item.milestoneId !== milestone.id)
                                ? milestoneName[item.milestoneId]
                                : null;
                            return (
                              <label
                                key={key}
                                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-accent/50"
                              >
                                <Checkbox
                                  checked={!!selected[key]}
                                  onCheckedChange={() => toggle(item)}
                                />
                                <span className="flex-1 truncate text-sm text-foreground">
                                  {item.title}
                                </span>
                                {otherMilestone && (
                                  <span
                                    className="shrink-0 text-[10px] text-muted-foreground"
                                    title={`Currently filed under ${otherMilestone}`}
                                  >
                                    · {otherMilestone}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-2">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDelete(true)}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the milestone. Items filed under it are kept — they'll
              just no longer belong to a milestone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
