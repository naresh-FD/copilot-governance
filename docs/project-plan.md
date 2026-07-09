# Standardizing copilot-instructions.md

## Project Plan — Copilot Governance Initiative, BOL Commercial

**Owner:** Naresh, Architect  |  **Status:** Draft  |  **Last updated:** July 2026

## 1. Problem statement

GitHub Copilot suggestions are inconsistent across our repos because there is
no shared, enforced `copilot-instructions.md` baseline. Each team either has
none, an outdated one, or one that conflicts with our compliance posture
(banking/financial regulated environment — code and data must never leave
approved tooling). This creates uneven code-suggestion quality and a
compliance exposure across the React microfrontend, Angular (v12 legacy /
v21 migration), and Java microservice stacks, spanning 100+ repos.

## 2. Goals

- Establish one org-owned baseline `copilot-instructions.md` covering
  compliance rules and stack conventions.
- Preserve each repo's legitimate local exceptions without letting them
  drift from the compliance core.
- Propagate the baseline to 100+ repos with an auditable, human-reviewed
  process (PRs, not silent overwrites).
- Keep the baseline current as the Angular v12 → v21 migration progresses.

## 3. Non-goals

- Replacing Azure DevOps as the release CI/CD system — GitHub Actions here
  is scoped to governance/sync only.
- Auto-merging changes into downstream repos without review.
- Rewriting each repo's full contributor docs — this covers Copilot
  instructions specifically.

## 4. Approach: hybrid org + repo governance

A central `copilot-governance` repo owns the baseline content. Each
downstream repo's `copilot-instructions.md` is split by a
`REPO OVERRIDES` marker: everything above it is managed centrally and
refreshed by automation; everything below it is repo-owned and never
touched by the sync. This gives teams room for legitimate local context
(e.g. a repo-specific testing quirk) while keeping the compliance-critical
baseline consistent and centrally auditable.

## 5. Workstreams and milestones

| Phase | Scope | Target |
|---|---|---|
| 0. Foundation | Author baseline content, build sync workflow + script, pilot on the 4 repos already touched by the security remediation work (`alerts`, `intrafi-transfers`, `react-feature-template`, `account-details`) | Week 1 |
| 1. Governance repo live | `copilot-governance` repo created, PAT + org variable configured, first manual sync run reviewed | Week 1-2 |
| 2. Wave 1 rollout | Sync to actively-developed repos (~25) with team leads reviewing PRs | Week 3-4 |
| 3. Wave 2 rollout | Remaining repos (~75), batched by team/domain | Week 5-7 |
| 4. Steady state | Weekly scheduled sync + on-change sync; baseline updates tracked via governance repo PR history | Ongoing |
| 5. Migration sync | Update Angular section as v12 → v21 migration reaches each repo | Ongoing, per migration wave |

## 6. Roles

| Role | Responsibility |
|---|---|
| Naresh (Principal Architect) | Owns baseline content, approves governance repo changes |
| Repo/team leads | Review and merge the sync PR for their repo(s), maintain repo-specific overrides |
| Platform/DevOps | Maintains the sync PAT, workflow health, and access scope |

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| PAT with broad repo access is a compliance concern | Fine-grained PAT scoped only to Contents + Pull Requests, rotated periodically, stored as an org secret |
| A repo silently loses its local overrides | Marker-based merge preserves everything below `REPO OVERRIDES START`; script diffs before writing |
| Sync PRs pile up unreviewed | Weekly scheduled re-run keeps PRs current; add a dashboard/report step if backlog grows |
| Baseline drifts out of date with the v12 → v21 migration | Migration section reviewed at each migration wave milestone, not just ad hoc |

## 8. Success metrics

- 100% of active repos have a `copilot-instructions.md` sourced from the
  governance baseline.
- Baseline updates reach all repos within one sync cycle (weekly) without
  manual chasing.
- Zero incidents of repo-specific overrides being lost during a sync.

## 9. Immediate next steps

- Create the `copilot-governance` repo and push the baseline template +
  workflow.
- Provision `GOV_SYNC_PAT` and `GH_ORG`, run the sync manually against the
  4 pilot repos.
- Review resulting PRs with pilot repo owners, adjust baseline wording
  based on feedback.
- Generate the full `repos.json` from `gh repo list` and sequence
  Wave 1 / Wave 2.
