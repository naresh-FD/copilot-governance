# Phase 5 P0 Implementation Record

Status date: 2026-08-13
Scope: code-level P0 controls from the Prompt Interception Kernel Next-Level Plan

## Outcome

The kernel now has the local engineering controls required to begin capability
validation. This is not a production-pilot completion claim: live multi-repository
canaries, privacy approval, on-prem aggregation, named owners, and statistical
rule evidence remain operational work.

| P0 requirement | Implementation | Status |
|---|---|---|
| Client/hook capability matrix | Versioned `surfaces.json` plus `docs/adapter-capability-matrix.md`; contract-only and canary-verified evidence are distinct | Implemented; two live canaries still required |
| Canonical prompt envelope | `envelope.mjs` creates event/correlation IDs, runtime/policy metadata, size buckets, capabilities, rule outcomes, workflow IDs, state, and phase latency | Implemented |
| Original-prompt preservation | Replacement paths use a dynamically sized verbatim fence without trimming; the in-memory prompt property is non-enumerable | Implemented and tested |
| Independent rule outcomes | Every event records matched/not-matched/error for all seven stable rule IDs, versions, reason codes, and modes | Implemented |
| Per-rule lifecycle | `control-plane.json` supports `off`, `shadow`, `candidate`, `soft-block`, and `enforce`, with cohort/repository/percentage/time targeting | Implemented; all rules remain shadow |
| No global enable-all | `GOV_ENFORCE_ALL` is ignored and audited as a bypass marker; tests can promote only named rules | Implemented and tested |
| Fail open but fail loud | Policy, audit, or integrity failure marks the event `degraded`, notifies supported clients, and prevents unhealthy enforcement | Implemented and tested at unit/contract level |
| Metadata-only local audit | JSONL events omit raw prompts, source fragments, repository paths, and content-derived prompt hashes | Implemented and tested |
| Pack pin and integrity | Semantic pack version, kernel compatibility range, manifest checksums, and a validated last-known-good local cache | Implemented and tested |
| Kill switch and rollback | Global rollback-to-shadow, per-rule rollback, expiring exception ledger, threshold evaluator, and short-lived rollback state | Implemented and tested |
| Security/failure/latency tests | Process-boundary adapter tests, integrity/tamper tests, privacy assertions, policy-mode tests, and per-phase latency events | Implemented locally; live performance baseline remains |
| Truthful status labels | Runtime states distinguish `unsupported`, `advisory-only`, `observed`, `governed-shadow`, `governed-enforced`, and `degraded` | Implemented |

## Runtime files

- `prompt-core/policy-pack.json` — semantic version, kernel compatibility, and
  checksums for policy inputs.
- `prompt-core/policy-pack.mjs` — validation and last-known-good rollback.
- `prompt-core/control-plane.json` — independent rule modes, thresholds, and
  exception ledger.
- `prompt-core/control-plane.mjs` — targeting, expiry, emergency rollback, and
  rollback-state consumption.
- `prompt-core/envelope.mjs` — canonical in-memory envelope and privacy-safe
  event projection.
- `scripts/evaluate-rollback.mjs` — evaluates recent event windows and emits a
  short-lived per-rule rollback state.
- `scripts/build-policy-pack.mjs` — refreshes checksums after an approved policy
  change.

## Operations

Local cold-process baseline on the implementation workstation (30 sequential
runs, telemetry/cache/rollback polling disabled, 2026-08-13): p50 119.5 ms,
p95 139.1 ms, p99 166.0 ms. This is a development baseline, not a pinned-client
pilot result or an organization-wide latency claim.

Rebuild the manifest after changing any declared policy input, then validate:

```bash
node scripts/build-policy-pack.mjs
node prompt-core/rewrite.mjs --selftest
node --test "tests/*.test.mjs"
```

Emergency rollback never enables a rule:

```bash
GOV_EMERGENCY_SHADOW=1 node prompt-core/rewrite.mjs --prompt "example"
GOV_RULE_ROLLBACK=hardcoded-secret node prompt-core/rewrite.mjs --prompt "example"
```

Evaluate the local buffer and write the default short-lived rollback state:

```bash
node scripts/evaluate-rollback.mjs
```

For Windows PowerShell, set environment variables with `$env:NAME='value'`
before invoking Node.

## Work intentionally not claimed complete

- pinned-runtime downstream canaries for Claude Code and Copilot CLI;
- production pilot evidence or governed-coverage targets;
- on-prem collector, reconciled dashboard, reviewer queue, and approved retention;
- named rule, adapter, privacy, analytics, and operations owners;
- golden/pilot/adversarial corpora approved for enterprise use;
- four-week shadow evidence, confidence bounds, Ring 0–3 rollout, or enforcement;
- managed-device heartbeat, endpoint inventory, and network-egress controls;
- JetBrains interception.

All seven rules therefore remain in `shadow`. Promotion requires the evidence and
approvals in the next-level plan, not a code-only configuration change.
