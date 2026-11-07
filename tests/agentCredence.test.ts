import { describe, it, expect, vi } from "vitest";
import { WRITE_HANDLERS } from "../supabase/functions/mcp/writeTools";
const append = WRITE_HANDLERS.aitention_append_agent_credence;
const payload = {
  hypothesis_id: "hypothesis",
  expected_revision: null,
  posterior_credence: 40,
  rationale: "Base rate and new evidence",
  source_references: ["source:1"],
  writer_id: "decision-watch",
  run_id: "run-1",
  idempotency_key: "event-1",
};
function client(existing: unknown, insertError: unknown = null) {
  const insert = vi.fn(() => ({
    select: () => ({
      single: async () => ({ data: payload, error: insertError }),
    }),
  }));
  const chain = {
    eq: () => chain,
    maybeSingle: async () => ({ data: existing, error: null }),
  };
  return { from: vi.fn(() => ({ select: () => chain, insert })), insert };
}
describe("independent agent credences", () => {
  it("rejects fabricated precision outside the probability bounds before writing", async () => {
    const c = client(null);
    await expect(
      append(c as never, { ...payload, posterior_credence: 101 }),
    ).rejects.toThrow();
    expect(c.insert).not.toHaveBeenCalled();
  });
  it("returns an existing same-content assessment without another insert", async () => {
    const c = client({ ...payload, id: "assessment" });
    expect(await append(c as never, payload)).toMatchObject({ created: false });
    expect(c.insert).not.toHaveBeenCalled();
  });
  it("rejects a reused event key with changed content", async () => {
    const c = client({ ...payload, posterior_credence: 80 });
    await expect(append(c as never, payload)).rejects.toThrow(
      /different content/,
    );
  });
  it("recovers an uncertain duplicate insert by reading the exact event", async () => {
    let reads = 0;
    const c = client(null, { code: "23505" });
    const chain = {
      eq: () => chain,
      maybeSingle: async () => ({
        data: ++reads === 1 ? null : { ...payload, id: "assessment" },
        error: null,
      }),
    };
    c.from.mockImplementation(() => ({
      select: () => chain,
      insert: c.insert,
    }));
    expect(await append(c as never, payload)).toMatchObject({ created: false });
  });
});
