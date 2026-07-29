#!/usr/bin/env bash
#
# Local developer CLI for Copilot governance.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
copilot-gov

Commands:
  validate                         Validate governance repository assets
  audit                            Scan current repo for common quality issues
  sync --dry-run                   Preview governance sync
  sync --apply                     Apply governance sync through PR automation
  prompt <workflow>                Print an approved prompt workflow
  rewrite <text>                   Show how the kernel governs a given prompt
  report                           Summarize local prompt interception telemetry
  install-hooks                    Install the local pre-commit validation hook
  doctor                           Show local tool readiness

Examples:
  scripts/copilot-gov.sh validate
  scripts/copilot-gov.sh audit
  scripts/copilot-gov.sh prompt fix-console-logs
  scripts/copilot-gov.sh rewrite "fix the SQL injection in the account lookup"
  scripts/copilot-gov.sh report
  scripts/copilot-gov.sh install-hooks
USAGE
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "node is required for the prompt interception kernel but was not found." >&2
    echo "Install Node.js, or run 'copilot-gov.sh doctor' to see what is missing." >&2
    exit 1
  fi
}

rewrite() {
  local text="${1:-}"
  if [[ -z "$text" ]]; then
    echo "Prompt text is required."
    echo "Example: scripts/copilot-gov.sh rewrite \"remove the console logs\""
    exit 1
  fi
  require_node
  # Diagnostics go to stderr, the governed prompt to stdout, so this composes
  # with pipes and redirects.
  node "$ROOT/prompt-core/rewrite.mjs" --prompt "$text"
}

report() {
  require_node
  node "$ROOT/prompt-core/rewrite.mjs" --report
}

install_hooks() {
  local git_dir
  git_dir="$(git -C "$ROOT" rev-parse --git-dir 2>/dev/null)" || {
    echo "Not a git repository: $ROOT" >&2
    exit 1
  }
  # rev-parse --git-dir can be relative to CWD, not $ROOT
  [[ "$git_dir" = /* ]] || git_dir="$ROOT/$git_dir"

  cp "$ROOT/scripts/hooks/pre-commit" "$git_dir/hooks/pre-commit"
  chmod +x "$git_dir/hooks/pre-commit"
  echo "Installed pre-commit hook at $git_dir/hooks/pre-commit"
  echo "It runs scripts/validate-copilot-governance.sh before each commit (local only, no network)."
}

doctor() {
  echo "=== copilot-gov doctor ==="
  for tool in git jq bash; do
    if command -v "$tool" >/dev/null 2>&1; then
      echo "OK: $tool"
    else
      echo "MISSING: $tool"
    fi
  done

  if command -v gh >/dev/null 2>&1; then
    echo "OK: gh"
  else
    echo "MISSING: gh (required only for sync automation)"
  fi

  if command -v node >/dev/null 2>&1; then
    echo "OK: node $(node --version)"
  else
    echo "MISSING: node (required by the prompt interception hook — without it,"
    echo "         prompts pass through ungoverned; the kernel fails open)"
  fi
}

audit() {
  local scan_root="${1:-.}"
  local rg_cmd
  echo "=== copilot-gov audit ==="

  if command -v rg >/dev/null 2>&1; then
    rg_cmd=(rg -n --hidden --glob '!.git/**')
  else
    echo "MISSING: rg is recommended for fast scanning"
    return 1
  fi

  echo "Console/debug findings:"
  "${rg_cmd[@]}" 'console\.(log|debug|warn)|debugger' "$scan_root" || true

  echo ""
  echo "Possible hardcoded secret markers:"
  "${rg_cmd[@]}" '(api[_-]?key|secret|password|token)\s*[:=]' "$scan_root" || true

  echo ""
  echo "Silent catch blocks:"
  "${rg_cmd[@]}" 'catch\s*\([^)]*\)\s*\{\s*\}' "$scan_root" || true

  echo ""
  echo "Audit complete. Review findings before changing code."
}

prompt() {
  local name="${1:-}"
  if [[ -z "$name" ]]; then
    echo "Prompt workflow name is required."
    usage
    exit 1
  fi

  local file="$ROOT/prompts/$name.prompt.md"
  if [[ ! -f "$file" ]]; then
    echo "Unknown prompt workflow: $name"
    echo "Available workflows:"
    find "$ROOT/prompts" -name '*.prompt.md' -printf '  - %f\n' | sed 's/\.prompt\.md$//'
    exit 1
  fi

  cat "$file"
}

cmd="${1:-}"
case "$cmd" in
  validate)
    "$ROOT/scripts/validate-copilot-governance.sh"
    ;;
  audit)
    audit "${2:-.}"
    ;;
  sync)
    mode="${2:-}"
    case "$mode" in
      --dry-run)
        DRY_RUN=true "$ROOT/scripts/sync-copilot-instructions.sh"
        ;;
      --apply)
        DRY_RUN=false "$ROOT/scripts/sync-copilot-instructions.sh"
        ;;
      *)
        echo "Use sync --dry-run or sync --apply."
        exit 1
        ;;
    esac
    ;;
  prompt)
    prompt "${2:-}"
    ;;
  rewrite)
    rewrite "${2:-}"
    ;;
  report)
    report
    ;;
  install-hooks)
    install_hooks
    ;;
  doctor)
    doctor
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd"
    usage
    exit 1
    ;;
esac
