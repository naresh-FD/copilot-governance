---
name: deprecation-and-migration
description: Reviewed compact governance skill for deprecation-and-migration workflows.
license: MIT
source: addyosmani/agent-skills
---

# deprecation-and-migration

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

1. Identify source and target versions before changing migration code.
2. Follow official migration order and keep compatibility shims explicit.
3. Migrate incrementally with tests after each framework-level change.
4. Do not combine migrations with unrelated feature work.
