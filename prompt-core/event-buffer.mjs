import {
  appendFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { dirname } from "node:path";

const FORBIDDEN_KEYS = new Set([
  "prompt",
  "rawPrompt",
  "originalPrompt",
  "transformedPrompt",
  "modifiedPrompt",
  "modifiedTransformedPrompt",
  "response",
  "sourceCode",
  "promptHash",
]);

const TOP_LEVEL_FIELDS = Object.freeze({
  interception: new Set([
    "schemaVersion", "recordType", "eventId", "correlationId", "ts",
    "kernelVersion", "client", "surface", "adapter", "hook", "event",
    "clientVersion", "adapterVersion", "extensionVersion", "repositoryClass",
    "cohort", "policyPackVersion", "policyPackChecksum", "policySignatureKeyId",
    "policyPackSource", "promptCharsBucket", "promptTokenEstimateBucket",
    "governedCharsBucket", "capabilities", "selectedWorkflowIds", "routingResult",
    "selectedSkills", "policyResults", "operatingMode", "mode", "decision",
    "controlState", "latencyMs", "failureMarkers", "bypassMarkers", "blocked",
    "enforcementLevel", "unenforceable", "advisoryShown", "contextBudgetChars",
    "contextUsedChars", "contextOverBudget", "exceptionIds",
  ]),
  feedback: new Set([
    "schemaVersion", "recordType", "feedbackId", "recordedAt", "eventId",
    "ruleId", "ruleVersion", "outcome", "reasonCode", "justificationCode",
    "exceptionId", "client",
  ]),
});

function assertMetadataOnly(value, path = "event") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`${path}.${key} is prohibited in the metadata buffer`);
    }
    assertMetadataOnly(nested, `${path}.${key}`);
  }
}

function assertAllowedRecord(record) {
  const allowed = TOP_LEVEL_FIELDS[record?.recordType];
  if (!allowed) throw new Error("recordType must be interception or feedback");
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`event.${key} is not in the metadata allowlist`);
  }
}

function decodeKey(value) {
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("event encryption key must be 32 bytes encoded as base64");
  }
  return key;
}

function encodeRecord(record, encryptionKey, keyId) {
  const plain = JSON.stringify(record);
  if (!encryptionKey) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    schemaVersion: 1,
    encrypted: true,
    algorithm: "aes-256-gcm",
    keyId: keyId || "unassigned",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

function decodeRecord(line, encryptionKey) {
  const parsed = JSON.parse(line);
  if (parsed.encrypted !== true) return parsed;
  if (!encryptionKey) {
    throw new Error(`event ${parsed.keyId || "unknown"} requires a decryption key`);
  }
  if (parsed.algorithm !== "aes-256-gcm") {
    throw new Error(`unsupported event encryption algorithm ${parsed.algorithm}`);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(parsed.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plain);
}

async function pathSize(path) {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function acquireLock(path, { attempts = 20, delayMs = 5, signal } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    signal?.throwIfAborted();
    try {
      return await open(path, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const lockStatus = await stat(path);
        if (Date.now() - lockStatus.mtimeMs > 5_000) {
          await rm(path, { force: true });
          continue;
        }
      } catch (statusError) {
        if (statusError.code !== "ENOENT") throw statusError;
      }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(signal.reason || new Error("event append aborted"));
          },
          { once: true },
        );
      });
    }
  }
  throw new Error("event buffer is busy");
}

async function rotate(path, maxFiles) {
  if (maxFiles <= 1) {
    await rm(path, { force: true });
    return;
  }
  await rm(`${path}.${maxFiles - 1}`, { force: true });
  for (let index = maxFiles - 2; index >= 1; index -= 1) {
    try {
      await rename(`${path}.${index}`, `${path}.${index + 1}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  try {
    await rename(path, `${path}.1`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export class LocalEventBuffer {
  constructor({
    path,
    maxBytes = 5 * 1024 * 1024,
    maxFiles = 3,
    encryptionKey = null,
    keyId = null,
  } = {}) {
    if (!path) throw new Error("event buffer path is required");
    if (!Number.isInteger(maxBytes) || maxBytes < 256)
      throw new Error("maxBytes must be an integer of at least 256");
    if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 20)
      throw new Error("maxFiles must be between 1 and 20");
    this.path = path;
    this.maxBytes = maxBytes;
    this.maxFiles = maxFiles;
    this.encryptionKey = decodeKey(encryptionKey);
    this.keyId = keyId;
    this.pending = Promise.resolve();
  }

  append(record, { signal } = {}) {
    assertMetadataOnly(record);
    assertAllowedRecord(record);
    const line = `${encodeRecord(record, this.encryptionKey, this.keyId)}\n`;
    if (Buffer.byteLength(line) > this.maxBytes) {
      return Promise.reject(new Error("event exceeds the configured buffer size"));
    }
    const operation = this.pending.catch(() => {}).then(async () => {
      signal?.throwIfAborted();
      await mkdir(dirname(this.path), { recursive: true });
      const lockPath = `${this.path}.lock`;
      const lock = await acquireLock(lockPath, { signal });
      try {
        if ((await pathSize(this.path)) + Buffer.byteLength(line) > this.maxBytes) {
          await rotate(this.path, this.maxFiles);
        }
        signal?.throwIfAborted();
        await appendFile(this.path, line, { encoding: "utf8", flush: true });
      } finally {
        await lock.close();
        await rm(lockPath, { force: true });
      }
    });
    this.pending = operation.catch(() => {});
    return operation;
  }

  async flush() {
    await this.pending;
  }
}

export async function readBufferedEvents({
  path,
  maxFiles = 3,
  encryptionKey = null,
  limit = Number.POSITIVE_INFINITY,
} = {}) {
  const key = decodeKey(encryptionKey);
  const paths = [];
  for (let index = maxFiles - 1; index >= 1; index -= 1) {
    paths.push(`${path}.${index}`);
  }
  paths.push(path);
  const events = [];
  for (const candidate of paths) {
    try {
      const content = await readFile(candidate, "utf8");
      for (const line of content.split("\n").filter(Boolean)) {
        events.push(decodeRecord(line, key));
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return events.slice(-limit);
}

export function eventBufferFromEnv(path, env = process.env) {
  return new LocalEventBuffer({
    path,
    maxBytes: Number(env.GOV_EVENT_BUFFER_BYTES || 5 * 1024 * 1024),
    maxFiles: Number(env.GOV_EVENT_BUFFER_FILES || 3),
    encryptionKey: env.GOV_EVENT_ENCRYPTION_KEY || null,
    keyId: env.GOV_EVENT_KEY_ID || null,
  });
}
