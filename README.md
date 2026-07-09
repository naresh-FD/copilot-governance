# copilot-governance

Central source of truth for `.github/copilot-instructions.md` across BOL
Commercial repos, with automated sync via GitHub Actions.

## How it works

1. `templates/copilot-instructions.base.md` is the org baseline. Edit it here,
   not in downstream repos.
2. `repos.json` lists which repos receive the sync.
3. The `sync-copilot-instructions` workflow runs on:
   - push to `main` that touches the base template, `repos.json`, or the
     sync script
   - manual dispatch (optionally scoped to one repo via `repo_filter`)
   - a weekly cron safety net (Mondays 03:00 UTC)
4. For each repo, it clones, replaces everything **above** the
   `<!-- REPO OVERRIDES START -->` marker with the current baseline, keeps
   everything at/after the marker untouched, and opens a PR on branch
   `chore/sync-copilot-instructions` if there's a diff.
5. Humans review and merge each PR — this never force-merges.

## One-time setup

1. **Create a fine-grained PAT** scoped to the org (or the specific 100+
   repos): permissions `Contents: Read and write`, `Pull requests: Read and
   write`. Store it as an org or repo secret named `GOV_SYNC_PAT`.
2. **Set the `GH_ORG` repo/org variable** to your GitHub org name.
3. Populate `repos.json` with the full repo list (script below can help
   generate it from `gh repo list`).
4. Push to `main` once to trigger the first sync, or run the workflow
   manually from the Actions tab.

## Generating the full repo list

```bash
gh repo list <org> --limit 400 --json name -q '.[].name' | jq -R -s -c 'split("\n")[:-1]' \
  | jq '{repos: .}' > repos.json
```

Review the output and remove archived/deprecated repos before committing.

## Adding a repo-specific override

In the target repo's `.github/copilot-instructions.md`, add anything
between the `REPO OVERRIDES START` and `REPO OVERRIDES END` markers. The
sync workflow will never touch that section — only the org baseline above
it gets refreshed.

## Rollout plan

See `docs/project-plan.md` (or the Word version shared alongside this repo)
for the phased rollout across the ~100+ repos, starting with the four repos
already onboarded from the security remediation work (`alerts`,
`intrafi-transfers`, `react-feature-template`, `account-details`).
