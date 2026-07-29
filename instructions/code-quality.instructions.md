---
applyTo: "**/*"
---

# Code-Quality Instructions

## Hallucination Prevention Rules
Never invent framework patterns, library functions, or configuration structures. If unsure of exact syntax, say so. Always check existing repo code for the approved pattern before suggesting new code.

## Console and Debug Output — FORBIDDEN Patterns

**NEVER** commit these (hallucination risk):
- `console.log()`, `console.debug()`, `console.warn()` in production code
- `debugger` statements
- Temporary test flags or bypass switches (e.g., `IS_STAGING = true` in source)
- Commented debug code or print statements
- Local-only environment checks like `if (process.env.NODE_ENV === "development")`

**ALWAYS** do these (approved patterns):
- For logging: Use org-approved logger only
  - Node: `const logger = require('@org/logger')` → `logger.info("message", context)`
  - Java: `private static final Logger LOGGER = LoggerFactory.getLogger(Class.class)` → `LOGGER.info("message")`
  - Angular/React: Never use console; call backend logging API
- For troubleshooting: Add structured logging with context, not console output
- For testing: Use appropriate test assertions, not console output
- Remove all debug code before submitting for review

---

## Unused Code Removal — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Leave commented-out code blocks ("might need later")
- Keep unused variables, parameters, or imports
- Leave dead branches (`if (false) { ... }`)
- Leave unreachable code after return/throw
- Keep test-only exports or mock functions in production

**ALWAYS** do these (approved patterns):
- Delete unused imports: `npm run lint -- --fix` or IDE auto-fix
- Delete unused variables and functions completely
- Delete commented code (git history preserves it)
- If code might be needed later, add a TODO with a ticket link: `// TODO: restore when PROJ-123 is done`
- Use git blame/log to find deleted code if needed

Before submitting: Run linter and check for unused exports.

---

## Constants and Configuration — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Hardcode URLs: `const apiUrl = "https://prod.example.com/api"`
- Hardcode environment-specific values: `const dbHost = "db.prod.example.com"`
- Hardcode feature flags, timeouts, retry counts, or limits in code
- Hardcode API keys, service IDs, or tenant IDs
- Commit `.env` files or environment-specific configs

**ALWAYS** do these (approved patterns):
- Move to approved config:
  - Node: `process.env.API_URL` with `.env` gitignored (or @org/config)
  - Java: Application properties or `@ConfigurationProperties`
  - Angular/React: Environment config in `environment.ts` / `environment.prod.ts`
- For feature flags: Use org-approved feature flag service, not code conditionals
- For timeouts/retries: Use constants in a centralized config module
- Config must be validated on app startup, not silently defaulted

Example:
```javascript
// GOOD
const apiUrl = process.env.API_URL || 'http://localhost:3000/api';
if (!apiUrl) throw new Error('API_URL env var is required');

// BAD
const apiUrl = 'https://prod.example.com/api'; // Do not hardcode
```

---

## Error Handling — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Silent catch blocks: `catch (e) { }`
- Catch-and-swallow: `catch (e) { return null; }`
- Log error and do nothing: `catch (e) { logger.error(e); }`
- Ignore async errors or unhandled promise rejections
- Return success when an error occurred

**ALWAYS** do these (approved patterns):
- Meaningful error handling with recovery or escalation:
  ```javascript
  try {
    result = await fetchData();
  } catch (e) {
    if (e.code === 'TIMEOUT') {
      // Retry with exponential backoff
      result = await retryWithBackoff(() => fetchData());
    } else {
      logger.error('Fetch failed', { errorCode: e.code, url });
      throw new AppError('Fetch failed', 'DATA_FETCH_ERROR', { cause: e });
    }
  }
  ```
- All errors logged with context (errorCode, userId masked, action attempted)
- Errors propagated up or handled with recovery strategy
- For async: Use try/await, never swallow rejections

---

## Type Safety — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Use `any` type: `function process(data: any)`
- Use unsafe casts: `(payload as unknown as MyType)`
- Assume variables are defined: `if (obj.field)` without checking `obj` first
- Optional chaining without validation: `user?.profile?.email` without null checks downstream
- Ignore TypeScript errors with `@ts-ignore` or `@ts-nocheck`

**ALWAYS** do these (approved patterns):
- Use specific types: `function process(data: MyType)`
- Use type guards: `if (typeof data === 'object' && 'name' in data) { ... }`
- Use optional chaining with nullish coalescing:
  ```typescript
  const email = user?.profile?.email ?? 'unknown';
  ```
- Use discriminated unions for type-safe variants:
  ```typescript
  type Result = { status: 'success'; data: T } | { status: 'error'; error: Error };
  ```
- Enable strict TypeScript: `"strict": true` in tsconfig.json

---

## Testing — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Skip failing tests with `.skip()` or `.only()`
- Delete test files because they're "too old"
- Mock external dependencies without verifying mock matches reality
- Test implementation details instead of behavior
- Leave test code in production (test-only fixtures, mock servers)

**ALWAYS** do these (approved patterns):
- Update tests to match new behavior, not the other way around
- Test behavior, not implementation: Test what the function does, not how
- Mock external dependencies consistently:
  - Node: Use `jest.mock()` or `sinon.stub()`
  - Java: Use Mockito, verify mocks match real API
- Add tests for new logic; update tests when behavior changes
- All tests passing before PR submission

---

## Code Organization — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Commit unrelated refactors in same PR as bug fix
- Rewrite entire functions when only one line needs to change
- Move code between files without updating imports/exports
- Change formatting/whitespace in unrelated code

**ALWAYS** do these (approved patterns):
- Keep diffs focused: One logical change per PR
- Fix the bug first, then optionally add cleanup in separate PR
- For large refactors: Split into multiple PRs, each with focused change
- Update all imports/exports when moving code
- Run formatter before commit (Prettier, Black, etc.)

---

## Dependency Management — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Add dependencies without checking if already present
- Use deprecated packages: `request`, `node-sass`, `@aws-sdk/client-*` v2
- Add unapproved packages without security/licensing review
- Upgrade major versions without testing compatibility

**ALWAYS** do these (approved patterns):
- Check for existing packages: `npm ls` / `mvn dependency:tree`
- Use approved packages only:
  - HTTP: `axios` (Node), `OkHttp` (Java)
  - Logging: `winston`/`pino` (Node), `slf4j` (Java)
  - Testing: `jest`, `mocha` (Node); `junit`, `testng` (Java)
- For new packages: Check npm/Maven security advisories before use
- Major upgrades: Test thoroughly, use dedicated PR
- Keep dependencies up-to-date: Run `npm audit fix` / `mvn dependency:resolve`

---

## Accessibility (UI Only) — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Use `<div>` or `<span>` for interactive elements (use `<button>`, `<a>`)
- Use images without alt text
- Use color alone to convey meaning
- Use unlabeled inputs or form fields
- Trap keyboard focus inside modals

**ALWAYS** do these (approved patterns):
- Use semantic HTML: `<button>`, `<form>`, `<nav>`, `<main>`
- Add labels and ARIA attributes:
  ```html
  <label for="name">Name:</label>
  <input id="name" type="text" aria-required="true" />
  ```
- Ensure keyboard navigation: Tab, Enter, Escape work as expected
- Test with screen reader (NVDA, JAWS) before review
- Verify contrast ratio ≥ 4.5:1 for text (use WebAIM checker)

---

## Performance — FORBIDDEN Patterns

**NEVER** do these (hallucination risk):
- Loop and fetch inside loop: `for (item of items) { await fetch(...) }`
- Load all data at once: `SELECT * FROM users` for 1M rows
- Re-render entire component on state change
- Keep references to deleted DOM nodes
- Use `eval()` or dynamic code execution

**ALWAYS** do these (approved patterns):
- Batch fetches: `Promise.all(fetchPromises)` or batch API endpoint
- Use pagination/filtering: `SELECT * FROM users LIMIT 100 OFFSET 0`
- React: Use `useMemo`, `useCallback`, React.memo for expensive operations
- Clean up: `useEffect` cleanup function removes listeners, timers, subscriptions
- Never use `eval()`; use `JSON.parse()` for data or `Function()` constructor if unavoidable

---

## Summary: What to Refuse

If a request asks you to:
1. Add `console.log` → Refuse; show approved logger pattern
2. Hardcode config → Refuse; show env/config pattern
3. Ignore TypeScript errors → Refuse; show proper type pattern
4. Skip tests → Refuse; update tests instead
5. Invent patterns → Say "I need to check the repo for the approved pattern"
