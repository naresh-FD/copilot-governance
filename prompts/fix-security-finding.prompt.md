# /fix-security-finding — Fix security issue using approved patterns

**Context**: Use `.github/instructions/security.instructions.md` for all approved patterns.

**Task**: Fix a specific security finding using only approved patterns.

**CRITICAL RULES**:
1. Never invent custom solutions (auth, encryption, secret management)
2. Never bypass checks with flags or overrides
3. Always use the exact approved pattern for the issue type
4. If uncertain of the approved pattern, ask for it first
5. Flag all sensitive changes for human security review

**Issue types and approved fixes**:

| Issue | Use These Patterns | Never Do This |
|-------|-------------------|---------------|
| Hardcoded secret | `process.env.SECRET` or `@org/config.secrets.get()` | Store in source, .env, comments |
| Insecure logging | `logger.info("safe msg", safeContext)` | Log PII, tokens, payloads |
| Unvalidated input | `@org/validator.sanitize()` + parameterized queries | Trust user input; use string concat |
| Custom auth | Use `@org/auth-guard` middleware/decorator | Roll your own JWT/session logic |
| Unhandled error | Meaningful catch with recovery or logging | `catch(e) { }` or `catch(e) { return null; }` |
| Insecure redirect | Use whitelist: `if (ALLOWED_URLS.includes(url))` | `redirect(userInput)` directly |
| Weak crypto | Use org-approved crypto lib only | `Math.random()`, custom encryption |

**After fixing**:
- Run this repository's configured lint and test commands. Take them from the
  repo overrides in `.github/copilot-instructions.md` or the build config — this
  workflow also fires on Java, so do not assume npm.
- Add comment: `// SECURITY REVIEW REQUIRED — [brief description]`
- Open PR for review by security team
- Summary: Explain what the vulnerability was and which approved pattern you used

**Do NOT**:
- Suppress warnings without fixing root cause
- Use different pattern than one in security.instructions.md
- Assume fix is correct without testing
- Merge without security team review
