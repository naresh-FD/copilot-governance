---
applyTo: "**/*"
---

# Migration Instructions

- Preserve behavior unless the migration explicitly changes it.
- Prefer small migration steps with tests over broad rewrites.
- Identify compatibility risks, deprecated APIs, dependency constraints, and
  rollback considerations.
- Do not mix unrelated cleanup with migration changes.
- For Angular migration work, call out v12-to-v21 blockers and avoid patterns
  that make future migration harder.
