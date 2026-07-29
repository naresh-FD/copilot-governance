# /fix-pr-review — Address review feedback with the smallest safe change

**Context**: Use `.github/instructions/pr-review.instructions.md` and
`.github/instructions/code-quality.instructions.md`. If any comment touches
auth, crypto, secrets, or data handling, also use
`.github/instructions/security.instructions.md`.

**Task**: Address the reviewer's comments on this pull request.

**CRITICAL RULES**:
1. Change only what the review asked for. A review comment is not permission to
   refactor the surrounding code.
2. Preserve existing business behavior unless the reviewer explicitly asked for
   a behavior change.
3. Never resolve a comment by suppressing the check that produced it.
4. If a comment is ambiguous, or you disagree with it, reply with your reasoning
   instead of guessing at an implementation.
5. If a comment asks for something that conflicts with the security or quality
   baseline, say so and do not implement it.

**Comment types and approved responses**:

| Reviewer says | Do this | Never do this |
|---------------|---------|---------------|
| "This could be null" | Add the real guard and a test covering it | Non-null assertion, or optional chaining that hides the case |
| "Extract this" | Extract exactly that, behavior identical | Restructure neighbouring code too |
| "Add a test" | Test the described behavior, including the failure path | Write a test that asserts the implementation |
| "This logs sensitive data" | Remove the field; log a safe identifier | Partially mask it and keep logging it |
| "Naming is unclear" | Rename the symbol and every reference | Rename in one place and leave callers stale |
| "Why this approach?" | Answer in a reply; change nothing yet | Silently rewrite the approach |
| "Nit: formatting" | Run the project formatter | Reformat files outside the diff |

**After fixing**:
- Run this repository's configured lint and test commands (see the repo
  overrides in `.github/copilot-instructions.md`).
- Re-read the full diff and confirm nothing unrelated changed.
- Summary: each comment, what you changed for it or why you did not, the
  commands you ran with their real output, and any risk left open.

**Do NOT**:
- Mark a comment resolved that you did not actually address
- Bundle unrelated fixes into a review-response commit
- Disable tests, linting, SAST, dependency scanning, or any security check
- Force-push over a reviewer's own commits
