---
name: debugging-and-error-recovery
description: Reviewed compact governance skill for debugging-and-error-recovery workflows.
license: Internal
source: copilot-governance
---

# debugging-and-error-recovery

Internal governance skill content reviewed for copilot-governance use on 2026-08-05.

## Operating rules

- Follow the repository governance core and any task-specific prompt overlay.
- Prefer the smallest safe change that resolves the verified task.
- Inspect relevant project metadata before assuming framework, package manager, or test command.
- Do not introduce runtime internet access, shell scripts, credential handling, or policy bypasses.
- Preserve existing behavior unless the request explicitly requires a change.
- Verify with the narrowest relevant command first, then broader checks when practical.
- Report root cause, files changed, commands run, and remaining risks.

## Skill-specific workflow

1. Reproduce the failing test, build, or type error before editing code.
2. Identify the first actionable error and avoid chasing cascading failures.
3. Fix production code before changing tests unless the test is demonstrably wrong.
4. Add or update a regression test when the failure exposes missing coverage.
