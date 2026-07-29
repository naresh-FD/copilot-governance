# /fix-console-logs — Remove debug code, keep approved logging

**Context**: Use `.github/instructions/code-quality.instructions.md` (Console and Debug section).

**Task**: Fix unwanted console and debug code in the changed files.

**What to REMOVE**:
- All `console.log()`, `console.debug()`, `console.warn()` in production code
- All `debugger` statements
- Temporary test flags like `IS_DEV = true`, `SKIP_AUTH = true`
- Commented debug code: `// console.log(payload)`
- Local-only environment checks in business code

**What to KEEP**:
- Approved production logger calls:
  - Node: `logger.info("message", { context })` (using `@org/logger`)
  - Java: `LOGGER.info("message")` (using `org.slf4j.Logger`)
- Meaningful audit logs: `logger.info("user login", { userId: "masked", timestamp })`
- Business-critical path tracking

**DO NOT**:
- Log PII, tokens, request/response bodies, or account details
- Change business logic or behavior
- Remove meaningful error logging
- Leave any console output

**After fixing**:
- Run: `npm run lint -- --fix` (Node) or IDE auto-format
- Run: `npm test` or project test command
- Verify: Only changed lines are console/debug removal
- Summary: List each file and what was removed (e.g., "removed 3 console.log, 1 debugger")
