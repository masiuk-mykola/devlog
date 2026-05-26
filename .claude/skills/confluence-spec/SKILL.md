---
name: confluence-spec
description: Fetch a Confluence page (spec, acceptance criteria, design doc, runbook) via the Atlassian MCP, extract every numbered/bulleted requirement into a checklist, then implement against the doc point-by-point without skipping, merging, or paraphrasing items. Use this skill whenever the user pastes a Confluence URL (atlassian.net/wiki/...), a Confluence pageId, or asks to "implement per the doc", "follow the spec", "go through the doc point by point", "do everything from the Confluence page", "here's the doc in Confluence", "implement the acceptance criteria", "per the spec" — even if they don't say the word "Confluence" explicitly. Also triggers on phrases like "check I didn't miss anything from the page", "cross-check with the doc", "per the technical description", or any request that references a doc page when an Atlassian Confluence link is in scope.
---

# Confluence-driven implementation

The user's source of truth is a Confluence page (spec / acceptance criteria / design doc). The goal of this skill is to make sure **every requirement on that page is read, tracked, and implemented — none skipped, none merged into "I already did that", none paraphrased into something looser than what's written**.

The reason this matters: specs in Confluence frequently contain checklist items that look redundant or implied but actually encode a concrete behavior the QA or product owner will verify. Silently dropping one ("the empty state is identical to the loading state") leads to rework. Treat the doc as a contract.

## When this triggers

- User pastes a Confluence URL (anything matching `*.atlassian.net/wiki/spaces/...` or `*.atlassian.net/wiki/...pages/<id>`).
- User mentions a pageId, a doc name, or says "per the spec / per the doc / by the requirements / point by point".
- A Jira ticket the user is working on links to a Confluence page — open it before starting (the ticket description is usually a summary; the doc has the real list).

If a Figma URL is also referenced, fetch designs separately via the Figma MCP after the Confluence requirements are captured — the doc dictates *what*, Figma dictates *how it looks*.

---

## Step 1 — Resolve the page

### From a URL

Confluence URLs come in a few shapes. Extract the pageId (it's the digit run after `/pages/`):

| URL shape | pageId source |
|---|---|
| `…/wiki/spaces/<SPACE>/pages/<pageId>/<slug>` | the `<pageId>` segment |
| `…/wiki/spaces/<SPACE>/pages/<pageId>` | same |
| `…/wiki/x/<shortcode>` | follow the redirect — the short link expands to one of the forms above |

If the URL lacks a numeric pageId (it's a tinyurl/shortcode like `/wiki/x/AbCdEf`), call `mcp__claude_ai_Atlassian_Rovo__fetch` on the URL and parse the resulting page metadata to recover the real pageId.

### From a description ("the doc about onboarding flow")

Use `mcp__claude_ai_Atlassian_Rovo__searchConfluenceUsingCql` with a CQL query like:

```
type = "page" AND title ~ "onboarding flow" AND space = "I4F"
```

Show the top 3 matches to the user and confirm which one before fetching — picking the wrong page wastes work.

### Get cloudId (needed by every Atlassian MCP call)

```
mcp__claude_ai_Atlassian_Rovo__getAccessibleAtlassianResources
```

Cache the cloudId for the rest of the session — it doesn't change.

---

## Step 2 — Fetch page contents and comments

A spec is more than the body. Inline comments often contain the latest amendment ("scratch point 4, do it like this instead"). Footer comments contain reviewer asks. **Read all three before declaring you understand the doc.**

```
mcp__claude_ai_Atlassian_Rovo__getConfluencePage              # body
mcp__claude_ai_Atlassian_Rovo__getConfluencePageInlineComments # inline edits / amendments
mcp__claude_ai_Atlassian_Rovo__getConfluencePageFooterComments # reviewer Q&A
```

If the page has child pages (`getConfluencePageDescendants`), the spec is probably split across them — confirm with the user whether the children are in scope before fetching everything.

If any comment contradicts the body, **the comment wins if it's newer than the body's last edit** — but flag the contradiction to the user explicitly before implementing the comment's version. Don't silently pick a side.

---

## Step 3 — Extract a flat checklist of requirements

This is the most important step. Build a numbered list where **one Confluence item = one checklist item**. Do not merge, do not paraphrase aggressively, do not drop items because they "look obvious".

What counts as a requirement:

- Bulleted/numbered list items under headings like `Acceptance Criteria`, `Requirements`, `Scope`, `Out of scope` (negation is also a requirement — "must NOT do X"), `Edge cases`, `Validation`, `Errors`, `States`, `Non-functional requirements`.
- Checkbox items (`☐`) — preserve their order.
- Imperative sentences in prose paragraphs: "The button should be disabled while loading." Each such sentence is one item.
- Field-level rules in tables (one cell often = one rule). Field name + rule = one item.
- Implicit-but-stated constraints near a heading like "Performance" or "Accessibility": "Form must be keyboard-navigable."

What does **not** count:

- Background / context paragraphs ("This feature exists because…").
- Links to other docs (those are pointers, not requirements — open them separately if needed).
- Screenshots without accompanying text (open them, but the spec is the text).

### Output format

Materialize the checklist with the TaskCreate tool (one task per requirement) so progress is visible. Each task subject must quote the spec verbatim where possible — paraphrase only when shortening for readability, and keep the original wording in the description. Example:

```
Task: Disable Submit while the form is submitting
Description: From doc §3.2 — "The Submit button must be disabled and show a spinner from the moment the user clicks it until the mutation resolves."
```

If the doc has 14 acceptance criteria, the TaskList should have 14 tasks. If it has 14 ACs and you produced 9 tasks, something was merged or dropped — re-read.

---

## Step 4 — Implement point-by-point, in order

The order on the page is usually meaningful (data → UI → states → errors → analytics). Implement in the doc's order unless there's a hard technical dependency that forces a different sequence — in that case, note the reordering in chat so the user can sanity-check it.

For each task:

1. `TaskUpdate` it to `in_progress` before writing any code for it.
2. Implement the smallest change that satisfies *that one requirement*. Don't bundle "while I'm here" changes.
3. Verify against the doc's wording. If the doc says "shows error toast", a console.error doesn't satisfy it.
4. `TaskUpdate` to `completed`.

Don't batch completions. Mark each one done as it's done — that way the user can stop you mid-stream if something diverged.

---

## Step 5 — Verify nothing was dropped

Before declaring the work finished, do a literal diff between the checklist and the doc:

1. Re-read the page (or the section you scoped to).
2. For each top-level requirement on the page, point to the corresponding completed task.
3. If a doc item has no matching task, you missed it — add and implement it now.
4. If a task has no matching doc item, you invented scope — confirm with the user whether to keep it.

Report the audit in chat as a compact table:

```
Doc §       | Requirement (short)              | Task # | Status
------------|----------------------------------|--------|----------
3.1         | New password ≥ 8 chars           | 4      | done
3.2         | Show server-side error inline    | 5      | done
3.3         | Disable submit while pending     | 6      | done
```

This is the moment to catch silent drops. Don't skip it.

---

## Step 6 — Tie the work back to the doc (and Jira, if applicable)

- **Commit message:** if the work is tied to a Jira ticket (the usual case in this repo — see the `I4F-<num>:` prefix in `git log`), the Jira key remains the prefix. Reference the Confluence page in the PR description, not the commit subject. Use a permalink (the URL that includes the pageId) so it survives a page rename.
- **PR description:** include the audit table from Step 5. Reviewers shouldn't have to re-derive the mapping between doc and diff.

---

## Anti-patterns (things that look helpful but aren't)

- **"I'll just implement the gist and we can refine later."** The gist is what the doc rejects — the doc exists because the gist already wasn't enough. Treat every bullet as load-bearing until proven otherwise.
- **Inferring "obviously they also meant X".** If the doc doesn't say X, ask before adding it. Inferred scope often duplicates work or contradicts a constraint elsewhere in the doc.
- **Closing tasks based on "covered by a previous task".** If two doc items resolve to the same code change, both tasks get completed and the description notes the overlap. Closing one as `deleted` makes Step 5's audit lie.
- **Reading only the heading hierarchy.** Specs frequently put the real rules inside table cells or inline comments. Always open the comments endpoints.
- **Skipping Step 5 because "I obviously did everything".** Step 5 is cheap and catches the one bullet that didn't fit anywhere — which is usually the one QA will fail you on.

---

## Quick checklist before declaring the doc done

- [ ] Page fetched via `getConfluencePage` (not just from memory of an earlier session)
- [ ] Inline + footer comments fetched and reconciled with the body
- [ ] Every doc requirement materialized as a TaskCreate item, in the doc's order
- [ ] Each task moved through `in_progress` → `completed` as work happened
- [ ] Step 5 audit table produced and shown to the user
- [ ] PR description links the Confluence permalink and includes the audit table
- [ ] `npm run build` and `npm run lint` pass
