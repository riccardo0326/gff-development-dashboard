"use client";

import { Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PriorityBadge } from "@/components/priority-badge";
import { Button, SelectInput } from "@/components/ui";

export function EcuPriorityEditor({
  ecuId,
  priority,
  onUpdated,
}: {
  ecuId: string;
  priority: number;
  onUpdated: (priority: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(priority));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/ecus/${ecuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: Number(value) }),
      });
      if (!response.ok) {
        toast.error("Could not update priority");
        return;
      }
      const payload = (await response.json()) as { ecu: { priority: number } };
      onUpdated(payload.ecu.priority);
      setEditing(false);
      toast.success("Priority updated");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <SelectInput
          value={value}
          onChange={setValue}
          options={[
            { value: "1", label: "PRIO 1" },
            { value: "2", label: "PRIO 2" },
            { value: "3", label: "PRIO 3" },
          ]}
        />
        <Button disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setValue(String(priority));
            setEditing(false);
          }}
          className="text-muted hover:text-foreground rounded-lg p-1 hover:bg-white/5"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PriorityBadge priority={priority} />
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted hover:text-foreground rounded-lg p-1 hover:bg-white/5"
        aria-label={`Edit priority for ${ecuId}`}
        title="Edit priority"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
