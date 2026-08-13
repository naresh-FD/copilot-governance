# PIK v2 Corrected Delivery Status

Status date: 2026-08-13

This is the repository-truth record for the corrected PIK v2 audit. “Implemented”
means source and automated verification exist in this repository. It does not
mean that a live client, privacy board, change board, risk owner, or pilot has
approved the control.

## First 30-day backlog

| ID | Repository evidence | Status | Remaining external decision or evidence |
|---|---|---|---|
| PIK-001 | This matrix, `phase5-p0-implementation.md`, source and test references | Implemented | Independent review of the audit |
| PIK-002 | `rule-catalog.json`, `deny.json`, `router.json`, `rule-workflow-inventory.md` | Partial | All rule and workflow owners are still `unassigned` |
| PIK-003 | `rule-catalog.json` four-axis classification and portability records | Implemented as preliminary engineering assessment | Argus, DLP and control owners must verify mappings |
| PIK-004 | `surfaces.json` and `adapter-capability-matrix.md` | Implemented | Revalidate every pinned pilot client/version |
| PIK-005 | `run-canary.mjs` separately tests SDK submit, configured submit and transformed hooks | Local contract proof | Pinned live SDK/CLI/cloud-agent executions |
| PIK-006 | `run-canary.mjs` proves process firing, mutation field, marker and event correlation | Partial | Downstream model receipt and live degraded-path canary |
| PIK-007 | `envelope.mjs` schema and privacy projection | Implemented | Schema approval and compatibility ownership |
| PIK-008 | Composer preservation, adversarial fence and duplicate-avoidance tests | Implemented | Pinned-client byte capture |
| PIK-009 | `control-plane.mjs` implements off/shadow/candidate/soft-block/enforce independently | Implemented | Candidate and soft-block UX pilot approval |
| PIK-010 | Ed25519 manifest, expiry, background refresh manager, LKG grace and rollback | Implemented | Enterprise signing-key custody and adapter-daemon integration |
| PIK-011 | Metadata allowlist enforced by `event-buffer.mjs`; no prompt/hash fields | Implemented technically | Privacy/security/employee-monitoring approval |
| PIK-012 | `feedback.mjs`, `labeling.mjs`, `review-sanitizer.mjs` and protocol document | Implemented technically | Workflow, reviewer and seven-day retention approval |
| PIK-013 | `evidence/rule-corpus.json` asserted cases and explicit known gaps | Skeleton complete | Rule-owner expansion, multilingual/obfuscation fixes and approval |
| PIK-014 | `evidence-gate.mjs` and `evaluate-evidence.mjs` implement 206/210 plus Wilson bounds | Implemented | Independent data-methodology review |
| PIK-015 | No repository is named in source | Blocked by decision | Nominate a low-criticality internal repository with no customer data |
| PIK-016 | Preliminary rule portability in `rule-catalog.json` | Partial | Argus/Azure DevOps owner must confirm each mapping |
| PIK-017 | Automated rollback and failure tests | Partial | Timed operational game day with named SRE and evidence record |
| PIK-018 | JetBrains is explicitly unsupported and recorded below | Partial | Bank risk owner, methodology rating, approver and expiry |
| PIK-019 | Thresholds are machine-readable in `evidence-gates.json` and `control-plane.json` | Proposed, unratified | Change board owners, evidence sources and review dates |
| PIK-020 | This status pack is reproducible from `main` | Not a go decision | Control owner must record go/hold after mandatory items close |

## What the repository proves today

- Four runtime adapters are represented: VS Code, Claude Code, Copilot SDK
  programmatic submit, and configured Copilot CLI transformed content.
- Configured command/HTTP `userPromptSubmitted` is treated as observe-only because
  its output is dropped; it is not counted as mutation.
- Signed policy integrity, expiry, LKG behavior, per-rule rollback, global
  rollback-to-shadow, asynchronous bounded audit buffering, and metadata privacy
  have automated tests.
- All seven rules remain shadow, have no production labels, and are ineligible
  for promotion.

## What remains unproven

- Pinned-runtime downstream model receipt for Copilot SDK/CLI and Claude Code.
- A privacy-approved production labeling system or on-prem collector/dashboard.
- A named pilot repository, four-stack cohort, four-week soak or 210 reviews.
- Named owners, signed approvals, bank risk ratings, endpoint heartbeat, DLP or
  verified Argus/Azure DevOps parity.
- Candidate, soft-block, Ring 0–3 or enforcement evidence.

The Day-30 decision is therefore **hold before pilot** until the plan’s mandatory
external decisions and live capability proofs are recorded.
