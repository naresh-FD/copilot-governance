#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readBufferedEvents } from "../prompt-core/event-buffer.mjs";

function flag(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1] ?? fallback;
}

function bump(target, key) {
  target[key] = (target[key] || 0) + 1;
}

export function summarize(events) {
  const summary = { total: events.length, controlStates: {}, decisions: {} };
  for (const event of events) {
    bump(summary.controlStates, event.controlState || "unknown");
    bump(summary.decisions, event.decision || "unknown");
  }
  return summary;
}

function flatten(value, prefix = "") {
  const result = {};
  for (const [key, nested] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === "object") Object.assign(result, flatten(nested, path));
    else result[path] = Number(nested);
  }
  return result;
}

export function reconcile(local, dashboard, tolerance = 0) {
  const left = flatten(local);
  const right = flatten(dashboard);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const differences = [];
  for (const key of keys) {
    const localValue = left[key] || 0;
    const dashboardValue = right[key] || 0;
    if (Math.abs(localValue - dashboardValue) > tolerance) {
      differences.push({ key, local: localValue, dashboard: dashboardValue });
    }
  }
  return { reconciled: differences.length === 0, tolerance, differences };
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const dashboardPath = flag(argv, "--dashboard");
  if (!dashboardPath) throw new Error("--dashboard is required");
  const telemetryPath = flag(
    argv,
    "--telemetry",
    join(env.GOV_TELEMETRY_DIR || join(homedir(), ".copilot-gov"), "telemetry.jsonl"),
  );
  const events = await readBufferedEvents({
    path: telemetryPath,
    maxFiles: Number(env.GOV_EVENT_BUFFER_FILES || 3),
    encryptionKey: env.GOV_EVENT_ENCRYPTION_KEY || null,
  });
  const dashboard = JSON.parse(readFileSync(dashboardPath, "utf8"));
  const result = reconcile(
    summarize(events),
    dashboard.counts || dashboard,
    Number(flag(argv, "--tolerance", "0")),
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.reconciled) process.exitCode = 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    process.stderr.write(`reconcile-telemetry: ${error.message}\n`);
    process.exitCode = 1;
  });
}
