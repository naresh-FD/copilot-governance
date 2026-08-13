# Phase 1 Deliverables: Token Reduction + Hallucination Prevention

**Completed**: Prompt template library + anchored instruction guardrails, ready for pilot. No pilot has run yet, so the outcomes below are targets, not measurements — see `docs/demo.md` for how to actually test and measure them.

**Target Outcomes** (unverified until piloted):
- Hypothesis: reusable workflows may reduce repeated context; measure completed-task tokens, turns, rework, elapsed time, and quality before publishing a percentage
- Fewer hallucinations (Copilot anchored to exact approved patterns)
- Faster PR reviews (fewer "use this pattern instead" comments)
- Consistent output across teams (same patterns, same results)

---

## Deliverable 1: Anchored Security Instructions

**File**: `.github/instructions/security.instructions.md`

**What it includes**:
- **FORBIDDEN Patterns** with specific anti-patterns (what NOT to suggest)
- **Approved Patterns** with exact code examples (what TO use)
- **Hallucination prevention rules** (if unsure, ask)
- **Summary: What to refuse** (specific refusal checklist)

**Coverage**:
- Secrets & credentials (vault API, env vars only)
- Logging (approved logger, no PII/tokens)
- Input validation (sanitize function, parameterized queries)
- Authentication (centralized auth-guard, no custom logic)
- Error handling (meaningful catch blocks, no silent swallows)
- Security-sensitive flags (always flag for review)

**Token impact**: Developers reference this file instead of repeating context in every prompt.

---

## Deliverable 2: Anchored Code-Quality Instructions

**File**: `.github/instructions/code-quality.instructions.md`

**What it includes**:
- **FORBIDDEN Patterns** (console, debugger, hardcoded values, unused code)
- **Approved Patterns** with exact examples (logger usage, config retrieval, error handling)
- **Hallucination prevention rules** (never invent framework patterns)
- **Summary: What to refuse** (specific refusal checklist)

**Coverage**:
- Console/debug removal (what to remove, what to keep)
- Unused code removal (delete; git preserves history)
- Configuration (env vars, approved config patterns)
- Error handling (meaningful recovery or logging)
- Type safety (avoid `any`, use guards)
- Testing (update tests, don't delete)
- Dependencies (avoid deprecated, use approved only)
- Accessibility (semantic HTML, ARIA, keyboard nav)
- Performance (batch fetches, pagination, avoid N+1)

**Token impact**: Developers reference this file instead of repeating context in every prompt.

---

## Deliverable 3: Enhanced Prompt Templates

**Files**: `.github/prompts/fix-*.prompt.md`

**Templates enhanced** (ready to use):
- `/fix-console-logs` — Remove debug output, keep approved logging
- `/fix-security-finding` — Fix security issues using approved patterns only
- `/fix-typescript-error` — Fix type safety using guards, not `any`
- `/fix-sonarqube-issue` — Fix root cause, never suppress
- `/fix-eslint-issue` — Fix lint errors with auto-fix first

**What each template includes**:
1. **Context reference** (which instruction file to use)
2. **Task** (what to fix)
3. **Approved patterns** (exact code examples)
4. **FORBIDDEN patterns** (what NOT to do)
5. **Validation steps** (how to verify the fix)
6. **Summary format** (how to report results)

**Usage**: Developers use 1-5 word command instead of writing long prompt:
```bash
# OLD way (token-heavy, repeated):
"Fix console logs and debug code in this file. Remove console.log, debugger, etc. 
Keep approved logger only. Follow security rules. Run lint and tests..."

# NEW way (1-5 words, template handles context):
/fix-console-logs
```

**Token impact**: ~70% reduction in repeated context per fix attempt.

---

## Deliverable 4: Hallucination Prevention Guide

**File**: `docs/hallucination-prevention.md`

**What it includes**:
- **4 categories of hallucinations** (security, API, pattern, performance)
- **For each category**: What to refuse, why it's wrong, approved alternative
- **Quick refusal checklist** (what triggers a "no")
- **Token savings explanation** (how anti-hallucination reduces token waste)
- **Audit checklist** for PR reviewers

**Usage**: Developers and reviewers use this to identify and refuse hallucinated patterns.

---

## How Phase 1 Works Together

### Token Reduction Flow

```
Developer task: "Fix unwanted console logs in src/api/users.ts"

OLD (token-heavy):
Prompt: "Remove console.log and debugger statements. Keep approved logger. 
Follow security rules. Don't log PII. Run lint. Don't change business logic..."
(~150 tokens of repeated context)

NEW (token-efficient):
Prompt: "/fix-console-logs src/api/users.ts"
(~5 tokens; template handles ~150 tokens of context)

Savings: ~145 tokens per request × 100 fixes/month = 14,500 tokens/month
```

### Hallucination Prevention Flow

```
Copilot suggests: "Use custom auth logic: jwt.sign({ userId }, secretKey)"

BEFORE hallucination prevention:
- PR reviewer rejects with "Use approved auth pattern"
- Developer asks Copilot again
- Copilot suggests similar pattern
- Back-and-forth cycle wastes tokens and time

WITH hallucination prevention:
- Copilot sees security.instructions.md rule: "Never invent custom auth"
- Copilot refuses upfront: "I need to use approved patterns. Check .../security.instructions.md"
- Developer reads Hallucination Prevention Guide
- Developer gets exact approved pattern on first try
- No back-and-forth, fewer tokens, faster PR
```

---

## Integration Checklist

Before rollout to pilot repos:

- [ ] `.github/instructions/security.instructions.md` deployed
- [ ] `.github/instructions/code-quality.instructions.md` deployed
- [ ] `.github/instructions/testing.instructions.md` deployed
- [ ] `.github/prompts/fix-console-logs.prompt.md` deployed
- [ ] `.github/prompts/fix-security-finding.prompt.md` deployed
- [ ] `.github/prompts/fix-typescript-error.prompt.md` deployed
- [ ] `.github/prompts/fix-sonarqube-issue.prompt.md` deployed
- [ ] `.github/prompts/fix-eslint-issue.prompt.md` deployed
- [ ] `docs/hallucination-prevention.md` shared with developers
- [ ] Developers trained on `/fix-*` commands
- [ ] Developers trained on refusal rules
- [ ] Sample PR with approved patterns created

---

## Expected Metrics (Post-Phase 1)

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Avg tokens per fix prompt | ~200 | ~30 |
| Hallucination refusal rate | 0% | 85%+ |
| PR comment "use approved pattern" | 5–10 per repo/week | 0–1 per repo/week |
| Copilot back-and-forth cycles | 2–4 attempts per fix | 1 attempt per fix |
| Developer time per fix | 10–15 min | 5–7 min |
| Security-pattern errors in PR | 3–5 per repo/month | 0–1 per repo/month |

---

## Next Step: Phase 2 (Validation Gate)

Phase 1 gives developers the right prompts and guidelines.

**Phase 2 will add**:
- Local CLI: `copilot-gov validate-output [file]` to catch hallucinations before commit
- Pre-commit hook to scan for risky patterns
- Error database to detect repeated hallucinations across repos

---

## Files Modified/Created in Phase 1

```
.github/instructions/
  ✅ security.instructions.md (enhanced with approved patterns + refusal rules)
  ✅ code-quality.instructions.md (enhanced with approved patterns + refusal rules)
  
.github/prompts/
  ✅ fix-console-logs.prompt.md (enhanced with token-efficient format)
  ✅ fix-security-finding.prompt.md (enhanced with issue-type table + refusal rules)
  ✅ fix-typescript-error.prompt.md (enhanced with type-safe patterns)
  ✅ fix-sonarqube-issue.prompt.md (enhanced with issue-type table + refusal rules)
  ✅ fix-eslint-issue.prompt.md (enhanced with auto-fix guidance)

docs/
  ✅ hallucination-prevention.md (NEW: category-based refusal guide)
  ✅ phase1-deliverables.md (THIS FILE)
```

---

## Usage Instructions for Developers

### Using Prompt Templates

```bash
# Inside Copilot chat or IDE:

# 1. Fix console logs
/fix-console-logs src/api/users.ts

# 2. Fix security issue
/fix-security-finding "Hardcoded secret in config.ts"

# 3. Fix TypeScript error
/fix-typescript-error src/types/User.ts "error TS7030: Not all code paths return a value"

# 4. Fix SonarQube issue
/fix-sonarqube-issue "Code smell: Cognitive complexity too high in handlers.ts"

# 5. Fix ESLint error
/fix-eslint-issue "Error: Unexpected 'any' type in auth.ts"
```

### Refusing Hallucinations

If Copilot suggests an unapproved pattern:

```
You: "That pattern is in the hallucination-prevention guide. Show me the approved pattern."
Copilot should then:
1. Reference the exact instruction file
2. Show the approved pattern
3. Show the anti-pattern alongside
```

### Checking Instruction Files

```bash
# Find the approved pattern for your task:
cat .github/instructions/security.instructions.md
cat .github/instructions/code-quality.instructions.md
cat docs/hallucination-prevention.md   # governance repo only; not synced to target repos
```

---

## Summary

**Phase 1 delivers**:
1. **Token efficiency**: Prompt templates cut how much context a developer types per fix — see `docs/demo.md` to measure it against your own prompts (targeting 70–80% fewer typed tokens, unverified until piloted)
2. **Hallucination prevention**: Exact approved patterns anchor Copilot output (refusal rate not yet measured)
3. **Consistency**: All teams follow the same security + quality rules
4. **Speed**: Fewer PR review cycles, faster fixes (target, pending pilot)
5. **Auditability**: All patterns version-controlled and documented

**Ready for**: Pilot repos (alerts, react-feature-template, backend-api, web-dashboard — replace with your own)

**Rollout date**: Ready when governance team approves for pilot deployment
