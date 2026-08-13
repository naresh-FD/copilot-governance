# Adapter Capability Matrix

Status date: 2026-08-13
Machine-readable source: `prompt-core/surfaces.json`

This matrix separates an implemented wire contract from proof that governed
content reached the downstream model. A surface is counted as governed only when
the exact client, hook, interaction, and version has a repeatable canary marked
`canary-verified`.

| Surface and hook | Observe | Notify | Replace/augment | Block | Delivery evidence | Current control state |
|---|---:|---:|---:|---:|---|---|
| VS Code `UserPromptSubmit` | Yes | Yes | `additionalContext` canary verified; `modifiedPrompt` unverified | Exit 2 contract | Local canary recorded 2026-08-09 for `additionalContext`; revalidate after upgrades | `governed-shadow` while healthy; `governed-enforced` only for a separately approved rule |
| Claude Code `UserPromptSubmit` | Yes | Yes | Context injection contract; prompt replacement unavailable | Top-level `decision:block` contract | Contract tests only; no pinned-runtime downstream canary recorded | `observed` |
| Copilot CLI `userPromptSubmitted` | Yes | Event-owned | No | No | Notification-only contract | `advisory-only` |
| Copilot CLI `userPromptTransformed` | Yes | No dedicated message channel | `modifiedTransformedPrompt` contract | No | Contract tests only; no pinned-runtime downstream canary recorded | `observed`; `degraded` if an enforced rule matches because hard blocking is unavailable |
| JetBrains | No supported adapter | No | No | No | None | `unsupported` |

## Repeatable contract checks

```bash
node --test tests/hook-simulator.test.mjs
node scripts/simulate-hook.mjs --prompt "fix the SQL injection"
```

These checks prove process-boundary payload and response shapes. They do not
replace the live harmless canary needed to prove that the pinned client delivered
the governed context to the model.

## Canary evidence record

For every pilot client/version, record:

- client, extension, adapter, hook, and interaction versions;
- harmless canary identifier and expected governed instruction;
- model-visible result proving receipt;
- correlated local event ID;
- tester, timestamp, repository class, and result;
- revalidation result after any client or extension upgrade.

No unrecorded surface may be added to the governed-coverage numerator.
