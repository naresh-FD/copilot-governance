# Corrected Control-Objective Map

No single component is the preventive control of record for every objective.

| Objective | Primary control | Honest classification | Explicit limitation |
|---|---|---|---|
| Compose governed model-facing context | Mutation-capable PIK adapter | Preventive composition only on a canary-proven path | Disabled, unsupported and bypassed clients |
| Reject before model submission | SDK/application gate before `session.send()` or proven block adapter | Preventive for that application submission | Not organization-wide if the application can be bypassed |
| Observe configured submit hooks | PIK metadata/advisory path | Detective/advisory | Command/HTTP `modifiedPrompt` output is dropped |
| Prevent prohibited data egress | Network/DLP and approved endpoint controls | Defined by the deployed egress control | Generated-code correctness |
| Detect unsafe generated code | Argus/SAST/secret/dependency scans | Detective before merge; preventive only when a gate blocks | Prompt egress that already occurred |
| Prevent merge/deployment | Branch and pipeline gates | Preventive for repository delivery | Model interaction outside delivery |
| Detect stale clients | Endpoint heartbeat/version attestation | Detective | Immediate prevention |
| Guide JetBrains/unsupported surfaces | Versioned repository instructions | Advisory | Evaluation, mutation and telemetry |

Consequently, repository documentation must not claim that CI prevents prompt
egress or that the kernel alone guarantees organization-wide prevention.
