import { runAgent } from "@/src/agents/runner";
import { buildPrioritizeTools, PRIORITIZE_SYSTEM, extractFinalJson } from "@/src/agents/prioritize";
import { getAnthropic, MODEL } from "@/src/lib/anthropic";
import { frame, sseResponse, type SseEvent } from "@/src/lib/sse";
import { NextResponse } from "next/server";

export async function POST() {
  let client;
  try { client = getAnthropic(); }
  catch {
    return NextResponse.json(
      { error: { code: "ai_not_configured", message: "Set ANTHROPIC_API_KEY in .env" } },
      { status: 503 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: SseEvent) => controller.enqueue(frame(ev));
      try {
        const result = await runAgent({
          client, model: MODEL, system: PRIORITIZE_SYSTEM,
          user: "Look at my tasks and tell me what to start with today. Justify the pick.",
          tools: buildPrioritizeTools(), maxIterations: 6, emit,
        });
        if (result.kind === "complete") {
          const parsed = extractFinalJson(result.text);
          emit({ event: "final", data: parsed ?? { raw: result.text } });
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
