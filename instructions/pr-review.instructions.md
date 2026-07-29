---
applyTo: "**/*"
---

# PR Review Instructions

- Prioritize correctness, security, and maintainability over cleverness.
- Address review comments directly and preserve business behavior unless the
  reviewer explicitly requested behavior changes.
- Keep fixes narrow and explain every changed file.
- Do not disable quality gates, tests, linting, scans, or review protections.
- Flag any security-sensitive change for human review.
- Run the smallest relevant test set first, then broader tests if the change
  touches shared behavior.
