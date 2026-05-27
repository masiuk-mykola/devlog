# DevLog — Claude working notes

## Next.js 16

This project runs on **Next.js 16.2.6** (App Router + Turbopack). The framework has breaking changes from older versions — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers, middleware, async APIs, metadata, or anything app-shape.

Notable in-repo gotchas:
- Dynamic route params are `Promise<{...}>` and must be awaited (see `app/api/tasks/[id]/route.ts`).
- `next lint` no longer exists; run `npx eslint <paths>` directly.
- Components reading `useSearchParams()` must sit inside a `<Suspense>` boundary, otherwise prerender fails.

## Commands

```
npm run dev         # next dev --turbopack
npm run build       # next build (verifies prerender + Suspense boundaries)
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (repository + agent runner)
npm run seed        # populate ~6 sample tasks
npx eslint <paths>  # lint (npm run lint is broken in Next 16)
```

## Verifying UI changes

For any UI-affecting work, drive the app in a real browser before declaring done. The Playwright MCP is installed and usable — `mcp__plugin_playwright_playwright__browser_navigate`, `_snapshot`, `_click`, `_type`, `_press_key`, `_take_screenshot`. Typecheck and tests verify code correctness, not feature correctness; the Playwright loop verifies feature correctness.

When verifying:
1. `npm run dev` (background).
2. Navigate to `http://localhost:3000`, snapshot to get refs.
3. Drive the golden path (open dialog, fill form, submit, verify side-effects in URL / API / DOM).
4. Verify edge cases relevant to the change (empty state, error state, optimistic state).

## AI agents

`ANTHROPIC_API_KEY` must be in `.env.local` for the three agent endpoints (`/api/agents/prioritize`, `/api/agents/decompose`, `/api/agents/standup`). Without it, route handlers return HTTP 503 with `{code:"ai_not_configured"}` and the UI surfaces this inline.

Model is fixed at `claude-sonnet-4-6` (`src/lib/anthropic.ts`). The runner (`src/agents/runner.ts`) is hand-written, not `client.beta.messages.toolRunner`, so proposal tools (`ask_clarification`, `propose_subtasks`) can short-circuit the LLM loop and surface their input as an SSE event for client-side confirmation.

## Coding rules

See `.claude/rules/` (common + typescript). Highlights: immutability, many small files (<400 lines), validate at boundaries with Zod, no `console.log`, no `any`.
