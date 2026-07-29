# /explain-legacy-code — Explain what it does, not what it should do

**Context**: Use `.github/instructions/security.instructions.md` when the code
touches auth, data handling, or logging.

**Task**: Explain the selected legacy code.

**CRITICAL RULES**:
1. Explain only what the code actually does. Do not describe intent you cannot
   see, and do not invent business rules to make the behavior sound sensible.
2. Say plainly when something is unclear. "This branch is unreachable in the
   code I can see; the caller may enable it elsewhere" beats a confident guess.
3. Do not change any code unless the request asked for a change.
4. Point out risks you notice, but separate them from the explanation — the
   reader asked what it does, not what you would do differently.
5. If the code depends on something outside the file you were given, say so
   rather than assuming its behavior.

**Cover these, in this order**:

| Aspect | What to state | Never do this |
|--------|---------------|---------------|
| Behavior | What it does, step by step, for the normal path | Describe the idealized version |
| Inputs and outputs | Types, shapes, and what the caller must supply | Assume validation happens upstream |
| Data flow | Where data enters, is transformed, and leaves | Skip the transformations "for brevity" |
| Side effects | Writes, network calls, global or shared state, timers | Describe it as pure without checking |
| Error paths | What is caught, what escapes, what is silently swallowed | Omit the empty `catch` |
| Dependencies | What it calls, and what calls it if you can see that | Guess at a caller you did not find |
| Security-sensitive areas | Auth checks, secret handling, logging of sensitive fields | Assess strength without reading the implementation |
| Test coverage gaps | Which described behaviors have no test | Assume tests exist because a test file does |
| Migration risk | What would break if this were changed | Propose a rewrite |

**After explaining**:
- Separate the sections clearly: what it does, then risks observed, then
  suggested safe next steps.
- List the specific questions a maintainer would need to answer before anyone
  changes this code.

**Do NOT**:
- Refactor, reformat, or "clean up" while explaining
- State a business rule that is not visible in the code
- Describe a function you did not actually read
- Present a guess in the same voice as an observation
