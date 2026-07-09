#!/usr/bin/env bash
#
# validate-copilot-governance.sh
#
# Pre-flight checks for copilot-governance setup. Validates:
#   - Required tools are available (jq, git, gh)
#   - Required env vars are set
#   - repos.json is well-formed and has no duplicates
#   - Base template exists and has proper marker structure
#   - No syntax errors in sync script
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_FILE="$SCRIPT_DIR/templates/copilot-instructions.base.md"
REPOS_FILE="$SCRIPT_DIR/repos.json"
SYNC_SCRIPT="$SCRIPT_DIR/scripts/sync-copilot-instructions.sh"
MARKER="<!-- REPO OVERRIDES START -->"
MARKER_END="<!-- REPO OVERRIDES END -->"

echo "=== Copilot Governance Validation ==="
errors=0

# Check required tools
for tool in jq git gh; do
  if ! command -v "$tool" &>/dev/null; then
    echo "✗ Missing required tool: $tool"
    ((errors++))
  else
    echo "✓ Found $tool"
  fi
done

# Check env vars
if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "✗ GH_TOKEN not set (required for gh auth)"
  ((errors++))
else
  echo "✓ GH_TOKEN is set"
fi

if [[ -z "${GH_ORG:-}" ]]; then
  echo "✗ GH_ORG not set (required, e.g. bol-commercial)"
  ((errors++))
else
  echo "✓ GH_ORG is set to: $GH_ORG"
fi

# Check base template exists and is well-formed
if [[ ! -f "$BASE_FILE" ]]; then
  echo "✗ Base template not found: $BASE_FILE"
  ((errors++))
else
  echo "✓ Base template found"
  if ! grep -q "$MARKER" "$BASE_FILE"; then
    echo "✗ Base template missing marker: $MARKER"
    ((errors++))
  else
    echo "✓ Base template has REPO OVERRIDES marker"
  fi
fi

# Check repos.json exists and is valid JSON
if [[ ! -f "$REPOS_FILE" ]]; then
  echo "✗ repos.json not found: $REPOS_FILE"
  ((errors++))
else
  echo "✓ repos.json found"
  if ! jq empty "$REPOS_FILE" 2>/dev/null; then
    echo "✗ repos.json has invalid JSON"
    ((errors++))
  else
    echo "✓ repos.json is valid JSON"
    # Check for duplicates
    duplicate_count=$(jq -r '.repos[]' "$REPOS_FILE" | sort | uniq -d | wc -l)
    if [[ $duplicate_count -gt 0 ]]; then
      echo "✗ repos.json has duplicate entries:"
      jq -r '.repos[]' "$REPOS_FILE" | sort | uniq -d | sed 's/^/    - /'
      ((errors++))
    else
      repo_count=$(jq -r '.repos | length' "$REPOS_FILE")
      echo "✓ repos.json has $repo_count repos, no duplicates"
    fi
    # Check for empty repo names
    empty_count=$(jq -r '.repos[] | select(length == 0)' "$REPOS_FILE" | wc -l)
    if [[ $empty_count -gt 0 ]]; then
      echo "✗ repos.json has empty repo names"
      ((errors++))
    fi
  fi
fi

# Check sync script is executable and valid bash
if [[ ! -f "$SYNC_SCRIPT" ]]; then
  echo "✗ Sync script not found: $SYNC_SCRIPT"
  ((errors++))
else
  echo "✓ Sync script found"
  if bash -n "$SYNC_SCRIPT" 2>/dev/null; then
    echo "✓ Sync script has valid bash syntax"
  else
    echo "✗ Sync script has syntax errors"
    ((errors++))
  fi
fi

echo ""
if [[ $errors -eq 0 ]]; then
  echo "✓ All checks passed. Ready to run sync."
  exit 0
else
  echo "✗ Found $errors error(s). Fix before running sync."
  exit 1
fi
