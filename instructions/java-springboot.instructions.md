---
applyTo: "**/*.java"
---

# Java Spring Boot Instructions

- Follow the existing package structure and layering.
- Prefer constructor injection. Do not add field injection in new code.
- Validate request bodies, path parameters, query parameters, and service
  inputs.
- Use explicit error handling and business-safe error responses.
- Do not log secrets, tokens, customer data, request payloads, or stack traces
  containing sensitive details.
- Keep transaction boundaries intentional and avoid broad catch blocks that
  hide failures.
- Add or update unit and integration tests for changed service behavior.
