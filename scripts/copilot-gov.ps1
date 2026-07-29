param(
  [Parameter(Position = 0)]
  [string]$Command,

  [Parameter(Position = 1)]
  [string]$Argument
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Show-Usage {
  @"
copilot-gov.ps1

Commands:
  validate                         Validate governance repository assets
  audit                            Scan current repo for common quality issues
  prompt <workflow>                Print an approved prompt workflow
  rewrite <text>                   Show how the kernel governs a given prompt
  report                           Summarize local prompt interception telemetry
  doctor                           Show local tool readiness

Examples:
  pwsh scripts/copilot-gov.ps1 validate
  pwsh scripts/copilot-gov.ps1 audit
  pwsh scripts/copilot-gov.ps1 prompt fix-console-logs
  pwsh scripts/copilot-gov.ps1 rewrite "fix the SQL injection in the account lookup"
  pwsh scripts/copilot-gov.ps1 report

Note: sync and install-hooks are bash-only. Use scripts/copilot-gov.sh under
Git Bash for those.
"@
}

function Test-Tool($Name, $Required = $true) {
  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    "OK: $Name"
  } elseif ($Required) {
    "MISSING: $Name"
  } else {
    "MISSING: $Name (optional)"
  }
}

function Invoke-Doctor {
  "=== copilot-gov doctor ==="
  Test-Tool "git"
  Test-Tool "jq" $false
  Test-Tool "rg" $false
  Test-Tool "gh" $false
  Test-Tool "bash" $false
  if (Get-Command "node" -ErrorAction SilentlyContinue) {
    "OK: node " + (& node --version)
  } else {
    "MISSING: node (required by the prompt interception hook - without it,"
    "         prompts pass through ungoverned; the kernel fails open)"
  }
}

$TokenBudgetWords = if ($env:TOKEN_BUDGET_WORDS) { [int]$env:TOKEN_BUDGET_WORDS } else { 300 }

# See scripts/validate-copilot-governance.sh for why these two files get a
# higher ceiling instead of the default budget.
$FileBudgetOverrides = @{
  "security.instructions.md"     = 900
  "code-quality.instructions.md" = 1400
}

# Extended-regex deny patterns, kept in sync with validate-copilot-governance.sh.
$DenyPatterns = @(
  '\[deployment date\]',
  '\[TODO[^\]]*\]',
  '\bTBD\b',
  '\bFIXME\b',
  '(api[_-]?key|secret|password|token)\s*[:=]\s*"[^"]{8,}"'
)

function Get-WordCount($Text) {
  @($Text -split '\s+' | Where-Object { $_ -ne "" }).Count
}

function Test-Budget($Label, $Words, $BudgetKey) {
  # Increments $script:errors directly rather than returning a bool: a
  # PowerShell function's return value and its printed output share the same
  # pipeline, so wrapping this call in `-not (...)` would swallow the OK/FAIL
  # lines instead of printing them.
  $budget = $TokenBudgetWords
  if ($BudgetKey -and $FileBudgetOverrides.ContainsKey($BudgetKey)) {
    $budget = $FileBudgetOverrides[$BudgetKey]
  }
  $tokensEst = [math]::Round($Words * 1.3)
  if ($Words -gt $budget) {
    "FAIL: $Label is $Words words (~$tokensEst tokens est.) - over the $budget-word budget for content auto-injected into every matching Copilot request"
    $script:errors++
  } else {
    "OK: $Label is $Words words (~$tokensEst tokens est.), within $budget-word budget"
  }
}

function Test-DenyPatterns($Path) {
  $content = Get-Content -Raw $Path
  foreach ($pattern in $DenyPatterns) {
    if ($content -match $pattern) {
      "FAIL: deny-pattern match in $Path`: $($Matches[0])"
      $script:errors++
    }
  }
}

function Invoke-Validate {
  "=== Copilot Governance Validation ==="
  $script:errors = 0

  $base = Join-Path $Root "templates/copilot-instructions.base.md"
  $repos = Join-Path $Root "repos.json"

  foreach ($path in @($base, $repos)) {
    if (Test-Path $path) {
      "OK: found $path"
    } else {
      "FAIL: missing $path"
      $script:errors++
    }
  }

  if (Test-Path $base) {
    $content = Get-Content -Raw $base
    foreach ($marker in @(
      "<!-- CENTRAL GOVERNANCE START -->",
      "<!-- CENTRAL GOVERNANCE END -->",
      "<!-- REPO OVERRIDES START -->",
      "<!-- REPO OVERRIDES END -->"
    )) {
      $count = ([regex]::Matches($content, [regex]::Escape($marker))).Count
      if ($count -eq 1) {
        "OK: marker present once: $marker"
      } else {
        "FAIL: marker '$marker' count is $count"
        $script:errors++
      }
    }
  }

  if (Test-Path $repos) {
    try {
      $repoJson = Get-Content -Raw $repos | ConvertFrom-Json
      "OK: repos.json is valid JSON"
      $duplicates = @($repoJson.repos | Group-Object | Where-Object Count -gt 1)
      if ($duplicates.Count -eq 0) {
        "OK: repos.json has no duplicates"
      } else {
        "FAIL: repos.json has duplicate repo names"
        $script:errors++
      }
    } catch {
      "FAIL: repos.json is invalid JSON"
      $script:errors++
    }
  }

  $requiredInstructions = @(
    "security", "code-quality", "react", "angular-v12", "angular-v21",
    "java-springboot", "testing", "pr-review", "migration"
  ) | ForEach-Object { Join-Path $Root "instructions/$_.instructions.md" }

  $requiredPrompts = @(
    "fix-pr-review", "fix-security-finding", "fix-console-logs",
    "fix-sonarqube-issue", "fix-eslint-issue", "fix-test-failure",
    "fix-build-failure", "fix-typescript-error", "fix-angular-migration",
    "fix-react-code-quality", "fix-java-springboot-security",
    "generate-unit-tests", "document-repo", "explain-legacy-code"
  ) | ForEach-Object { Join-Path $Root "prompts/$_.prompt.md" }

  foreach ($path in @($requiredInstructions + $requiredPrompts)) {
    if (Test-Path $path) {
      "OK: present $path"
    } else {
      "FAIL: missing $path"
      $script:errors++
    }
  }

  if (Test-Path $base) {
    ""
    "--- Content budget (auto-injected files only, TOKEN_BUDGET_WORDS=$TokenBudgetWords) ---"
    $content = Get-Content -Raw $base
    $centralMatch = [regex]::Match($content, '(?s)<!-- CENTRAL GOVERNANCE START -->(.*?)<!-- CENTRAL GOVERNANCE END -->')
    if ($centralMatch.Success) {
      Test-Budget "central governance block ($base)" (Get-WordCount $centralMatch.Groups[1].Value) $null
    }

    foreach ($path in $requiredInstructions) {
      if (Test-Path $path) {
        $fileName = Split-Path $path -Leaf
        $words = Get-WordCount (Get-Content -Raw $path)
        Test-Budget "instructions/$fileName" $words $fileName
      }
    }

    ""
    "--- Deny-pattern checks ---"
    foreach ($path in @($base) + $requiredInstructions + $requiredPrompts) {
      if (Test-Path $path) { Test-DenyPatterns $path }
    }

    ""
    "Duplicate-phrasing check is bash-only for now (scripts/validate-copilot-governance.sh); run that via Git Bash for the warn-only dedup pass."
  }

  if ($script:errors -gt 0) {
    throw "Found $script:errors validation error(s)."
  }

  "All checks passed."
}

function Invoke-Audit {
  $scanRoot = if ($Argument) { $Argument } else { "." }
  if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
    throw "rg is required for audit scanning."
  }

  "=== copilot-gov audit ==="
  "Console/debug findings:"
  & rg -n --hidden --glob "!.git/**" "console\.(log|debug|warn)|debugger" $scanRoot
  if ($LASTEXITCODE -gt 1) { throw "rg failed while scanning console/debug findings." }

  ""
  "Possible hardcoded secret markers:"
  & rg -n --hidden --glob "!.git/**" "(api[_-]?key|secret|password|token)\s*[:=]" $scanRoot
  if ($LASTEXITCODE -gt 1) { throw "rg failed while scanning secret markers." }

  ""
  "Audit complete. Review findings before changing code."
}

function Show-Prompt {
  if (-not $Argument) {
    throw "Prompt workflow name is required."
  }

  $file = Join-Path $Root "prompts/$Argument.prompt.md"
  if (-not (Test-Path $file)) {
    "Unknown prompt workflow: $Argument"
    "Available workflows:"
    Get-ChildItem (Join-Path $Root "prompts") -Filter "*.prompt.md" |
      ForEach-Object { "  - " + $_.BaseName.Replace(".prompt", "") }
    exit 1
  }

  Get-Content -Raw $file
}

function Assert-Node {
  if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    throw "node is required for the prompt interception kernel but was not found. Install Node.js, or run 'copilot-gov.ps1 doctor'."
  }
}

function Invoke-Rewrite {
  if (-not $Argument) {
    throw "Prompt text is required. Example: copilot-gov.ps1 rewrite ""remove the console logs"""
  }
  Assert-Node
  & node (Join-Path $Root "prompt-core/rewrite.mjs") --prompt $Argument
}

function Invoke-Report {
  Assert-Node
  & node (Join-Path $Root "prompt-core/rewrite.mjs") --report
}

switch ($Command) {
  "validate" { Invoke-Validate }
  "audit" { Invoke-Audit }
  "prompt" { Show-Prompt }
  "rewrite" { Invoke-Rewrite }
  "report" { Invoke-Report }
  "doctor" { Invoke-Doctor }
  { $_ -in @("", $null, "help", "-h", "--help") } { Show-Usage }
  default {
    "Unknown command: $Command"
    Show-Usage
    exit 1
  }
}
