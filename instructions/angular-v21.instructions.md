---
applyTo: "**/*.{ts,html,scss}"
---

# Angular v21 Instructions

- Prefer standalone components for new Angular code.
- Prefer signals for local component state when appropriate. Use RxJS for HTTP,
  websockets, event streams, and existing shared async patterns.
- Use typed forms where the repo supports them.
- Keep dependency injection explicit and testable.
- Avoid unsafe HTML binding and client-side trust assumptions.
- Flag changes that complicate migration from Angular v12.
