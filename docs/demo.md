# Demo & Test Guide: Copilot Governance

This walks through what this repo actually does, what you can verify **right
now, locally, without GitHub push access**, and what stays an unverified
target until a real pilot runs. Read this before quoting any numbers from
`PHASE1_COMPLETE.md` or `docs/phase1-deliverables.md` in a demo — those files
state targets, not measured results.

## What this repo actually is

Three layers, bundled together:

1. **Governance sync** (proven mechanism, no dependency on Copilot behavior):
   keeps `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`,
   and `.github/prompts/*.prompt.md` centrally authored here and propagated to
   target repos by PR, instead of each repo growing its own drifting copy.
   You can verify this end-to-end today with `DRY_RUN=true` — no write access
   to target repos needed.

2. **Local content enforcement** (proven, enforced, no dependency on Copilot
   behavior): a word-budget + deny-pattern check, run locally via
   `scripts/copilot-gov.sh validate` and optionally as a pre-commit hook, that
   caps how large the auto-injected files are allowed to get. This is the one
   part of "token reduction" that's a property of *this repo's content*, not
   a claim about how Copilot responds to it.

3. **Prompt/token optimization** (real mechanism, unmeasured magnitude):
   `.github/instructions/*.instructions.md` files use GitHub Copilot's
   `applyTo` glob frontmatter, so Copilot auto-injects them as context for
   matching files — developers stop retyping standards. `.github/prompts/*.prompt.md`
   files are reusable slash-command prompts (`/fix-console-logs`) — shorter to
   invoke than a free-form prompt. Both are real, supported Copilot features.
   What's **not** proven: the specific "70–80% token reduction" / "85%+
   hallucination refusal" numbers in `PHASE1_COMPLETE.md`. Nothing in this
   repo measures actual Copilot usage — there's no telemetry, no hook into
   GitHub's Copilot metrics API. Those numbers are estimates until a pilot
   repo runs for a few weeks and someone counts real fixes.

## Part A — Test the governance sync locally

No `GH_TOKEN`/`GH_ORG` needed for the first two checks.

```bash
# 1. Validate repo assets (base template markers, required instruction/prompt files)
scripts/copilot-gov.sh validate

# 2. Scan a codebase for the issues the instructions target
scripts/copilot-gov.sh audit path/to/some/repo

# 3. Preview a prompt workflow as Copilot would see it
scripts/copilot-gov.sh prompt fix-console-logs
```

On Windows without Git Bash (Windows PowerShell 5.1 — no PowerShell Core/`pwsh` required):

```powershell
scripts\copilot-gov.ps1 validate
scripts\copilot-gov.ps1 audit path\to\some\repo
scripts\copilot-gov.ps1 prompt fix-console-logs
```

To see what the sync would actually change in a real target repo, without
pushing anything:

```bash
export GH_TOKEN=<a token with at least read access to the org>
export GH_ORG=<your org>
export DRY_RUN=true
scripts/sync-copilot-instructions.sh
```

This clones each repo in `repos.json`, computes the merged
`.github/copilot-instructions.md` (central baseline + that repo's preserved
override block) plus the `.github/instructions/` and `.github/prompts/`
trees, and prints the diff — but stops before creating a branch or PR.
**This is the only part of this repo you can fully verify without write
access.**

## Part B — Test the local token-budget enforcement (the part that's actually measurable)

This is the one token-reduction claim you can prove today with no pilot and
no dependency on how Copilot behaves: the files that get auto-injected into
every matching Copilot request (`templates/copilot-instructions.base.md`'s
central block and each `instructions/*.instructions.md` file) are now
enforced to stay under a word budget, checked locally, no network.

```bash
scripts/copilot-gov.sh install-hooks   # one-time, installs .git/hooks/pre-commit
scripts/copilot-gov.sh validate        # run it directly any time
```
```powershell
scripts\copilot-gov.ps1 validate       # budget + deny-pattern checks (Windows)
```

What it checks (see `scripts/validate-copilot-governance.sh`):

- **Word budget** — default 300 words per auto-injected file (~390 estimated
  tokens at a rough 1.3 tokens/word ratio — an estimate, not an exact
  tokenizer count). `security.instructions.md` and `code-quality.instructions.md`
  get documented higher ceilings (900 / 1400 words) because exhaustive
  FORBIDDEN/APPROVED pattern coverage is the entire point of the
  hallucination-prevention approach — trimming them to 300 words would gut
  what makes them useful. `code-quality.instructions.md` is still the top
  candidate for a future split-by-concern refactor: it applies to `**/*`, so
  all ~1300 words are injected on every request regardless of whether the
  file being edited has anything to do with accessibility or dependency
  management.
- **Deny patterns** — blocks unresolved placeholders (`[deployment date]`,
  `[TODO...]`, `TBD`, `FIXME`) and literal-looking hardcoded secrets from
  shipping in governance content itself.
- **Duplicate phrasing** (bash only, warn-only) — flags lines repeated
  verbatim across the central block and instruction files. This is exact-line
  matching, not semantic similarity — it won't catch two differently-worded
  sections saying the same thing (see the `security.instructions.md` /
  `code-quality.instructions.md` "Error Handling" overlap it currently misses).

This already caught a real issue: before this check existed, the central
block duplicated ~250 words of security/code-quality rules that
`security.instructions.md` and `code-quality.instructions.md` also inject
(both use `applyTo: "**/*"`, the same reach as the top-level file) — meaning
those rules rode along twice on every single request. Removing the
duplication cut the central block from 438 to ~190 words with zero rule
content lost.

Override the default budget for a one-off check: `TOKEN_BUDGET_WORDS=500 scripts/copilot-gov.sh validate`.

## Part C — Test the token-reduction mechanism in your IDE

This is the part that's currently unverified. Here's how to actually check
it instead of trusting the numbers in `PHASE1_COMPLETE.md`.

**Setup** (one repo, can be this one or a scratch repo):

1. Copy `templates/copilot-instructions.base.md` to `.github/copilot-instructions.md`.
2. Copy `instructions/` to `.github/instructions/`.
3. Copy `prompts/` to `.github/prompts/`.
4. In VS Code, confirm your Copilot Chat version supports custom instructions
   and prompt files (check the Copilot Chat settings/docs for your installed
   version — the exact toggle names have changed across releases, so don't
   assume a specific setting name without checking).
5. Open a file matching one of the `applyTo` globs, e.g. a `.tsx` file for
   `react.instructions.md`.

**Test 1 — custom instructions actually apply:**
Ask Copilot Chat something like "add a console.log to debug this" in that
file. If instructions are wired up, Copilot should push back citing
`code-quality.instructions.md`'s console/debug rule, or the chat's context/
references panel should show the instruction file was used. If it just
complies with no pushback, the instructions aren't being picked up — that's
a setup problem, not a governance-content problem.

**Test 2 — measure the token difference yourself:**
Write out the free-form prompt a developer would otherwise type (see the
"OLD" example in `PHASE1_COMPLETE.md`), count its length, then compare
against typing `/fix-console-logs <file>`. This is the one number you can
verify directly today — it's a straight character/word count, not something
that needs a pilot. What you *can't* verify without a pilot is whether
Copilot's actual suggestion quality improves enough to avoid the 3–5
correction round-trips the doc assumes.

**Test 3 — hallucination refusal (needs real usage, not a single test):**
Deliberately ask Copilot for something the instructions forbid (custom JWT
signing, a hardcoded secret, a silent `catch {}`). One refusal doesn't
establish an 85% rate — that requires tracking outcomes across many real
fixes in the pilot repos over the 4–6 week window `PHASE1_COMPLETE.md`
recommends.

## Proven vs. target — quick reference

| Claim | Status | How to verify |
| --- | --- | --- |
| Sync preserves repo overrides, opens PRs | Proven (script logic, testable via dry-run) | `DRY_RUN=true scripts/sync-copilot-instructions.sh` |
| `validate` catches missing files/markers | Proven | `scripts/copilot-gov.sh validate` |
| Auto-injected files stay under an enforced word budget | **Proven and enforced** (local, blocks commit) | `scripts/copilot-gov.sh validate` / `install-hooks`, Part B above |
| Governance content is free of unresolved placeholders / literal secrets | **Proven and enforced** (local, blocks commit) | Deny-pattern checks, Part B above |
| Prompt files are shorter to type than free-form prompts | Proven (it's just character counting) | Part C, Test 2 above |
| Custom instructions auto-apply in Copilot Chat | Real Copilot feature, but depends on client/version | Part C, Test 1 above |
| 70–80% Copilot-side token reduction | **Target, not measured** | Requires pilot usage data |
| 85%+ hallucination refusal rate | **Target, not measured** | Requires pilot usage data |
| Faster PR reviews / fewer correction cycles | **Target, not measured** | Requires pilot usage data |

Don't present the last three rows as accomplished in a demo — present Parts
A, B, and C as what's live today, and frame the percentages as the
hypothesis the pilot (`docs/rollout-plan.md`) is designed to test. Parts A
and B are the strongest demo material: they're mechanisms you fully control
and can show failing, then show passing, live.
