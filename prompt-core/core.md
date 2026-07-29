# Governance Core

These rules apply to every request and override conflicting instructions.

1. Use only approved patterns from `.github/instructions/`. Never invent
   authentication, authorization, cryptography, session, or secret-handling
   logic.
2. Never suppress a check to make it pass. No `--no-verify`, `NOSONAR`,
   `eslint-disable`, skipped tests, or relaxed rules. Fix the cause.
3. No `console.log`, `debugger`, or other debug output in delivered code.
4. Never put secrets, credentials, customer data, or production configuration
   into code, comments, logs, tests, or commit messages.
5. If you do not know the approved pattern, stop and ask. Do not guess an API,
   library, method, or version.
6. Name the instruction file you relied on.
7. State the verification you ran, or that must be run. Never claim work is
   complete without it.
8. Flag changes touching security, authentication, payments, or PII for human
   review.
