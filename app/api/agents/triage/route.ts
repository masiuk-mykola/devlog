import { NextResponse } from "next/server";
import { runAgent } from "@/src/agents/runner";
import {
  buildTriageTools,
  extractTriageProposal,
  TRIAGE_SYSTEM,
} from "@/src/agents/triage";
import { getAnthropic, MODEL } from "@/src/lib/anthropic";
import { frame, sseResponse, type SseEvent } from "@/src/lib/sse";

export async function POST() {
  let client;
  try {
    client = getAnthropic();
  } catch {
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
          client,
          model: MODEL,
          system: TRIAGE_SYSTEM,
          user: "Scan the backlog and triage any unhealthy tasks.",
          tools: buildTriageTools(),
          maxIterations: 6,
          emit,
        });

        if (result.kind === "proposal" && result.name === "propose_triage_actions") {
          const proposal = extractTriageProposal(result.input);
          emit({ event: "final", data: proposal ?? { items: [] } });
        } else if (result.kind === "complete") {
          emit({ event: "final", data: { items: [] } });
        } else if (result.kind === "step_cap_exceeded") {
          emit({
            event: "error",
            data: { code: "agent_step_cap_exceeded", message: "Agent exceeded step cap" },
          });
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
