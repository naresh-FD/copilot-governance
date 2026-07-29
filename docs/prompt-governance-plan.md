# Prompt Governance Plan

## Purpose

Reusable prompt workflows reduce repeated long prompts, improve consistency,
and make common fixes easier to audit.

Developers should use approved workflows from `.github/prompts/` for repeatable
tasks instead of writing fresh prompts from scratch.

## Required Workflows

- `/fix-pr-review`
- `/fix-security-finding`
- `/fix-console-logs`
- `/fix-sonarqube-issue`
- `/fix-eslint-issue`
- `/fix-test-failure`
- `/fix-build-failure`
- `/fix-typescript-error`
- `/fix-angular-migration`
- `/fix-react-code-quality`
- `/fix-java-springboot-security`
- `/generate-unit-tests`
- `/document-repo`
- `/explain-legacy-code`

## Workflow Rules

- Each workflow must reference repository Copilot instructions and the security
  baseline.
- Each workflow must include task scope, rules, verification expectations, and
  summary expectations.
- Workflows must not instruct developers to bypass tests, linting, scans,
  review, or compliance gates.
- Security-sensitive workflows must require human review callouts.

## Local Usage

```bash
scripts/copilot-gov.sh prompt fix-pr-review
scripts/copilot-gov.sh prompt fix-security-finding
scripts/copilot-gov.sh prompt fix-console-logs
```
