---
name: context-engineering
description: Reviewed compact governance skill for context-engineering workflows.
license: MIT
source: addyosmani/agent-skills
---

# context-engineering

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

1. Load only files needed to understand the task, ownership, tests, and conventions.
2. Prefer metadata and nearby tests before scanning broad source trees.
3. Summarize context decisions and identify any files intentionally not loaded.
4. Respect token budgets and never dump full unrelated files into the prompt.
