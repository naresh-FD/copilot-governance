# /fix-sonarqube-issue — Fix code quality issues, never suppress

**Context**: Use `.github/instructions/code-quality.instructions.md` for all issue types.

**Task**: Fix the specified SonarQube issue using root-cause fixes only.

**CRITICAL RULE**: Never suppress without fixing root cause first. Suppression is only acceptable if explicitly justified (rare).

**Common SonarQube issues and approved fixes**:

| Issue | Root Cause | Approved Fix |
|-------|-----------|-------------|
| `Duplicated code` | Same logic in multiple places | Extract to shared function/method |
| `Cognitive complexity` | Logic too hard to follow | Split into smaller functions with clear names |
| `Unused variable` | Dead code | Delete it; git history preserves it |
| `Dead code` | Unreachable path | Remove; flag with ticket if needed later |
| `Missing error handling` | No catch/error handling | Add meaningful catch with recovery or logging |
| `Null pointer risk` | Unsafe navigation | Add null check: `if (obj !== null) { ... }` |
| `Type casting risk` | Unsafe cast | Use type guard: `if (typeof x === 'number') { ... }` |
| `Missing test coverage` | No tests for logic | Add test case: `it('should ...', () => { ... })` |
| `Hardcoded value` | Magic number/string | Extract to named constant or config |
| `Comment debt` | Old/wrong comment | Update or remove comment |

**After fixing**:
- Run this repository's configured scan and test commands. Take them from the
  repo overrides in `.github/copilot-instructions.md` or the build config — this
  workflow also fires on Java, so do not assume npm.
- Verify: Issue resolved (not suppressed)
- Keep diff minimal: Only the necessary changes
- DO NOT: Remove tests, delete validation, or weaken security checks
- Summary: Explain the root cause and which approved fix you used

**Do NOT do this** (hallucination prevention):
- ❌ Add `//NOSONAR` without fix
- ❌ Comment out code instead of deleting
- ❌ Weaken validation to pass scan
- ❌ Skip tests because they're "too old"
- ❌ Ignore accessibility/performance issues
