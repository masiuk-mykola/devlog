import { z } from "zod";

export type AgentTool<I> = {
  name: string;
  description: string;
  input_schema: z.ZodType<I>;
  /** Read-only DB tools execute and return data. Proposal tools return null so the runner emits a special SSE event instead of continuing. */
  run: (input: I) => Promise<unknown> | unknown;
  /** When true, calling this tool ends the loop and the input is surfaced to the client. */
  isProposal?: boolean;
};

export function toAnthropicTool<I>(t: AgentTool<I>) {
  return {
    name: t.name,
    description: t.description,
    input_schema: z.toJSONSchema(t.input_schema) as Record<string, unknown>,
  };
}
