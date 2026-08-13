# Rule and Workflow Inventory

Status date: 2026-08-13

Machine-readable sources are `prompt-core/rule-catalog.json`,
`prompt-core/deny.json`, and `prompt-core/router.json`. Owners are intentionally
`unassigned`; runtime blocks promotion until a named owner and evidence approval
exist.

## Seven rules

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
portability fields are versioned in `rule-catalog.json`. These are engineering
assessments, not bank risk ratings.

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
