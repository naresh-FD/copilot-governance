#!/usr/bin/env node
//
// Merge the governance UserPromptSubmit hook into an existing .claude/settings.json.
//
// Usage:
//   node scripts/install-claude-hook.mjs \
//     --fragment hooks/claude-code-settings.fragment.json \
//     --dest /path/to/downstream-repo/.claude/settings.json
//
// The merge is idempotent: if the hook command is already present the file is
// not rewritten. Writes are atomic — the destination is updated via a temp-file
// rename so partial writes cannot corrupt the settings file.
//
// Why this is separate from the sync script:
//   .claude/settings.json is a REAL settings file that developers own. Copying
//   the fragment over it would silently discard their model, permissions, env,
//   and statusline settings. The installer merges only the keys the fragment
//   defines, leaving everything else intact.

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function usage() {
  console.error('Usage: install-claude-hook.mjs --fragment <path> --dest <settings.json>');
  process.exit(1);
}

const args = process.argv.slice(2);
let fragmentPath = null;
let destPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--fragment' && args[i + 1]) { fragmentPath = resolve(args[++i]); }
  else if (args[i] === '--dest' && args[i + 1]) { destPath = resolve(args[++i]); }
}
if (!fragmentPath || !destPath) usage();

// Read the fragment — exit non-zero if unreadable so the caller can decide.
let fragment;
try {
  fragment = JSON.parse(readFileSync(fragmentPath, 'utf8'));
} catch (err) {
  console.error(`Cannot read fragment ${fragmentPath}: ${err.message}`);
  process.exit(1);
}

const fragmentHooks = fragment?.hooks?.UserPromptSubmit;
if (!Array.isArray(fragmentHooks) || fragmentHooks.length === 0) {
  console.error(`Fragment ${fragmentPath} has no hooks.UserPromptSubmit array`);
  process.exit(1);
}

// Read or initialise the existing settings file.
let settings = {};
if (existsSync(destPath)) {
  try {
    settings = JSON.parse(readFileSync(destPath, 'utf8'));
  } catch (err) {
    console.error(`Cannot parse ${destPath}: ${err.message}`);
    process.exit(1);
  }
}

if (!settings.hooks) settings.hooks = {};
if (!Array.isArray(settings.hooks.UserPromptSubmit)) {
  settings.hooks.UserPromptSubmit = [];
}

const existing = settings.hooks.UserPromptSubmit;

// Deduplicate by command string — if the exact command is already registered,
// skip it rather than duplicating.
let added = 0;
for (const entry of fragmentHooks) {
  const alreadyPresent = existing.some(
    (e) => e.command === entry.command && e.type === entry.type,
  );
  if (!alreadyPresent) {
    existing.push(entry);
    added++;
  }
}

if (added === 0) {
  console.log(`hook already present in ${destPath} — no change`);
  process.exit(0);
}

// Atomic write: write to a temp file alongside dest, then rename.
const dir = dirname(destPath);
mkdirSync(dir, { recursive: true });
const tmp = `${destPath}.gov-tmp-${process.pid}`;
try {
  writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  renameSync(tmp, destPath);
} catch (err) {
  try { unlinkSync(tmp); } catch { /* ignore */ }
  console.error(`Failed to write ${destPath}: ${err.message}`);
  process.exit(1);
}

console.log(`hook installed in ${destPath} (${added} entry added)`);
