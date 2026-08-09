# Copilot Governance, Prompt Optimization, and Secure Code Quality Plan

## Objective

Build a hybrid Copilot Governance and Prompt Optimization Platform that helps
the organization use AI safely and efficiently across repositories.

The platform reduces repeated prompt/context token usage, strengthens security
and compliance behavior, gives developers reusable prompt workflows, and catches
common code-quality issues earlier.

## Platform Modes

| Mode | Purpose |
| --- | --- |
| Local CLI | Developers validate repo governance, preview prompts, scan common issues, and run dry-run sync locally. |
| GitHub Automation | Central team syncs governed instructions, opens PRs, checks drift, and preserves repo overrides. |
| Optional Dashboard | Platform team can later view repo coverage, drift, violations, and prompt workflow usage. |

## Scope

In scope:

- Central `.github/copilot-instructions.md` baseline.
- Path-specific `.github/instructions/*.instructions.md` files.
- Reusable `.github/prompts/*.prompt.md` workflows.
- Local `copilot-gov` CLI.
- GitHub PR-based automation.
- Security, compliance, testing, and code-quality guardrails.
- Repo-specific override preservation.
- Audit, reporting, and phased rollout.

Out of scope for MVP:

- Full custom AI model hosting.
- Replacing SonarQube, SAST, secret scanning, dependency scanning, or manual
  security review.
- Auto-merging governance PRs.
- Automatically modifying application code without developer approval.

## MVP Phases

This table is the single source of truth for phase numbering. `PHASE1_COMPLETE.md`
previously used a competing numbering in which "Phase 2" meant the local
validation gate; that numbering is retired, because the sync engine and the
GitHub automation it called future work already shipped.

| Phase | Name | Status | Output |
| --- | --- | --- | --- |
| 0 | Foundation | Delivered | Governance baseline ready for pilot. |
| 1 | Baseline Instructions | Delivered | Reusable Copilot governance baseline ready. |
| 2 | Sync Engine | Delivered | Central governance files can be safely synced to target repos. |
| 3 | Local CLI | Delivered | Developers can use governance locally before PR. |
| 4 | GitHub Automation | Delivered | Governance can scale across repos through PR-based automation. |
| 5 | Prompt Interception Kernel | In progress (shadow mode) | Every prompt is governed against the governance core before the model sees it, on every surface that supports hooks, and every interception is measured. See `docs/prompt-interception-plan.md`. |
| 6 | Pilot Rollout | Not started | Pilot feedback and real telemetry captured; deny rules graduate from shadow to enforcing per rule. |
| 7 | Wave Rollout | Not started | Weekly audit and sync steady state. |

Phase 5 is sometimes called "Phase 2" in interception-programme documents, where
it is the second stage after instruction sync. The table above is the platform
numbering and is what the rest of this repository uses.

## Phase 5 surface coverage

Interception is delivered per client, and the clients are not equivalent. This
table is the coverage position of record; `docs/prompt-interception-plan.md`
holds the schema detail behind it.

| Client | Governed | Can rewrite | Can block | Config |
| --- | --- | --- | --- | --- |
| VS Code Copilot | Yes, by injection | No | Yes (exit 2) | `hooks/prompt-interceptor.json` |
| Copilot CLI / coding agent | Yes, by rewrite | Yes | **No** | `hooks/copilot-cli-interceptor.json` |
| Claude Code | Yes, by injection | No | Yes (`decision`) | `hooks/claude-code-settings.fragment.json` |
| **JetBrains / IntelliJ** | **No** | No | No | *none possible* |

Two things follow that must not be smoothed over when reporting coverage:

**No single client can both rewrite and block.** The one client that can replace
a prompt cannot stop one, and the two that can stop one cannot alter it. "The
platform intercepts and enforces" is true of the union of clients and of no
individual developer's setup. Report the per-client position.

**JetBrains cannot be governed at runtime at all.** IntelliJ has no hook support,
so those repositories get `.github/copilot-instructions.md`, the
`.github/instructions/` files and the `.github/prompts/` workflows — published
guidance the developer may or may not follow — and nothing else. No prompt
rewriting, no context injection, no deny-rule evaluation, and **no telemetry**,
which means there is no evidence of what is happening in those sessions either.

This gap lands disproportionately on the Java and Spring Boot estate, which is
both the most likely to be working in IntelliJ and the holder of the only
high-risk, human-review-required intent in the router (`java-security`). The
teams with the highest-risk prompts have the weakest coverage. This must be
raised with the Java teams by name and carried as a named accepted risk with an
owner — not netted off against the three surfaces that do work. Options are to
move those teams to VS Code for Copilot work, formally accept instructions-only
coverage, or wait for JetBrains hook support.

## Pilot Repositories

- `alerts`
- `react-feature-template`
- `backend-api`
- `web-dashboard`

Pilot repos must cover all three governed surfaces and at least one IntelliJ
Java team, so the coverage gap is measured during the pilot rather than
discovered at wave rollout.

## Success Metrics

| Metric | Target |
| --- | --- |
| Repo onboarding | 100% active repos receive the governance files |
| Runtime interception coverage | 100% of repos on a hook-capable client; IntelliJ-only repos counted separately as uncovered, never as onboarded |
| Token reduction | 40-60% less repeated manual prompt context |
| Security baseline coverage | 100% repos include security guardrails |
| Console/debug reduction | 80% reduction in unwanted console/debug review comments |
| PR fix speed | 20-30% faster fixes for common issues |
| Override safety | Zero repo override loss |
| Drift | Governance drift fixed within one sync cycle |
| Prompt reuse | Approved workflows used for common fixes |
| Compliance PR approval | 100% governance changes reviewed by required owners |

## Final Positioning

This is a hybrid Copilot Governance and Prompt Optimization platform that
reduces AI token waste, strengthens secure coding and compliance behavior, and
gives developers reusable workflows to fix code issues faster across local IDE
usage and GitHub automation.
