---
name: code-review-and-quality
description: Reviewed compact governance skill for code-review-and-quality workflows.
license: Internal
source: copilot-governance
---

# code-review-and-quality

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

1. Address reviewer or quality-tool feedback directly and minimally.
2. Prefer clarity, maintainability, and reduced complexity over broad rewrites.
3. Do not suppress lints, quality gates, or warnings without documented justification.
4. Preserve public APIs unless the review explicitly asks for an API change.
