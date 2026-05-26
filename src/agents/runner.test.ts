import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runAgent } from "./runner";
import type { AgentTool } from "./tools";

type FakeBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

function fakeAnthropic(responses: Array<{ stop_reason: "tool_use" | "end_turn"; content: FakeBlock[] }>) {
  let i = 0;
  return {
    messages: {
      create: vi.fn(async () => responses[i++] ?? responses[responses.length - 1]),
    },
  };
}

const listTasks: AgentTool<{ status?: string }> = {
  name: "list_tasks",
  description: "lists tasks",
  input_schema: z.object({ status: z.string().optional() }),
  run: () => [{ id: "1", title: "first" }],
};

const proposeFoo: AgentTool<{ items: string[] }> = {
  name: "propose_foo",
  description: "proposal",
  input_schema: z.object({ items: z.array(z.string()) }),
  run: (input) => input,
  isProposal: true,
};

describe("runAgent", () => {
  it("calls tools and returns final text on end_turn", async () => {
    const client = fakeAnthropic([
      { stop_reason: "tool_use", content: [
        { type: "tool_use", id: "u1", name: "list_tasks", input: {} },
      ] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "ok done" }] },
    ]);
    const events: { event: string; data: unknown }[] = [];
    const result = await runAgent({
      client: client as unknown as Parameters<typeof runAgent>[0]["client"],
      model: "test", system: "sys", user: "go",
      tools: [listTasks as AgentTool<unknown>], maxIterations: 4,
      emit: (e) => events.push(e),
    });
    expect(result.kind).toBe("complete");
    expect(events.some((e) => e.event === "tool_use" && (e.data as { name: string }).name === "list_tasks")).toBe(true);
    expect(events.some((e) => e.event === "tool_result")).toBe(true);
  });

  it("emits a proposal and ends without a follow-up LLM call", async () => {
    const client = fakeAnthropic([
      { stop_reason: "tool_use", content: [
        { type: "tool_use", id: "u1", name: "propose_foo", input: { items: ["a", "b"] } },
      ] },
    ]);
    const events: { event: string; data: unknown }[] = [];
    const result = await runAgent({
      client: client as unknown as Parameters<typeof runAgent>[0]["client"],
      model: "test", system: "sys", user: "go",
      tools: [proposeFoo as AgentTool<unknown>], maxIterations: 4,
      emit: (e) => events.push(e),
    });
    expect(result.kind).toBe("proposal");
    if (result.kind === "proposal") expect(result.name).toBe("propose_foo");
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("respects the step cap", async () => {
    const client = fakeAnthropic([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "u1", name: "list_tasks", input: {} }] },
    ]);
    const events: { event: string; data: unknown }[] = [];
    const result = await runAgent({
      client: client as unknown as Parameters<typeof runAgent>[0]["client"],
      model: "test", system: "sys", user: "go",
      tools: [listTasks as AgentTool<unknown>], maxIterations: 2,
      emit: (e) => events.push(e),
    });
    expect(result.kind).toBe("step_cap_exceeded");
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });
});
