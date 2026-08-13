#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENGINE = join(ROOT, "prompt-core", "rewrite.mjs");
const CANARY = "PIK_CANARY_MODEL_FACING_7F4E";

function flag(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1] ?? fallback;
}

function invoke(surface, event, payload, telemetryDir) {
  const result = spawnSync(
    process.execPath,
    [ENGINE, "--surface", surface, "--event", event],
    {
      cwd: ROOT,
      input: JSON.stringify(payload),
      encoding: "utf8",
      env: {
        ...process.env,
        GOV_TELEMETRY: "1",
        GOV_TELEMETRY_DIR: telemetryDir,
        GOV_POLICY_CACHE: "0",
        GOV_ROLLBACK_STATE: "0",
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(`${surface}/${event} failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout || "{}");
}

function eventReference(value) {
  return String(value || "").match(/event=([0-9a-f-]{36})/)?.[1] || null;
}

export function run(argv = process.argv.slice(2)) {
  const dir = mkdtempSync(join(tmpdir(), "pik-canary-"));
  try {
    const sdk = invoke(
      "copilot-sdk",
      "userPromptSubmitted",
      { sessionId: "canary-sdk", prompt: `repeat marker ${CANARY}` },
      dir,
    );
    const configuredSubmit = invoke(
      "copilot-cli",
      "userPromptSubmitted",
      { sessionId: "canary-config", prompt: `repeat marker ${CANARY}` },
      dir,
    );
    const transformed = invoke(
      "copilot-cli",
      "userPromptTransformed",
      {
        sessionId: "canary-transformed",
        prompt: `repeat marker ${CANARY}`,
        transformedPrompt: `runtime transformed: ${CANARY}`,
      },
      dir,
    );
    const events = readFileSync(join(dir, "telemetry.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const sdkReference = eventReference(sdk.modifiedPrompt);
    const transformedReference = eventReference(
      transformed.modifiedTransformedPrompt,
    );
    const proof = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      proofType: "local-process-contract",
      downstreamModelReceiptProven: false,
      canary: CANARY,
      checks: {
        sdkProgrammaticSubmit: {
          mutationField: "modifiedPrompt",
          markerPresent: sdk.modifiedPrompt?.includes(CANARY) === true,
          eventReference: sdkReference,
          telemetryCorrelated: events.some((event) => event.eventId === sdkReference),
        },
        commandHttpSubmit: {
          outputDroppedContract: Object.keys(configuredSubmit).length === 0,
          telemetryObserved: events.some(
            (event) => event.correlationId === "canary-config",
          ),
        },
        transformed: {
          mutationField: "modifiedTransformedPrompt",
          markerPresent:
            transformed.modifiedTransformedPrompt?.includes(CANARY) === true,
          eventReference: transformedReference,
          telemetryCorrelated: events.some(
            (event) => event.eventId === transformedReference,
          ),
        },
      },
    };
    proof.passed = Object.values(proof.checks).every((check) =>
      Object.entries(check)
        .filter(([key]) => !["mutationField", "eventReference"].includes(key))
        .every(([, value]) => value === true),
    );
    const output = `${JSON.stringify(proof, null, 2)}\n`;
    const outputPath = flag(argv, "--output");
    if (outputPath) writeFileSync(outputPath, output, "utf8");
    process.stdout.write(output);
    if (!proof.passed) process.exitCode = 1;
    return proof;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`run-canary: ${error.message}\n`);
    process.exitCode = 1;
  }
}
