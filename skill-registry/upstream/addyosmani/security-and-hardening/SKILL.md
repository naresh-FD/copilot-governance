---
name: security-and-hardening
description: Reviewed compact governance skill for security-and-hardening workflows.
license: MIT
source: addyosmani/agent-skills
---

# security-and-hardening

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

1. Treat the task as security-sensitive and require human review.
2. Prefer allowlists, parameterized APIs, framework protections, and least privilege.
3. Never log secrets, tokens, customer identifiers, or sensitive error details.
4. Add abuse-case regression tests for the vulnerability class being fixed.
