# Build Prompt

Implement the next highest-priority task from `plan.json`. This prompt is designed for repeated execution - run it in a loop until all tasks are complete.

## Before Starting

1. Read `plan.json` to understand current project state
2. Read relevant specifications in `specs/` for the task you'll work on
3. Select the highest-priority pending task (not necessarily first in the list)
4. Skip tasks with unmet dependencies (check `dependencies` array)

## Implementation Workflow

### Step 1: Understand Context

Before writing any code:

- Read all files in `affectedPaths` for the selected task
- Search for existing patterns using Grep and Glob
- Check `src/lib/` for reusable utilities
- Use the Svelte MCP server's `svelte-autofixer` for any Svelte components

### Step 2: Implement

- Make the minimum changes required to complete the task
- Follow existing code patterns and conventions
- Prefer editing existing files over creating new ones
- Keep changes focused - one logical change per task

### Step 3: Verify

Run these checks in sequence. All must pass before proceeding:

```sh
bun run check      # TypeScript type checking
bun run test       # All tests must pass
bun run lint       # Code style and formatting
```

If any check fails:

- Fix the issue immediately
- Re-run all checks
- Do not proceed until all pass

### Step 4: Validate Against Spec

- Review the task's `verificationSteps` from plan.json
- Manually verify each step is satisfied
- If any verification fails, return to Step 2

### Step 5: Update Progress

Update `plan.json`:

- Set the completed task's status to `"complete"`
- Add any discovered subtasks or follow-up work
- Update `lastUpdated` timestamp

### Step 6: Commit

Create a focused commit:

- Stage only files related to this task
- Write a descriptive commit message referencing the task
- Format: `feat|fix|refactor(scope): description`

## Quality Standards

- **No stubs or placeholders**: Implement features completely
- **No breaking changes**: Ensure existing functionality still works
- **Type safety**: All TypeScript must compile without errors
- **Test coverage**: Add tests for new functionality
- **Svelte components**: Always run through `svelte-autofixer` before committing

## When Blocked

If you cannot complete a task:

1. Update the task status to `"blocked"` in plan.json
2. Add a clear description of what's blocking progress
3. Move to the next highest-priority unblocked task

## Constraints

- Only implement ONE task per invocation
- Never skip verification steps
- Never commit with failing tests or type errors
- Do not modify specifications in `specs/`
- Always update plan.json before committing

## Stop Conditions

Stop execution when:

- The selected task is complete and committed
- All tasks in plan.json are complete
- You encounter a blocking issue that requires human input
