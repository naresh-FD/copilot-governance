# Adapter Capability Matrix

Status date: 2026-08-13
Machine-readable source: `prompt-core/surfaces.json`

Capabilities are specific to surface, client version, hook runtime and
interaction type. An official wire contract is not downstream delivery proof.

| Surface/runtime and hook | Observe | Mutate model-facing content | Pre-send/hard block | Evidence | Counted state |
|---|---:|---:|---:|---|---|
| VS Code `UserPromptSubmit` command hook | Yes | `additionalContext` augmentation; `modifiedPrompt` unverified | Exit-2 contract | Local augmentation canary 2026-08-09; client version must be pinned for pilot | `governed-shadow` only in recorded scope |
| Claude Code `UserPromptSubmit` | Yes | Context injection contract; cannot replace prompt | Top-level `decision:block` contract | Process contract only; no model-receipt canary | `observed` |
| Copilot SDK programmatic `userPromptSubmitted` | Yes | Yes, `modifiedPrompt` | Hook cannot reject; application must gate before `session.send()` | Official contract plus local process harness; no pinned app receipt canary | `observed` |
| Copilot CLI/cloud command or HTTP `userPromptSubmitted` | Yes | No; output is dropped, including `modifiedPrompt` | No | Official contract plus local process harness | `advisory-only` |
| Copilot CLI/cloud `userPromptTransformed` | Yes | Yes, `modifiedTransformedPrompt` | No; mutation-only | Official contract plus local process harness; no pinned downstream receipt canary | `observed`; `degraded` for an unenforceable blocking match |
| Cloud-agent machine-wide policy hook | No | No | No | Officially unsupported for policy-hook installation | `unsupported` |
| JetBrains | No adapter | No | No | None | `unsupported` |

GitHub’s current contract states that configured command/HTTP
`userPromptSubmitted` output is dropped, while SDK programmatic output can
return `modifiedPrompt`. `userPromptTransformed` runs immediately before
model-facing content is emitted and persisted, can replace that content, and
cannot block or handle the turn. Hosted/cloud-agent behavior still requires a
pinned live canary.

## Repeatable local checks

```bash
node scripts/run-canary.mjs
node --test tests/hook-simulator.test.mjs tests/pik-v2.test.mjs
```

The canary correlates a harmless marker with its metadata event and separately
tests SDK submit, configured submit, and transformed output. Its evidence type
is `local-process-contract` and it explicitly reports
`downstreamModelReceiptProven: false`.

## Required live canary record

- client, SDK/extension, adapter, hook and interaction versions;
- harmless canary ID and expected governed instruction;
- model-visible result proving receipt;
- correlated local event ID;
- tester, timestamp, repository class and result;
- failure/degraded behavior and upgrade revalidation.

No unrecorded path enters the governed-coverage numerator.
