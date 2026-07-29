---
applyTo: "**/*"
---

# Security Instructions

## Hallucination Prevention Rules
If you are unsure of exact function names, import paths, or patterns, say so explicitly. Never invent custom security implementations. Always cite the exact code location or configuration key.

## Secrets and Credentials — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Hardcode passwords, tokens, API keys, connection strings, certificates, session IDs
- Store secrets in `.env`, `config.json`, source code, tests, comments, samples, or frontend
- Create custom secret encryption or rotation logic
- Suggest environment-specific hardcoding tricks

**ALWAYS** do these (approved patterns):
- Use `process.env.SECRET_KEY` (Node) / `System.getenv("SECRET_KEY")` (Java) for retrieval only
- For sensitive data, use the org's approved vault:
  - **Node**: `@org/config.secrets.get("KEY_NAME")`
  - **Java**: `SecretManager.get("KEY_NAME")`
  - **Angular/React**: Never retrieve secrets in frontend; call backend API only
- Never log, pass, or serialize secret values
- Rotate secrets via governance team workflow, not code

If no approved pattern exists, flag for security review before suggesting anything.

---

## Logging — FORBIDDEN Patterns

**NEVER** log (hallucination risk):
- Customer data, account numbers, card numbers, SSN, email, phone
- Passwords, API keys, tokens, session IDs, JWTs, OAuth codes
- Request/response bodies containing PII or authentication headers
- Stack traces or internal error details to users
- `console.log()`, `System.out.println()`, or debug output in production code

**ALWAYS** do these (approved patterns):
- Use approved logger: `logger.info("Safe message")` with business-safe context only
  - Node: `winston` or `pino` configured to approved log sink
  - Java: `org.slf4j.Logger` configured to approved log sink
  - Angular/React: Call backend logging API, never log client-side
- Log success/failure status only: `{ status: "success", userId: "masked-id", action: "login" }`
- Use `stripPII(payload)` or approved anonymization for audit context
- For errors: `{ status: "error", errorCode: "AUTH_001", message: "Authentication failed" }` — never include stack trace

---

## Input Validation and Injection Prevention — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Use user input directly in SQL: `"SELECT * FROM users WHERE id = " + userId`
- Use user input in XPath, LDAP, OS commands without escaping
- Trust client-side validation; assume all input is malicious
- Allow unvalidated redirects: `redirect(req.query.url)`
- Deserialize untrusted JSON without schema validation

**ALWAYS** do these (approved patterns):
- Validate at trust boundary (API entry point):
  - Node: `@org/validator.sanitize(input, schema)`
  - Java: `@Valid @RequestBody User user` with Bean Validation
  - Angular/React: Validate on backend, never trust frontend
- Use parameterized queries / prepared statements only:
  - Node: `db.query("SELECT * FROM users WHERE id = ?", [userId])`
  - Java: `PreparedStatement ps = db.prepareStatement("SELECT * FROM users WHERE id = ?")`
- For HTML/XML: Use framework escaping (React's JSX, Angular's sanitizer)
- For URLs: Use `new URL(userInput).href` or approved URL builder

---

## Authentication and Authorization — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Invent custom JWT signing, token generation, or session management
- Bypass MFA, dual-control/change-approval workflows, or permission checks with flags or admin overrides
- Store tokens in localStorage or client cookies without HttpOnly + Secure flags
- Trust user ID or role from client headers; always validate on backend

**ALWAYS** do these (approved patterns):
- Use centralized auth:
  - **Node/Java**: Use `@org/auth-guard` middleware/decorator
  - **Angular/React**: Use `@org/auth-provider` component wrapper
  - All authentication decisions made server-side only
- For tokens: Use org-approved token library only; never roll your own
- For permission checks: Always validate `hasPermission(userId, "ACTION")` server-side
- Flag any auth or permission changes for human security review before merge

---

## Error Handling — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Return full stack traces, internal paths, or database error details to users
- Swallow errors silently: `catch (e) { }`
- Log secrets, payloads, or internal state in error messages
- Assume errors are non-recoverable without retry logic

**ALWAYS** do these (approved patterns):
- Return safe error messages to users:
  ```json
  { "error": "Operation failed", "errorCode": "PAYMENT_DECLINED" }
  ```
- Log diagnostic context safely:
  ```
  logger.error("Payment processing failed", { errorCode: "PAYMENT_DECLINED", userId: "masked", timestamp: now })
  ```
- Implement retry logic for transient errors (timeouts, rate limits)
- For sensitive operations (auth, payment, compliance), flag for human review

---

## Security-Sensitive Change Flags

**Always flag for human security review** if changes touch:
- Authentication, authorization, MFA, or permission logic
- Encryption, key generation, or cryptographic operations
- Payment, billing, or transaction processing
- PII, customer data, or compliance-regulated fields
- Audit logging, reporting, or record-keeping
- API rate limiting, throttling, or DOS protection
- Secrets retrieval, rotation, or storage

Add comment: `// SECURITY REVIEW REQUIRED` and open a PR for human review.

---

## Summary: What to Refuse

If a request asks you to:
1. Write custom auth/encryption → Refuse; cite approved pattern location
2. Log secrets or PII → Refuse; show approved logging pattern
3. Invent secret storage → Refuse; show vault usage pattern
4. Bypass checks with flags → Refuse; escalate to security team
5. Use unapproved patterns → Say "I need to check the repo first"
