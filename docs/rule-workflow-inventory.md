# Rule and Workflow Inventory

Status date: 2026-08-13

Machine-readable sources are `prompt-core/rule-catalog.json`,
`prompt-core/deny.json`, and `prompt-core/router.json`. The 21 mandatory baseline
rules have the named owner `security-governance` and source approval for enforce
mode. The seven legacy broad-signal rules remain `unassigned` and shadow-only;
runtime blocks their promotion until a named owner and evidence approval exist.

## Twenty-one mandatory baseline rules

| Stable rule ID | Intent | Current mode | Named owner |
|---|---|---|---|
| `SEC-001` | Prevent authentication or authorization bypass | Enforce | `security-governance` |
| `SEC-002` | Prevent submission of literal-looking exposed secrets | Enforce | `security-governance` |
| `SEC-003` | Prevent weak algorithms and custom cryptography | Enforce | `security-governance` |
| `QA-001` | Prevent introduction or retention of debug logging | Enforce | `security-governance` |
| `QA-002` | Prevent hardcoded operational and environment values | Enforce | `security-governance` |
| `SEC-004` | Prevent SQL injection authoring | Enforce | `security-governance` |
| `SEC-005` | Prevent sensitive data and credentials in logs | Enforce | `security-governance` |
| `SEC-006` | Prevent hardcoded credentials | Enforce | `security-governance` |
| `SEC-007` | Prevent customer, payment, and regulated data exposure | Enforce | `security-governance` |
| `SEC-008` | Prevent credential and environment-data exfiltration | Enforce | `security-governance` |
| `SEC-009` | Prevent command injection and unsafe dynamic execution | Enforce | `security-governance` |
| `SEC-010` | Prevent XSS and template injection | Enforce | `security-governance` |
| `SEC-011` | Prevent SSRF, open redirects, and path traversal | Enforce | `security-governance` |
| `SEC-012` | Prevent unsafe deserialization and XXE | Enforce | `security-governance` |
| `SEC-013` | Prevent weakening session, cookie, CSRF, CORS, and identity controls | Enforce | `security-governance` |
| `SEC-014` | Prevent internal error and stack-trace disclosure | Enforce | `security-governance` |
| `GOV-001` | Prevent governance bypass and blanket tool approval | Enforce | `security-governance` |
| `DEP-001` | Prevent software supply-chain weakening | Enforce | `security-governance` |
| `SEC-015` | Prevent removal of rate limits, timeouts, and bounded-resource controls | Enforce | `security-governance` |
| `QA-003` | Prevent silent exception swallowing and false success | Enforce | `security-governance` |
| `QA-004` | Prevent type and lint suppression used to bypass failures | Enforce | `security-governance` |

## Seven legacy shadow rules

| Stable rule ID | Intent | Portability class | Current mode | Named owner |
|---|---|---|---|---|
| `bypass-verification` | Prevent assistant-authored suppression of tests, lint, scans or CI | Dual-surface, CI mapping partial/unverified | Shadow | Missing |
| `hardcoded-secret` | Prevent secret submission or hardcoding | Dual-surface plus egress control | Shadow | Missing |
| `disable-security-scan` | Prevent assistant-driven scanner disablement or waiver | Dual-surface, CI mapping partial/unverified | Shadow | Missing |
| `custom-crypto` | Prevent custom crypto or weak-algorithm introduction | Dual-surface, SAST mapping partial/unverified | Shadow | Missing |
| `customer-data-in-prompt` | Prevent real customer/regulated data submission | Egress-control-owned; CI is not equivalent | Shadow | Missing |
| `exfiltration` | Prevent credential/environment disclosure or transmission | Egress-control-owned; CI is not equivalent | Shadow | Missing |
| `production-mutation` | Prevent direct production/protected-branch mutation | Dual-surface plus branch/pipeline gates | Shadow | Missing |

Exact non-matches, remediation text, preliminary four-axis classification and
portability fields for all 28 contracts are versioned in `rule-catalog.json`.
These are engineering assessments, not bank risk ratings. Enforce mode is a
source configuration claim: production deployment, bypass resistance, false
positive rate, and latency remain pilot evidence questions.

## Fourteen routed workflows

| Workflow ID | Intended use | Explicit non-match boundary |
|---|---|---|
| `java-security` | Java/Spring security remediation | Non-Java security work |
| `security-fix` | General security findings and CWE remediation | Requests to bypass security controls |
| `pr-review` | Address PR/reviewer feedback | General refactoring without review context |
| `angular-migration` | Angular version migration | Non-Angular upgrades |
| `test-failure` | Diagnose failing/flaky tests | Requests to introduce skipped tests |
| `generate-tests` | Add unit/integration tests | Debugging an already failing suite |
| `build-failure` | Diagnose compilation/build/CI failures | Requests to bypass the quality gate |
| `sonarqube` | Remediate Sonar findings | Adding `NOSONAR` or waivers |
| `console-cleanup` | Remove debug/console output | General observability design |
| `typescript-error` | Resolve TypeScript compiler/type errors | JavaScript-only defects |
| `eslint` | Resolve lint/format findings | Adding blanket suppressions |
| `react-quality` | React component quality/refactoring | Angular or backend refactoring |
| `explain-legacy` | Explain existing legacy code | Implement broad unrequested rewrites |
| `document-repo` | Repository/API documentation | Functional code changes unrelated to docs |

`generic` is a deterministic unmatched fallback marker, not a fifteenth routed
workflow. Telemetry emits `routingResult: unmatched` when that fallback is used.
