#!/usr/bin/env bash
#
# sync-copilot-instructions.sh
#
# Propagates the org-baseline .github/copilot-instructions.md into every repo
# listed in repos.json, preserving each repo's REPO OVERRIDES block, and
# opens a PR per repo. Designed to run inside the sync-copilot-instructions
# GitHub Actions workflow, but works locally too if GH_TOKEN is exported.
#
# Env vars:
#   GH_TOKEN       GitHub API token (required for gh auth)
#   GH_ORG         GitHub org name (required)
#   DRY_RUN        If "true", validate and show diffs but don't push/PR (optional)
#
# Requires: gh CLI (authenticated), git, jq
#
set -euo pipefail

BASE_FILE="templates/copilot-instructions.base.md"
REPOS_FILE="repos.json"
TARGET_PATH=".github/copilot-instructions.md"
BRANCH_NAME="chore/sync-copilot-instructions"
ORG="${GH_ORG:?Set GH_ORG env var, e.g. bol-commercial}"
DRY_RUN="${DRY_RUN:-false}"
WORKDIR="$(mktemp -d)"
MARKER="<!-- REPO OVERRIDES START -->"
MARKER_END="<!-- REPO OVERRIDES END -->"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

trap 'rm -rf "$WORKDIR"' EXIT

if [[ ! -f "$SCRIPT_DIR/$BASE_FILE" ]]; then
  echo "Base template not found at $SCRIPT_DIR/$BASE_FILE" >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/$REPOS_FILE" ]]; then
  echo "Repo list not found at $SCRIPT_DIR/$REPOS_FILE" >&2
  exit 1
fi

# Extract baseline content BEFORE the marker (excluding marker line itself)
BASE_CONTENT_ABOVE_MARKER="$(awk -v marker="$MARKER" '
  $0 ~ marker { exit }
  { print }
' "$SCRIPT_DIR/$BASE_FILE")"

mapfile -t REPOS < <(jq -r '.repos[]' "$SCRIPT_DIR/$REPOS_FILE")
echo "Syncing to ${#REPOS[@]} repos in org $ORG"
[[ "$DRY_RUN" == "true" ]] && echo "(DRY_RUN mode — no changes will be pushed)"

FAILED=()
SYNCED=()

for repo in "${REPOS[@]}"; do
  echo "=== $repo ==="
  repo_dir="$WORKDIR/$repo"

  if ! gh repo clone "$ORG/$repo" "$repo_dir" -- --depth 1 -q 2>/dev/null; then
    echo "  ✗ clone failed" >&2
    FAILED+=("$repo (clone)")
    continue
  fi

  (
    cd "$repo_dir"
    mkdir -p .github
    target="$TARGET_PATH"

    if [[ -f "$target" ]] && grep -q "$MARKER" "$target"; then
      # Repo already has markers — preserve everything at/after the marker
      overrides="$(awk -v marker="$MARKER" '
        found { print; next }
        $0 ~ marker { found=1; print; next }
      ' "$target")"
      {
        printf '%s\n' "$BASE_CONTENT_ABOVE_MARKER"
        printf '%s\n' "$MARKER"
        printf '%s\n' "$overrides"
      } > "$target.new"
    elif [[ -f "$target" ]]; then
      # Repo has old instructions without markers — preserve as repo override
      old_content="$(cat "$target")"
      {
        printf '%s\n' "$BASE_CONTENT_ABOVE_MARKER"
        printf '%s\n' "$MARKER"
        printf '%s\n' "<!-- MIGRATED FROM PRE-GOVERNANCE INSTRUCTIONS -->"
        printf '%s\n' "$old_content"
        printf '%s\n' "$MARKER_END"
      } > "$target.new"
    else
      # No existing file — use baseline template as-is
      {
        printf '%s\n' "$BASE_CONTENT_ABOVE_MARKER"
        printf '%s\n' "$MARKER"
        printf '%s\n' "$MARKER_END"
      } > "$target.new"
    fi

    if [[ -f "$target" ]] && diff -q "$target" "$target.new" >/dev/null 2>&1; then
      echo "  ✓ no changes needed"
      rm "$target.new"
      exit 0
    fi

    # Show diff for review
    echo "  Diff:"
    diff -u "$target" "$target.new" 2>/dev/null | sed 's/^/    /' || true

    mv "$target.new" "$target"
    git checkout -B "$BRANCH_NAME" -q
    git add "$target"
    git -c user.name="copilot-governance-bot" -c user.email="copilot-governance-bot@users.noreply.github.com" \
      commit -m "chore: sync org-baseline copilot-instructions.md" -q

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "  (dry-run) would push to $BRANCH_NAME"
      exit 0
    fi

    git push --force-with-lease origin "$BRANCH_NAME" -q
    echo "  ✓ pushed to $BRANCH_NAME"

    if gh pr view "$BRANCH_NAME" --repo "$ORG/$repo" >/dev/null 2>&1; then
      echo "  ✓ PR already open"
    else
      gh pr create \
        --repo "$ORG/$repo" \
        --title "chore: sync org-baseline copilot-instructions.md" \
        --body "Automated sync from copilot-governance. Repo-specific overrides below the REPO OVERRIDES marker are preserved. Review the diff above that marker only." \
        --head "$BRANCH_NAME" \
        --base "$(gh repo view "$ORG/$repo" --json defaultBranchRef -q .defaultBranchRef.name)" \
        -q
      echo "  ✓ PR opened"
    fi
    SYNCED+=("$repo")
  ) || FAILED+=("$repo (sync)")
done

echo ""
echo "=== Summary ==="
echo "Synced: ${#SYNCED[@]}"
echo "Failed: ${#FAILED[@]}"
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "Failures:"
  printf '  - %s\n' "${FAILED[@]}"
  exit 1
fi
