#!/usr/bin/env node
import {
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash, sign, verify } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CORE = join(ROOT, "prompt-core");
const manifestPath = join(CORE, "policy-pack.json");
const signaturePath = join(CORE, "policy-pack.sig");
const publicKeyPath = join(CORE, "policy-public-key.pem");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

for (const path of Object.keys(manifest.files || {})) {
  const content = readFileSync(join(CORE, path), "utf8").replace(/\r\n/g, "\n");
  manifest.files[path] = createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
const signingKeyPath = process.env.GOV_POLICY_SIGNING_KEY_FILE;
let signature;
if (signingKeyPath) {
  const privateKey = readFileSync(signingKeyPath, "utf8");
  signature = sign(null, Buffer.from(manifestText, "utf8"), privateKey);
} else {
  const existingSignature = Buffer.from(
    readFileSync(signaturePath, "utf8").trim(),
    "base64",
  );
  const publicKey = readFileSync(publicKeyPath, "utf8");
  if (!verify(null, Buffer.from(manifestText, "utf8"), publicKey, existingSignature)) {
    throw new Error(
      "policy inputs changed; GOV_POLICY_SIGNING_KEY_FILE is required to sign the updated manifest",
    );
  }
  signature = existingSignature;
}

const manifestTemporary = `${manifestPath}.${process.pid}.tmp`;
const signatureTemporary = `${signaturePath}.${process.pid}.tmp`;
writeFileSync(manifestTemporary, manifestText, "utf8");
writeFileSync(signatureTemporary, `${signature.toString("base64")}\n`, "utf8");
renameSync(manifestTemporary, manifestPath);
renameSync(signatureTemporary, signaturePath);
console.log(
  `Updated and verified ${manifestPath} for signed policy pack ${manifest.version}`,
);
