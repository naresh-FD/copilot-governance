import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const REQUIRED_FILES = [
  "core.md",
  "router.json",
  "deny.json",
  "surfaces.json",
  "control-plane.json",
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

function validateBundle({ manifest, manifestText, files, kernelVersion, source }) {
  if (manifest.schemaVersion !== 1) {
    throw new PolicyPackError(`unsupported policy manifest schema ${manifest.schemaVersion}`);
  }
  parseVersion(manifest.version, "policy pack version");
  assertCompatibility(manifest, kernelVersion);

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
    const actual = sha256(content);
    if (actual !== expected) failures.push(`${path}: checksum mismatch`);
  }
  if (failures.length) {
    throw new PolicyPackError("policy pack integrity validation failed", failures);
  }

  return {
    source,
    manifest,
    checksum: sha256(manifestText),
    files,
    core: files["core.md"],
    router: parseJson(files["router.json"], "router.json"),
    deny: parseJson(files["deny.json"], "deny.json"),
    surfaces: parseJson(files["surfaces.json"], "surfaces.json"),
    control: parseJson(files["control-plane.json"], "control-plane.json"),
    degradedReasons: [],
  };
}

function loadActive(coreDir, kernelVersion) {
  const manifestPath = join(coreDir, "policy-pack.json");
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = parseJson(manifestText, "policy-pack.json");
  const files = {};
  for (const path of Object.keys(manifest.files || {})) {
    files[path] = readFileSync(safePackPath(coreDir, path), "utf8");
  }
  return validateBundle({
    manifest,
    manifestText,
    files,
    kernelVersion,
    source: "active",
  });
}

function cacheFile(cacheDir) {
  return join(cacheDir, "policy-last-known-good.json");
}

function readCache(cacheDir, kernelVersion) {
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
    files: snapshot.files,
    kernelVersion,
    source: "last-known-good",
  });
}

function refreshCache(bundle, cacheDir, kernelVersion) {
  mkdirSync(cacheDir, { recursive: true });
  const path = cacheFile(cacheDir);
  if (existsSync(path)) {
    try {
      const current = readCache(cacheDir, kernelVersion);
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
} = {}) {
  if (!coreDir || !kernelVersion) {
    throw new PolicyPackError("coreDir and kernelVersion are required");
  }

  try {
    const active = loadActive(coreDir, kernelVersion);
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
        const cached = readCache(cacheDir, kernelVersion);
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
        refreshCache(active, cacheDir, kernelVersion);
      } catch (error) {
        active.degradedReasons.push(`policy-cache-write-failed: ${error.message}`);
      }
    }
    return active;
  } catch (activeError) {
    if (!cacheEnabled) throw activeError;
    try {
      const fallback = readCache(cacheDir, kernelVersion);
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
