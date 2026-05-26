"use client";
import { useState } from "react";
import { PrioritizePanel } from "@/components/prioritize-panel";
import { TaskList } from "@/components/task-list";

export default function Home() {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DevLog</h1>
          <p className="text-sm text-muted-foreground">Tasks, sharpened by an AI agent.</p>
        </div>
        <div className="flex gap-2">
          <PrioritizePanel onPickTask={(id) => setOpenTaskId(id)} />
          {/* StandupPanel mounts here in Task 14 */}
        </div>
      </header>
      <TaskList externalOpenTaskId={openTaskId} onExternalClose={() => setOpenTaskId(null)} />
    </main>
  );
}
