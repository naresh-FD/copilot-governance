#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createFeedbackEvent } from "../prompt-core/feedback.mjs";
import { eventBufferFromEnv } from "../prompt-core/event-buffer.mjs";

function flag(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1] ?? fallback;
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const event = createFeedbackEvent({
    eventId: flag(argv, "--event-id"),
    ruleId: flag(argv, "--rule-id"),
    ruleVersion: flag(argv, "--rule-version"),
    outcome: flag(argv, "--outcome"),
    reasonCode: flag(argv, "--reason-code"),
    justificationCode: flag(argv, "--justification-code"),
    exceptionId: flag(argv, "--exception-id"),
    client: flag(argv, "--client", "unknown"),
  });
  const path =
    env.GOV_FEEDBACK_FILE ||
    join(env.GOV_TELEMETRY_DIR || join(homedir(), ".copilot-gov"), "feedback.jsonl");
  const buffer = eventBufferFromEnv(path, env);
  await buffer.append(event);
  console.log(`${event.feedbackId} recorded for ${event.ruleId}`);
  return event;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    process.stderr.write(`record-feedback: ${error.message}\n`);
    process.exitCode = 1;
  });
}
