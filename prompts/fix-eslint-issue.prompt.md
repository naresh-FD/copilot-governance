# /fix-eslint-issue — Fix linting errors using auto-fix first

**Context**: Use `.github/instructions/code-quality.instructions.md` for patterns.

**Task**: Fix the specified ESLint issue.

**Step 1: Try auto-fix first**
```bash
npm run lint -- --fix
```
This fixes ~70% of issues (formatting, imports, unused vars).

**Common ESLint issues and approved fixes**:

| Rule | Issue | Approved Fix |
|------|-------|-------------|
| `no-unused-vars` | Unused variable | Delete it; git preserves history |
| `no-console` | Console output | Use approved logger instead |
| `no-debugger` | Debugger statement | Remove it |
| `no-var` | Using `var` | Change to `const` or `let` |
| `no-any` | Using `any` type | Use specific type from `.github/instructions/code-quality.instructions.md` |
| `no-implicit-any` | Missing type | Add type: `function(x: MyType) { ... }` |
| `eqeqeq` | Using `==` | Change to `===` |
| `semi` | Missing semicolon | Run `npm run lint -- --fix` |
| `quotes` | Wrong quote style | Run `npm run lint -- --fix` |
| `indent` | Wrong indentation | Run `npm run lint -- --fix` |
| `no-trailing-spaces` | Trailing whitespace | Run `npm run lint -- --fix` |
| `prefer-const` | Using `let` when `const` works | Change to `const` |
| `no-shadow` | Variable shadows outer scope | Rename variable to avoid shadowing |

**After fixing**:
- Run: `npm run lint` (verify no errors)
- Run: `npm test`
- Keep diff minimal: Only the necessary changes
- If rule conflicts with project style, ask before overriding

**Do NOT do this** (hallucination prevention):
- ❌ Disable linting with `/* eslint-disable */` without root-cause fix
- ❌ Use `any` to silence type errors
- ❌ Reformat unrelated code
- ❌ Ignore security-related lint rules (no-eval, no-new-func, etc.)

**Summary**: Report rule name, what was fixed, and any remaining warnings
