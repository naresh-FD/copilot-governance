# /fix-java-springboot-security — Fix using Spring Security, never custom code

**Context**: Use `.github/instructions/security.instructions.md` for approved
patterns and `.github/instructions/java-springboot.instructions.md` for stack
conventions.

**Task**: Fix the Spring Boot security finding named in the request.

**CRITICAL RULES**:
1. Never write your own authentication, session, token, or crypto code. Spring
   Security and the org-approved libraries already cover these.
2. Never remove or weaken an existing authorization check to make something
   work. If a check blocks a legitimate call, fix the role or the rule.
3. Use the exact approved pattern for the finding type. If it is not in the
   instruction files, ask rather than inventing one.
4. Every security fix needs a test that fails without the fix.
5. Flag the change for human security review. Do not treat it as done without one.

**Finding types and approved fixes**:

| Finding | Use this | Never do this |
|---------|----------|---------------|
| SQL injection | Parameterized query, JPA criteria, or a bound `@Query` | String concatenation or `String.format` into SQL |
| Missing authorization | `@PreAuthorize` / the org auth-guard on the method | Client-side or UI-only checks |
| Hardcoded secret | Injected config from the approved secret store | `application.properties` literals, constants, comments |
| Sensitive logging | Log a non-reversible identifier only | Log request bodies, headers, tokens, PII, or full stack traces to the client |
| Mass assignment | An explicit request DTO with only the writable fields | Binding the JPA entity straight to the request |
| Unsafe deserialization | A strict allowlist, or a safe format | Java native deserialization of untrusted input |
| Path traversal | Canonicalize, then verify the path is inside the allowed root | Concatenating user input into a file path |
| SSRF | Allowlist the destination host | Fetching a user-supplied URL directly |
| Weak crypto | The org-approved crypto library | `MD5`, `SHA-1`, `DES`, ECB mode, `java.util.Random` for anything secret |
| Error leakage | A business-safe message; log the detail server-side | Returning the stack trace or SQL error to the caller |

**After fixing**:
- Run this repository's configured build and test commands (Maven or Gradle as
  the project defines — check the repo overrides in
  `.github/copilot-instructions.md`).
- Add or update a unit or integration test that exercises the security behavior.
- Add a `// SECURITY REVIEW REQUIRED — <brief description>` comment at the change.
- Summary: what the vulnerability allowed, which approved pattern you used, the
  test that now covers it, and the commands you ran with their real output.

**Do NOT**:
- Add `@SuppressWarnings` or a scanner exclusion instead of fixing the cause
- Disable CSRF, CORS restrictions, or TLS verification to make something work
- Widen a role or permission to get past an authorization failure
- Assume the fix is correct without running the test
- Merge without security team review
