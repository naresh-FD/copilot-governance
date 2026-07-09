<!--
  ORG BASELINE — copilot-instructions.md
  Owned by: Platform/Architecture team (copilot-governance repo)
  Do not edit directly in downstream repos — edit here and let the sync
  workflow propagate. Repo-specific rules go in the REPO OVERRIDES block
  below, which the sync script preserves on every push.
-->

# GitHub Copilot Instructions — BOL Commercial

## Compliance (non-negotiable)

- This is a regulated banking/financial environment. **Never** transmit source
  code, credentials, customer data, or internal identifiers to any service
  outside our approved, contracted tooling.
- Do not suggest storing secrets, tokens, or connection strings in code,
  comments, or config files. Point to the approved secrets manager instead.
- Do not fabricate API responses, security control behavior, or compliance
  claims. If uncertain, say so and flag for human review.
- Any authentication, authorization, encryption, or PII-handling code must be
  flagged for security review before merge — do not present it as "safe to
  ship" on its own.

## Stack conventions

### React microfrontends
- Functional components with hooks; no new class components.
- Co-locate tests with source (`Component.test.tsx` beside `Component.tsx`).
- Shared UI primitives come from the design-system package — don't
  reimplement existing components.

### Angular — legacy (v12)
- Treat v12 code as maintenance-mode: bug fixes and security patches only.
- Do not introduce new Angular v12 modules/features; new functionality
  belongs in the v21 migration track unless explicitly scoped otherwise.
- Preserve existing RxJS patterns already in the file rather than mixing
  styles mid-file.

### Angular — active migration (v21)
- Standalone components by default; avoid NgModules for new code.
- Prefer signals over RxJS for new local component state; keep RxJS for
  cross-cutting async streams (HTTP, websockets).
- Flag any code that will block or complicate migration of adjacent v12
  modules.

### Java microservices
- Follow existing package structure; don't introduce a new layering pattern
  in a service without discussion.
- Favor constructor injection; no field injection in new code.
- All new endpoints need request/response validation and explicit error
  handling — no silent catch-and-swallow.

### CI/CD
- Azure DevOps pipelines are the source of truth for build/release. Don't
  suggest GitHub Actions as a replacement for release pipelines — GitHub
  Actions in this org is scoped to governance/sync automation only (like
  this file's own propagation).

## Code review posture

- Prioritize correctness and security over cleverness or brevity.
- Call out breaking changes to shared/microfrontend contracts explicitly.
- When suggesting a refactor, keep the diff minimal and scoped to the task.

<!-- REPO OVERRIDES START -->
<!--
  Repo-specific additions go below this line. The sync workflow will
  overwrite everything ABOVE this marker with the latest org baseline and
  leave everything from "REPO OVERRIDES START" to the end of the file
  untouched. Add your repo's exceptions, extra context, or stack notes here.
-->

<!-- REPO OVERRIDES END -->
