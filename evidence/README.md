# PIK Evidence Inputs

This directory contains versioned, non-production test evidence. It must never
contain raw production prompts, source code, credentials, customer data, plain
prompt hashes, or sanitized samples awaiting deletion.

`rule-corpus.json` is a corpus skeleton. Fixtures marked `asserted` are automated
regression cases. Fixtures marked `known-gap` describe missing rule capability;
they are deliberately excluded from pass counts and prevent the corpus from
being represented as complete enforcement evidence.

Run `node scripts/evaluate-rule-corpus.mjs` to produce a report explicitly
labelled `corpus-recall`. It sets `productionRecall: false`; metadata-only logs
cannot estimate violations the rules did not fire on.

Long-term reviewed evidence contains only the final label, rule/version, reason
code, pseudonymous repository reference, evidence ID, reviewer references, and
adjudicator reference. Short-lived sanitized material belongs only in the
approved ephemeral review system, not Git.
