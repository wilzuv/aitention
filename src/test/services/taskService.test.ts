import { describe, expect, it } from "vitest";
import { parseTask, buildUpdatePayload, buildInsertPayload } from "@/services/taskService";

describe("parseTask", () => {
  it("parses a full task row into a Task", () => {
    const row = {
      id: "abc-123",
      title: "Test task",
      status: "open",
      priority: 3,
      due_date: "2026-04-01",
      scheduled_date: "2026-03-26",
      goal_id: "goal-1",
      estimated_minutes: 30,
      actual_minutes: 15,
      success_criteria: "Ship it",
      notes: "Some notes",
      reflection: null,
      recurrence_rule: { type: "daily" },
      schedule_history: [{ from: "2026-03-25", to: "2026-03-26", changed_at: "2026-03-25T10:00:00Z" }],
      completed_at: null,
      discarded_at: null,
      created_at: "2026-03-20T00:00:00Z",
      updated_at: "2026-03-25T00:00:00Z",
      postponed_to: null,
      user_id: "user-1",
    };

    const task = parseTask(row as never);
    expect(task.id).toBe("abc-123");
    expect(task.priority).toBe(3);
    expect(task.actual_minutes).toBe(15);
    expect(task.schedule_history).toHaveLength(1);
    expect(task.recurrence_rule).toEqual({ type: "daily" });
  });

  it("defaults nullable fields", () => {
    const row = {
      id: "abc-456",
      title: "Minimal",
      status: "open",
      priority: null,
      due_date: null,
      scheduled_date: null,
      goal_id: null,
      estimated_minutes: null,
      actual_minutes: null,
      success_criteria: null,
      notes: null,
      reflection: null,
      recurrence_rule: null,
      schedule_history: null,
      completed_at: null,
      discarded_at: null,
      created_at: "2026-03-20T00:00:00Z",
      updated_at: "2026-03-20T00:00:00Z",
      postponed_to: null,
      user_id: "user-1",
    };

    const task = parseTask(row as never);
    expect(task.priority).toBe(2);
    expect(task.actual_minutes).toBe(0);
    expect(task.schedule_history).toEqual([]);
    expect(task.recurrence_rule).toBeNull();
  });
});

describe("buildUpdatePayload", () => {
  it("auto-sets completed_at when status is done", () => {
    const payload = buildUpdatePayload({ status: "done" });
    expect(payload.status).toBe("done");
    expect(payload.completed_at).toBeDefined();
    expect(typeof payload.completed_at).toBe("string");
  });

  it("auto-sets discarded_at when status is discarded", () => {
    const payload = buildUpdatePayload({ status: "discarded" });
    expect(payload.discarded_at).toBeDefined();
  });

  it("does not override explicit completed_at", () => {
    const explicit = "2026-01-01T00:00:00Z";
    const payload = buildUpdatePayload({ status: "done", completed_at: explicit });
    expect(payload.completed_at).toBe(explicit);
  });

  it("only includes fields that are present in updates", () => {
    const payload = buildUpdatePayload({ title: "New title" });
    expect(payload.title).toBe("New title");
    expect(payload.status).toBeUndefined();
    expect(payload.priority).toBeUndefined();
  });
});

describe("buildInsertPayload", () => {
  it("defaults optional fields", () => {
    const payload = buildInsertPayload({ title: "Test" });
    expect(payload.title).toBe("Test");
    expect(payload.status).toBe("open");
    expect(payload.priority).toBe(2);
  });
});
