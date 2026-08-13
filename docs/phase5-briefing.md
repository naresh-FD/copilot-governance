# Phase 5 Briefing — Prompt Interception

**For:** Engineering leadership
**Status:** Built and tested, not yet piloted. Nothing is blocking developers today.
**Date:** 2026-07-29

> **Evidence correction, 2026-08-13:** Hook registration or a passing local
> contract test is not proof that the model received governed context. Only the
> recorded VS Code `additionalContext` canary is currently classified
> `governed-shadow`; Claude Code and Copilot CLI remain `observed` pending
> pinned-runtime downstream canaries, and JetBrains is unsupported.

---

## In one paragraph

Until now, our Copilot governance worked by *publishing* standards — we pushed
instruction files into every repository and hoped developers followed them. There
was no way to know whether they did. Phase 5 adds capability-aware prompt hooks:
eligible events are evaluated, composed with security and quality rules, and
recorded as privacy-safe local metadata. A path is counted as governed only after
a live canary proves downstream receipt. The developer's wording remains
unchanged on injected paths and is preserved byte-for-byte on replacement paths.

## Why this was worth doing

Our previous approach had a structural gap. Instruction files only influence
Copilot if the developer happens to be editing a matching file, and our reusable
prompt workflows only helped if the developer chose to invoke one. A developer in
a hurry typing "just make this work" got no governance at all — which is exactly
the moment governance matters most.

Interception narrows that gap on healthy, supported clients. It remains bypassable
through disabled, downgraded, or unsupported clients, so managed-client inventory,
network controls, and CI remain separate required controls.

The second gap was measurement. Every headline number in our Phase 1 documents —
token reduction, hallucination refusal rates — was an estimate. We had no
telemetry of any kind. The interception point is also a natural measurement
point, so we can now replace estimates with counts.

## What changes for a developer

Very little, deliberately.

| | Before | After |
| --- | --- | --- |
| What they type | Free-form prompt | Unchanged |
| What the AI receives | Whatever they typed | Their exact words, plus our security rules and the relevant approved workflow |
| Prompts blocked | n/a | **None** — see shadow mode below |
| Setup required | n/a | None; it arrives with the normal governance sync |

Their original wording is always preserved word-for-word inside the rewritten
prompt. We add context; we never replace their intent with our interpretation.

## Shadow mode — why nothing is blocked yet

The system can block prompts that violate policy (asking to hardcode a secret,
disable a security scan, skip tests, paste customer data). We have deliberately
shipped all seven policy rules in **shadow mode**: they are evaluated and logged,
the developer sees an advisory note, and the prompt proceeds normally.

This is the low-risk sequencing. We collect a few weeks of real data, see which
rules fire cleanly and which produce false alarms, and then switch on enforcement
**one rule at a time**. A high-confidence rule can go live early without waiting
for the whole set. Nobody's work gets blocked on day one by a rule we hadn't yet
validated against real usage.

## What this is not

Worth being precise about, because it affects what we can claim upward.

**It is not an auditable security control.** A developer can turn the hook off,
and if it ever runs slow it fails open by design rather than blocking their work.
It is a strong guardrail, not a gate. Making it a true control requires pushing a
device-management policy to managed laptops — a desktop-engineering workstream,
not something this initiative can deliver alone.

**It does not cover IntelliJ.** JetBrains does not support this mechanism at all.
Our Java and Spring Boot teams working in IntelliJ get the old instruction-file
coverage only — no rewriting, no policy rules, no measurement. This is a real
hole in the coverage story and we should describe it that way rather than round
it up to full coverage.

**It does not reduce token cost the way our earlier documents claimed.** The
governed prompt is *larger* than what the developer typed, because it now
includes the workflow they previously would have typed by hand or skipped
entirely. Any efficiency benefit shows up in fewer wrong answers and fewer review
round-trips, not in a smaller request. The "70–80% token reduction" figure in our
Phase 1 summary should not be repeated; it was never measured, and the
interception data now shows request size moves the other way.

## Decisions I need

| # | Decision | Why it's blocking |
| --- | --- | --- |
| 1 | **IntelliJ coverage** — move Java teams to VS Code for Copilot work, or formally accept instructions-only coverage as a documented risk? | Determines whether we can describe coverage as complete |
| 2 | **Argus integration** — can I get the CWE ruleset export format? | Our policy rules are currently hand-written placeholders. Wiring them to Argus keeps one source of truth instead of two drifting copies |
| 3 | **Device policy** — is desktop engineering willing to push the setting that prevents developers disabling this? | The difference between a guardrail and a control |

Decision 1 is the one I'd want resolved before we brief anyone in risk or audit,
because it changes the coverage claim.

## What happens next

**Phase 6 — Pilot.** Run the four pilot repositories for a few weeks in shadow
mode. Review which policy rules fired and whether the alerts were correct. Turn
on enforcement rule by rule. Publish real measured numbers to replace the
estimates in our Phase 1 documents.

**Phase 7 — Wave rollout.** 20–25 repositories, then 50–75, then the remainder,
using the existing pull-request-based sync we already run.

No new infrastructure, licences, or vendor spend is involved. It rides on the
governance sync that is already in production.

## Two defects found and fixed along the way

Both were in the existing sync engine and both were live:

**First-time onboarding was silently skipped.** The sync used a check that cannot
see brand-new files, so any repository that did not already have a governance
file was reported as "no changes needed" and quietly passed over — meaning the
primary onboarding path had never actually worked. Reproduced, fixed, verified.

**Deleted rules were never removed downstream.** The sync only ever added and
overwrote files. If we retired a rule centrally, it stayed live in every
repository forever. It now tracks what it shipped and removes what it retires,
while leaving alone any file a team added themselves.

Both matter more now that security policy rules travel through the same pipeline.

---

Full technical detail, the coverage matrix, and the honest-limits section are in
[`docs/prompt-interception-plan.md`](prompt-interception-plan.md).
