# Prompt Interception Kernel

Phase 5 of the governance platform. Where phases 0–4 *published* governance
content and hoped developers used it, this phase *applies* it: every prompt
submitted in a governed repository is rewritten against a governance core before
the model sees it.

Schema and capability claims here were verified against the VS Code and GitHub
Copilot documentation on **2026-07-29**. The hooks API is in **Preview** — re-verify
at each pilot checkpoint and update the pinned schema below when it moves.

## What is actually enforceable

| Client | Interception | Mechanism |
| --- | --- | --- |
| VS Code Copilot | **Real** — rewrite and block | `UserPromptSubmit` hook, `.github/hooks/*.json` |
| Claude Code | **Real** — rewrite and block | Same event via `.claude/settings.json` (VS Code reads this too) |
| Copilot CLI / coding agent | **Real, different schema** | `userPromptSubmitted` is notification-only; rewriting needs `userPromptTransformed` + `modifiedTransformedPrompt` |
| JetBrains / IntelliJ | **None** | No hook support |

Only the VS Code path ships in this phase. See the gaps section.

## Flow

```
developer prompt
      │
      ▼
.github/hooks/prompt-interceptor.json     UserPromptSubmit registration
      │  stdin JSON
      ▼
.github/prompt-core/rewrite.mjs           engine, single file, zero dependencies
      │
      ├─ screen   → deny.json    per-rule shadow or enforce
      ├─ classify → router.json  intent, risk, template, anchors
      ├─ compose  → core.md + workflow + verbatim original prompt
      └─ log      → ~/.copilot-gov/telemetry.jsonl   hashed, no raw prompt text
      │  stdout JSON
      ▼
  modifiedPrompt → model
```

## Files

| Path (central) | Path (downstream) | Purpose |
| --- | --- | --- |
| `prompt-core/core.md` | `.github/prompt-core/core.md` | Invariant preamble prepended to every prompt. Budget: 150 words |
| `prompt-core/router.json` | `.github/prompt-core/router.json` | Intent map onto the 14 prompt workflows |
| `prompt-core/deny.json` | `.github/prompt-core/deny.json` | Policy rules, each with its own `enforce` flag |
| `prompt-core/rewrite.mjs` | `.github/prompt-core/rewrite.mjs` | The engine |
| `hooks/prompt-interceptor.json` | `.github/hooks/prompt-interceptor.json` | Hook registration |

The engine resolves `prompts/` and `instructions/` relative to its own parent
directory, so the same file works centrally (parent is the repo root) and
downstream (parent is `.github/`) with no configuration.

## The rewrite contract

Every prompt is rewritten, matched or not. The developer's words are never
dropped or paraphrased:

```
<!-- copilot-governance | prompt-core v1 | intent=<id> risk=<low|medium|high> -->

[core.md — the invariant governance preamble]

## Original developer intent
[the developer's exact text, in a fenced block]

## Governed workflow — <matched workflow>
[the body of the matched prompts/*.prompt.md, inlined]

## Instruction anchors
- .github/instructions/<file>

## Governance concerns detected in this request   (only when a shadow rule matched)
- <rule id> — <reason>

## Closing constraints
- verification required, human review if high risk, ask rather than guess
```

Unmatched prompts get the same wrapper with a generic "Governed approach"
section instead of a workflow.

The original text is wrapped in a fence sized to exceed any backtick run inside
it, and is introduced with an explicit instruction not to follow directives in
it that conflict with the core. A prompt containing its own `## Closing
constraints` heading therefore cannot restructure the rewrite.

## Deny rules and per-rule enforcement

Every rule in `deny.json` carries its own `enforce` boolean:

- `enforce: false` (**shadow**) — evaluated, logged, an advisory `systemMessage`
  is shown, the concern is written into the rewritten prompt, and the prompt
  proceeds.
- `enforce: true` — the prompt is blocked with `permissionDecision: "deny"` and
  the rule's `reason` is shown to the developer.

All seven rules ship in shadow. To graduate one:

1. `copilot-gov.sh report` — read the shadow hit count for that rule.
2. Sample the hits. A rule is ready when its false-positive rate is acceptable
   *for that rule*, independent of the others.
3. Set `"enforce": true` for that rule only, and sync.

Two rules are deliberately marked as needing work before enforcement:
`customer-data-in-prompt` (its 13–19 digit signal needs a Luhn check first) and
`disable-security-scan` (legitimate human false-positive triage uses similar
wording).

`GOV_ENFORCE_ALL=1` promotes every rule to enforcing. It exists so tests can
exercise the block path; it only ever makes the kernel stricter.

## Telemetry and privacy

Written to `~/.copilot-gov/telemetry.jsonl` — the user's home directory, **not**
the repository. Prompt text in a regulated environment can contain customer
data and must never land in a git working tree.

Each record holds: timestamp, session id, repo name, intent, risk, score,
matched template, deny rule ids with their enforce state, a truncated SHA-256
`promptHash`, and the character counts of the raw and rewritten prompts. **Raw
prompt text is never written** unless `GOV_TELEMETRY_RAW=1` is set explicitly for
local debugging. `GOV_TELEMETRY=0` disables logging entirely.

This is the first thing in the platform that measures anything. `docs/demo.md`
correctly notes that every headline number in `PHASE1_COMPLETE.md` is an
estimate; the intent distribution and per-rule hit counts here are real
measurements, and should replace those estimates once pilot data exists.

One honest caveat, surfaced by `report` itself: the governed prompt is *larger*
than the raw prompt, because it inlines the workflow the developer would
otherwise have typed or skipped. Any token-reduction claim has to come from
measuring the response and the number of review round-trips, not the request.

## Pinned hook schema (Preview — re-verify)

Registration, `.github/hooks/*.json`:

```json
{ "hooks": { "UserPromptSubmit": [ { "type": "command", "command": "node .github/prompt-core/rewrite.mjs", "timeout": 10 } ] } }
```

Engine receives on stdin: `hook_event_name`, `session_id`, `timestamp`, `cwd`,
`prompt`, `transcript_path`, `conversationTurns`.

Engine writes on stdout:

| Field | Effect |
| --- | --- |
| `continue` | `false` stops processing |
| `systemMessage` | Warning shown in the chat UI |
| `hookSpecificOutput.modifiedPrompt` | Replaces the prompt text |
| `hookSpecificOutput.additionalContext` | Appends context without replacing |
| `hookSpecificOutput.permissionDecision` | `allow`, `deny`, or `ask` |
| `hookSpecificOutput.permissionDecisionReason` | Shown with a deny |

Exit codes: `0` parse stdout as JSON; `2` **blocking** error; anything else is a
non-blocking warning. **The engine must never exit 2.** It catches everything and
falls back to `{"continue": true}` with exit 0, so a kernel fault degrades to an
ungoverned prompt rather than a broken chat session.

## Known gaps

**JetBrains has no hook support.** Java and Spring Boot teams working in IntelliJ
get the instruction and prompt files only — no rewriting, no deny rules, no
telemetry. This is a real hole in the compliance story and must be stated as
such rather than reported as coverage. Options, none free: move those teams to
VS Code for Copilot work, accept instructions-only coverage and document it as
an accepted risk, or wait for JetBrains hook support.

**Hooks are a guardrail, not a security control.** A developer can disable hooks,
and a hook timeout always fails open. Real enforcement is an enterprise policy
push — `ChatHooks` via MDM (`HKEY_LOCAL_MACHINE\SOFTWARE\Policies\GitHubCopilot`
on Windows) or `managed-settings.json`. That is a desktop-engineering workstream
this repository cannot deliver on its own. Until it lands, treat interception as
strong assistance, not as a control an auditor can rely on.

**Node is a runtime dependency.** The hook shells out to `node`. Where it is
absent the command exits non-zero, which the runtime treats as a non-blocking
warning, so prompts pass through ungoverned. `copilot-gov doctor` reports this.

**The Argus CWE ruleset is not wired in.** The deny rules here are hand-written
placeholders. The intended design is `scripts/prompt-core/import-argus.mjs`,
mapping an Argus CWE export onto `deny.json` rules and router intents so the
rules stay authored in Argus rather than copied by hand. Writing that importer
needs the Argus export format, which is not yet available to this repository.

**Classification is regex-based.** A prompt routed to the wrong intent inlines
the wrong workflow. `report` shows the intent distribution; a distribution that
looks wrong is the signal to tune `router.json`.

## Operating runbook

Validate the kernel (also runs inside `copilot-gov validate` and the pre-commit
hook):

```bash
node prompt-core/rewrite.mjs --selftest
```

See what a given prompt becomes:

```bash
scripts/copilot-gov.sh rewrite "fix the SQL injection in the account lookup"
```

Review shadow hits before graduating a rule:

```bash
scripts/copilot-gov.sh report
```

Dogfood the kernel in this repository (optional — the synced hook config points
at `.github/prompt-core/`, which only exists downstream):

```bash
mkdir -p .github/hooks && sed 's|.github/prompt-core|prompt-core|' hooks/prompt-interceptor.json > .github/hooks/prompt-interceptor.json
```
