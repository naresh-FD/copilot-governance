# Phase 5 P0 Implementation Record

Status date: 2026-08-13
Scope: repository-local controls from the corrected Prompt Interception Kernel v2 plan

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
| Independent rule outcomes | Every event records matched/not-matched/error for all 28 stable rule IDs, versions, reason codes, and modes | Implemented |
| Per-rule lifecycle | `control-plane.json` supports `off`, `shadow`, `candidate`, `soft-block`, and `enforce`, with cohort/repository/percentage/time targeting | Implemented; 21 mandatory rules enforce, 7 legacy rules remain shadow |
| No global enable-all | `GOV_ENFORCE_ALL` is ignored and audited as a bypass marker; tests can promote only named rules | Implemented and tested |
| Fail open but fail loud | Policy, audit, or integrity failure marks the event `degraded`, notifies supported clients, and prevents unhealthy enforcement | Implemented and tested at unit/contract level |
| Metadata-only local audit | JSONL events omit raw prompts, source fragments, repository paths, and content-derived prompt hashes | Implemented and tested |
| Pack pin and integrity | Ed25519 signature, semantic version, issued/expiry window, kernel compatibility, checksums, background refresh manager, and validated last-known-good grace | Implemented and tested; enterprise key custody remains |
| Kill switch and rollback | Global rollback-to-shadow, per-rule rollback, expiring exception ledger, threshold evaluator, and short-lived rollback state | Implemented and tested |
| Security/failure/latency tests | Process-boundary adapter tests, integrity/tamper tests, privacy assertions, policy-mode tests, and per-phase latency events | Implemented locally; live performance baseline remains |
| Truthful status labels | Runtime states distinguish `unsupported`, `advisory-only`, `observed`, `governed-shadow`, `governed-enforced`, and `degraded` | Implemented |
| Promotion evidence | 206/210 Wilson gate, named-owner requirement, fixture/latency/degraded/game-day gates, and evidence approvals prevent configuration-only promotion | Implemented; no production evidence exists |
| Local event buffer | Asynchronous bounded rotation, concurrent append lock, optional AES-256-GCM encryption, metadata-field prohibition, and cancellation behavior | Implemented and tested |
| Feedback and labels | Structured feedback, safe justification codes, two independent reviewers, adjudication, and conservative local sanitization | Implemented technically; approval/collector absent |
| Hook variants | SDK programmatic submit, configured command/HTTP submit, and transformed mutation are represented and tested independently | Local contract proof; pinned downstream canaries absent |

## Runtime files

- `prompt-core/policy-pack.json` — semantic version, kernel compatibility,
  validity window, signature key ID, and checksums for policy inputs.
- `prompt-core/policy-pack.sig` and `policy-public-key.pem` — detached Ed25519
  signature and repository trust anchor; the private key is not stored in Git.
- `prompt-core/policy-pack.mjs` — signature/integrity validation, background
  refresh manager, expiry grace, and last-known-good rollback.
- `prompt-core/control-plane.json` — independent rule modes, thresholds, and
  exception ledger.
- `prompt-core/control-plane.mjs` — targeting, expiry, emergency rollback, and
  rollback-state consumption.
- `prompt-core/envelope.mjs` — canonical in-memory envelope and privacy-safe
  event projection.
- `prompt-core/event-buffer.mjs` — bounded asynchronous local audit storage.
- `prompt-core/evidence-gate.mjs` — Wilson precision and operational gates.
- `prompt-core/feedback.mjs`, `labeling.mjs`, and `review-sanitizer.mjs` — the
  metadata-only feedback and two-reviewer evidence path.
- `scripts/evaluate-rollback.mjs` — evaluates recent event windows and emits a
  short-lived per-rule rollback state.
- `scripts/build-policy-pack.mjs` — refreshes checksums after an approved policy
  change.

## Operations

Local cold-process baseline on the implementation workstation (30 sequential
runs, telemetry/cache/rollback polling disabled, 2026-08-13): p50 120.4 ms,
p95 236.5 ms, p99 316.7 ms. This is a development baseline, not a pinned-client
pilot result or an organization-wide latency claim.

Rebuilding a changed manifest requires the out-of-repository Ed25519 private key:

```bash
GOV_POLICY_SIGNING_KEY_FILE=/secure/path/pik-private.pem node scripts/build-policy-pack.mjs
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
- four-week pilot evidence, confidence bounds, Ring 0–3 rollout, or production deployment proof;
- managed-device heartbeat, endpoint inventory, and network-egress controls;
- JetBrains interception.

The signed v3.2.0 pack source-configures 21 mandatory baseline rules in `enforce`
mode and retains seven legacy broad-signal rules in `shadow`. Mandatory approval
is explicit in the control plane and remains independently rollbackable. This is
not proof of production deployment or operating effectiveness; promotion of any
legacy rule still requires the evidence and approvals in the next-level plan.
