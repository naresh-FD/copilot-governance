#!/usr/bin/env bash
#
# Sync governed Copilot instructions, path-specific instruction packs, and
# prompt workflows into each repository listed in repos.json.
#
# Env vars:
#   GH_TOKEN       GitHub API token or GitHub App installation token
#   GH_ORG         GitHub org name
#   DRY_RUN        If "true", validate and show diffs but do not push or PR
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_FILE="$SCRIPT_DIR/templates/copilot-instructions.base.md"
REPOS_FILE="$SCRIPT_DIR/repos.json"
INSTRUCTIONS_DIR="$SCRIPT_DIR/instructions"
PROMPTS_DIR="$SCRIPT_DIR/prompts"
PROMPT_CORE_DIR="$SCRIPT_DIR/prompt-core"
HOOKS_DIR="$SCRIPT_DIR/hooks"
TARGET_FILE=".github/copilot-instructions.md"
MANIFEST_FILE=".github/.copilot-governance-manifest"
BRANCH_NAME="chore/sync-copilot-governance"
ORG="${GH_ORG:?Set GH_ORG env var, e.g. your-github-org}"
DRY_RUN="${DRY_RUN:-false}"
WORKDIR="$(mktemp -d)"

CENTRAL_START="<!-- CENTRAL GOVERNANCE START -->"
CENTRAL_END="<!-- CENTRAL GOVERNANCE END -->"
OVERRIDES_START="<!-- REPO OVERRIDES START -->"
OVERRIDES_END="<!-- REPO OVERRIDES END -->"

trap 'rm -rf "$WORKDIR"' EXIT

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

marker_count() {
  local marker="$1"
  local file="$2"
  grep -F -c "$marker" "$file" || true
}

extract_managed_baseline() {
  awk -v start="$CENTRAL_START" -v end="$CENTRAL_END" '
    $0 == start { found=1 }
    found { print }
    $0 == end { exit }
  ' "$BASE_FILE"
}

extract_overrides() {
  local target="$1"
  awk -v marker="$OVERRIDES_START" '
    found { print; next }
    $0 == marker { found=1; print; next }
  ' "$target"
}

copy_tree() {
  local source_dir="$1"
  local target_dir="$2"
  mkdir -p "$target_dir"
  if [[ -d "$source_dir" ]]; then
    cp -R "$source_dir"/. "$target_dir"/
  fi
}

# List the files a source tree contributes, as repo-relative target paths.
list_tree() {
  local source_dir="$1"
  local target_prefix="$2"
  [[ -d "$source_dir" ]] || return 0
  (cd "$source_dir" && find . -type f) | sed "s|^\./|$target_prefix/|"
}

# Governance owns specific files, not whole directories — a repo may keep its
# own prompt or hook files alongside ours. So instead of clearing the target
# directories, we track what we shipped last time and remove only files that
# governance previously owned and no longer does.
prune_stale() {
  local new_list="$1"
  [[ -f "$MANIFEST_FILE" ]] || return 0
  while IFS= read -r old_path; do
    [[ -n "$old_path" ]] || continue
    if ! grep -Fxq "$old_path" "$new_list"; then
      if [[ -f "$old_path" ]]; then
        rm -f "$old_path"
        echo "  pruned $old_path (no longer governed)"
      fi
    fi
  done < "$MANIFEST_FILE"
}

require_file "$BASE_FILE"
require_file "$REPOS_FILE"

for marker in "$CENTRAL_START" "$CENTRAL_END" "$OVERRIDES_START" "$OVERRIDES_END"; do
  count="$(marker_count "$marker" "$BASE_FILE")"
  if [[ "$count" -ne 1 ]]; then
    echo "Base template must contain exactly one marker '$marker' but found $count" >&2
    exit 1
  fi
done

BASE_MANAGED="$(extract_managed_baseline)"
mapfile -t REPOS < <(jq -r '.repos[]' "$REPOS_FILE")

echo "Syncing Copilot governance to ${#REPOS[@]} repos in org $ORG"
[[ "$DRY_RUN" == "true" ]] && echo "DRY_RUN=true; no branches or PRs will be pushed"

FAILED=()
CHANGED=()
UNCHANGED=()

for repo in "${REPOS[@]}"; do
  echo "=== $repo ==="
  repo_dir="$WORKDIR/$repo"

  if ! gh repo clone "$ORG/$repo" "$repo_dir" -- --depth 1 -q 2>/dev/null; then
    echo "  clone failed" >&2
    FAILED+=("$repo (clone)")
    continue
  fi

  if (
    cd "$repo_dir"
    mkdir -p .github
    target="$TARGET_FILE"

    if [[ -f "$target" ]]; then
      override_count="$(marker_count "$OVERRIDES_START" "$target")"
      override_end_count="$(marker_count "$OVERRIDES_END" "$target")"
      if [[ "$override_count" -gt 1 || "$override_end_count" -gt 1 ]]; then
        echo "  duplicate override markers found; refusing to sync" >&2
        exit 2
      fi

      if [[ "$override_count" -eq 1 ]]; then
        overrides="$(extract_overrides "$target")"
      else
        old_content="$(cat "$target")"
        overrides="$(
          printf '%s\n' "$OVERRIDES_START"
          printf '%s\n' "<!-- MIGRATED FROM PRE-GOVERNANCE INSTRUCTIONS -->"
          printf '%s\n' "$old_content"
          printf '%s\n' "$OVERRIDES_END"
        )"
      fi

      {
        printf '%s\n\n' "$BASE_MANAGED"
        printf '%s\n' "$overrides"
      } > "$target.new"
    else
      cp "$BASE_FILE" "$target.new"
    fi

    mv "$target.new" "$target"
    copy_tree "$INSTRUCTIONS_DIR" ".github/instructions"
    copy_tree "$PROMPTS_DIR" ".github/prompts"
    copy_tree "$PROMPT_CORE_DIR" ".github/prompt-core"
    copy_tree "$HOOKS_DIR" ".github/hooks"

    new_manifest="$(mktemp)"
    {
      printf '%s\n' "$TARGET_FILE"
      list_tree "$INSTRUCTIONS_DIR" ".github/instructions"
      list_tree "$PROMPTS_DIR" ".github/prompts"
      list_tree "$PROMPT_CORE_DIR" ".github/prompt-core"
      list_tree "$HOOKS_DIR" ".github/hooks"
    } | LC_ALL=C sort > "$new_manifest"

    prune_stale "$new_manifest"
    cp "$new_manifest" "$MANIFEST_FILE"
    rm -f "$new_manifest"

    # git diff only sees tracked files. On a repo being onboarded for the first
    # time every governed file is untracked, so a diff-based check would report
    # "no changes needed" and skip the repo entirely. status --porcelain covers
    # added, modified, deleted, and untracked alike.
    if [[ -z "$(git status --porcelain -- .github)" ]]; then
      echo "  no changes needed"
      exit 0
    fi

    echo "  Change summary:"
    git status --porcelain -- .github | sed 's/^/    /'

    git fetch origin "$BRANCH_NAME":"refs/remotes/origin/$BRANCH_NAME" -q 2>/dev/null || true
    git checkout -B "$BRANCH_NAME" -q
    git add -A -- \
      .github/copilot-instructions.md \
      .github/instructions \
      .github/prompts \
      .github/prompt-core \
      .github/hooks \
      "$MANIFEST_FILE"
    git -c user.name="copilot-governance-bot" \
      -c user.email="copilot-governance-bot@users.noreply.github.com" \
      commit -m "chore: sync Copilot governance baseline" -q

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "  dry-run: would push $BRANCH_NAME and open/update PR"
      exit 0
    fi

    git push --force-with-lease origin "$BRANCH_NAME" -q
    default_branch="$(gh repo view "$ORG/$repo" --json defaultBranchRef -q .defaultBranchRef.name)"
    existing_pr="$(gh pr list --repo "$ORG/$repo" --head "$BRANCH_NAME" --json number -q '.[0].number' 2>/dev/null || true)"

    if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
      echo "  PR already open: #$existing_pr"
    else
      gh pr create \
        --repo "$ORG/$repo" \
        --title "chore: sync Copilot governance baseline" \
        --body "Automated sync from copilot-governance. Central instructions, path-specific instruction packs, prompt workflows, and the prompt interception kernel (\`.github/prompt-core\` + \`.github/hooks\`) are updated by PR. Repo overrides are preserved and must not weaken the baseline.

The interception kernel rewrites Copilot prompts against the governance core before the model sees them. All deny rules ship in shadow mode: they are logged, never blocking. See \`docs/prompt-interception-plan.md\` in the governance repo." \
        --head "$BRANCH_NAME" \
        --base "$default_branch" \
        >/dev/null
      echo "  PR opened"
    fi
  ); then
    if [[ -d "$repo_dir/.git" ]]; then
      if git -C "$repo_dir" log -1 --pretty=%s 2>/dev/null | grep -q "sync Copilot governance"; then
        CHANGED+=("$repo")
      else
        UNCHANGED+=("$repo")
      fi
    fi
  else
    FAILED+=("$repo (sync)")
  fi
done

echo ""
echo "=== Summary ==="
echo "Changed: ${#CHANGED[@]}"
echo "Unchanged: ${#UNCHANGED[@]}"
echo "Failed: ${#FAILED[@]}"

if [[ ${#FAILED[@]} -gt 0 ]]; then
  printf '  - %s\n' "${FAILED[@]}"
  exit 1
fi
