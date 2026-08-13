#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluateCandidateEvidence } from "../prompt-core/evidence-gate.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function flag(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1] ?? fallback;
}

function readRecords(path) {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  if (text.startsWith("[")) return JSON.parse(text);
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

export function run(argv = process.argv.slice(2)) {
  const ruleId = flag(argv, "--rule-id");
  const labelsPath = flag(argv, "--labels");
  const operationsPath = flag(argv, "--operations");
  const fixturesPath = flag(argv, "--fixtures");
  const shadowStartedAt = flag(argv, "--shadow-started-at");
  if (!ruleId || !labelsPath || !operationsPath || !fixturesPath || !shadowStartedAt) {
    throw new Error(
      "--rule-id, --labels, --operations, --fixtures, and --shadow-started-at are required",
    );
  }
  const policy = JSON.parse(
    readFileSync(join(ROOT, "prompt-core", "evidence-gates.json"), "utf8"),
  );
  const result = evaluateCandidateEvidence({
    ruleId,
    labels: readRecords(labelsPath),
    shadowStartedAt,
    operations: JSON.parse(readFileSync(operationsPath, "utf8")),
    fixtures: JSON.parse(readFileSync(fixturesPath, "utf8")),
    thresholds: policy.thresholds,
  });
  const output = `${JSON.stringify(result, null, 2)}\n`;
  const outputPath = flag(argv, "--output");
  if (outputPath) writeFileSync(outputPath, output, "utf8");
  process.stdout.write(output);
  if (!result.eligible) process.exitCode = 2;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`evaluate-evidence: ${error.message}\n`);
    process.exitCode = 1;
  }
}
