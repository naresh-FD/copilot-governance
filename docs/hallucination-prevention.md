# Copilot Hallucination Prevention Guide

**Purpose**: Prevent Copilot from inventing custom patterns, deprecated methods, non-existent functions, or unapproved security implementations.

**For Developers**: When Copilot suggests something, check against this guide. If it violates these rules, refuse and ask for the approved pattern instead.

**For Governance Team**: Use this as audit criteria for PR reviews.

---

## The Core Principle

**Copilot must refuse to invent patterns.** If unsure of the exact function name, import path, or approved pattern, Copilot should say:
> "I need to check the repo for the exact pattern. Can you share the location or provide an example?"

---

## Category 1: Security Hallucinations (Highest Risk)

### ❌ What Copilot MUST REFUSE

| Hallucination | Why It's Dangerous | Approved Alternative |
|--------------|-------------------|----------------------|
| Custom JWT signing: `jwt.sign({ userId: 123 }, secretKey)` | Weak key management, no token validation | Use `@org/auth-guard` decorator |
| Custom encryption: `encrypt(data, password)` | Weak cipher, key derivation bugs | Use org-approved crypto lib only |
| Storing secrets in env files: `PASSWORD = "secret123"` | Secrets in git history, exposed on deploy | Use vault API: `config.secrets.get()` |
| Bypassing auth: `if (process.env.ADMIN_MODE === 'true')` | Security check disabled in code | Use centralized auth middleware only |
| Logging secrets: `logger.log("token:", token)` | Secrets in logs, audit trail exposed | Log safe context only: `logger.log("auth success")` |
| Custom SQL: `"SELECT * FROM users WHERE id = " + userId` | SQL injection vulnerability | Use prepared statements only |
| Trusting user input: `redirect(req.query.url)` | Open redirect, phishing vector | Use URL whitelist: `ALLOWED_URLS.includes(url)` |

### ✅ How Developers Should Respond

When Copilot suggests custom auth/crypto/secret management:
1. Refuse: "No, I need to use approved patterns only"
2. Check `.github/instructions/security.instructions.md`
3. Copy the exact approved pattern
4. Use that instead

---

## Category 2: API/Framework Hallucinations (High Risk)

### ❌ What Copilot MUST REFUSE

| Hallucination | Why It's Wrong | Approved Alternative |
|--------------|---------------|----------------------|
| Inventing function names: `validateEmail(input)` when it doesn't exist | Code won't compile/run | Check existing code: `@org/validator.sanitize()` |
| Using deprecated libs: `const request = require('request')` | Deprecated, no longer maintained | Use `axios` or org-approved HTTP lib |
| Wrong import path: `import { auth } from '@angular/common'` | Import fails, wrong module | Check actual location: `import { AuthGuard } from '@org/auth'` |
| Non-existent React hook: `useMyCustomState()` | Hook doesn't exist | Use standard hooks or check `@org/hooks` |
| Wrong Java class: `SimpleDateFormat sdf = new SimpleDateFormat(...)` | Thread-unsafe, deprecated | Use `java.time.LocalDate`, `java.time.Instant` |
| Making up config keys: `process.env.API_KEY_SECRET` | Env var doesn't exist, app crashes | Check actual keys in `.env.example` |

### ✅ How Developers Should Respond

When Copilot suggests a function/import that doesn't exist:
1. Check the code: Does this function exist? Can I find an import?
2. Run: `grep -r "functionName" src/` to verify
3. If not found: "I don't think this exists. Can you check the actual import path?"
4. Provide the correct import if available

---

## Category 3: Pattern Hallucinations (Medium Risk)

### ❌ What Copilot MUST REFUSE

| Hallucination | Why It's Wrong | Approved Alternative |
|--------------|---------------|----------------------|
| Custom error handling: `try { ... } catch (e) { console.error(e); }` | Silent failures, no recovery | Use meaningful catch with logging: `catch (e) { logger.error(...); throw; }` |
| Silencing errors: `try { ... } catch (e) { }` | Errors go undetected | Add meaningful error handling + logging |
| Using `any` type: `function process(data: any)` | Type safety lost, bugs easier | Use specific type: `function process(data: MyType)` |
| Commenting out code: `// const value = getConfig();` | Dead code, confusion | Delete it; git preserves history |
| Hardcoding values: `const API_URL = "https://prod.example.com"` | Environment-specific, deploy bugs | Use config: `process.env.API_URL` |
| Making up test patterns: `test.skip("should work")` or test that doesn't match behavior | Tests don't run, coverage fake | Write real tests; use `test.only()` for debugging, then remove |

### ✅ How Developers Should Respond

When Copilot suggests a pattern:
1. Check `.github/instructions/code-quality.instructions.md` for the approved pattern
2. If suggested pattern differs: "No, let me use the approved pattern from our guidelines"
3. Example: Instead of `catch (e) { }`, use the example from code-quality.instructions.md

---

## Category 4: Performance/Quality Hallucinations (Low Risk)

### ❌ What Copilot MUST REFUSE

| Hallucination | Why It's Wrong | Approved Alternative |
|--------------|---------------|----------------------|
| Loop inside fetch: `for (item of items) { await fetch(...) }` | Inefficient, N+1 query problem | Use: `Promise.all(items.map(fetch))` |
| Loading all data: `SELECT * FROM users` for 1M rows | Memory explosion, timeout | Use pagination: `LIMIT 100 OFFSET 0` |
| Re-rendering entire component: `setState(data)` in expensive loop | Performance degradation | Use `useMemo`, `useCallback` in React |
| Using `eval()`: `eval(userInput)` | Security + performance risk | Use: `JSON.parse()` for data |
| Repeated string concat: `let sql = "SELECT..."; sql += "WHERE...";` | Inefficient, injection risk | Use template: `` `SELECT ... WHERE ${id}` `` (with validation) |

### ✅ How Developers Should Respond

When Copilot suggests an inefficient pattern:
1. Ask: "Is this the most efficient approach?"
2. Check performance section in code-quality.instructions.md
3. Example: "For N items, I need to batch the fetch, not loop"

---

## Quick Refusal Checklist

**If Copilot suggests any of these, REFUSE and ask for the approved pattern:**

- [ ] Custom auth, encryption, or JWT logic
- [ ] Storing secrets in source/config/comments
- [ ] Logging PII, tokens, payloads, or secrets
- [ ] Trusting user input without validation
- [ ] Bypassing security checks with flags
- [ ] Functions/imports you can't find in the repo
- [ ] Deprecated libraries (check npm advisories)
- [ ] Using `any` type in TypeScript
- [ ] Silent error handling: `catch (e) { }`
- [ ] Commented-out code
- [ ] Hardcoded environment-specific values
- [ ] `eval()`, custom encryption, or custom random generation

---

## What Copilot Should Do Instead

When unsure, Copilot should:

1. **Ask for clarification**: "I need to check the repo for the exact pattern. Can you share an example or location?"
2. **Cite the approved location**: "Let me use the pattern from `.github/instructions/security.instructions.md` (Secrets section)"
3. **Provide the exact pattern**: Include full import, function call, and usage
4. **Include examples of what NOT to do**: Show the anti-pattern side-by-side
5. **Flag security-sensitive changes**: Add `// SECURITY REVIEW REQUIRED` comment

---

## Token Savings Through Anti-Hallucination

**How this saves tokens:**

1. **Less repeat context**: Instead of explaining the approved pattern each time, developers reference `.github/instructions/*.md`
2. **Shorter prompts**: `/fix-security-finding` + finding name instead of long prompt with all rules
3. **Faster fixes**: Fewer back-and-forth corrections when Copilot doesn't hallucinate
4. **Less PR review time**: Reviewers don't have to reject hallucinated patterns

---

## For Auditing

**Check these in PR reviews:**

- [ ] No custom auth/crypto/secret logic
- [ ] No secrets in logs, source, or comments
- [ ] No deprecated libraries used
- [ ] No function/imports that don't exist in repo
- [ ] No silent error handling (`catch (e) { }`)
- [ ] No hardcoded environment-specific values
- [ ] No `any` types without justification
- [ ] No unapproved patterns in security-sensitive code
- [ ] Security changes flagged for review

---

## Reference Links

- Security approved patterns: `.github/instructions/security.instructions.md`
- Code-quality patterns: `.github/instructions/code-quality.instructions.md`
- Prompt workflows: `.github/prompts/fix-*.prompt.md`
- Stack-specific: `.github/instructions/react.instructions.md`, `.../java-springboot.instructions.md`, etc.
