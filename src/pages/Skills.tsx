import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUserSkills } from "@/hooks/useUserSkills";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

function NewSkillForm({
  onSave,
  onCancel,
  isSaving,
}: {
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const nameError =
    name.length > 0 && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
      ? "Use kebab-case (lowercase letters, numbers, hyphens)"
      : null;

  const canSave =
    name.length > 0 && content.length > 0 && !nameError && !isSaving;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Skill name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="my-custom-skill"
          className="font-mono text-sm"
        />
        {nameError && (
          <p className="text-xs text-destructive">{nameError}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Content</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          placeholder="Write your skill instructions here..."
          className="font-mono text-xs resize-y"
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => onSave(name, content)}
          disabled={!canSave}
          size="sm"
        >
          Create skill
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1 h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

const Skills = () => {
  const { skills, isLoading, upsert, remove } = useUserSkills();
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const customSkills = skills.filter((s) => !s.is_override);

  const handleCreateCustom = (name: string, content: string) => {
    upsert.mutate(
      { skill_name: name, content, is_override: false },
      {
        onSuccess: () => {
          toast.success(`Skill "${name}" created`);
          setShowNewForm(false);
        },
        onError: (e) => toast.error(`Failed to create: ${e.message}`),
      },
    );
  };

  const handleSaveCustomEdit = (skillName: string) => {
    upsert.mutate(
      { skill_name: skillName, content: editValue, is_override: false },
      {
        onSuccess: () => {
          toast.success(`Skill "${skillName}" saved`);
          setEditingCustom(null);
        },
        onError: (e) => toast.error(`Failed to save: ${e.message}`),
      },
    );
  };

  const handleDeleteCustom = (skillName: string) => {
    remove.mutate(skillName, {
      onSuccess: () => toast.success(`Skill "${skillName}" deleted`),
      onError: (e) => toast.error(`Failed to delete: ${e.message}`),
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <h1 className="mb-2 font-display text-2xl font-bold tracking-tight text-foreground">
        Skills
      </h1>
      <p className="mb-10 text-sm text-muted-foreground">
        Create your own skills the agent can load with read_skill.
      </p>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Custom Skills
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your own skills that the agent can load with read_skill.
            </p>
          </div>
          {!showNewForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewForm(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New skill
            </Button>
          )}
        </div>

        {showNewForm && (
          <NewSkillForm
            onSave={handleCreateCustom}
            onCancel={() => setShowNewForm(false)}
            isSaving={upsert.isPending}
          />
        )}

        {customSkills.length === 0 && !showNewForm && (
          <p className="text-sm text-muted-foreground italic">
            No custom skills yet.
          </p>
        )}

        {customSkills.map((skill) => (
          <div
            key={skill.id}
            className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <code className="text-sm font-semibold">{skill.skill_name}</code>
              <div className="flex gap-1">
                {editingCustom !== skill.skill_name && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingCustom(skill.skill_name);
                      setEditValue(skill.content);
                    }}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteCustom(skill.skill_name)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {editingCustom === skill.skill_name ? (
              <div className="space-y-3">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={12}
                  className="font-mono text-xs resize-y"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveCustomEdit(skill.skill_name)}
                    disabled={editValue === skill.content || upsert.isPending}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCustom(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground line-clamp-3 font-mono whitespace-pre-wrap">
                {skill.content}
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};

export default Skills;
