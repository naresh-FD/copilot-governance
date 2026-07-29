# Rollout Plan

## Waves

| Wave | Scope |
| --- | --- |
| Pilot | 4 repos |
| Wave 1 | 20-25 active repos |
| Wave 2 | 50-75 repos |
| Wave 3 | Remaining active repos |
| Steady state | Weekly audit and sync |

## Pilot Validation

- Does Copilot follow security instructions?
- Are repeated prompts reduced?
- Are PR fixes faster?
- Are unwanted console/debug findings detected earlier?
- Are repo overrides preserved?
- Are developers comfortable using prompt workflows?

## Rollout Checklist

- Confirm target repo list.
- Confirm repo owners and CODEOWNERS coverage.
- Run `scripts/copilot-gov.sh validate`.
- Run `scripts/copilot-gov.sh sync --dry-run`.
- Review generated diffs for pilot repos.
- Open PRs through automation.
- Capture pilot feedback.
- Refine baseline before Wave 1.
