import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash, verify } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const REQUIRED_FILES = [
  "core.md",
  "router.json",
  "deny.json",
  "surfaces.json",
  "control-plane.json",
  "rule-catalog.json",
  "evidence-gates.json",
];

export class PolicyPackError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "PolicyPackError";
    this.details = details;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function policyFileChecksumMatches(content, expected) {
  if (sha256(content) === expected) return true;

  // Git stores policy text as LF, while older signed packs may have been built
  // from a Windows CRLF checkout. Treat only those two byte representations as
  // equivalent; every non-line-ending content change still fails integrity.
  const lf = content.replace(/\r\n/g, "\n");
  if (sha256(lf) === expected) return true;
  return sha256(lf.replace(/\n/g, "\r\n")) === expected;
}

function parseVersion(value, label) {
  const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new PolicyPackError(`${label} must be semantic version x.y.z`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function compareVersionStrings(left, right) {
  return compareVersions(
    parseVersion(left, "policy pack version"),
    parseVersion(right, "policy pack version"),
  );
}

function assertCompatibility(manifest, kernelVersion) {
  const kernel = parseVersion(kernelVersion, "kernel version");
  const minimum = parseVersion(
    manifest.minimumKernelVersion,
    "minimumKernelVersion",
  );
  const maximum = parseVersion(
    manifest.maximumKernelVersionExclusive,
    "maximumKernelVersionExclusive",
  );
  if (compareVersions(kernel, minimum) < 0 || compareVersions(kernel, maximum) >= 0) {
    throw new PolicyPackError(
      `policy pack ${manifest.version} is incompatible with kernel ${kernelVersion}`,
    );
  }
}

function safePackPath(coreDir, path) {
  if (!path || isAbsolute(path)) {
    throw new PolicyPackError(`policy pack path must be relative: ${path}`);
  }
  const full = resolve(coreDir, path);
  const rel = relative(resolve(coreDir), full);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PolicyPackError(`policy pack path escapes prompt-core: ${path}`);
  }
  return full;
}

function parseJson(content, label) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new PolicyPackError(`${label} is not valid JSON: ${error.message}`);
  }
}

function validateTemporalWindow(
  manifest,
  { source, now, lastKnownGoodGraceMs },
) {
  const issuedAt = Date.parse(manifest.issuedAt || "");
  const expiresAt = Date.parse(manifest.expiresAt || "");
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    throw new PolicyPackError("policy manifest issuedAt and expiresAt must be valid dates");
  }
  if (expiresAt <= issuedAt) {
    throw new PolicyPackError("policy manifest expiresAt must be after issuedAt");
  }
  if (issuedAt > now + 5 * 60_000) {
    throw new PolicyPackError("policy manifest is not valid yet");
  }
  if (now <= expiresAt) return [];
  if (source === "last-known-good" && now <= expiresAt + lastKnownGoodGraceMs) {
    return ["last-known-good-expired-grace"];
  }
  throw new PolicyPackError(`policy manifest expired at ${manifest.expiresAt}`);
}

function validateSignature(manifestText, signatureText, publicKeyText) {
  let signature;
  try {
    signature = Buffer.from(String(signatureText || "").trim(), "base64");
  } catch {
    throw new PolicyPackError("policy signature is not valid base64");
  }
  if (signature.length === 0) throw new PolicyPackError("policy signature is missing");
  let valid = false;
  try {
    valid = verify(null, Buffer.from(manifestText, "utf8"), publicKeyText, signature);
  } catch (error) {
    throw new PolicyPackError(`policy signature could not be verified: ${error.message}`);
  }
  if (!valid) throw new PolicyPackError("policy signature verification failed");
}

function validateBundle({
  manifest,
  manifestText,
  signatureText,
  publicKeyText,
  files,
  kernelVersion,
  source,
  now,
  lastKnownGoodGraceMs,
}) {
  if (manifest.schemaVersion !== 2) {
    throw new PolicyPackError(`unsupported policy manifest schema ${manifest.schemaVersion}`);
  }
  if (manifest.signature?.algorithm !== "Ed25519" || !manifest.signature?.keyId) {
    throw new PolicyPackError("policy manifest must declare an Ed25519 keyId");
  }
  validateSignature(manifestText, signatureText, publicKeyText);
  parseVersion(manifest.version, "policy pack version");
  assertCompatibility(manifest, kernelVersion);
  const temporalWarnings = validateTemporalWindow(manifest, {
    source,
    now,
    lastKnownGoodGraceMs,
  });

  const declared = manifest.files || {};
  for (const required of REQUIRED_FILES) {
    if (!declared[required]) {
      throw new PolicyPackError(`policy pack does not declare ${required}`);
    }
  }

  const failures = [];
  for (const [path, expected] of Object.entries(declared)) {
    const content = files[path];
    if (typeof content !== "string") {
      failures.push(`${path}: missing`);
      continue;
    }
    if (!policyFileChecksumMatches(content, expected)) {
      failures.push(`${path}: checksum mismatch`);
    }
  }
  if (failures.length) {
    throw new PolicyPackError("policy pack integrity validation failed", failures);
  }

  return {
    source,
    manifest,
    checksum: sha256(manifestText),
    signature: String(signatureText).trim(),
    files,
    core: files["core.md"],
    router: parseJson(files["router.json"], "router.json"),
    deny: parseJson(files["deny.json"], "deny.json"),
    surfaces: parseJson(files["surfaces.json"], "surfaces.json"),
    control: parseJson(files["control-plane.json"], "control-plane.json"),
    ruleCatalog: parseJson(files["rule-catalog.json"], "rule-catalog.json"),
    evidenceGates: parseJson(files["evidence-gates.json"], "evidence-gates.json"),
    degradedReasons: temporalWarnings,
  };
}

function loadActive(
  coreDir,
  kernelVersion,
  publicKeyText,
  now,
  lastKnownGoodGraceMs,
) {
  const manifestPath = join(coreDir, "policy-pack.json");
  const manifestText = readFileSync(manifestPath, "utf8");
  const signatureText = readFileSync(join(coreDir, "policy-pack.sig"), "utf8");
  const manifest = parseJson(manifestText, "policy-pack.json");
  const files = {};
  for (const path of Object.keys(manifest.files || {})) {
    files[path] = readFileSync(safePackPath(coreDir, path), "utf8");
  }
  return validateBundle({
    manifest,
    manifestText,
    signatureText,
    publicKeyText,
    files,
    kernelVersion,
    source: "active",
    now,
    lastKnownGoodGraceMs,
  });
}

function cacheFile(cacheDir) {
  return join(cacheDir, "policy-last-known-good.json");
}

function readCache(
  cacheDir,
  kernelVersion,
  publicKeyText,
  now,
  lastKnownGoodGraceMs,
) {
  const snapshotText = readFileSync(cacheFile(cacheDir), "utf8");
  const snapshot = parseJson(snapshotText, "last-known-good policy cache");
  if (sha256(snapshot.manifestText || "") !== snapshot.manifestChecksum) {
    throw new PolicyPackError("last-known-good manifest checksum mismatch");
  }
  const manifest = parseJson(
    snapshot.manifestText,
    "last-known-good policy manifest",
  );
  return validateBundle({
    manifest,
    manifestText: snapshot.manifestText,
    signatureText: snapshot.signatureText,
    publicKeyText,
    files: snapshot.files,
    kernelVersion,
    source: "last-known-good",
    now,
    lastKnownGoodGraceMs,
  });
}

function refreshCache(
  bundle,
  cacheDir,
  kernelVersion,
  publicKeyText,
  now,
  lastKnownGoodGraceMs,
) {
  mkdirSync(cacheDir, { recursive: true });
  const path = cacheFile(cacheDir);
  if (existsSync(path)) {
    try {
      const current = readCache(
        cacheDir,
        kernelVersion,
        publicKeyText,
        now,
        lastKnownGoodGraceMs,
      );
      if (current.checksum === bundle.checksum) return;
    } catch {
      // Replace an unreadable cache only after the active pack has validated.
    }
  }

  const manifestText = readFileSync(join(bundle.coreDir, "policy-pack.json"), "utf8");
  const snapshot = JSON.stringify(
    {
      schemaVersion: 1,
      cachedAt: new Date().toISOString(),
      manifestChecksum: bundle.checksum,
      manifestText,
      signatureText: bundle.signature,
      manifest: bundle.manifest,
      files: bundle.files,
    },
    null,
    2,
  );
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${snapshot}\n`, "utf8");
  renameSync(temporary, path);
}

export function loadPolicyPack({
  coreDir,
  kernelVersion,
  cacheDir = process.env.GOV_POLICY_CACHE_DIR ||
    join(homedir(), ".copilot-gov", "policy-cache"),
  cacheEnabled = process.env.GOV_POLICY_CACHE !== "0",
  minimumPolicyVersion = process.env.GOV_MIN_POLICY_VERSION || null,
  publicKeyPath = join(coreDir || "", "policy-public-key.pem"),
  now = Date.now(),
  lastKnownGoodGraceMs = Number(
    process.env.GOV_LKG_GRACE_HOURS || 24,
  ) * 60 * 60_000,
} = {}) {
  if (!coreDir || !kernelVersion) {
    throw new PolicyPackError("coreDir and kernelVersion are required");
  }

  now = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(now)) throw new PolicyPackError("now must be a valid time");
  if (!Number.isFinite(lastKnownGoodGraceMs) || lastKnownGoodGraceMs < 0) {
    throw new PolicyPackError("lastKnownGoodGraceMs must be non-negative");
  }

  let publicKeyText;
  try {
    publicKeyText = readFileSync(publicKeyPath, "utf8");
  } catch (error) {
    throw new PolicyPackError(`policy public key is unavailable: ${error.message}`);
  }
  try {
    const active = loadActive(
      coreDir,
      kernelVersion,
      publicKeyText,
      now,
      lastKnownGoodGraceMs,
    );
    if (
      minimumPolicyVersion &&
      compareVersionStrings(active.manifest.version, minimumPolicyVersion) < 0
    ) {
      throw new PolicyPackError(
        `policy pack downgrade rejected: ${active.manifest.version} is below pinned ${minimumPolicyVersion}`,
      );
    }
    active.coreDir = coreDir;
    if (cacheEnabled) {
      try {
        const cached = readCache(
          cacheDir,
          kernelVersion,
          publicKeyText,
          now,
          lastKnownGoodGraceMs,
        );
        if (
          compareVersionStrings(active.manifest.version, cached.manifest.version) < 0
        ) {
          cached.degradedReasons.push(
            `active-policy-downgrade-rejected: ${active.manifest.version} < ${cached.manifest.version}`,
          );
          return cached;
        }
      } catch {
        // A missing or invalid cache is replaced only after active validation.
      }
      try {
        refreshCache(
          active,
          cacheDir,
          kernelVersion,
          publicKeyText,
          now,
          lastKnownGoodGraceMs,
        );
      } catch (error) {
        active.degradedReasons.push(`policy-cache-write-failed: ${error.message}`);
      }
    }
    return active;
  } catch (activeError) {
    if (!cacheEnabled) throw activeError;
    try {
      const fallback = readCache(
        cacheDir,
        kernelVersion,
        publicKeyText,
        now,
        lastKnownGoodGraceMs,
      );
      if (
        minimumPolicyVersion &&
        compareVersionStrings(fallback.manifest.version, minimumPolicyVersion) < 0
      ) {
        throw new PolicyPackError(
          `last-known-good policy ${fallback.manifest.version} is below pinned ${minimumPolicyVersion}`,
        );
      }
      fallback.degradedReasons.push(
        `active-policy-invalid: ${activeError.message}`,
        ...(activeError.details || []),
      );
      return fallback;
    } catch (cacheError) {
      throw new PolicyPackError(
        `active policy invalid and no valid last-known-good pack is available: ${activeError.message}`,
        [
          ...(activeError.details || []),
          `last-known-good: ${cacheError.message}`,
          ...(cacheError.details || []),
        ],
      );
    }
  }
}

export class PolicyPackManager {
  constructor({ refreshIntervalMs = 5 * 60_000, onRefresh = null, ...options } = {}) {
    if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs < 100) {
      throw new PolicyPackError("refreshIntervalMs must be at least 100");
    }
    this.options = options;
    this.refreshIntervalMs = refreshIntervalMs;
    this.onRefresh = onRefresh;
    this.current = null;
    this.lastError = null;
    this.timer = null;
  }

  refresh() {
    try {
      this.current = loadPolicyPack(this.options);
      this.lastError = null;
      this.onRefresh?.({ ok: true, bundle: this.current });
    } catch (error) {
      this.lastError = error;
      if (this.current) {
        const expiresAt = Date.parse(this.current.manifest.expiresAt || "");
        const grace = Number(
          this.options.lastKnownGoodGraceMs ??
            Number(process.env.GOV_LKG_GRACE_HOURS || 24) * 60 * 60_000,
        );
        const refreshNow =
          this.options.now instanceof Date
            ? this.options.now.getTime()
            : Number(this.options.now ?? Date.now());
        if (!Number.isFinite(expiresAt) || refreshNow > expiresAt + grace) {
          this.current = null;
        } else if (
          !this.current.degradedReasons.includes("background-policy-refresh-failed")
        ) {
          this.current.degradedReasons.push("background-policy-refresh-failed");
        }
      }
      this.onRefresh?.({ ok: false, error, bundle: this.current });
      if (!this.current) throw error;
    }
    return this.current;
  }

  start() {
    if (this.timer) return this;
    this.refresh();
    this.timer = setInterval(() => {
      try {
        this.refresh();
      } catch {
        // onRefresh receives the failure; consumers observe it through getCurrent().
      }
    }, this.refreshIntervalMs);
    this.timer.unref?.();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getCurrent() {
    if (!this.current) {
      throw this.lastError || new PolicyPackError("no current policy pack");
    }
    return this.current;
  }
}
