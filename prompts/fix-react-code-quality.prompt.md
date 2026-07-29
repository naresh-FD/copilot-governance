# /fix-react-code-quality — Fix the cause, follow existing patterns

**Context**: Use `.github/instructions/react.instructions.md` and
`.github/instructions/code-quality.instructions.md`.

**Task**: Fix the React code-quality issue named in the request.

**CRITICAL RULES**:
1. Match the patterns already in this codebase for components, state, data
   fetching, routing, and the design system. Do not introduce a new library or
   a new state approach to solve a local problem.
2. Never silence a hooks lint warning. An exhaustive-deps warning is almost
   always a real bug about to happen.
3. Preserve behavior. If a fix changes what the user sees, say so explicitly.
4. If the component's intended behavior is unclear, ask rather than guessing.
5. Never log request payloads, tokens, or personal data from browser code — it
   is visible to anyone with devtools open.

**Issue types and approved fixes**:

| Issue | Use this | Never do this |
|-------|----------|---------------|
| Missing effect dependency | Add the dependency; stabilize it with `useCallback`/`useMemo` if it churns | `// eslint-disable-next-line react-hooks/exhaustive-deps` |
| Effect that only derives state | Compute during render | `useEffect` that calls `setState` from other state |
| Duplicate API calls | Lift the fetch, or use the project's existing data-fetching layer | A module-level flag or a ref used as a lock |
| Missing loading/error/empty state | Handle all of them explicitly | Render `undefined`, or a bare spinner with no error path |
| Unstable list keys | A stable id from the data | Array index, `Math.random()`, or `crypto.randomUUID()` during render |
| Prop drilling many levels | The project's existing context or store | A new global state library |
| Large re-renders | Measure first, then memoize the proven hot path | Wrapping everything in `React.memo` speculatively |
| Direct DOM manipulation | A ref, or the design-system component | `document.querySelector` inside a component |
| Missing accessible name | A real label, `aria-label`, or visible text | A `title` attribute as a substitute |

**After fixing**:
- Run this repository's configured lint, typecheck, and test commands (see the
  repo overrides in `.github/copilot-instructions.md`).
- Confirm the change did not alter rendered output unless that was the point.
- Summary: the issue, the pattern you applied, files changed, and the commands
  you ran with their real output.

**Do NOT**:
- Disable a lint rule instead of fixing the cause
- Convert a class component to a function component unless that was the request
- Add a dependency to solve something the existing stack already handles
- Leave `console.log` or `debugger` behind
- Claim a performance improvement you did not measure
