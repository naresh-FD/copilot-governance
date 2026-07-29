# /fix-build-failure — Fix the root cause, never the gate

**Context**: Use `.github/instructions/code-quality.instructions.md`. If the
build broke on a dependency or version change, also read
`.github/instructions/migration.instructions.md`.

**Task**: Fix the build failure named in the request.

**CRITICAL RULES**:
1. Fix the **first** meaningful error. Later errors are usually downstream of it.
2. Never make a build pass by weakening it — no disabled type checks, skipped
   steps, `--force`, `--legacy-peer-deps`, or loosened compiler options.
3. Never add or upgrade a dependency to work around a build error unless the
   error is specifically a defect in that dependency. Say so if you do.
4. If the error text is not in the request, ask for it. Do not infer the failure
   from a file name.
5. Report the root cause, not just the change you made.

**Failure types and approved fixes**:

| Failure | Fix this | Never do this |
|---------|----------|---------------|
| Module not found | Correct the import path, or add the genuinely missing dependency | Create a stub module; add a path alias to silence it |
| Type error at build time | Fix the type or the value | `any`, `@ts-ignore`, `skipLibCheck`, loosened `strict` |
| Peer dependency conflict | Align versions deliberately, one change at a time | `--force`, `--legacy-peer-deps`, deleting the lockfile |
| Out of memory | Report it — usually an import cycle or a runaway build step | Raise the memory ceiling and move on |
| Env var missing at build | Add it to the documented config contract | Hardcode a value or a fallback secret |
| Lockfile out of sync | Regenerate through the project's package manager | Hand-edit the lockfile |
| Green locally, red in CI | Find the environment difference (runtime version, case-sensitive paths, timezone) | Add a CI-only skip |

**After fixing**:
- Run this repository's own build, lint, and test commands. Take them from the
  repo overrides in `.github/copilot-instructions.md` or the build config — do
  not assume npm, Maven, or Gradle.
- Confirm the build is green from a clean state, not just incrementally.
- Summary: root cause, files changed, exact commands run, and their real output.

**Do NOT**:
- Report the build as fixed without running it
- Change unrelated files while "cleaning up"
- Delete, skip, or `continue-on-error` a failing build step
- Commit a lockfile change you did not intend to make
