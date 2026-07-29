# Security and Compliance Plan

## Non-Negotiable Guardrails

Copilot must be guided to:

- Never generate or suggest hardcoded passwords, tokens, API keys,
  certificates, connection strings, or session identifiers.
- Never log PII, customer data, account numbers, card numbers, secrets, tokens,
  session IDs, request payloads, or authentication headers.
- Never bypass authentication, authorization, MFA, dual-control/change-approval
  workflows, audit logging, SAST, dependency scanning, linting, or tests.
- Never suggest storing secrets in `.env`, config files, frontend code,
  comments, docs, or sample payloads.
- Use approved secret-management patterns only.
- Validate and sanitize external input.
- Avoid SQL injection, XSS, CSRF, insecure redirects, path traversal, unsafe
  deserialization, weak crypto, insecure cookies, insecure CORS, and
  client-side trust assumptions.
- Use secure error handling without exposing stack traces or sensitive internals.
- Flag auth, encryption, payment, audit, logging, and PII-related changes for
  human security review.

## Content Exclusion

Sensitive files should be excluded from Copilot context through GitHub Copilot
content exclusion where appropriate. Candidate exclusions include:

- secrets and local environment files
- production config snapshots
- customer data samples
- payment fixtures
- certificate or key material
- incident or audit exports

## Review Controls

Add CODEOWNERS entries for governance files in target repositories:

```text
.github/copilot-instructions.md      @org/platform-architecture @org/security
.github/instructions/**              @org/platform-architecture @org/security
.github/prompts/**                   @org/platform-architecture
```

Required review expectations:

| File changed | Required reviewers |
| --- | --- |
| `copilot-instructions.md` | Platform architect and repo owner |
| `security.instructions.md` | Security team and platform architect |
| Stack instruction file | Stack SME and repo owner |
| Prompt workflow file | Platform architect |
| Override section | Repo owner |
