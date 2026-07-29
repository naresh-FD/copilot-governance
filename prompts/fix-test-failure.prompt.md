# /fix-test-failure — Fix root cause, never skip tests

**Context**: Use `.github/instructions/code-quality.instructions.md` (Testing section).

**Task**: Fix the failing test or the product code that caused it.

**Step 1: Diagnose the failure**
```bash
npm test -- --verbose [test-file]
# OR
mvn test -Dtest=TestClass#testMethod
```

**Root cause types and approved fixes**:

| Failure Type | Cause | Approved Fix | Never Do |
|-------------|-------|-------------|----------|
| Assertion fails | Behavior changed | Update test OR fix code | ❌ Delete test |
| Mock/stub stale | Test setup outdated | Update mock to match real API | ❌ Ignore discrepancy |
| Flaky test | Race condition/timing | Add wait, fix timing logic | ❌ Add `setTimeout` delay |
| Missing fixture | Test data missing | Create/restore fixture | ❌ Delete test |
| Environment | Wrong env, secrets missing | Fix env setup, not test | ❌ Hardcode value in test |
| Regression | Real bug in code | Fix code logic | ❌ Weaken test |

**After fixing**:
- Run: `npm test` or `mvn test` (all tests pass)
- Run: `npm run coverage` (coverage maintained or improved)
- Verify: No test.skip(), test.only(), or disabled tests remain
- Summary: Explain root cause and whether you fixed code or test

**Do NOT do this** (hallucination prevention):
- ❌ Delete failing test to make CI pass
- ❌ Use `test.skip()` or `.skip()` without a ticket
- ❌ Use `test.only()` to skip other tests
- ❌ Hardcode test data or mock values in source code
- ❌ Ignore flaky test; always fix root cause
- ❌ Weaken assertions to pass easier
- ❌ Mock functionality that should be tested

**Example**:
```javascript
// BAD — Skipping test to pass CI
describe('authentication', () => {
  it.skip('should validate token', () => { ... }); // NO!
});

// GOOD — Update test or fix code
describe('authentication', () => {
  it('should validate token with new format', () => {
    const token = generateToken({ format: 'v2' });
    expect(isValidToken(token)).toBe(true);
  });
});
```
