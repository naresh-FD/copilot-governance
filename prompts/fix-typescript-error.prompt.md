# /fix-typescript-error — Fix type safety using approved patterns

**Context**: Use `.github/instructions/code-quality.instructions.md` (Type Safety section).

**Task**: Fix the TypeScript error using type-safe patterns only.

**What NOT to do** (hallucination prevention):
- ❌ Use `any` type: `let data: any`
- ❌ Use `@ts-ignore` or `@ts-nocheck`
- ❌ Use unsafe casts: `(value as unknown as MyType)`
- ❌ Use non-null assertions: `value!`
- ❌ Ignore tsconfig errors; keep `"strict": true`

**What to do** (approved patterns):

| Error Type | Approved Fix | Example |
|-----------|-------------|---------|
| `Could not find name` | Import correctly | `import { MyType } from './types'` |
| `not assignable to type` | Use correct type | Change `any` to specific type |
| `Object is possibly null` | Add type guard | `if (obj !== null) { obj.property }` |
| `Property does not exist` | Use optional chaining | `obj?.property ?? defaultValue` |
| `Cannot access index` | Check array bounds | `array[index] ?? defaultValue` |
| `Function argument type mismatch` | Use type with specifics | `function(data: MyType)` not `data: any` |

**Examples**:

```typescript
// BAD — Do not use any or ignore errors
let data: any = fetchData();
const result = (data as unknown as MyType).process();

// GOOD — Use specific types and guards
const data: FetchResult = fetchData();
if ('process' in data && typeof data.process === 'function') {
  const result = data.process();
}

// GOOD — Use discriminated unions
type Result = { status: 'success'; data: T } | { status: 'error'; error: Error };
if (result.status === 'success') {
  console.log(result.data); // Type narrowed to T
}
```

**After fixing**:
- Run: `npx tsc --noEmit` (verify no errors)
- Run: `npm test`
- Verify: No `@ts-ignore`, `any`, or suppressions remain
- Summary: Explain the type issue and how the guard/type fix resolves it
