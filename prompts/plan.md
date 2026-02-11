# Planning Prompt

Analyze the codebase against specifications and produce a structured implementation plan. This is planning only - do not implement anything.

## Instructions

Read the specifications in `specs/` and compare against the source code in `src/`. Identify incomplete implementations, missing features, TODOs, placeholders, and gaps between spec and code.

If `plan.json` exists, read it first to understand current progress and avoid duplicating completed work.

Use the Task tool with Explore subagents to search the codebase efficiently. Before assuming any functionality is missing, verify with code search - it may already exist.

Treat `src/lib/` as the project's shared library. Prefer extending existing utilities there over creating ad-hoc implementations elsewhere.

## Verification Before Assumptions

When you identify a potential gap:

1. Search for the functionality using Grep and Glob
2. Check related files and imports
3. Only mark as missing after confirming it doesn't exist

## Output

Write or update `plan.json` at the repository root with this structure:

```json
{
	"version": "1",
	"lastUpdated": "ISO 8601 timestamp",
	"summary": "Brief description of current implementation status",
	"tasks": [
		{
			"id": "unique-id",
			"title": "Task title",
			"description": "What needs to be done and why",
			"status": "pending | in_progress | complete | blocked",
			"priority": "critical | high | medium | low",
			"specReference": "Reference to spec section (e.g., 'v1-specification.md#modules')",
			"affectedPaths": ["src/routes/...", "src/lib/..."],
			"dependencies": ["other-task-id"],
			"verificationSteps": ["How to verify this task is complete"]
		}
	],
	"missingSpecs": [
		{
			"proposedPath": "specs/filename.md",
			"description": "What this spec should cover",
			"reason": "Why this spec is needed"
		}
	]
}
```

## Task Priorities

- **critical**: Blocks other work or breaks core functionality
- **high**: Required for v1 success criteria
- **medium**: Important but not blocking
- **low**: Nice to have, polish, or future consideration

## What to Look For

- TODO and FIXME comments
- Placeholder or stub implementations
- Spec requirements without corresponding code
- Missing database schema for spec entities
- Missing routes for required views
- Inconsistent patterns or duplicated logic
- Features mentioned in spec but not implemented

## Constraints

- Do NOT implement any changes
- Do NOT create or modify source code files
- Do NOT assume - verify with search first
- Only output to `plan.json`

If you identify functionality that requires a new specification document, add it to the `missingSpecs` array rather than creating the file.
