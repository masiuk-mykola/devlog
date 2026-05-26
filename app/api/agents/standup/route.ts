import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/src/agents/runner";
import { buildStandupTools, STANDUP_SYSTEM, extractMarkdown } from "@/src/agents/standup";
import { getAnthropic, MODEL } from "@/src/lib/anthropic";
import { frame, sseResponse, type SseEvent } from "@/src/lib/sse";

const BodySchema = z.object({ sinceHours: z.number().int().positive().max(24 * 14).optional() });

export async function POST(req: NextRequest) {
  let client;
  try { client = getAnthropic(); }
  catch {
    return NextResponse.json(
      { error: { code: "ai_not_configured", message: "Set ANTHROPIC_API_KEY in .env" } },
      { status: 503 },
    );
  }
  const body = BodySchema.parse(await req.json().catch(() => ({})));
  const sinceHours = body.sinceHours ?? 24;
  const sinceMs = Date.now() - sinceHours * 3_600_000;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: SseEvent) => controller.enqueue(frame(ev));
      try {
        const result = await runAgent({
          client, model: MODEL, system: STANDUP_SYSTEM,
          user: `Write a standup digest covering the last ${sinceHours} hours (sinceMs=${sinceMs}).`,
          tools: buildStandupTools(sinceMs), maxIterations: 6, emit,
        });
        if (result.kind === "complete") {
          const md = extractMarkdown(result.text);
          emit({ event: "final", data: { markdown: md ?? result.text } });
        } else if (result.kind === "step_cap_exceeded") {
          emit({ event: "error", data: { code: "agent_step_cap_exceeded", message: "Agent exceeded step cap" } });
        }
        emit({ event: "done", data: {} });
      } catch (err) {
        emit({ event: "error", data: { code: "agent_error", message: (err as Error).message } });
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
