#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(percentileValue * sorted.length) - 1),
  );
  return sorted[index];
}

function matchedRule(event, ruleId) {
  return (event.policyResults || []).some(
    (result) => result.id === ruleId && result.result === "matched",
  );
}

function latencyBreachedTwice(events, threshold) {
  if (events.length < 2) return false;
  const split = Math.floor(events.length / 2);
  const windows = [events.slice(0, split), events.slice(split)];
  return windows.every(
    (window) =>
      percentile(
        window
          .map((event) => Number(event.latencyMs?.totalDecision || 0))
          .filter(Number.isFinite),
        0.95,
      ) > threshold,
  );
}

export function evaluateRollback(events, control, now = new Date()) {
  const thresholds = control.rollbackThresholds || {};
  const configured = Object.entries(control.rules || {}).filter(([, value]) =>
    ["soft-block", "enforce"].includes(value.mode),
  );
  const rules = {};
  const degradedRate = events.length
    ? events.filter((event) => event.controlState === "degraded").length /
      events.length
    : 0;
  const integrityFailure = events.some((event) =>
    (event.failureMarkers || []).some((marker) =>
      /integrity|checksum|audit-write-failed/i.test(marker),
    ),
  );
  const latencyFailure = latencyBreachedTwice(
    events,
    Number(thresholds.p95LatencyMs ?? 250),
  );

  for (const [ruleId] of configured) {
    const matched = events.filter((event) => matchedRule(event, ruleId));
    const reasons = [];
    if (events.some((event) => event.severity1FalsePositive === true)) {
      reasons.push("severity-1-false-positive");
    }
    if (integrityFailure) reasons.push("integrity-or-audit-failure");
    if (degradedRate > Number(thresholds.degradedRate ?? 0.01)) {
      reasons.push("degraded-rate");
    }
    if (latencyFailure) reasons.push("p95-latency-two-windows");

    const minimum = Number(thresholds.minimumMatchedEvents ?? 20);
    if (matched.length >= minimum) {
      const appealed = matched.filter(
        (event) =>
          event.developerDisagreed === true ||
          event.appealOutcome === "upheld" ||
          event.overrideApproved === true,
      ).length;
      const immediate = matched.filter(
        (event) => event.immediateOverride === true,
      ).length;
      if (
        appealed / matched.length >
        Number(thresholds.appealOverrideRate ?? 0.02)
      ) {
        reasons.push("appeal-or-override-rate");
      }
      if (
        immediate / matched.length >
        Number(thresholds.immediateOverrideRate ?? 0.2)
      ) {
        reasons.push("immediate-override-rate");
      }
    }

    if (reasons.length) {
      rules[ruleId] = {
        rollbackTo: "shadow",
        triggeredAt: now.toISOString(),
        reasons: [...new Set(reasons)],
      };
    }
  }
  return rules;
}

function flagValue(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1] ?? fallback;
}

export function run(argv = process.argv.slice(2)) {
  const telemetryPath = flagValue(
    argv,
    "--telemetry",
    process.env.GOV_TELEMETRY_DIR
      ? join(process.env.GOV_TELEMETRY_DIR, "telemetry.jsonl")
      : join(homedir(), ".copilot-gov", "telemetry.jsonl"),
  );
  const outputPath = flagValue(
    argv,
    "--output",
    process.env.GOV_ROLLBACK_STATE_FILE ||
      join(homedir(), ".copilot-gov", "rollback-state.json"),
  );
  const windowSize = Number(flagValue(argv, "--window", "1000"));
  const control = JSON.parse(
    readFileSync(join(ROOT, "prompt-core", "control-plane.json"), "utf8"),
  );
  const events = existsSync(telemetryPath)
    ? readFileSync(telemetryPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .slice(-windowSize)
    : [];
  const now = new Date();
  const rules = evaluateRollback(events, control, now);
  const ttlMinutes = Number(control.rollbackThresholds?.stateTtlMinutes ?? 10);
  const state = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
    telemetryEventsEvaluated: events.length,
    rules,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(
    `${Object.keys(rules).length} rule(s) rolled back; state written to ${outputPath}`,
  );
  return state;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
