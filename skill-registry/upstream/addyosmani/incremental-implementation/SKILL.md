---
name: incremental-implementation
description: Reviewed compact governance skill for incremental-implementation workflows.
license: MIT
source: addyosmani/agent-skills
---

# incremental-implementation

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

1. Break work into small, reviewable steps with clear checkpoints.
2. Avoid unrelated refactors, dependency upgrades, or formatting churn.
3. Keep rollback easy by limiting the number of touched files.
4. Verify each step before proceeding to broader changes.
