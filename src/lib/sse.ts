export type SseEvent =
  | { event: "text_delta"; data: { text: string } }
  | { event: "tool_use"; data: { name: string; input: unknown } }
  | { event: "tool_result"; data: { name: string; output: unknown } }
  | { event: "needs_clarification"; data: { questions: string[] } }
  | { event: "final"; data: unknown }
  | { event: "error"; data: { code: string; message: string } }
  | { event: "done"; data: object };

const encoder = new TextEncoder();

export function frame(ev: SseEvent): Uint8Array {
  return encoder.encode(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`);
}

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      Connection: "keep-alive",
    },
  });
}
