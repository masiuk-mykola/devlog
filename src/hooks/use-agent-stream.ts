"use client";
import { useCallback, useRef, useState } from "react";
import type { SseEvent } from "@/src/lib/sse";

type Status = "idle" | "running" | "done" | "error";

export function useAgentStream() {
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const ctrlRef = useRef<AbortController | null>(null);

  const start = useCallback(async (url: string, body: unknown) => {
    setEvents([]); setStatus("running");
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setEvents((e) => [...e, { event: "error", data: { code: "request_failed", message: (j as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}` } }]);
        setStatus("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const f of frames) {
          const evMatch = f.match(/^event: (.+)$/m);
          const dataMatch = f.match(/^data: (.+)$/m);
          if (!evMatch || !dataMatch) continue;
          try {
            const ev = { event: evMatch[1].trim(), data: JSON.parse(dataMatch[1]) } as SseEvent;
            setEvents((prev) => [...prev, ev]);
            if (ev.event === "done") setStatus("done");
            if (ev.event === "error") setStatus("error");
          } catch { /* ignore malformed frame */ }
        }
      }
      setStatus((s) => (s === "running" ? "done" : s));
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setEvents((p) => [...p, { event: "error", data: { code: "client_error", message: (e as Error).message } }]);
        setStatus("error");
      }
    }
  }, []);

  const cancel = useCallback(() => ctrlRef.current?.abort(), []);
  return { events, status, start, cancel };
}
