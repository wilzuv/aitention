import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ValenceArousalPicker } from "@/components/today/ValenceArousalPicker";

export function MoodCheckInDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (mood: number | null, energy: number | null, note: string | null) => void;
}) {
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const handleSave = () => {
    if (mood === null && energy === null) return;
    onSave(mood, energy, note.trim() || null);
    setMood(null);
    setEnergy(null);
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mood check-in</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ValenceArousalPicker type="valence" value={mood} onChange={setMood} />
          <ValenceArousalPicker type="arousal" value={energy} onChange={setEnergy} />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={mood === null && energy === null}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
