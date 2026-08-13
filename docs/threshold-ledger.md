# PIK v2 Threshold Ledger

All values are **proposed and unratified**. Owner and approval fields remain
unresolved; therefore no rule can leave shadow.

| Threshold | Proposed value | Runtime action | Owner/status |
|---|---:|---|---|
| Reviewed matched events | 210 across at least 3 repositories and 28 days | Candidate ineligible below gate | Unassigned/unratified |
| True positives | At least 206; no more than 4 false positives | Candidate ineligible | Unassigned/unratified |
| Point precision | At least 98% | Candidate ineligible | Unassigned/unratified |
| Wilson 95% lower bound | At least 95% | Candidate ineligible | Unassigned/unratified |
| Warm p95 latency | At most 250 ms | Two windows trigger per-rule rollback | Unassigned/unratified |
| Degraded interactions | Less than 1% | Per-rule rollback | Unassigned/unratified |
| Disagreement/appeal/override | Less than 2% | Per-rule rollback/hold | Unassigned/unratified |
| Immediate overrides | At most 20% | Per-rule rollback | Unassigned/unratified |
| Severity-1 false positive | Zero | Immediate per-rule rollback | Unassigned/unratified |
| Silent failure/integrity/audit loss | Zero known events | Rollback and incident | Unassigned/unratified |
| Rollback game day age | At most 30 days | Candidate ineligible | Unassigned/unratified |
| PR lead-time change | More than 10% degradation | Pause expansion and investigate; no automatic rollback | Unassigned/unratified |
| Unheartbeated active seats | More than 5 percentage-point rise | Pause expansion and investigate | Data availability unproven |

Deployment frequency, change-failure rate, satisfaction and surface-usage shifts
are investigation inputs only. They are intentionally absent from automatic
rollback code because they are lagging and confounded.
