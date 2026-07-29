---
applyTo: "**/*.{ts,tsx,js,jsx,java}"
---

# Testing Instructions

- Add or update tests for changed behavior, validation logic, error handling,
  security-sensitive branches, and edge cases.
- Do not delete or weaken failing tests just to make CI pass.
- Prefer existing test frameworks, helpers, fixtures, and naming patterns.
- Keep tests deterministic. Avoid real network calls, real secrets, time-zone
  dependence, and shared mutable state unless the repo already has a safe
  pattern.
- Cover negative paths for validation, auth, permission, and error handling.
- Summarize which tests were run and any tests that could not be run.
