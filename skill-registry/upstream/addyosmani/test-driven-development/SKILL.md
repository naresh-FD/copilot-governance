---
name: test-driven-development
description: Reviewed compact governance skill for test-driven-development workflows.
license: MIT
source: addyosmani/agent-skills
---

# test-driven-development

MIT-licensed skill content derived from addyosmani/agent-skills and reviewed for copilot-governance use on 2026-08-05.

## Operating rules

- Follow the repository governance core and any task-specific prompt overlay.
- Prefer the smallest safe change that resolves the verified task.
- Inspect relevant project metadata before assuming framework, package manager, or test command.
- Do not introduce runtime internet access, shell scripts, credential handling, or policy bypasses.
- Preserve existing behavior unless the request explicitly requires a change.
- Verify with the narrowest relevant command first, then broader checks when practical.
- Report root cause, files changed, commands run, and remaining risks.

## Skill-specific workflow

1. Start from observable behavior and define the smallest useful test.
2. Add regression coverage for the bug or security issue before or alongside the fix.
3. Do not weaken assertions, skip tests, or remove valid coverage to get green output.
4. Keep test data synthetic and free of customer identifiers or secrets.
