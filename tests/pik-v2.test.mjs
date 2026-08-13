import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LocalEventBuffer,
  readBufferedEvents,
} from "../prompt-core/event-buffer.mjs";
import { evaluateCandidateEvidence } from "../prompt-core/evidence-gate.mjs";
import { createFeedbackEvent } from "../prompt-core/feedback.mjs";
import { finalizeReview } from "../prompt-core/labeling.mjs";
import { sanitizeReviewSample } from "../prompt-core/review-sanitizer.mjs";
import {
  prepareControlPlane,
  resolveRuleControl,
} from "../prompt-core/control-plane.mjs";
import {
  reconcile,
  summarize,
} from "../scripts/reconcile-telemetry.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENGINE = join(ROOT, "prompt-core", "rewrite.mjs");

function withTemp(fn) {
  const directory = mkdtempSync(join(tmpdir(), "pik-v2-"));
  return Promise.resolve(fn(directory)).finally(() => {
    rmSync(directory, { recursive: true, force: true });
  });
}

test("the metadata buffer is asynchronous, bounded, concurrent, and metadata-only", async () => {
  await withTemp(async (directory) => {
    const path = join(directory, "events.jsonl");
    const first = new LocalEventBuffer({ path, maxBytes: 512, maxFiles: 3 });
    const second = new LocalEventBuffer({ path, maxBytes: 512, maxFiles: 3 });
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        (index % 2 ? first : second).append({
          schemaVersion: 1,
          recordType: "interception",
          eventId: `event-${index}`,
          controlState: "governed-shadow",
          decision: "allowed",
        }),
      ),
    );
    const events = await readBufferedEvents({ path, maxFiles: 3 });
    assert.ok(events.length > 0 && events.length < 20, "rotation must bound retained events");
    assert.equal(new Set(events.map((event) => event.eventId)).size, events.length);
    assert.throws(
      () => first.append({ recordType: "interception", eventId: "bad", prompt: "must never be stored" }),
      /prohibited/,
    );
    assert.throws(
      () => first.append({ recordType: "interception", eventId: "bad", content: "unknown" }),
      /allowlist/,
    );
  });
});

test("the local buffer encrypts metadata when an approved key is configured", async () => {
  await withTemp(async (directory) => {
    const path = join(directory, "events.jsonl");
    const encryptionKey = randomBytes(32).toString("base64");
    const buffer = new LocalEventBuffer({
      path,
      encryptionKey,
      keyId: "test-key",
    });
    await buffer.append({ recordType: "interception", eventId: "encrypted-event", controlState: "observed" });
    const raw = readFileSync(path, "utf8");
    assert.ok(!raw.includes("encrypted-event"));
    const events = await readBufferedEvents({ path, encryptionKey });
    assert.equal(events[0].eventId, "encrypted-event");
  });
});

test("local and dashboard event counts reconcile by control state and decision", () => {
  const local = summarize([
    { controlState: "observed", decision: "allowed" },
    { controlState: "degraded", decision: "audit_unavailable" },
  ]);
  assert.equal(reconcile(local, local).reconciled, true);
  const mismatch = reconcile(local, { ...local, total: 3 });
  assert.equal(mismatch.reconciled, false);
  assert.deepEqual(mismatch.differences[0], {
    key: "total",
    local: 2,
    dashboard: 3,
  });
});

test("cancelled event writes do not append an audit event", async () => {
  await withTemp(async (directory) => {
    const path = join(directory, "events.jsonl");
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const buffer = new LocalEventBuffer({ path });
    await assert.rejects(
      buffer.append({ recordType: "interception", eventId: "cancelled-event" }, { signal: controller.signal }),
      /cancelled/,
    );
    const events = await readBufferedEvents({ path });
    assert.deepEqual(events, []);
    await buffer.append({ recordType: "interception", eventId: "recovered-after-cancellation" });
    assert.equal((await readBufferedEvents({ path }))[0].eventId, "recovered-after-cancellation");
  });
});

test("a stale event-buffer lock is recovered after process restart", async () => {
  await withTemp(async (directory) => {
    const path = join(directory, "events.jsonl");
    writeFileSync(`${path}.lock`, "stale", "utf8");
    const old = new Date(Date.now() - 10_000);
    utimesSync(`${path}.lock`, old, old);
    const buffer = new LocalEventBuffer({ path });
    await buffer.append({ recordType: "interception", eventId: "after-restart" });
    const events = await readBufferedEvents({ path });
    assert.equal(events[0].eventId, "after-restart");
  });
});

test("206 of 210 independently reviewed labels clear the corrected Wilson gate", () => {
  const labels = Array.from({ length: 210 }, (_, index) => ({
    evidenceId: `evidence-${index}`,
    ruleId: "hardcoded-secret",
    finalLabel: index < 206 ? "true-positive" : "false-positive",
    reviewerRefs: [`reviewer-a-${index}`, `reviewer-b-${index}`],
    repositoryRef: `repo-${index % 3}`,
  }));
  const result = evaluateCandidateEvidence({
    ruleId: "hardcoded-secret",
    labels,
    shadowStartedAt: "2026-07-01T00:00:00Z",
    now: new Date("2026-08-13T00:00:00Z"),
    fixtures: { mandatoryPassed: true, adversarialPassed: true },
    operations: {
      unresolvedSeverity1FalsePositives: 0,
      materialPrecisionDifference: false,
      p95WarmLatencyMs: 200,
      degradedRate: 0.005,
      silentFailures: 0,
      rollbackGameDayPassed: true,
      lastGameDayAt: "2026-08-01T00:00:00Z",
      disagreementRate: 0.01,
    },
  });
  assert.equal(result.eligible, true, JSON.stringify(result.reasons));
  assert.equal(result.metrics.truePositives, 206);
  assert.ok(result.metrics.wilson95Lower >= 0.95);
});

test("promotion fails when labels or operational proof are missing", () => {
  const result = evaluateCandidateEvidence({
    ruleId: "hardcoded-secret",
    labels: [],
    shadowStartedAt: "2026-08-12T00:00:00Z",
    now: new Date("2026-08-13T00:00:00Z"),
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("insufficient-reviewed-matches"));
  assert.ok(result.reasons.includes("rollback-game-day-not-passed"));
});

test("every asserted rule-corpus fixture matches its expected rule outcome", () => {
  const corpus = JSON.parse(
    readFileSync(join(ROOT, "evidence", "rule-corpus.json"), "utf8"),
  );
  for (const rule of corpus.rules) {
    for (const fixture of rule.fixtures.filter((item) => item.status === "asserted")) {
      const output = execFileSync(
        process.execPath,
        [ENGINE, "--surface", "vscode", "--prompt", fixture.prompt],
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
      assert.equal(
        output.includes(`**${rule.id}**`),
        fixture.expectedMatch,
        `${rule.id}/${fixture.category}: ${fixture.prompt}`,
      );
    }
  }
});

test("composition ordering is deterministic apart from the per-event reference", () => {
  const run = () =>
    execFileSync(
      process.execPath,
      [ENGINE, "--surface", "copilot-sdk", "--prompt", "rename PIK_UNIQUE_FIELD_42"],
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
    ).replace(/event=[0-9a-f-]{36}/, "event=[REFERENCE]");
  assert.equal(run(), run());
});

test("transformed-hook replay replaces, rather than duplicates, governance content", () => {
  const prompt = "rename PIK_UNIQUE_FIELD_43";
  const invoke = (transformedPrompt) => {
    const result = spawnSync(
      process.execPath,
      [ENGINE, "--surface", "copilot-cli", "--event", "userPromptTransformed"],
      {
        cwd: ROOT,
        input: JSON.stringify({
          sessionId: "dedup-test",
          prompt,
          transformedPrompt,
        }),
        encoding: "utf8",
        env: {
          ...process.env,
          GOV_TELEMETRY: "0",
          GOV_POLICY_CACHE: "0",
          GOV_ROLLBACK_STATE: "0",
        },
      },
    );
    assert.equal(result.status, 0);
    return JSON.parse(result.stdout).modifiedTransformedPrompt;
  };
  const first = invoke(prompt);
  const second = invoke(first);
  assert.equal((second.match(/<!-- copilot-governance/g) || []).length, 1);
  assert.equal(second.split(prompt).length - 1, 1);
});

test("a mode edit cannot promote an unowned or unapproved rule", () => {
  const base = JSON.parse(
    readFileSync(join(ROOT, "prompt-core", "control-plane.json"), "utf8"),
  );
  base.rules["hardcoded-secret"] = {
    ...base.rules["hardcoded-secret"],
    mode: "candidate",
    owner: "security-rule-owner",
  };
  const rule = { id: "hardcoded-secret", owner: "security-rule-owner" };
  const denied = prepareControlPlane(base, { GOV_ROLLBACK_STATE: "0" }, {
    status: "ratified",
    rules: { "hardcoded-secret": { candidateApproved: false } },
  });
  assert.equal(resolveRuleControl(rule, denied).effectiveMode, "shadow");
  assert.equal(resolveRuleControl(rule, denied).reason, "evidence-gate-not-approved");

  const approved = prepareControlPlane(base, { GOV_ROLLBACK_STATE: "0" }, {
    status: "ratified",
    rules: {
      "hardcoded-secret": {
        candidateApproved: true,
        approvalRef: "change-board-123",
        approvedAt: "2026-08-13T00:00:00Z",
      },
    },
  });
  assert.equal(resolveRuleControl(rule, approved).effectiveMode, "candidate");
});

test("feedback accepts only structured safe reason and justification codes", () => {
  const event = createFeedbackEvent({
    eventId: "event-123",
    ruleId: "hardcoded-secret",
    ruleVersion: "1.0.0",
    outcome: "disagree",
    reasonCode: "HARDCODED_SECRET_DETECTED",
    justificationCode: "false-positive-suspected",
  });
  assert.equal(event.outcome, "disagree");
  assert.ok(!JSON.stringify(event).includes("prompt"));
  assert.throws(
    () =>
      createFeedbackEvent({
        eventId: "event-123",
        ruleId: "hardcoded-secret",
        ruleVersion: "1.0.0",
        outcome: "agree",
        reasonCode: "SAFE",
        justificationCode: "free form customer details",
      }),
    /not approved/,
  );
});

test("two-reviewer labels require independent adjudication on disagreement", () => {
  const common = {
    evidenceId: "evidence-123",
    repositoryRef: "repo-a",
    ruleId: "hardcoded-secret",
    ruleVersion: "1.0.0",
    reasonCode: "HARDCODED_SECRET_DETECTED",
  };
  const reviews = [
    { ...common, reviewerRef: "reviewer-a", label: "true-positive" },
    { ...common, reviewerRef: "reviewer-b", label: "false-positive" },
  ];
  assert.throws(() => finalizeReview({ reviews }), /adjudicator/);
  const final = finalizeReview({
    reviews,
    adjudication: { adjudicatorRef: "reviewer-c", label: "false-positive" },
  });
  assert.equal(final.finalLabel, "false-positive");
  assert.ok(!Object.hasOwn(final, "sample"));
});

test("review sampling is opt-in, redacts identifiers, and refuses secrets or source code", () => {
  assert.equal(
    sanitizeReviewSample("contact person@example.com").reasonCode,
    "DEVELOPER_APPROVAL_REQUIRED",
  );
  const safe = sanitizeReviewSample("contact person@example.com about the warning", {
    developerApproved: true,
  });
  assert.equal(safe.eligible, true);
  assert.ok(safe.sanitized.includes("[EMAIL]"));
  assert.equal(
    sanitizeReviewSample("password = hunter2", { developerApproved: true }).eligible,
    false,
  );
  assert.equal(
    sanitizeReviewSample("function leak() { return secret; }", {
      developerApproved: true,
    }).eligible,
    false,
  );
});

test("oversized prompts fail open loudly and emit metadata only", async () => {
  await withTemp(async (directory) => {
    const prompt = "x".repeat(2_000);
    const result = spawnSync(process.execPath, [ENGINE, "--surface", "vscode"], {
      cwd: ROOT,
      input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt }),
      encoding: "utf8",
      env: {
        ...process.env,
        GOV_MAX_PROMPT_CHARS: "1000",
        GOV_TELEMETRY: "1",
        GOV_TELEMETRY_DIR: directory,
        GOV_POLICY_CACHE: "0",
        GOV_ROLLBACK_STATE: "0",
      },
    });
    assert.equal(result.status, 0);
    assert.match(result.stderr, /exceeded local safety limit/);
    const body = JSON.parse(result.stdout);
    assert.match(body.systemMessage, /passed through unchanged/);
    const telemetry = readFileSync(join(directory, "telemetry.jsonl"), "utf8");
    assert.ok(!telemetry.includes(prompt));
    assert.ok(JSON.parse(telemetry).failureMarkers.includes("oversized-prompt"));
  });
});

test("soft-block is distinct from enforce and explains correction or exception", async () => {
  await withTemp(async (directory) => {
    const result = spawnSync(process.execPath, [ENGINE, "--surface", "vscode"], {
      cwd: ROOT,
      input: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "Add eslint-disable to silence this warning",
      }),
      encoding: "utf8",
      env: {
        ...process.env,
        GOV_ALLOW_TEST_OVERRIDES: "1",
        GOV_TEST_RULE_MODES: JSON.stringify({
          "bypass-verification": "soft-block",
        }),
        GOV_TELEMETRY: "1",
        GOV_TELEMETRY_DIR: directory,
        GOV_POLICY_CACHE: "0",
        GOV_ROLLBACK_STATE: "0",
      },
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Soft block: correct the request or use an approved time-bound exception/);
    const row = JSON.parse(readFileSync(join(directory, "telemetry.jsonl"), "utf8"));
    assert.equal(row.decision, "soft_blocked");
    assert.equal(row.enforcementLevel, "soft-block");
  });
});

test("the canary harness separates SDK, config-submit, and transformed contracts", () => {
  const proof = JSON.parse(
    execFileSync(process.execPath, [join(ROOT, "scripts", "run-canary.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  );
  assert.equal(proof.passed, true);
  assert.equal(proof.downstreamModelReceiptProven, false);
  assert.equal(proof.checks.commandHttpSubmit.outputDroppedContract, true);
});
