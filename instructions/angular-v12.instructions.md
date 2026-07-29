---
applyTo: "**/*.{ts,html,scss}"
---

# Angular v12 Instructions

- Treat Angular v12 as maintenance-mode unless the task explicitly says
  otherwise.
- Prefer bug fixes, security fixes, test fixes, and migration preparation over
  new v12 feature work.
- Preserve existing RxJS and NgModule patterns within a file or module.
- Do not introduce migration-blocking dependencies or patterns.
- Avoid broad refactors while fixing v12 defects.
- Keep template changes accessible and avoid unsafe HTML binding.
