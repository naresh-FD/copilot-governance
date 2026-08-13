# Prompt Interception Kernel

Phase 5 of the governance platform. Where phases 0–4 publish governance content,
this phase attempts to apply it at prompt submission. “Every prompt governed” is
a target, not a current fact: only a pinned client/hook path with repeatable
downstream delivery proof is counted as governed. See
`docs/adapter-capability-matrix.md` for the current evidence.

Schema and capability claims here were re-verified against the VS Code, GitHub
Copilot and Claude Code documentation on **2026-08-13**. The hooks APIs are in
**Preview** on represented surfaces — re-verify at each pilot checkpoint and update
the pinned schema below when they move.

## What is actually enforceable

> **Correction, 2026-08-02.** An earlier version of this document claimed that
> VS Code Copilot and Claude Code could both rewrite and block prompts via
> `hookSpecificOutput.modifiedPrompt` and `permissionDecision`. Neither field
> exists on the prompt-submission event on either surface: `permissionDecision`
> is `PreToolUse`-only, and Claude Code's reference states plainly that
> `UserPromptSubmit` "can't replace the prompt; it only injects
> `additionalContext` alongside it". The v1 kernel emitted both fields, so on
> those two surfaces every prompt reached the model ungoverned and every deny
> would have failed open silently. The tests passed because they asserted the
> engine's own output shape and never the runtime's acceptance of it. The v3
> kernel renders per surface from `prompt-core/surfaces.json`, and the tests now
> assert the documented field per surface.

| Client | Rewrite the prompt | Block a prompt | Mechanism |
| --- | --- | --- | --- |
| VS Code Copilot | **No documented field** | Yes, exit code 2 only | `UserPromptSubmit`, `.github/hooks/*.json`; governance delivered as `hookSpecificOutput.additionalContext` |
| Claude Code | **No** — documented as impossible | Yes, `{"decision":"block","reason":…}` | `UserPromptSubmit` via `.claude/settings.json`; `additionalContext` only |
| Copilot SDK programmatic hook | **Yes** — `modifiedPrompt` | Hook cannot reject; application must gate before `session.send()` | SDK `userPromptSubmitted` only |
| Copilot CLI / coding agent | **Yes** — `modifiedTransformedPrompt` | **No** — mutation-only event | `userPromptTransformed`; configured command/HTTP `userPromptSubmitted` output is dropped |
| JetBrains / IntelliJ | **None** | **None** | No hook support at all |

Read that table carefully before quoting coverage to anyone. SDK submit and the
transformed hook have mutation contracts but neither hook hard-rejects. The two
configured surfaces that can block do not replace the prompt. A supported SDK
application can combine mutation with its own gate before `session.send()` only
after that exact application path is proven.

All three configs ship in this phase. The entry point uses local zero-package
modules for envelope, policy-pack, and control-plane handling; rendering remains
surface-specific.

## The hybrid strategy, and what it means per surface

Two strategies, chosen per prompt:

- **Rewrite** — the prompt matched a known intent, so the full governed workflow
  for that intent becomes the governance block, with the developer's original
  text embedded verbatim in a labeled `## Original developer intent` section.
- **Inject** — no intent matched, so the prompt is left exactly as written and
  only the governance preamble plus the generic governed wrapper is added. The
  no-match path never rejects or empties a prompt.

How each strategy is *delivered* depends on what the surface allows:

| Surface | Rewrite arm | Inject arm |
| --- | --- | --- |
| Copilot SDK | `modifiedPrompt` contains the governed envelope | The governed envelope contains the available original prompt exactly once |
| Copilot CLI | `modifiedTransformedPrompt` replaces the model-facing prompt | The governed envelope contains the available original prompt exactly once |
| VS Code, Claude Code | Governed workflow injected as `additionalContext` beside the untouched prompt | Preamble injected as `additionalContext` |

On the injecting surfaces the developer's wording is preserved by construction —
the runtime never lets us touch it. On Copilot CLI the guarantee is enforced by
the engine and pinned by a test.

Because Copilot CLI cannot block, an **enforcing** deny rule degrades there to a
`## Refuse this request` instruction written into the rewritten prompt. That is
weaker than a block: it depends on the model complying. Telemetry records it as
`unenforceable: true` so the gap is measurable rather than assumed away.

## Flow

```
developer prompt
      │
      ▼
.github/hooks/prompt-interceptor.json     UserPromptSubmit registration
      │  stdin JSON
      ▼
.github/prompt-core/rewrite.mjs           engine and local modules, zero external packages
      │
      ├─ screen   → deny.json + control-plane.json   independent rule lifecycle
      ├─ classify → router.json  intent, risk, template, anchors
      ├─ compose  → core.md + workflow + verbatim original prompt
      ├─ verify   → Ed25519-signed policy pack + expiring LKG cache
      └─ log      → bounded local event buffer   metadata only
      │  stdout JSON
      ▼
  surface-specific inject/rewrite/block response
```

## Files

| Path (central) | Path (downstream) | Purpose |
| --- | --- | --- |
| `prompt-core/core.md` | `.github/prompt-core/core.md` | Invariant preamble prepended to every prompt. Budget: 150 words |
| `prompt-core/router.json` | `.github/prompt-core/router.json` | Intent map onto the 14 prompt workflows |
| `prompt-core/deny.json` | `.github/prompt-core/deny.json` | Versioned rule contracts, stable reason codes, and provenance |
| `prompt-core/control-plane.json` | `.github/prompt-core/control-plane.json` | Independent rule modes, targeting, thresholds, and exceptions |
| `prompt-core/policy-pack.json` | `.github/prompt-core/policy-pack.json` | Version, validity window, signature key ID, compatibility, and checksums |
| `prompt-core/policy-pack.sig` | `.github/prompt-core/policy-pack.sig` | Detached Ed25519 signature; private key is not distributed |
| `prompt-core/policy-public-key.pem` | `.github/prompt-core/policy-public-key.pem` | Verification trust anchor |
| `prompt-core/surfaces.json` | `.github/prompt-core/surfaces.json` | Per-surface capability matrix — what each runtime can actually do |
| `prompt-core/envelope.mjs` | `.github/prompt-core/envelope.mjs` | Canonical in-memory envelope and privacy-safe event projection |
| `prompt-core/control-plane.mjs` | `.github/prompt-core/control-plane.mjs` | Per-rule targeting, exceptions, kill switch, and rollback |
| `prompt-core/event-buffer.mjs` | `.github/prompt-core/event-buffer.mjs` | Asynchronous bounded metadata buffer with optional encryption |
| `prompt-core/evidence-gate.mjs` | `.github/prompt-core/evidence-gate.mjs` | 206/210 Wilson and operational promotion gates |
| `prompt-core/policy-pack.mjs` | `.github/prompt-core/policy-pack.mjs` | Signature, expiry, compatibility, refresh, cache, and LKG rollback |
| `prompt-core/rewrite.mjs` | `.github/prompt-core/rewrite.mjs` | The engine |
| `hooks/prompt-interceptor.json` | `.github/hooks/prompt-interceptor.json` | VS Code Copilot registration |
| `hooks/copilot-cli-interceptor.json` | `.github/hooks/copilot-cli-interceptor.json` | Copilot CLI registration, both events |
| `hooks/claude-code-settings.fragment.json` | merged into `.claude/settings.json` | Claude Code registration — **a fragment, not a whole file** |
| `scripts/simulate-hook.mjs` | not synced | Replays hook payloads locally; see `docs/interceptor-test-plan.md` |

`claude-code-settings.fragment.json` is the one asset that must not be copied
wholesale. `.claude/settings.json` is a real settings file that developers and
other tooling also write to, so the sync has to **merge** the
`hooks.UserPromptSubmit` key into any existing file. The `.fragment` in the name
exists so a future change to the sync script cannot mistake it for a whole-file
asset and silently discard a developer's settings.

Note also that VS Code Copilot reads `.claude/settings.json` too. A repository
that registers both the VS Code config and the Claude fragment will inject the
governance block twice for a VS Code developer — a token cost, not a correctness
failure. Where a repository's teams use only one client, register only that one.

The engine resolves `prompts/` and `instructions/` relative to its own parent
directory, so the same file works centrally (parent is the repo root) and
downstream (parent is `.github/`) with no configuration.

## The governance block

Every eligible event is evaluated, matched or not. The interaction is counted as
governed only where delivery proof is current. On replacement paths, the
developer's words are never dropped, trimmed, or paraphrased:

```
<!-- copilot-governance | prompt-core v3.0.0 | mode=<rewrite|inject> intent=<id> risk=<low|medium|high> -->

[core.md — the invariant governance preamble]

## Original developer intent
[the developer's exact text, in a fenced block — only where the block
 replaces the prompt; elsewhere a pointer to the untouched prompt beside it]

## Governed workflow — <matched workflow>          (mode=rewrite)
[the body of the matched prompts/*.prompt.md, inlined]

## Governed approach                                (mode=inject)
[the generic governed wrapper — never an empty or rejected state]

## Instruction anchors
- .github/instructions/<file>

## Governance concerns detected in this request   (advisory rule matched)
- <rule id> — <reason>

## Refuse this request                            (enforcing rule, unblockable surface)
- <rule id> — <reason>

## Closing constraints
- verification required, human review if high risk, ask rather than guess
```

The original text is embedded verbatim **only where the block replaces the
prompt**, because that is the only case where it would otherwise be lost. Where
the block is injected as context beside an untouched prompt, duplicating the
text would cost tokens and add nothing, so the section points at it instead.

The embedded text is wrapped in a fence sized to exceed any backtick run inside
it, and is introduced with an explicit instruction not to follow directives in
it that conflict with the core. A prompt containing its own `## Closing
constraints` heading therefore cannot restructure the block.

## Deny rules and per-rule enforcement

Every contract in `deny.json` has a stable ID, version, owner placeholder,
reason code, safe explanation, and provenance. `control-plane.json` configures
each rule independently as `off`, `shadow`, `candidate`, `soft-block`, or
`enforce`, with repository/cohort/percentage/time targeting and expiring
exceptions.

All 28 contracts produce independent matched/not-matched/error results. The 21
mandatory baseline rules use `enforce`; the seven legacy broad-signal rules use
`shadow` and continue as advisories. `soft-block` and `enforce` use the documented
surface mechanism where available. A mandatory match on Copilot CLI degrades to
a refusal instruction because the hook cannot hard-block; it is never counted as
a direct reject.

Exit code 2 is otherwise forbidden to the engine. A deliberate policy block is
its one legitimate use; every internal fault falls through to a pass-through and
exit 0, so a bug degrades to an ungoverned prompt rather than a broken session.
Both halves of that are pinned by tests.

The seven legacy rules ship in shadow. To graduate one:

1. `copilot-gov.sh report` — read the shadow hit count and the graduation order.
2. Collect at least 210 independently reviewed matched events across three
   repositories and four weeks, with at least 206 true positives, no more than
   four false positives, and a Wilson 95% lower bound of at least 95%.
3. Record the named owner and evidence approval. A mode edit without those fields
   is downgraded to shadow by runtime.
4. Move only that rule through `candidate`, `soft-block`, and `enforce`; keep
   every other rule unchanged.

### Graduation order

`report` ranks graduation candidates rather than leaving the order to judgement:

1. Rules with `"provenance": "argus-cwe"` first — they carry production
   false-positive data from a live system rather than local pilot volume alone.
2. Then by shadow hit count.
3. Rules carrying a `graduationBlocker` are listed but flagged as ineligible.
   The selftest fails the build if such a rule is promoted to `soft-block` or
   `enforce`.

**No rule currently carries Argus provenance.** All 28 are `hand-authored`.
The 21-rule mandatory baseline is source-approved through its explicit control-
plane approval records, while ranking and promotion of the seven legacy rules is
still driven by local shadow evidence. Wiring the Argus CWE export into
`deny.json` remains a separate provenance improvement; do not present local
ordering as equivalent to a production-validated enterprise ruleset.

Two rules record a hard blocker today: `customer-data-in-prompt` (its 13–19 digit
signal needs a Luhn check) and `custom-crypto` (its weak-algorithm signal matches
prompts asking to *remove* md5/sha1, so enforcing it would block the remediation
the rule exists to encourage). `disable-security-scan` records a third: it cannot
yet tell an assistant being asked to waive a finding from a developer discussing
a waiver that already went through security.

There is no global enable-all switch. `GOV_ENFORCE_ALL` is ignored and recorded
as a bypass marker. Tests and the simulator may opt one named rule into one mode
with an explicitly test-only override. The production emergency control is
rollback-only: `GOV_EMERGENCY_SHADOW=1` moves enforced rules to shadow, and
`GOV_RULE_ROLLBACK=<rule-id>` rolls back only the named rule.

## Telemetry and privacy

Written through an asynchronous bounded buffer under `~/.copilot-gov/` — the
user's home directory, **not** the repository. Rotation is size-bounded and
optional AES-256-GCM encryption uses an approved external key. Prompt text in a
regulated environment can contain customer data and must never land in a git
working tree.

Each record holds event/correlation IDs; client, adapter, hook, and policy-pack
versions; repository class and cohort; bucketed size estimates; capabilities;
all 28 rule results; selected workflow and skills; operating mode, decision,
control state, failure/bypass markers, and phase latency. Raw prompt text,
source fragments, unrestricted paths, repository names, and prompt-derived
content hashes are never written. There is no raw-telemetry override.
`GOV_TELEMETRY=0` disables logging for tests and local simulation only.

`surface` and `mode` matter for graduation decisions: a rule's false-positive
rate is not necessarily the same across clients, and a rule that only ever fires
on Copilot CLI cannot be enforced there at all.

This is the first thing in the platform that measures anything. `docs/demo.md`
correctly notes that every headline number in `PHASE1_COMPLETE.md` is an
estimate; the intent distribution and per-rule hit counts here are real
measurements, and should replace those estimates once pilot data exists.

One honest caveat, surfaced by `report` itself: the governed prompt is *larger*
than the raw prompt, because it inlines the workflow the developer would
otherwise have typed or skipped. Any token-reduction claim has to come from
measuring the response and the number of review round-trips, not the request.

## Pinned hook schemas (Preview — re-verify at each checkpoint)

Verified 2026-08-02. `prompt-core/surfaces.json` is the machine-readable copy of
this section and carries the same `verifiedOn` date; update both together.

### VS Code Copilot — `.github/hooks/*.json`

```json
{ "hooks": { "UserPromptSubmit": [ { "type": "command", "command": "node .github/prompt-core/rewrite.mjs --surface vscode", "timeout": 10 } ] } }
```

stdin: `hook_event_name`, `session_id`, `timestamp`, `cwd`, `prompt`.
stdout: `continue`, `stopReason`, `systemMessage`,
`hookSpecificOutput.additionalContext`. There is **no documented
prompt-replacement field**; `permissionDecision` is `PreToolUse`-only and is
ignored here. Blocking is exit code 2 with the reason on stderr.

### Copilot CLI — `.github/hooks/*.json`

```json
{ "version": 1, "hooks": { "userPromptTransformed": [ { "type": "command", "bash": "node .github/prompt-core/rewrite.mjs --surface copilot-cli --event userPromptTransformed", "powershell": "…", "timeoutSec": 10 } ] } }
```

Note the different shape: a top-level `version`, per-shell `bash`/`powershell`
keys rather than one `command`, and `timeoutSec` rather than `timeout`.

`userPromptSubmitted` stdin: `sessionId`, `timestamp` (epoch ms), `cwd`,
`prompt`. Output is **not processed** — it cannot modify or block.

`userPromptTransformed` stdin: the above plus `transformedPrompt`, which is the
field the engine governs. stdout: `modifiedTransformedPrompt`, which replaces
the model-facing content and the session history while leaving the timeline
showing what the developer typed. Mutation-only — **it cannot block**.

### Claude Code — merged into `.claude/settings.json`

```json
{ "hooks": { "UserPromptSubmit": [ { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/.github/prompt-core/rewrite.mjs\" --surface claude", "timeout": 10 } ] } }
```

`UserPromptSubmit` takes **no matcher** — a `matcher` field is silently ignored —
so the registration is a flat array, not the matcher-grouped shape used by tool
events. The default command timeout is lowered to 30s for this event.

stdout: `hookSpecificOutput.additionalContext` to inject, and top-level
`{"decision":"block","reason":…}` to block. The prompt **cannot** be replaced.

### The exit-code contract

`0` parse stdout as JSON; `2` **blocking**; anything else is a non-blocking
warning. Exit 2 has exactly one legitimate use in this engine: a deliberate
policy block on VS Code, the only surface where the exit code is the block
mechanism. Every internal fault is caught and falls back to `{"continue": true}`
with exit 0, so a kernel bug degrades to an ungoverned prompt rather than a
broken chat session. Both halves are pinned by tests.

Why `--surface` is mandatory on every registration: `UserPromptSubmit` is sent
by both VS Code and Claude Code, and those two block by different mechanisms.
The engine cannot tell them apart from the payload, and a wrong guess renders a
field the runtime ignores — which fails open silently.

## Known gaps

**No surface can both rewrite and block.** Copilot CLI is the only client that
can genuinely replace a prompt, and it is mutation-only, so it cannot stop one.
VS Code and Claude Code can stop a prompt but cannot alter it. Any statement
that the platform "intercepts and enforces" is therefore true of no single
client — it is only true of the union, and the union is not what any one
developer is sitting in front of. State the per-client position, not the union.

**Enforcement on Copilot CLI is model-dependent.** When a rule reaches
`enforce`, Copilot CLI cannot honour a hard block. The prompt is rewritten with a
`## Refuse this request` instruction and the model is trusted to comply. That is
a materially weaker control than a block and must not be counted as one; it is
recorded as `unenforceable: true` in telemetry so the difference is measurable.

**JetBrains has no hook support.** Java and Spring Boot teams working in IntelliJ
get the instruction and prompt files only — no rewriting, no injection, no deny
rules, no telemetry. This is a real hole in the compliance story and must be
stated as such rather than reported as coverage.

This gap is not evenly distributed, and that is what makes it serious: **the
Java and Spring Boot estate is the part of the organization most likely to be
in IntelliJ, and it is also the part carrying `java-security`, the only intent
in the router that is both high-risk and requires human security review.** The
teams with the highest-risk prompts have the weakest interception. Flag this
explicitly to the Java teams and to whoever signs the compliance position, in
those terms.

Options, none free: move those teams to VS Code for Copilot work; accept
instructions-only coverage and record it as an accepted risk with a named owner;
or wait for JetBrains hook support. Doing nothing and reporting estate-wide
coverage is not among them.

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
looks wrong is the signal to tune `router.json`. The behavioural tests pin the
known cases, so a regression in routing fails the build rather than shipping.

**Telemetry is never collected centrally.** `report` reads only the local
machine's file. That is deliberate for privacy, but it means the platform cannot
demonstrate estate-wide that interception is actually running — you can only ask
each developer to run `report` and send the output. Fine across four pilot
repos, unworkable at estate scale. Central collection is a Wave 1 prerequisite
and carries its own privacy and employee-monitoring questions.

**The hook APIs are Preview on represented surfaces, and one already moved under
us.** The v1 kernel was built against a schema that did not exist, and nothing in
the build caught it for a full phase, because the tests asserted the engine's own
output rather than the runtime's contract. `surfaces.json` now carries a
`verifiedOn` date and the validation gate checks that every declared surface has
a hook registering it, but neither of those can detect a vendor changing a field
name. Only re-reading the three references can. Treat the `verifiedOn` date as an
expiry, not a footnote: re-verify at every pilot checkpoint, and assume anything
older than a quarter is stale.

**This repo ships executable code into every governed repo.** `rewrite.mjs` runs
on every prompt on every developer's machine, so a bad merge here is code
execution across the estate. `.github/CODEOWNERS` requires security review on
`prompt-core/`, `hooks/` and `scripts/`, and the downstream template does the
same for `.github/prompt-core/**` and `.github/hooks/**` — that downstream
coverage was missing until it was caught during the approval review. Pair both
with branch protection and commit signing; neither is configured by this repo.

## Operating runbook

Validate the kernel (also runs inside `copilot-gov validate` and the pre-commit
hook):

```bash
node prompt-core/rewrite.mjs --selftest
```

Run the behavioural tests. The selftest checks that the configuration is well
formed; these check that it *behaves* — routing accuracy, the verbatim
guarantee, the hybrid strategy's two arms, the correct output field per surface,
legacy shadow rules never blocking, mandatory rules using the correct reject or
refusal contract, and all failures degrading safely. Also runs inside
`copilot-gov validate`, so it gates every sync:

```bash
node --test tests/prompt-core.test.mjs
```

Set `GOV_SKIP_TESTS=1` to skip them during rapid local iteration. CI must not
skip them.

Replay a real hook payload against every surface without opening an IDE:

```bash
node scripts/simulate-hook.mjs --prompt "fix the SQL injection in the account lookup"
```

See `docs/interceptor-test-plan.md` for the full local verification procedure,
including how to exercise the block path and how to read a "not governed"
result.

See what a given prompt becomes:

```bash
scripts/copilot-gov.sh rewrite "fix the SQL injection in the account lookup"
```

Review shadow hits and the graduation order before enforcing a rule:

```bash
scripts/copilot-gov.sh report
```

Dogfood the kernel in this repository (optional — the synced hook configs point
at `.github/prompt-core/`, which only exists downstream):

```bash
mkdir -p .github/hooks && sed 's|.github/prompt-core|prompt-core|' hooks/prompt-interceptor.json > .github/hooks/prompt-interceptor.json
```
