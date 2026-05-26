import type Anthropic from "@anthropic-ai/sdk";
import type { SseEvent } from "@/src/lib/sse";
import { toAnthropicTool, type AgentTool } from "./tools";

export type RunResult =
  | { kind: "complete"; text: string }
  | { kind: "proposal"; name: string; input: unknown }
  | { kind: "step_cap_exceeded" };

export type RunArgs = {
  client: Anthropic;
  model: string;
  system: string;
  user: string;
  tools: AgentTool<unknown>[];
  maxIterations: number;
  emit: (ev: SseEvent) => void;
};

type AnyBlock = { type: string; [k: string]: unknown };

export async function runAgent(args: RunArgs): Promise<RunResult> {
  const { client, model, system, user, tools, maxIterations, emit } = args;
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const anthropicTools = tools.map((t) => toAnthropicTool(t));

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [{ role: "user", content: user }];

  for (let step = 0; step < maxIterations; step++) {
    const resp = await client.messages.create({
      model,
      max_tokens: 1500,
      system,
      messages: messages as never,
      tools: anthropicTools as never,
    });
    const content: AnyBlock[] = ((resp as unknown as { content: AnyBlock[] }).content) ?? [];

    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string") {
        emit({ event: "text_delta", data: { text: block.text as string } });
      }
    }

    const toolUses = content.filter((b) => b.type === "tool_use");
    const stopReason = (resp as unknown as { stop_reason?: string }).stop_reason;
    if (toolUses.length === 0 || stopReason === "end_turn") {
      const text = content
        .filter((b) => b.type === "text")
        .map((b) => (b as unknown as { text: string }).text)
        .join("\n");
      return { kind: "complete", text };
    }

    // Proposal short-circuit
    for (const tu of toolUses) {
      const tool = toolsByName.get(tu.name as string);
      if (tool?.isProposal) {
        emit({ event: "tool_use", data: { name: tu.name as string, input: tu.input } });
        return { kind: "proposal", name: tu.name as string, input: tu.input };
      }
    }

    messages.push({ role: "assistant", content });
    const toolResults: unknown[] = [];
    for (const tu of toolUses) {
      emit({ event: "tool_use", data: { name: tu.name as string, input: tu.input } });
      const tool = toolsByName.get(tu.name as string);
      if (!tool) {
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `unknown tool: ${tu.name}` });
        continue;
      }
      try {
        const output = await tool.run(tu.input as never);
        emit({ event: "tool_result", data: { name: tu.name as string, output } });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(output) });
      } catch (e) {
        emit({ event: "tool_result", data: { name: tu.name as string, output: { error: (e as Error).message } } });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: (e as Error).message });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { kind: "step_cap_exceeded" };
}
