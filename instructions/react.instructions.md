---
applyTo: "**/*.{tsx,jsx}"
---

# React Instructions

- Use functional components and hooks. Do not introduce new class components.
- Follow the repo's existing state, routing, data-fetching, and design-system
  patterns.
- Do not reimplement shared UI primitives when an approved design-system
  component exists.
- Co-locate tests with source where the repo uses that pattern.
- Keep effects dependency-safe and avoid unnecessary rendering or repeated API
  calls.
- Handle loading, empty, disabled, error, and permission states.
- Avoid exposing sensitive data in browser logs, DOM attributes, URLs, local
  storage, session storage, or analytics events.
