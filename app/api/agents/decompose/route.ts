import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/src/agents/runner";
import { buildDecomposeTools, DECOMPOSE_SYSTEM } from "@/src/agents/decompose";
import { getAnthropic, MODEL } from "@/src/lib/anthropic";
import { frame, sseResponse, type SseEvent } from "@/src/lib/sse";

const BodySchema = z.object({
  taskId: z.string(),
  clarificationAnswers: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: NextRequest) {
  let client;
  try {
    client = getAnthropic();
  } catch {
    return NextResponse.json(
      { error: { code: "ai_not_configured", message: "Set ANTHROPIC_API_KEY in .env" } },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: { code: "bad_request", message: (e as Error).message } },
      { status: 400 },
    );
  }
  const { taskId, clarificationAnswers } = parsed;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: SseEvent) => controller.enqueue(frame(ev));
      try {
        const userMessage = clarificationAnswers
          ? `Decompose task ${taskId}. The user answered your clarifying questions:\n${JSON.stringify(
              clarificationAnswers,
              null,
              2,
            )}\nUse these answers to call propose_subtasks now.`
          : `Decompose task ${taskId}.`;

        const result = await runAgent({
          client,
          model: MODEL,
          system: DECOMPOSE_SYSTEM,
          user: userMessage,
          tools: buildDecomposeTools(),
          maxIterations: 6,
          emit,
        });

        if (result.kind === "proposal") {
          if (result.name === "ask_clarification") {
            const d = result.input as { questions: string[] };
            emit({ event: "needs_clarification", data: { questions: d.questions } });
          } else if (result.name === "propose_subtasks") {
            emit({ event: "final", data: result.input });
          }
        } else if (result.kind === "step_cap_exceeded") {
          emit({
            event: "error",
            data: { code: "agent_step_cap_exceeded", message: "Agent exceeded step cap" },
          });
        } else {
          emit({ event: "final", data: { raw: (result as { text: string }).text } });
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
