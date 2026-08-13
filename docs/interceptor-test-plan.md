# Interceptor Test Plan (local, no IDE required)

How to verify the prompt-interception contracts on every declared surface,
without a live VS Code, Copilot CLI or Claude Code session, and without any
network access.

Everything below runs locally. No prompt text, telemetry, or governance content
leaves the machine at any point.

## Why simulation is not optional

The v1 kernel emitted `hookSpecificOutput.modifiedPrompt` and
`permissionDecision` on `UserPromptSubmit`. Neither field exists on that event.
Every test passed and the selftest passed, but the emitted fields would have
been ignored — because the tests asserted *what the engine emitted* and never
*what a runtime would accept*.

So this plan is layered deliberately. Each layer catches a class of failure the
one above it cannot see:

| Layer | Command | Catches |
| --- | --- | --- |
| 1. Configuration | `--selftest` | Missing files, signature/config errors, bad regexes, unresolvable templates, or promotion without evidence |
| 2. Behaviour | `node --test tests/` | Wrong routing, lost original text, a shadow rule blocking, a fault exiting 2 |
| 3. Wire format | `simulate-hook.mjs` | The engine emitting a field the target runtime ignores |
| 4. Registration | `validate-copilot-governance.sh` | A surface with no hook config, or a hook missing `--surface` |
| 5. Live | one prompt per client | Everything the vendor docs got wrong |

Layers 1–4 are local and run in CI. Layer 5 needs a human and a real client, and
is the only layer that proves the whole chain.

---

## Layer 1 — Configuration

```bash
node prompt-core/rewrite.mjs --selftest
```

Expected: `prompt-core selftest OK — 14 intents, 28 deny rules (7 shadow, 21 enforce), 4 surfaces`

The enforcing count must be exactly `21`. The shadow count must be exactly `7`
unless an approved legacy-rule promotion is in scope.

## Layer 2 — Behaviour

```bash
node --test "tests/*.test.mjs"
```

Expected: all tests pass. The suite covers one routing case per intent plus the
unmatched fallback, the verbatim guarantee, both arms of the hybrid strategy,
per-surface output fields, soft/hard block behavior, fail-open, signed expiry,
bounded/encrypted buffering, evidence gates, and that no prompt reaches telemetry.

## Layer 3 — Wire format (the important one)

`simulate-hook.mjs` spawns the engine as a child process, writes a realistic
payload to its stdin, and reads stdout, stderr and the exit code back — the same
boundary a hook runtime sits on. Field names, event names and payload shapes
differ per surface, and this is what checks them.

### Every surface at once

```bash
node scripts/simulate-hook.mjs --prompt "fix the SQL injection in the account lookup"
```

Expected, per surface:

| Surface / event | strategy | delivered via |
| --- | --- | --- |
| vscode / `UserPromptSubmit` | `rewrite` | `hookSpecificOutput.additionalContext` |
| claude / `UserPromptSubmit` | `rewrite` | `hookSpecificOutput.additionalContext` |
| copilot-sdk / `userPromptSubmitted` | `rewrite` | top-level `modifiedPrompt` |
| copilot-cli / configured `userPromptSubmitted` | — | output dropped contract, `{}` |
| copilot-cli / `userPromptTransformed` | `rewrite` | `modifiedTransformedPrompt` |

**`NOT GOVERNED` on any line is a failure**, and it is the exact failure that
went undetected for a phase. It means the engine produced a response with no
governance block where the runtime expects one.

### The hybrid strategy's two arms

```bash
node scripts/simulate-hook.mjs --surface copilot-cli --event userPromptTransformed --prompt "remove the console.log calls"
```
Expect `strategy: rewrite`, `intent: console-cleanup`, and
`original text preserved verbatim in the block: YES`.

```bash
node scripts/simulate-hook.mjs --surface copilot-cli --event userPromptTransformed --prompt "rename accountId to customerId" --raw
```
Expect `strategy: inject`, `intent: generic`. In the `--raw` output the
developer's text must appear byte-for-byte exactly once inside the labeled
original-intent fence in `modifiedTransformedPrompt`. An empty, duplicate, or
rejected state here is a bug: the no-match path must always apply the generic
governed wrapper.

### The block path

The seven legacy rules ship in shadow. Verify the advisory path with a prompt
that matches only a legacy rule:

```bash
node scripts/simulate-hook.mjs --prompt "just commit with --no-verify and skip the tests"
```
Expect no `BLOCKED` line anywhere, and an advisory `systemMessage` naming
`bypass-verification`. A block here means that legacy rule was promoted without
review.

Then verify that a mandatory rule blocks by default on capable surfaces:

```bash
node scripts/simulate-hook.mjs --prompt "Add a quick login bypass for testing"
```

Expect VS Code and Claude Code to block on `SEC-001`; Copilot CLI must degrade to
a refusal instruction because its hook cannot hard-block.

To exercise an explicit legacy-rule promotion, promote only the matched rule in
the simulator:

```bash
node scripts/simulate-hook.mjs --prompt "just commit with --no-verify and skip the tests" --rule-mode bypass-verification=enforce
```

| Surface | Expected |
| --- | --- |
| vscode | `BLOCKED via exit code 2` with the reason on stderr |
| claude | `BLOCKED via top-level decision field` |
| copilot-cli | **not blocked** — degrades to an in-prompt refusal instruction |

The Copilot CLI line is not a bug. That surface has no block mechanism; the
simulator says so explicitly. If it ever reports a block, the engine is emitting
something the CLI will ignore.

### Fail-open

A kernel fault must never become a blocked prompt.

```bash
echo 'not json' | node prompt-core/rewrite.mjs --surface vscode; echo "exit=$?"
```
Expect `continue:true`, a governance-unavailable `systemMessage`, and `exit=0`.

```bash
echo '{"prompt":"   "}' | node prompt-core/rewrite.mjs --surface claude; echo "exit=$?"
```
Expect `{"continue":true}` and `exit=0`.

Simulate node being absent — the most likely real-world degradation:

```bash
PATH=/nonexistent node scripts/simulate-hook.mjs --prompt "test" 2>&1 | head -5
```
The hook command failing is treated as a non-blocking warning by the represented
configured runtimes, so prompts pass through ungoverned rather than failing the session.
`scripts/copilot-gov.sh doctor` reports a missing node.

### Telemetry privacy

```bash
GOV_TELEMETRY_DIR=/tmp/govtest node scripts/simulate-hook.mjs --prompt "customer 4111111111111111 password hunter2" --telemetry
grep -c 'hunter2\|4111111111111111' /tmp/govtest/telemetry.jsonl   # must be 0
rm -rf /tmp/govtest
```

Records must contain an event ID, policy-pack version/checksum, all 28 safe
rule results, and never the prompt text or a prompt-derived content hash. Note
that `simulate-hook.mjs` disables telemetry unless `--telemetry` is passed, so
simulation never pollutes real shadow-mode evidence.

## Layer 4 — Registration

```bash
bash scripts/validate-copilot-governance.sh
```

Checks that every command-configured surface declared in `surfaces.json` has a hook config
registering it, that each hook command targets `.github/prompt-core/rewrite.mjs`,
and that each carries the right `--surface` flag. A hook without `--surface`
renders the wrong schema and fails open silently.

The programmatic SDK adapter intentionally has no command-hook registration:
configured command/HTTP output would discard `modifiedPrompt`.

Requires `jq`; without it these specific checks skip with a `SKIP:` line rather
than passing. **Treat a skip as unverified, not as a pass** — CI must have `jq`
installed.

## Layer 5 — Live verification (once per client, per pilot repo)

Simulation cannot prove the vendor honours its own documented schema. One prompt
per client does.

1. Install the hook config for that client in a pilot repo.
2. Submit: `remove the console.log calls from the checkout service`.
3. Confirm the assistant's reply reflects the governed workflow — it should cite
   an instruction file and state how it verified the change, which an ungoverned
   reply will not do.
4. Confirm a telemetry record was appended:
   ```bash
   tail -1 ~/.copilot-gov/telemetry.jsonl
   ```
   Check `surface` matches the client, `mode` is `rewrite`, and `controlState`
   matches the capability matrix. Record the event ID with the canary evidence.

An absent telemetry record means the hook never ran — check that the client
loaded the config, and that `node` is on the PATH the client uses, which is not
always the PATH of an interactive shell.

### JetBrains / IntelliJ

There is nothing to test. JetBrains has no hook support, so no layer of this
plan applies: no interception, no injection, no deny rules, no telemetry. Java
and Spring Boot teams working in IntelliJ have only the instruction and prompt
files. Do not record a JetBrains repo as covered because layers 1–4 pass
centrally — they pass on a machine that is not the one running the prompt. See
the known gaps in `docs/prompt-interception-plan.md`.

## Pre-merge checklist

Any change to `prompt-core/` or `hooks/`:

- [ ] `GOV_POLICY_SIGNING_KEY_FILE=/secure/path/key.pem node scripts/build-policy-pack.mjs` after a declared policy-input change
- [ ] `node prompt-core/rewrite.mjs --selftest` — exactly 21 mandatory rules enforce and seven legacy rules remain shadow unless an approved change is in scope
- [ ] `node --test "tests/*.test.mjs"` — all pass
- [ ] `node scripts/simulate-hook.mjs --prompt "fix the SQL injection in the account lookup"` — no `NOT GOVERNED`
- [ ] `node scripts/simulate-hook.mjs --prompt "…" --rule-mode bypass-verification=enforce` — blocks on vscode and claude, degrades on copilot-cli
- [ ] `bash scripts/validate-copilot-governance.sh` with `jq` present — no `SKIP:` on hook checks
- [ ] If a hook schema changed: `surfaces.json` `verifiedOn` updated, and the pinned schema in `docs/prompt-interception-plan.md` updated to match
- [ ] Security review requested — `.github/CODEOWNERS` requires it for this code
