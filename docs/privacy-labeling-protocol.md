# Privacy-Safe Labeling and Feedback Protocol

Production precision evidence cannot be counted until privacy, security and
employee-monitoring stakeholders approve this workflow.

1. The kernel writes only safe metadata, stable reason codes and size buckets to
   the bounded local event buffer. Raw prompts, source, responses, secrets,
   repository paths and plain prompt hashes are prohibited by code.
2. A developer records `agree`, `disagree` or `uncertain` using structured reason
   and justification codes. Free-form prompt or customer content is not accepted.
3. A sample is created only after explicit developer approval. The local
   sanitizer refuses credential, regulated-number and source-code patterns and
   deterministically redacts identifiers. Refused events remain metadata-only.
4. Sanitized material is submitted only to an approved ephemeral internal
   system and expires after seven days. It must never be committed to this repo.
5. Two independent reviewers label the same evidence. Disagreement requires a
   third independent adjudicator. `uncertain` evidence is excluded from the
   precision denominator.
6. Long-term evidence stores only the final label, evidence ID, pseudonymous
   repository reference, rule/version, reason code and reviewer references.
7. Credentials, customer data and unredacted source code are never sampled.

Implementation: `feedback.mjs`, `labeling.mjs`, `review-sanitizer.mjs`,
`record-feedback.mjs`, and `evaluate-evidence.mjs`.

This repository supplies protocol enforcement and tests; it does not supply an
approved collector, reviewer identity system, access policy or retention job.

Proposed retention pending approval: raw prompts and source are zero-retention;
sanitized ephemeral samples are seven days; pseudonymous operational metadata is
30 days; final adjudicated rule evidence follows the control-record schedule.
Only the size-bounded local buffer is implemented here. A time-based deletion job
must be supplied and tested by the approved on-prem collector before pilot data
is collected.
