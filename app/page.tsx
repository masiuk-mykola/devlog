import { Suspense } from "react";
import { PrioritizePanel } from "@/components/prioritize-panel";
import { StandupPanel } from "@/components/standup-panel";
import { TaskList } from "@/components/task-list";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DevLog</h1>
          <p className="text-sm text-muted-foreground">Tasks, sharpened by an AI agent.</p>
        </div>
        <Suspense fallback={<div className="flex gap-2" />}>
          <div className="flex gap-2">
            <PrioritizePanel />
            <StandupPanel />
          </div>
        </Suspense>
      </header>
      <Suspense fallback={null}>
        <TaskList />
      </Suspense>
    </main>
  );
}
