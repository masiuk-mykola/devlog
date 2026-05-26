# DevLog

Single-user task tracker with embedded AI agents that remove the friction of "what should I work on next," "break this task down for me," and "draft today's standup." Built as a take-home assignment.

## Quick start

```bash
npm install
cp .env.example .env       # add your ANTHROPIC_API_KEY
npm run seed               # populates ~6 sample tasks (optional but recommended)
npm run dev
```

Open http://localhost:3000.

## Architecture

- **Next.js 15 App Router** — single process. Route Handlers for CRUD + agents.
- **SQLite via `better-sqlite3`** — file at `./data/devlog.db`, journal mode WAL, foreign keys on. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`) and run on first request.
- **Anthropic Claude (`claude-sonnet-4-6`)** — `@anthropic-ai/sdk` with a custom tool-use loop in `src/agents/runner.ts`. Hard step cap of 6 iterations.
- **SSE streaming** — agent routes return `text/event-stream`; client consumes with `fetch` + reader.
- **Tailwind v4 + shadcn/ui** — component primitives generated into `components/ui/`.
- **TanStack Query** — server-state cache + invalidation for CRUD.

```
app/api/tasks/...     CRUD route handlers (sync SQLite)
app/api/agents/...    streaming agent endpoints (SSE)
src/db/               client + migrations + repository (only place with SQL)
src/agents/           runner + per-agent prompts/tools
src/schemas/          zod schemas — single source of truth for API shape
components/           UI (drawer, list, agent panels, transcript)
```

## Storage choice and limits

SQLite via `better-sqlite3` was chosen for: zero-config, file-based persistence; synchronous API that keeps Route Handlers simple; real querying for filter+sort+joins on subtasks/notes. Limits:
- Single-process only (no app server clustering). Fine for one-user scope.
- No migration tool — schema bootstraps on demand. A real product would use `drizzle-kit` or similar.
- DB file lives at `./data/devlog.db` — gitignored, recreated by `npm run seed`.

## AI agents

Three multi-step agents — the runner enforces tool round-trips and a step cap, never a single shot:

1. **Prioritizer** (`POST /api/agents/prioritize`) — calls `list_tasks` + optionally `get_task_age` to factor in staleness, returns a "start here" pick plus a ranked list.
2. **Decomposer** (`POST /api/agents/decompose`) — calls `get_task`, then branches: either `ask_clarification` (vague task → second turn after user answers) or `propose_subtasks` (clear task → editable proposal the user confirms before persisting).
3. **Standup digest** (`POST /api/agents/standup`) — synthesises `list_tasks`, `get_completed_since`, and `list_notes` into a four-section Slack-style digest with a Copy button.

If `ANTHROPIC_API_KEY` is missing, agent endpoints return HTTP 503 with `{code:"ai_not_configured"}`; the UI surfaces this. Calls are not mocked — reviewers can plug in their own keys.

## Testing

Deliberately minimal — see scope note below. Two suites:

- `src/db/repository.test.ts` — temp `:memory:` DB through `runMigrations`, exercises create/list/filter/sort/cascade-delete/notes/age.
- `src/agents/runner.test.ts` — mocked Anthropic client: verifies the tool-call loop, short-circuits on proposal tools, and respects the step cap.

Run with `npm run test`.

## What I didn't build, and why

- **Auth, multi-user, teams** — explicitly out of scope per the brief.
- **Real-time sync** — overkill for one user.
- **Drag-and-drop reordering** — status is the order signal.
- **Tags, labels, due dates, assignees** — would have stretched the data model and AI prompts without adding to the agent demo.
- **Kanban / calendar views** — list + filter covers the assignment.
- **UI tests (Playwright)** — manual verification; tests focused on the highest-risk surfaces (repository + agent loop).
- **Deployment configuration** — local-only per assignment.
- **A fourth AI agent variant** — three is enough to demonstrate range.

## Scripts

```
npm run dev         # next dev (Turbopack)
npm run build       # next build
npm run start       # next start
npm run seed        # populate sample tasks
npm run test        # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```
