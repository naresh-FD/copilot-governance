<!-- CENTRAL GOVERNANCE START -->
Managed by copilot-governance.
Do not edit this section directly in downstream repositories.
Update the central governance repository and sync by pull request.

# GitHub Copilot Instructions

## Operating Posture

This repository participates in the hybrid Copilot Governance and Prompt
Optimization Platform. `security.instructions.md` and
`code-quality.instructions.md` apply to every file (`applyTo: "**/*"`) and
are auto-injected same as this file — their rules are not repeated here to
avoid double-injecting the same content on every request. Also load:

- `.github/instructions/testing.instructions.md`
- `.github/instructions/pr-review.instructions.md`
- relevant stack files under `.github/instructions/`

Use path-specific instructions where they apply. Do not rely on this file as
the only source of standards.

## Prompt Workflow Usage

For repeatable work, use approved prompt workflows from `.github/prompts/`
instead of writing long prompts from scratch (`/fix-console-logs`,
`/fix-security-finding`, etc. — see that directory for the full list).

## Governed Prompts

Prompts in this repository are intercepted by `.github/hooks/` and rewritten
against the governance core before the model answers. Your original wording is
always carried through verbatim. Policy rules currently run in shadow mode —
matches are logged and shown, not blocked. This applies in VS Code only;
JetBrains has no hook support, so there these instruction files are the only
control.

## Repo Override Rule

Repo-specific overrides may add local build commands, test commands, domain
context, stack notes, and approved exceptions. They must not weaken or
contradict the central security, compliance, testing, or code-quality rules.
When in doubt, follow the stricter rule and ask for human review.

<!-- CENTRAL GOVERNANCE END -->

<!-- REPO OVERRIDES START -->
Repo-specific rules go here.
These rules can add local standards but cannot weaken central security,
compliance, testing, or code-quality requirements.
<!-- REPO OVERRIDES END -->
