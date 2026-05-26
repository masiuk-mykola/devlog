import { getDb } from "./client";
import { createRepository } from "./repository";

const repo = createRepository(getDb());

const seedTasks: Array<{ title: string; description: string; status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high" }> = [
  { title: "Investigate flaky CI on PR-checks workflow", description: "Job fails intermittently on tsc step. Logs cut off mid-output.", status: "in_progress", priority: "high" },
  { title: "Refactor billing module", description: "", status: "todo", priority: "medium" },
  { title: "Write postmortem for last week's payments outage", description: "Stripe webhook handler timed out. Need to document timeline and remediation.", status: "todo", priority: "high" },
  { title: "Bump Node to 22 across all services", description: "Test runner, prod runtime, CI image.", status: "todo", priority: "low" },
  { title: "Ship dark mode toggle", description: "Tailwind theme switch + persisted preference.", status: "done", priority: "medium" },
  { title: "Investigate slow dashboard queries", description: "p95 above 800ms on the team-overview endpoint. Suspect missing index on events.created_at.", status: "in_progress", priority: "high" },
];

for (const t of seedTasks) repo.createTask(t);

console.log(`Seeded ${seedTasks.length} tasks into ${process.env.DATABASE_PATH ?? "./data/devlog.db"}`);
process.exit(0);
