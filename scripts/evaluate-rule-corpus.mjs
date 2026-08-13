#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENGINE = join(ROOT, "prompt-core", "rewrite.mjs");
const CORPUS = join(ROOT, "evidence", "rule-corpus.json");

function matched(ruleId, prompt) {
  const output = execFileSync(
    process.execPath,
    [ENGINE, "--surface", "vscode", "--prompt", prompt],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        GOV_TELEMETRY: "0",
        GOV_POLICY_CACHE: "0",
        GOV_ROLLBACK_STATE: "0",
      },
    },
  );
  return output.includes(`**${ruleId}**`);
}

export function run() {
  const corpus = JSON.parse(readFileSync(CORPUS, "utf8"));
  const rules = {};
  let mismatches = 0;
  for (const rule of corpus.rules) {
    const asserted = rule.fixtures.filter((fixture) => fixture.status === "asserted");
    const positives = asserted.filter((fixture) => fixture.expectedMatch === true);
    let truePositives = 0;
    const failures = [];
    for (const fixture of asserted) {
      const actual = matched(rule.id, fixture.prompt);
      if (actual === true && fixture.expectedMatch === true) truePositives += 1;
      if (actual !== fixture.expectedMatch) {
        mismatches += 1;
        failures.push({ category: fixture.category, expected: fixture.expectedMatch, actual });
      }
    }
    rules[rule.id] = {
      metricType: "corpus-recall",
      productionRecall: false,
      assertedFixtures: asserted.length,
      assertedPositiveFixtures: positives.length,
      truePositives,
      corpusRecall: positives.length ? truePositives / positives.length : 0,
      knownGaps: rule.fixtures.filter((fixture) => fixture.status === "known-gap").length,
      failures,
    };
  }
  const report = {
    schemaVersion: 1,
    corpusVersion: corpus.version,
    generatedAt: new Date().toISOString(),
    productionRecall: false,
    passed: mismatches === 0,
    rules,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`evaluate-rule-corpus: ${error.message}\n`);
    process.exitCode = 1;
  }
}
