# /generate-unit-tests — Add behavior tests with good coverage

**Context**: Use `.github/instructions/code-quality.instructions.md` (Testing section).

**Task**: Generate or update unit tests for the specified code.

**Test coverage checklist**:

| Path Type | Examples | Coverage |
|-----------|----------|----------|
| **Happy path** | Success case: user logged in correctly | ✅ Always |
| **Error path** | Validation fails, API error, timeout | ✅ Always |
| **Edge cases** | Empty array, null value, boundary values | ✅ For logic-heavy functions |
| **Security path** | Unauthorized access, injection attempts | ✅ For auth/input handling |
| **Boundary values** | Min/max values, 0, negative numbers | ✅ For numeric/string handling |

**Test structure** (Jest example):
```javascript
describe('authenticateUser', () => {
  // Happy path
  it('should authenticate valid credentials', async () => {
    const result = await authenticateUser('user@ex.com', 'password123');
    expect(result.token).toBeDefined();
    expect(result.userId).toBe('user-123');
  });

  // Error path
  it('should reject invalid credentials', async () => {
    await expect(authenticateUser('user@ex.com', 'wrong')).rejects.toThrow(
      'Authentication failed'
    );
  });

  // Security path
  it('should not log credentials', async () => {
    const logSpy = jest.spyOn(logger, 'debug');
    await authenticateUser('user@ex.com', 'password123');
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('password'));
  });
});
```

**Approved patterns**:
- **Framework**: Jest (Node), JUnit (Java), Jasmine (Angular), React Testing Library
- **Mocking**: Use repo's mock library (jest.mock, sinon, Mockito)
- **Fixtures**: Use existing fixtures from `__fixtures__/` or test helpers
- **Naming**: `describe('className/functionName', () => { it('should do X when Y', ...) })`

**After generating**:
- Run: `npm test` (all tests pass)
- Run: `npm run coverage` (coverage ≥ project target, e.g., 80%)
- Verify: No skipped tests (`it.skip`, `describe.skip`)
- Verify: No real API calls (all mocked)
- Verify: No hardcoded secrets in test data
- Summary: Explain paths covered and coverage %, e.g., "Added 5 tests for authentication.ts: happy path, invalid credentials, timeout, security (no password logging), edge case (empty email)"

**Do NOT do this** (hallucination prevention):
- ❌ Mock functionality that should be tested
- ❌ Use real API calls or secrets in tests
- ❌ Test implementation details instead of behavior
- ❌ Skip tests: `it.skip()`, `it.only()`
- ❌ Hardcode test data; reuse fixtures
- ❌ Rewrite production code unless absolutely necessary for testability
- ❌ Add console.log or debugger in tests
- ❌ Make tests flaky (non-deterministic, timing-dependent)

**Example: What to test vs. what NOT to test**

```javascript
// GOOD — Test behavior
it('should validate email format', () => {
  expect(isValidEmail('user@example.com')).toBe(true);
  expect(isValidEmail('invalid-email')).toBe(false);
  expect(isValidEmail('')).toBe(false);
});

// BAD — Test implementation
it('should use regex pattern', () => {
  // Don't test internal regex; test the result
});

// GOOD — Mock external dependency
jest.mock('node-fetch');
it('should fetch user data', async () => {
  fetch.mockResolvedValueOnce({ json: () => ({ id: 1 }) });
  const user = await getUser(1);
  expect(user.id).toBe(1);
});

// BAD — Real network call
it('should fetch from real API', async () => {
  const user = await fetch('https://api.example.com/users/1');
  // This is flaky and slow!
});
```
