import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPolicyPack,
  PolicyPackManager,
  PolicyPackError,
} from "../prompt-core/policy-pack.mjs";
import {
  prepareControlPlane,
  resolveRuleControl,
} from "../prompt-core/control-plane.mjs";
import {
  createCanonicalEnvelope,
  telemetryFromEnvelope,
} from "../prompt-core/envelope.mjs";
import { evaluateRollback } from "../scripts/evaluate-rollback.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CORE = join(ROOT, "prompt-core");
const MANIFEST = JSON.parse(
  readFileSync(join(CORE, "policy-pack.json"), "utf8"),
);

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "gov-policy-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function copyPolicyPack(destination) {
  mkdirSync(destination, { recursive: true });
  copyFileSync(join(CORE, "policy-pack.json"), join(destination, "policy-pack.json"));
  copyFileSync(join(CORE, "policy-pack.sig"), join(destination, "policy-pack.sig"));
  copyFileSync(
    join(CORE, "policy-public-key.pem"),
    join(destination, "policy-public-key.pem"),
  );
  for (const path of Object.keys(MANIFEST.files)) {
    copyFileSync(join(CORE, path), join(destination, path));
  }
}

function replaceSigningKey(directory) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  writeFileSync(
    join(directory, "policy-public-key.pem"),
    publicKey.export({ type: "spki", format: "pem" }),
    "utf8",
  );
  const signCurrent = () => {
    const manifestText = readFileSync(join(directory, "policy-pack.json"), "utf8");
    writeFileSync(
      join(directory, "policy-pack.sig"),
      `${sign(null, Buffer.from(manifestText), privateKey).toString("base64")}\n`,
      "utf8",
    );
  };
  signCurrent();
  return signCurrent;
}

test("active policy pack validates every declared checksum", () => {
  withTemp((cacheDir) => {
    const pack = loadPolicyPack({
      coreDir: CORE,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    assert.equal(pack.source, "active");
    assert.equal(pack.manifest.version, "3.2.0");
    assert.equal(pack.manifest.signature.algorithm, "Ed25519");
    assert.equal(pack.deny.rules.length, 28);
    assert.equal(pack.router.intents.length, 14);
  });
});

test("a tampered active pack rolls back to the checksummed last-known-good cache", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    const cacheDir = join(dir, "cache");
    copyPolicyPack(activeDir);
    const seeded = loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    assert.equal(seeded.source, "active");

    appendFileSync(join(activeDir, "deny.json"), "\nTAMPERED", "utf8");
    const fallback = loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    assert.equal(fallback.source, "last-known-good");
    assert.ok(
      fallback.degradedReasons.some((reason) =>
        reason.includes("active-policy-invalid"),
      ),
    );
    assert.equal(fallback.deny.rules.length, 28);
  });
});

test("a lower active policy version cannot replace a newer last-known-good pack", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    const cacheDir = join(dir, "cache");
    copyPolicyPack(activeDir);
    const resign = replaceSigningKey(activeDir);
    loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    const manifestPath = join(activeDir, "policy-pack.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.version = "2.9.0";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    resign();

    const fallback = loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    assert.equal(fallback.source, "last-known-good");
    assert.equal(fallback.manifest.version, "3.2.0");
    assert.ok(
      fallback.degradedReasons.some((reason) => reason.includes("downgrade")),
    );
  });
});

test("a tampered rollback-cache manifest is rejected", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    const cacheDir = join(dir, "cache");
    copyPolicyPack(activeDir);
    loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    const cachePath = join(cacheDir, "policy-last-known-good.json");
    const cache = JSON.parse(readFileSync(cachePath, "utf8"));
    cache.manifestText = cache.manifestText.replace('"version": "3.2.0"', '"version": "9.9.9"');
    writeFileSync(cachePath, JSON.stringify(cache), "utf8");
    appendFileSync(join(activeDir, "deny.json"), "\nTAMPERED", "utf8");

    assert.throws(
      () =>
        loadPolicyPack({
          coreDir: activeDir,
          kernelVersion: "3.0.0",
          cacheDir,
        }),
      /no valid last-known-good/,
    );
  });
});

test("a valid active pack repairs a corrupt last-known-good cache", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    const cacheDir = join(dir, "cache");
    copyPolicyPack(activeDir);
    loadPolicyPack({ coreDir: activeDir, kernelVersion: "3.0.0", cacheDir });
    const cachePath = join(cacheDir, "policy-last-known-good.json");
    const cache = JSON.parse(readFileSync(cachePath, "utf8"));
    cache.files["deny.json"] += "\nTAMPERED";
    writeFileSync(cachePath, JSON.stringify(cache), "utf8");

    const active = loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    assert.equal(active.source, "active");
    appendFileSync(join(activeDir, "deny.json"), "\nTAMPERED", "utf8");
    const repaired = loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
    });
    assert.equal(repaired.source, "last-known-good");
    assert.equal(repaired.deny.rules.length, 28);
  });
});

test("an invalid pack without a valid rollback cache fails closed as configuration", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    copyPolicyPack(activeDir);
    appendFileSync(join(activeDir, "router.json"), "\nTAMPERED", "utf8");
    assert.throws(
      () =>
        loadPolicyPack({
          coreDir: activeDir,
          kernelVersion: "3.0.0",
          cacheDir: join(dir, "missing-cache"),
        }),
      PolicyPackError,
    );
  });
});

test("incompatible kernel versions are rejected", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    copyPolicyPack(activeDir);
    assert.throws(
      () =>
        loadPolicyPack({
          coreDir: activeDir,
          kernelVersion: "4.0.0",
          cacheEnabled: false,
        }),
      /incompatible/,
    );
  });
});

test("a manifest edit without an Ed25519 signature is rejected", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    copyPolicyPack(activeDir);
    const manifestPath = join(activeDir, "policy-pack.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.releaseNotes = "unsigned edit";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    assert.throws(
      () =>
        loadPolicyPack({
          coreDir: activeDir,
          kernelVersion: "3.0.0",
          cacheEnabled: false,
        }),
      /signature verification failed/,
    );
  });
});

test("an expired active pack uses signed last-known-good only during the grace window", () => {
  withTemp((dir) => {
    const activeDir = join(dir, "active");
    const cacheDir = join(dir, "cache");
    copyPolicyPack(activeDir);
    loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
      now: Date.parse("2026-08-14T00:00:00Z"),
    });
    const grace = loadPolicyPack({
      coreDir: activeDir,
      kernelVersion: "3.0.0",
      cacheDir,
      now: Date.parse("2027-02-13T01:00:00Z"),
    });
    assert.equal(grace.source, "last-known-good");
    assert.ok(grace.degradedReasons.includes("last-known-good-expired-grace"));
    assert.throws(
      () =>
        loadPolicyPack({
          coreDir: activeDir,
          kernelVersion: "3.0.0",
          cacheDir,
          now: Date.parse("2027-02-14T02:00:00Z"),
        }),
      /no valid last-known-good|expired/,
    );
  });
});

test("the policy manager refreshes a signed current pack for long-lived adapters", () => {
  withTemp((cacheDir) => {
    const states = [];
    const manager = new PolicyPackManager({
      coreDir: CORE,
      kernelVersion: "3.0.0",
      cacheDir,
      refreshIntervalMs: 100,
      onRefresh: (state) => states.push(state.ok),
    });
    const current = manager.refresh();
    assert.equal(current.manifest.version, "3.2.0");
    assert.deepEqual(states, [true]);
    manager.start();
    manager.stop();
  });
});

test("rules are promoted independently and the legacy global switch is ignored", () => {
  const base = JSON.parse(
    readFileSync(join(CORE, "control-plane.json"), "utf8"),
  );
  const control = prepareControlPlane(base, {
    GOV_ROLLBACK_STATE: "0",
    GOV_ENFORCE_ALL: "1",
    GOV_ALLOW_TEST_OVERRIDES: "1",
    GOV_TEST_RULE_MODES: JSON.stringify({ "hardcoded-secret": "enforce" }),
  });
  const secret = resolveRuleControl(
    { id: "hardcoded-secret" },
    control,
    { repository: "repo", cohort: "pilot" },
  );
  const exfiltration = resolveRuleControl(
    { id: "exfiltration" },
    control,
    { repository: "repo", cohort: "pilot" },
  );
  assert.equal(secret.effectiveMode, "enforce");
  assert.equal(exfiltration.effectiveMode, "shadow");
  assert.ok(control.warnings.some((warning) => warning.includes("ignored")));
});

test("mandatory baseline approval enforces one named priority rule without fabricating evidence", () => {
  const base = JSON.parse(
    readFileSync(join(CORE, "control-plane.json"), "utf8"),
  );
  const deny = JSON.parse(readFileSync(join(CORE, "deny.json"), "utf8"));
  const gates = JSON.parse(
    readFileSync(join(CORE, "evidence-gates.json"), "utf8"),
  );
  const rule = deny.rules.find((entry) => entry.id === "SEC-001");
  const control = prepareControlPlane(
    base,
    { GOV_ROLLBACK_STATE: "0" },
    gates,
  );
  const result = resolveRuleControl(rule, control);
  assert.equal(result.effectiveMode, "enforce");
  assert.equal(result.reason, "mandatory-baseline");
});

test("incomplete mandatory baseline approval fails safe to shadow", () => {
  const base = JSON.parse(
    readFileSync(join(CORE, "control-plane.json"), "utf8"),
  );
  const deny = JSON.parse(readFileSync(join(CORE, "deny.json"), "utf8"));
  const gates = JSON.parse(
    readFileSync(join(CORE, "evidence-gates.json"), "utf8"),
  );
  delete base.rules["SEC-001"].mandatoryBlock.approvalRef;
  const rule = deny.rules.find((entry) => entry.id === "SEC-001");
  const control = prepareControlPlane(
    base,
    { GOV_ROLLBACK_STATE: "0" },
    gates,
  );
  const result = resolveRuleControl(rule, control);
  assert.equal(result.effectiveMode, "shadow");
  assert.equal(result.reason, "threshold-ledger-unratified");
});

test("emergency rollback still disables a mandatory baseline blocker", () => {
  const base = JSON.parse(
    readFileSync(join(CORE, "control-plane.json"), "utf8"),
  );
  const deny = JSON.parse(readFileSync(join(CORE, "deny.json"), "utf8"));
  const gates = JSON.parse(
    readFileSync(join(CORE, "evidence-gates.json"), "utf8"),
  );
  const rule = deny.rules.find((entry) => entry.id === "SEC-001");
  const control = prepareControlPlane(
    base,
    { GOV_EMERGENCY_SHADOW: "1", GOV_ROLLBACK_STATE: "0" },
    gates,
  );
  const result = resolveRuleControl(rule, control);
  assert.equal(result.effectiveMode, "shadow");
  assert.equal(result.reason, "emergency-rollback");
});

test("the emergency control rolls enforced rules back to shadow and never enables rules", () => {
  const base = JSON.parse(
    readFileSync(join(CORE, "control-plane.json"), "utf8"),
  );
  base.rules["hardcoded-secret"].mode = "enforce";
  base.rules.exfiltration.mode = "off";
  const control = prepareControlPlane(base, {
    GOV_EMERGENCY_SHADOW: "1",
    GOV_ROLLBACK_STATE: "0",
  });
  assert.equal(
    resolveRuleControl({ id: "hardcoded-secret" }, control).effectiveMode,
    "shadow",
  );
  assert.equal(
    resolveRuleControl({ id: "exfiltration" }, control).effectiveMode,
    "off",
  );
});

test("an invalid rule schedule fails safe to shadow", () => {
  const base = JSON.parse(
    readFileSync(join(CORE, "control-plane.json"), "utf8"),
  );
  base.rules["hardcoded-secret"] = {
    ...base.rules["hardcoded-secret"],
    mode: "enforce",
    startsAt: "not-a-date",
  };
  const control = prepareControlPlane(base, { GOV_ROLLBACK_STATE: "0" });
  const result = resolveRuleControl({ id: "hardcoded-secret" }, control);
  assert.equal(result.effectiveMode, "shadow");
  assert.equal(result.reason, "invalid-schedule");
});

test("active time-bound exceptions revert one matching rule to shadow", () => {
  const base = JSON.parse(
    readFileSync(join(CORE, "control-plane.json"), "utf8"),
  );
  base.rules["hardcoded-secret"].mode = "enforce";
  base.exceptions = [
    {
      id: "EX-123",
      ruleId: "hardcoded-secret",
      repositories: ["payments"],
      cohorts: ["ring-0"],
      businessJustification: "Short-lived migration window",
      approvingOwner: "security-owner",
      compensatingControl: "Manual review of every change",
      startsAt: "2026-08-01T00:00:00Z",
      expiresAt: "2026-09-01T00:00:00Z",
      reviewDate: "2026-08-20T00:00:00Z",
    },
  ];
  const control = prepareControlPlane(base, { GOV_ROLLBACK_STATE: "0" });
  const result = resolveRuleControl(
    { id: "hardcoded-secret" },
    control,
    {
      repository: "payments",
      cohort: "ring-0",
      now: Date.parse("2026-08-13T00:00:00Z"),
    },
  );
  assert.equal(result.effectiveMode, "shadow");
  assert.equal(result.exceptionId, "EX-123");
});

test("rollback thresholds generate a short-lived per-rule shadow state consumed by the kernel", () => {
  withTemp((dir) => {
    const base = JSON.parse(
      readFileSync(join(CORE, "control-plane.json"), "utf8"),
    );
    base.rules["hardcoded-secret"].mode = "enforce";
    const events = Array.from({ length: 40 }, (_, index) => ({
      controlState: "governed-enforced",
      policyResults: [
        { id: "hardcoded-secret", result: "matched" },
      ],
      overrideApproved: index === 0,
      latencyMs: { totalDecision: 20 },
      failureMarkers: [],
    }));
    const now = new Date("2026-08-13T00:00:00Z");
    const rules = evaluateRollback(events, base, now);
    assert.deepEqual(rules["hardcoded-secret"].reasons, [
      "appeal-or-override-rate",
    ]);

    const statePath = join(dir, "rollback-state.json");
    writeFileSync(
      statePath,
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: now.toISOString(),
        expiresAt: "2026-09-01T00:00:00Z",
        rules,
      }),
      "utf8",
    );
    const control = prepareControlPlane(base, {
      GOV_ROLLBACK_STATE_FILE: statePath,
    });
    const result = resolveRuleControl(
      { id: "hardcoded-secret" },
      control,
      { now: Date.parse("2026-08-13T00:01:00Z") },
    );
    assert.equal(result.effectiveMode, "shadow");
    assert.equal(result.reason, "per-rule-rollback");
  });
});

test("canonical envelopes keep original prompt in memory but out of JSON telemetry", () => {
  const prompt = "customer secret hunter2";
  const envelope = createCanonicalEnvelope({
    prompt,
    surface: {
      id: "test",
      adapterId: "test-adapter",
      adapterVersion: "1.0.0",
      events: ["submit"],
      notifyOnly: [],
      rewriteVerified: true,
      injectVerified: false,
      block: null,
      systemMessage: false,
      deliveryProof: { status: "contract-only" },
    },
    event: "submit",
    kernelVersion: "3.0.0",
    policyPack: {
      manifest: { version: "3.0.0", signature: { keyId: "test-key" } },
      checksum: "abc",
      source: "active",
      degradedReasons: [],
    },
    repositoryProfile: { stacks: ["node"] },
  });
  assert.equal(envelope.originalPrompt, prompt);
  assert.ok(!JSON.stringify(envelope).includes(prompt));

  const event = telemetryFromEnvelope(envelope, {
    mode: "inject",
    ruleResults: [],
    selectedSkills: [],
  });
  const serialized = JSON.stringify(event);
  assert.ok(!serialized.includes(prompt));
  assert.ok(!serialized.includes("promptHash"));
});

test("cold process p95 stays below the catastrophic-regression ceiling", {
  timeout: 20_000,
}, () => {
  // Cold startup verifies and parses the complete signed 28-rule policy pack.
  // Warm in-process policy evaluation retains the separate 250 ms threshold.
  // Windows process creation and real-time scanning can add substantial jitter
  // when the full test suite starts many Node processes concurrently. Keep the
  // ceiling strict on other platforms while retaining a catastrophic (not
  // microbenchmark) guard on Windows.
  const coldProcessCeilingMs = process.platform === "win32" ? 2_000 : 1_000;
  const durations = [];
  for (let index = 0; index < 10; index += 1) {
    const started = performance.now();
    execFileSync(
      process.execPath,
      [join(CORE, "rewrite.mjs"), "--prompt", "rename accountId to customerId"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GOV_TELEMETRY: "0",
          GOV_POLICY_CACHE: "0",
          GOV_ROLLBACK_STATE: "0",
        },
      },
    );
    durations.push(performance.now() - started);
  }
  durations.sort((left, right) => left - right);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
  assert.ok(
    p95 < coldProcessCeilingMs,
    `cold process p95 ${p95.toFixed(1)}ms exceeded ${coldProcessCeilingMs}ms safety ceiling`,
  );
});
