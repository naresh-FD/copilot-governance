#!/usr/bin/env bash
#
# sync-copilot-instructions.sh
#
# Propagates the org-baseline .github/copilot-instructions.md into every repo
# listed in repos.json, preserving each repo's REPO OVERRIDES block, and
# opens a PR per repo. Designed to run inside the sync-copilot-instructions
# GitHub Actions workflow, but works locally too if GH_TOKEN is exported.
#
# Requires: gh CLI (authenticated), git, jq
#
set -euo pipefail

BASE_FILE="templates/copilot-instructions.base.md"
REPOS_FILE="repos.json"
TARGET_PATH=".github/copilot-instructions.md"
BRANCH_NAME="chore/sync-copilot-instructions"
ORG="${GH_ORG:?Set GH_ORG env var, e.g. bol-commercial}"
WORKDIR="$(mktemp -d)"
MARKER="<!-- REPO OVERRIDES START -->"

trap 'rm -rf "$WORKDIR"' EXIT

if [[ ! -f "$BASE_FILE" ]]; then
  echo "Base template not found at $BASE_FILE" >&2
  exit 1
fi

if [[ ! -f "$REPOS_FILE" ]]; then
  echo "Repo list not found at $REPOS_FILE" >&2
  exit 1
fi

BASE_CONTENT_ABOVE_MARKER="$(awk -v marker="$MARKER" '
  $0 ~ marker { print; exit }
  { print }
' "$BASE_FILE")"

mapfile -t REPOS < <(jq -r '.repos[]' "$REPOS_FILE")
echo "Syncing to ${#REPOS[@]} repos in org $ORG"

FAILED=()

for repo in "${REPOS[@]}"; do
  echo "=== $repo ==="
  repo_dir="$WORKDIR/$repo"

  if ! gh repo clone "$ORG/$repo" "$repo_dir" -- --depth 1 -q 2>/dev/null; then
    echo "  clone failed, skipping" >&2
    FAILED+=("$repo (clone)")
    continue
  fi

  (
    cd "$repo_dir"

    mkdir -p .github
    target="$TARGET_PATH"

    if [[ -f "$target" ]] && grep -q "$MARKER" "$target"; then
      # Preserve everything from the marker onward, replace everything above it
      overrides="$(awk -v marker="$MARKER" '
        found { print; next }
        $0 ~ marker { found=1; print; next }
      ' "$target")"
      {
        printf '%s\n' "$BASE_CONTENT_ABOVE_MARKER"
        printf '%s\n' "$overrides"
      } > "$target.new"
    else
      # No existing file, or no marker present — write the full base template as-is
      cp "$BASE_FILE" "$target.new"
    fi

    if [[ -f "$target" ]] && diff -q "$target" "$target.new" >/dev/null 2>&1; then
      echo "  no changes needed"
      rm "$target.new"
      exit 0
    fi

    mv "$target.new" "$target"
    git checkout -B "$BRANCH_NAME"
    git add "$target"
    git -c user.name="copilot-governance-bot" -c user.email="copilot-governance-bot@users.noreply.github.com" \
      commit -m "chore: sync org-baseline copilot-instructions.md" -q
    git push -f origin "$BRANCH_NAME" -q

    if gh pr view "$BRANCH_NAME" --repo "$ORG/$repo" >/dev/null 2>&1; then
      echo "  PR already open"
    else
      gh pr create \
        --repo "$ORG/$repo" \
        --title "chore: sync org-baseline copilot-instructions.md" \
        --body "Automated sync from copilot-governance. Repo-specific overrides below the REPO OVERRIDES marker are preserved. Review the diff above that marker only." \
        --head "$BRANCH_NAME" \
        --base "$(gh repo view "$ORG/$repo" --json defaultBranchRef -q .defaultBranchRef.name)" \
        -q
      echo "  PR opened"
    fi
  ) || FAILED+=("$repo (sync)")
done

echo ""
echo "Done. ${#FAILED[@]} failures."
if [[ ${#FAILED[@]} -gt 0 ]]; then
  printf '  - %s\n' "${FAILED[@]}"
  exit 1
fi
