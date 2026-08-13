#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CORE = join(ROOT, "prompt-core");
const manifestPath = join(CORE, "policy-pack.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

for (const path of Object.keys(manifest.files || {})) {
  manifest.files[path] = createHash("sha256")
    .update(readFileSync(join(CORE, path)))
    .digest("hex");
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Updated ${manifestPath} for policy pack ${manifest.version}`);
