# /document-repo — Document what is there, mark what is not

**Context**: Use `.github/instructions/code-quality.instructions.md` and
`.github/instructions/security.instructions.md` (documentation is a common
accidental disclosure path).

**Task**: Write or update developer documentation for this repository.

**CRITICAL RULES**:
1. Every statement must be traceable to something in the repository. If you
   cannot point at the file that proves it, do not write it.
2. Mark genuine unknowns as unknown. `> **Unknown:** deployment target — needs
   owner input` is far more useful than a plausible guess.
3. Never document a real secret, token, internal hostname, production endpoint,
   or customer identifier. Use a placeholder and say where the real value lives.
4. Copy commands verbatim from the project's own config. Do not assume npm,
   Maven, or Gradle.
5. Documentation that is wrong is worse than documentation that is missing.

**Sections and where the facts come from**:

| Section | Source of truth | Never do this |
|---------|-----------------|---------------|
| Purpose | README, package/build metadata, main entry point | Infer the business domain from the repo name |
| Architecture | Actual directory layout and imports | Describe a layering the code does not follow |
| Local setup | Build config, lockfile, `.nvmrc`, Dockerfile, CI workflow | Invent prerequisites or versions |
| Build / test / run | The project's own scripts and CI steps | Generic commands that were never run here |
| Configuration | Config schema, env var references in code | List a value; list the key and its purpose only |
| Dependencies | Manifest and lockfile | Describe why a dependency was chosen unless a doc says so |
| Ownership | CODEOWNERS, existing docs | Name a team you inferred |
| Deployment | CI/CD workflow files | Describe an environment you cannot see |

**After writing**:
- Re-read each claim and confirm the file that supports it.
- Run any command you documented, and correct it if it does not work.
- Summary: which sections you wrote from evidence, which you marked unknown, and
  what someone needs to fill in.

**Do NOT**:
- Include secrets, tokens, credentials, internal URLs, or customer data
- Describe features, endpoints, or integrations you did not find in the code
- Copy a template's boilerplate sections that do not apply here
- Overwrite existing documentation that is more accurate than yours
