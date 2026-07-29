#!/usr/bin/env bash
#
# Pre-flight checks for the Copilot governance repository.
#
# Set REQUIRE_GITHUB_AUTH=true in automation when GH_TOKEN and GH_ORG must be
# present. Local validation can run without GitHub credentials.
#
# Set TOKEN_BUDGET_WORDS to change the per-file word budget for content that
# is auto-injected into every matching Copilot request (the base template's
# central governance block and each instructions/*.instructions.md file).
# Default: 300 words (~390 estimated tokens at a rough 1.3 tokens/word ratio
# for English prose — an estimate, not an exact tokenizer count).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_FILE="$SCRIPT_DIR/templates/copilot-instructions.base.md"
REPOS_FILE="$SCRIPT_DIR/repos.json"
SYNC_SCRIPT="$SCRIPT_DIR/scripts/sync-copilot-instructions.sh"
CLI_SCRIPT="$SCRIPT_DIR/scripts/copilot-gov.sh"
INSTRUCTIONS_DIR="$SCRIPT_DIR/instructions"
PROMPTS_DIR="$SCRIPT_DIR/prompts"
PROMPT_CORE_DIR="$SCRIPT_DIR/prompt-core"
HOOKS_DIR="$SCRIPT_DIR/hooks"
TEST_FILE="$SCRIPT_DIR/tests/prompt-core.test.mjs"
REQUIRE_GITHUB_AUTH="${REQUIRE_GITHUB_AUTH:-false}"

CENTRAL_START="<!-- CENTRAL GOVERNANCE START -->"
CENTRAL_END="<!-- CENTRAL GOVERNANCE END -->"
OVERRIDES_START="<!-- REPO OVERRIDES START -->"
OVERRIDES_END="<!-- REPO OVERRIDES END -->"
TOKEN_BUDGET_WORDS="${TOKEN_BUDGET_WORDS:-300}"

# security.instructions.md and code-quality.instructions.md trade the
# default budget for exhaustive FORBIDDEN/APPROVED pattern coverage, which is
# the entire point of the hallucination-prevention approach — a terse
# version of either would be less useful. Ceilings below are set just above
# current size (not "no limit") so growth is still caught. code-quality.md
# in particular is the top candidate for a future split-by-concern refactor:
# it uses applyTo: "**/*", so all ~1300 words are injected on every request
# regardless of whether the file being edited has anything to do with
# accessibility, dependency management, or performance.
declare -A FILE_BUDGET_OVERRIDES=(
  [security.instructions.md]=900
  [code-quality.instructions.md]=1400
  # core.md is prepended to EVERY intercepted prompt, so it carries the
  # tightest budget in the repository. Anything that is not a non-negotiable
  # belongs in an instructions file, not here.
  [core.md]=150
)

# Deny patterns: content that should never ship in auto-injected governance
# files. Extended regex (grep -E). Keep these objective (unresolved
# placeholders, literal-looking secrets) — fuzzy judgment calls belong in
# human review, not a blocking script.
DENY_PATTERNS=(
  '\[deployment date\]'
  '\[TODO[^]]*\]'
  '\bTBD\b'
  '\bFIXME\b'
  '(api[_-]?key|secret|password|token)[[:space:]]*[:=][[:space:]]*"[^"]{8,}"'
)

REQUIRED_INSTRUCTIONS=(
  security.instructions.md
  code-quality.instructions.md
  react.instructions.md
  angular-v12.instructions.md
  angular-v21.instructions.md
  java-springboot.instructions.md
  testing.instructions.md
  pr-review.instructions.md
  migration.instructions.md
)

REQUIRED_PROMPTS=(
  fix-pr-review.prompt.md
  fix-security-finding.prompt.md
  fix-console-logs.prompt.md
  fix-sonarqube-issue.prompt.md
  fix-eslint-issue.prompt.md
  fix-test-failure.prompt.md
  fix-build-failure.prompt.md
  fix-typescript-error.prompt.md
  fix-angular-migration.prompt.md
  fix-react-code-quality.prompt.md
  fix-java-springboot-security.prompt.md
  generate-unit-tests.prompt.md
  document-repo.prompt.md
  explain-legacy-code.prompt.md
)

REQUIRED_PROMPT_CORE=(
  core.md
  router.json
  deny.json
  rewrite.mjs
)

REQUIRED_HOOKS=(
  prompt-interceptor.json
)

errors=0

fail() {
  echo "FAIL: $1"
  errors=$((errors + 1))
}

pass() {
  echo "OK: $1"
}

marker_count() {
  local marker="$1"
  local file="$2"
  grep -F -c "$marker" "$file" || true
}

extract_central_block() {
  awk -v start="$CENTRAL_START" -v end="$CENTRAL_END" '
    $0 == start { found=1 }
    found { print }
    $0 == end { exit }
  ' "$BASE_FILE"
}

check_budget() {
  local label="$1"
  local words="$2"
  local budget_key="${3:-}"
  local budget="$TOKEN_BUDGET_WORDS"
  local tokens_est
  if [[ -n "$budget_key" && -n "${FILE_BUDGET_OVERRIDES[$budget_key]:-}" ]]; then
    budget="${FILE_BUDGET_OVERRIDES[$budget_key]}"
  fi
  tokens_est="$(awk -v w="$words" 'BEGIN { printf "%d", w * 1.3 }')"
  if [[ "$words" -gt "$budget" ]]; then
    fail "$label is $words words (~$tokens_est tokens est.) — over the $budget-word budget for content auto-injected into every matching Copilot request"
  else
    pass "$label is $words words (~$tokens_est tokens est.), within $budget-word budget"
  fi
}

check_deny_patterns() {
  local file="$1"
  local pattern
  local match
  for pattern in "${DENY_PATTERNS[@]}"; do
    if match="$(grep -E -n "$pattern" "$file" | head -1)"; then
      fail "deny-pattern match in $file: $match"
    fi
  done
}

# Exact-phrase duplicate check (line-level, normalized whitespace). This is
# NOT fuzzy/semantic similarity — it only catches lines repeated verbatim
# across the auto-injected content. Warn-only: false positives on
# legitimately repeated short phrases are expected.
check_dedup() {
  local tmp
  tmp="$(mktemp)"
  {
    extract_central_block
    local f
    for f in "$INSTRUCTIONS_DIR"/*.instructions.md; do
      [[ -f "$f" ]] || continue
      grep -v -E '^(---|applyTo:)' "$f"
    done
  } | sed -E -e 's/^[[:space:]]*[-*][[:space:]]*//' -e 's/[[:space:]]+/ /g' -e 's/^ //' -e 's/ $//' \
    | awk 'NF >= 6' \
    | sort | uniq -c | sort -rn | awk '$1 > 1' > "$tmp"

  if [[ -s "$tmp" ]]; then
    echo "WARN: duplicate phrasing (6+ words, exact match) found across central instructions — not blocking, consider tightening:"
    sed 's/^/    /' "$tmp"
  else
    pass "no duplicate phrasing (6+ words, exact match) across central instructions"
  fi
  rm -f "$tmp"
}

echo "=== Copilot Governance Validation ==="

for tool in git bash; do
  if command -v "$tool" >/dev/null 2>&1; then
    pass "found $tool"
  else
    fail "missing required tool: $tool"
  fi
done

if [[ "$REQUIRE_GITHUB_AUTH" == "true" ]]; then
  command -v gh >/dev/null 2>&1 && pass "found gh" || fail "missing required tool: gh"
  [[ -n "${GH_TOKEN:-}" ]] && pass "GH_TOKEN is set" || fail "GH_TOKEN is not set"
  [[ -n "${GH_ORG:-}" ]] && pass "GH_ORG is set" || fail "GH_ORG is not set"
fi

if [[ -f "$BASE_FILE" ]]; then
  pass "base template found"
  for marker in "$CENTRAL_START" "$CENTRAL_END" "$OVERRIDES_START" "$OVERRIDES_END"; do
    count="$(marker_count "$marker" "$BASE_FILE")"
    [[ "$count" -eq 1 ]] && pass "base marker present once: $marker" || fail "base marker '$marker' count is $count"
  done
else
  fail "base template not found: $BASE_FILE"
fi

if [[ -f "$REPOS_FILE" ]]; then
  pass "repos.json found"
  if ! command -v jq >/dev/null 2>&1; then
    echo "SKIP: repos.json checks (jq not installed)"
  elif jq empty "$REPOS_FILE" >/dev/null 2>&1; then
    pass "repos.json is valid JSON"
    repo_count="$(jq -r '.repos | length' "$REPOS_FILE")"
    pass "repos.json contains $repo_count repos"

    duplicate_count="$(jq -r '.repos[]' "$REPOS_FILE" | sort | uniq -d | wc -l | tr -d ' ')"
    [[ "$duplicate_count" -eq 0 ]] && pass "repos.json has no duplicates" || fail "repos.json has duplicate repo names"

    empty_count="$(jq -r '.repos[] | select(length == 0)' "$REPOS_FILE" | wc -l | tr -d ' ')"
    [[ "$empty_count" -eq 0 ]] && pass "repos.json has no empty names" || fail "repos.json has empty repo names"
  else
    fail "repos.json is invalid JSON"
  fi
else
  fail "repos.json not found: $REPOS_FILE"
fi

for file in "${REQUIRED_INSTRUCTIONS[@]}"; do
  [[ -f "$INSTRUCTIONS_DIR/$file" ]] && pass "instruction present: $file" || fail "missing instruction: $file"
done

for file in "${REQUIRED_PROMPTS[@]}"; do
  [[ -f "$PROMPTS_DIR/$file" ]] && pass "prompt present: $file" || fail "missing prompt: $file"
done

echo ""
echo "--- Prompt interception kernel ---"

for file in "${REQUIRED_PROMPT_CORE[@]}"; do
  [[ -f "$PROMPT_CORE_DIR/$file" ]] && pass "prompt-core present: $file" || fail "missing prompt-core file: $file"
done

for file in "${REQUIRED_HOOKS[@]}"; do
  [[ -f "$HOOKS_DIR/$file" ]] && pass "hook config present: $file" || fail "missing hook config: $file"
done

# The hook must point at the downstream location of the engine. Getting this
# path wrong fails silently at runtime — the hook simply never produces output
# and every prompt passes through ungoverned.
hook_config="$HOOKS_DIR/prompt-interceptor.json"
if [[ -f "$hook_config" ]]; then
  if command -v jq >/dev/null 2>&1; then
    if jq empty "$hook_config" >/dev/null 2>&1; then
      pass "hook config is valid JSON"
      hook_cmd="$(jq -r '.hooks.UserPromptSubmit[0].command // ""' "$hook_config")"
      if [[ "$hook_cmd" == *".github/prompt-core/rewrite.mjs"* ]]; then
        pass "hook command targets .github/prompt-core/rewrite.mjs"
      else
        fail "hook command does not target .github/prompt-core/rewrite.mjs (got: '$hook_cmd')"
      fi
    else
      fail "hook config is invalid JSON: $hook_config"
    fi
  else
    echo "SKIP: hook config JSON checks (jq not installed)"
  fi
fi

# Router/deny structure, regex compilation, template and anchor resolution, and
# a rewrite smoke test all live in the engine so a synced repo can run the same
# check against its own copy.
if command -v node >/dev/null 2>&1; then
  if node --check "$PROMPT_CORE_DIR/rewrite.mjs" 2>/dev/null; then
    pass "rewrite.mjs parses"
  else
    fail "rewrite.mjs has a syntax error"
  fi

  if selftest_out="$(node "$PROMPT_CORE_DIR/rewrite.mjs" --selftest 2>&1)"; then
    pass "kernel selftest: ${selftest_out#prompt-core selftest OK — }"
  else
    fail "kernel selftest failed:"
    printf '%s\n' "$selftest_out" | sed 's/^/    /'
  fi

  # The selftest checks structure. These check behaviour — routing accuracy, the
  # verbatim guarantee, shadow rules never blocking, and failing open. Set
  # GOV_SKIP_TESTS=1 to skip during rapid local iteration; CI must not skip.
  if [[ "${GOV_SKIP_TESTS:-0}" == "1" ]]; then
    echo "SKIP: kernel behaviour tests (GOV_SKIP_TESTS=1)"
  elif [[ ! -f "$TEST_FILE" ]]; then
    fail "kernel behaviour tests not found: $TEST_FILE"
  elif test_out="$(node --test "$TEST_FILE" 2>&1)"; then
    test_count="$(printf '%s\n' "$test_out" | sed -n 's/^# pass \([0-9]*\)$/\1/p;s/^ℹ pass \([0-9]*\)$/\1/p' | head -1)"
    pass "kernel behaviour tests: ${test_count:-all} passed"
  else
    fail "kernel behaviour tests failed:"
    printf '%s\n' "$test_out" | grep -E '^(✖|not ok|  [A-Za-z].*:)' | head -20 | sed 's/^/    /'
  fi
else
  echo "SKIP: kernel selftest (node not installed)"
  echo "      The interception hook needs node at runtime. Without it, prompts"
  echo "      pass through ungoverned — the kernel fails open by design."
fi

if [[ -f "$BASE_FILE" ]]; then
  echo ""
  echo "--- Content budget (auto-injected files only, TOKEN_BUDGET_WORDS=$TOKEN_BUDGET_WORDS) ---"
  central_words="$(extract_central_block | wc -w | tr -d ' ')"
  check_budget "central governance block ($BASE_FILE)" "$central_words"

  for file in "${REQUIRED_INSTRUCTIONS[@]}"; do
    path="$INSTRUCTIONS_DIR/$file"
    [[ -f "$path" ]] || continue
    words="$(wc -w < "$path" | tr -d ' ')"
    check_budget "instructions/$file" "$words" "$file"
  done

  # core.md is prepended to every intercepted prompt, so it is the single most
  # cost-sensitive file in the repository.
  if [[ -f "$PROMPT_CORE_DIR/core.md" ]]; then
    core_words="$(wc -w < "$PROMPT_CORE_DIR/core.md" | tr -d ' ')"
    check_budget "prompt-core/core.md" "$core_words" "core.md"
  fi

  echo ""
  echo "--- Deny-pattern checks ---"
  for path in "$BASE_FILE" "$INSTRUCTIONS_DIR"/*.instructions.md "$PROMPTS_DIR"/*.prompt.md "$PROMPT_CORE_DIR"/core.md; do
    [[ -f "$path" ]] || continue
    check_deny_patterns "$path"
  done

  echo ""
  echo "--- Duplicate phrasing check (warn-only, does not affect exit code) ---"
  check_dedup
fi

for script in "$SYNC_SCRIPT" "$CLI_SCRIPT"; do
  if [[ -f "$script" ]]; then
    bash -n "$script" && pass "bash syntax valid: $script" || fail "bash syntax invalid: $script"
  else
    fail "script not found: $script"
  fi
done

# copilot-gov.ps1 has no BOM, so Windows PowerShell 5.1 decodes it as ANSI. A
# UTF-8 em dash then becomes the three bytes E2 80 94, and 0x94 is a curly
# closing quote in cp1252 — which terminates the surrounding string and breaks
# the parse several functions later. Keeping the file ASCII-only avoids this
# entirely; the alternative (adding a BOM) is easy to lose on the next edit.
PS_SCRIPT="$SCRIPT_DIR/scripts/copilot-gov.ps1"
if [[ -f "$PS_SCRIPT" ]]; then
  if non_ascii="$(grep -n -P '[^\x00-\x7F]' "$PS_SCRIPT" 2>/dev/null)"; then
    fail "copilot-gov.ps1 contains non-ASCII characters, which Windows PowerShell 5.1 mis-decodes:"
    printf '%s\n' "$non_ascii" | sed 's/^/    /'
  else
    pass "copilot-gov.ps1 is ASCII-only (safe for Windows PowerShell 5.1)"
  fi
fi

echo ""
if [[ "$errors" -eq 0 ]]; then
  echo "All checks passed."
  exit 0
fi

echo "Found $errors validation error(s)."
exit 1
