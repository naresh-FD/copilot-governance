# copilot-governance

Hybrid Copilot Governance and Prompt Optimization Platform — a reusable
template for centrally governing GitHub Copilot instructions, path-specific
guardrails, and prompt workflows across any organization's repositories.

This repository is the central source of truth for:

- repo-wide `.github/copilot-instructions.md`
- path-specific `.github/instructions/*.instructions.md`
- reusable `.github/prompts/*.prompt.md` workflows
- local developer validation through `scripts/copilot-gov.sh`
- GitHub PR-based sync automation

The goal is not only to standardize Copilot instructions. The stronger value is
prompt governance, secure coding guardrails, code-quality automation, and faster
developer fixes with reusable approved workflows.

## Repository Layout

```text
templates/
  copilot-instructions.base.md
  CODEOWNERS.governance
instructions/
  security.instructions.md
  code-quality.instructions.md
  react.instructions.md
  angular-v12.instructions.md
  angular-v21.instructions.md
  java-springboot.instructions.md
  testing.instructions.md
  pr-review.instructions.md
  migration.instructions.md
prompts/
  fix-pr-review.prompt.md
  fix-security-finding.prompt.md
  fix-console-logs.prompt.md
  fix-sonarqube-issue.prompt.md
  fix-eslint-issue.prompt.md
  fix-test-failure.prompt.md
  fix-build-failure.prompt.md
  fix-typescript-error.prompt.md
  fix-angular-migration.prompt.md
  fix-react-code-quality.prompt.md
  fix-java-springboot-security.prompt.md
  generate-unit-tests.prompt.md
  document-repo.prompt.md
  explain-legacy-code.prompt.md
prompt-core/
  core.md
  router.json
  deny.json
  rewrite.mjs
hooks/
  prompt-interceptor.json
scripts/
  copilot-gov.ps1
  copilot-gov.sh
  sync-copilot-instructions.sh
  validate-copilot-governance.sh
  hooks/pre-commit
docs/
  demo.md
  project-plan.md
  prompt-governance-plan.md
  prompt-interception-plan.md
  phase5-briefing.md
  rollout-plan.md
  security-compliance-plan.md
  hallucination-prevention.md
  phase1-deliverables.md
```

## Prompt Interception

`prompt-core/` and `hooks/` are the Phase 5 interception kernel. Once synced,
every prompt submitted in a governed repository is intercepted by a VS Code
`UserPromptSubmit` hook and rewritten against the governance core before the
model sees it — the developer's original wording is always carried through
verbatim. Policy rules ship in shadow mode: logged and surfaced, never blocking,
until pilot data justifies enforcing them one at a time.

This works in VS Code and Claude Code. **JetBrains has no hook support**, so
IntelliJ users get the instruction and prompt files only. See
`docs/prompt-interception-plan.md` for the full coverage matrix, the pinned hook
schema, and the honest limits.

## How Sync Works

1. `templates/copilot-instructions.base.md` contains the managed central
   baseline and repo override markers.
2. `instructions/` contains governed path-specific Copilot instruction packs.
3. `prompts/` contains approved reusable prompt workflows.
4. `repos.json` lists target repositories.
5. `scripts/sync-copilot-instructions.sh` clones each target repo, updates:
   - `.github/copilot-instructions.md`
   - `.github/instructions/*.instructions.md`
   - `.github/prompts/*.prompt.md`
   - `.github/prompt-core/*` and `.github/hooks/*` (the interception kernel)
6. Repo-specific override content between the override markers is preserved.
7. Sync records what it shipped in `.github/.copilot-governance-manifest`, so a
   file removed centrally is removed downstream on the next sync — without
   touching prompt or hook files the repo added itself.
8. Sync opens or updates PRs. It does not commit directly to default branches.

## Local CLI

```bash
scripts/copilot-gov.sh doctor
scripts/copilot-gov.sh validate
scripts/copilot-gov.sh audit
scripts/copilot-gov.sh prompt fix-console-logs
scripts/copilot-gov.sh rewrite "fix the SQL injection in the account lookup"
scripts/copilot-gov.sh report
scripts/copilot-gov.sh sync --dry-run
scripts/copilot-gov.sh install-hooks
```

On Windows without WSL/Git Bash (Windows PowerShell 5.1, no `pwsh` required):

```powershell
scripts\copilot-gov.ps1 doctor
scripts\copilot-gov.ps1 validate
scripts\copilot-gov.ps1 audit
scripts\copilot-gov.ps1 prompt fix-console-logs
```

Use `sync --apply` only when `GH_TOKEN` and `GH_ORG` are configured.

## Local Content Enforcement (Token Budget)

`validate` (and the pre-commit hook installed by `install-hooks`) enforces a
word budget on every file that gets auto-injected into Copilot requests — the
central governance block and each `instructions/*.instructions.md` file
(`applyTo: "**/*"` files have the same reach as the top-level file). Default
budget is 300 words per file, override with `TOKEN_BUDGET_WORDS`; two files
(`security.instructions.md`, `code-quality.instructions.md`) have documented
higher ceilings since exhaustive pattern coverage is their purpose. It also
blocks unresolved placeholders and literal-looking hardcoded secrets in
governance content, and (bash only) warns on verbatim duplicate phrasing
across files. See [docs/demo.md](docs/demo.md) for how to test this and what
it caught the first time it ran.

## Authentication

Recommended long-term automation is a GitHub App with fine-grained repository
scope and short-lived installation tokens.

For pilot rollout, a fine-grained PAT can be used if approved:

- `Contents: Read and write`
- `Pull requests: Read and write`
- scoped only to target repositories
- stored as `GOV_SYNC_PAT`
- paired with repo/org variable `GH_ORG`

## Override Model

Central managed section:

```text
<!-- CENTRAL GOVERNANCE START -->
Managed by copilot-governance.
...
<!-- CENTRAL GOVERNANCE END -->
```

Repo-owned section:

```text
<!-- REPO OVERRIDES START -->
Repo-specific rules go here.
<!-- REPO OVERRIDES END -->
```

Rules:

- Central section is managed by this repo.
- Repo overrides are preserved.
- Overrides can add local context but cannot weaken security, compliance,
  testing, or code-quality rules.
- Duplicate markers fail validation/sync.
- Existing files without markers enter onboarding mode and are preserved inside
  the repo override section.

## Pilot Repos

`repos.json` holds the example pilot list — replace it with your own repos
before running a real sync:

```text
alerts
react-feature-template
backend-api
web-dashboard
```

See [docs/project-plan.md](docs/project-plan.md) for the rollout plan.
