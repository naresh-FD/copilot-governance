# /fix-angular-migration — Migrate incrementally, preserve behavior

**Context**: Use `.github/instructions/migration.instructions.md`. For target
code use `.github/instructions/angular-v21.instructions.md`; for maintenance on
the old line use `.github/instructions/angular-v12.instructions.md`.

**Important**: both Angular instruction files match the same file types, so both
may be injected. Confirm which Angular version this repository is actually on
before applying either, and say which one you used.

**Task**: Fix the Angular migration issue named in the request.

**CRITICAL RULES**:
1. Migrate one concern at a time. A migration PR that also refactors is a
   migration PR nobody can review or revert.
2. Preserve behavior exactly unless the migration itself requires a change — and
   if it does, call it out explicitly.
3. Use the official `ng update` schematics where one exists. Do not hand-write a
   transformation that a schematic already performs.
4. Never guess at an API that changed between versions. If you are not certain
   of the v21 signature, ask.
5. Do not pull in a new dependency to bridge a migration gap.

**Migration areas and approved fixes**:

| Area | Use this | Never do this |
|------|----------|---------------|
| Module to standalone | `standalone: true` plus explicit `imports` | Delete `NgModule` before its declarations have moved |
| Structural directives | Built-in control flow, applied via schematic | Hand-rewriting every template at once |
| State in components | Signals, or the project's existing store | Mixing signals and the old pattern in one component |
| RxJS version change | Follow the official migration for the removed operator | Suppressing the deprecation and moving on |
| Strict template checks | Fix the real type mismatch | Turning `strictTemplates` off |
| Removed lifecycle or API | The documented replacement | An approximation that "looks right" |
| Test bed changes | Update the harness the project already uses | Rewriting tests into a different framework |

**After fixing**:
- Run this repository's configured build, lint, and test commands (see the repo
  overrides in `.github/copilot-instructions.md`).
- Confirm templates, routing, forms, and state still behave the same.
- Summary: what migrated, which Angular version you targeted, the residual risk,
  the files changed, and the commands you ran with their real output.

**Do NOT**:
- Bundle unrelated refactoring into the migration
- Upgrade past the version this repository targets
- Delete tests that fail because of the migration — fix them or report them
- Claim a migration is complete when only part of the surface moved
