#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, basename, resolve, relative, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REGISTRY_DIR = join(ROOT, 'skill-registry');
const REGISTRY = join(REGISTRY_DIR, 'approved-skills.json');
const LOCK = join(REGISTRY_DIR, 'skill-lock.json');
const COMPACT_DIR = join(REGISTRY_DIR, 'compact');
const FORBIDDEN = [/curl\s+/i, /wget\s+/i, /bash\s+-c/i, /rm\s+-rf\s+\//i, /GOV_TELEMETRY_RAW/i];
const problems = [];

const fail = (msg) => problems.push(msg);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const isInside = (parent, child) => {
  const r = relative(parent, child);
  return r !== '' && !r.startsWith('..') && !r.includes(':');
};

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!kv) return null;
    data[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return data;
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let registry, lock;
try { registry = readJson(REGISTRY); } catch (e) { fail(`approved-skills.json unreadable: ${e.message}`); }
try { lock = readJson(LOCK); } catch (e) { fail(`skill-lock.json unreadable: ${e.message}`); }

if (registry && lock) {
  const root = resolve(ROOT, 'skill-registry');

  // Resolve real root path once (handles symlinks on the root itself)
  let realRoot;
  try { realRoot = realpathSync(root); } catch { realRoot = root; }

  const skills = registry.skills ?? {};
  const approvedSkills = Object.entries(skills).filter(([, cfg]) => cfg.status === 'approved');

  // --- Structural checks on the registry ------------------------------------

  // Duplicate skill IDs: JSON object keys cannot be duplicate by spec, but we
  // validate explicitly to catch tooling that merges objects incorrectly.
  const registryIds = new Set();
  for (const id of Object.keys(skills)) {
    if (registryIds.has(id)) fail(`duplicate skill ID in registry: ${id}`);
    else registryIds.add(id);
  }

  // Duplicate canonical paths
  const seenPaths = new Map();
  for (const [name, cfg] of Object.entries(skills)) {
    if (!cfg.path) continue;
    if (seenPaths.has(cfg.path)) fail(`duplicate path in registry: "${cfg.path}" shared by "${seenPaths.get(cfg.path)}" and "${name}"`);
    else seenPaths.set(cfg.path, name);
  }

  // --- Per-skill validation -------------------------------------------------

  for (const [name, cfg] of approvedSkills) {
    const rawPath = cfg.path ?? '';

    // Reject absolute paths
    if (isAbsolute(rawPath)) {
      fail(`${name}: path must be relative, got absolute path: ${rawPath}`);
      continue;
    }

    // Reject explicit parent traversal (double-dot segments)
    if (rawPath.split(/[/\\]/).some((seg) => seg === '..')) {
      fail(`${name}: path contains ".." traversal: ${rawPath}`);
      continue;
    }

    const p = resolve(ROOT, rawPath);

    // Lexical boundary check
    if (!isInside(root, p)) { fail(`${name}: path leaves skill-registry`); continue; }

    if (!existsSync(p)) { fail(`${name}: SKILL.md missing at ${p}`); continue; }

    // Symlink escape detection: resolve real path and re-check boundary
    let realPath;
    try { realPath = realpathSync(p); } catch (e) { fail(`${name}: cannot resolve real path: ${e.message}`); continue; }
    if (!isInside(realRoot, realPath)) {
      fail(`${name}: symlink escapes skill-registry boundary (resolved to ${realPath})`);
      continue;
    }

    if (basename(dirname(p)) !== name) fail(`${name}: directory name mismatch (expected "${name}")`);

    const text = readFileSync(p, 'utf8');
    const fm = frontmatter(text);
    if (!fm) fail(`${name}: invalid YAML frontmatter`);
    else if (fm.name !== name) fail(`${name}: frontmatter name mismatch (got "${fm.name}")`);

    if (text.length > (cfg.maxChars ?? registry.defaultSkillBudgetChars ?? 7000)) fail(`${name}: exceeds character budget`);

    // Hash verification
    const expected = lock.skills?.[name]?.sha256;
    const actual = createHash('sha256').update(text).digest('hex');
    if (!expected) fail(`${name}: missing lock entry (no sha256 in skill-lock.json)`);
    else if (actual !== expected) fail(`${name}: hash mismatch (file was modified after lock was generated)`);

    for (const pattern of FORBIDDEN) if (pattern.test(text)) fail(`${name}: forbidden pattern ${pattern}`);
    if (!/source:\s*copilot-governance/i.test(text)) fail(`${name}: provenance missing (source: copilot-governance)`);

    for (const f of walk(dirname(p))) {
      if (basename(f) !== 'SKILL.md') fail(`${name}: unapproved extra file ${relative(ROOT, f)}`);
    }

    for (const ref of text.matchAll(/\]\((?!https?:)([^)]+)\)/g)) {
      const target = resolve(dirname(p), ref[1]);
      if (!isInside(dirname(p), target) && target !== dirname(p)) fail(`${name}: reference leaves skill directory: ${ref[1]}`);
    }
  }

  // --- Lock-file parity checks ----------------------------------------------
  const approvedNames = new Set(approvedSkills.map(([n]) => n));
  const lockNames = new Set(Object.keys(lock.skills ?? {}));

  // Missing lock entries
  for (const name of approvedNames) {
    if (!lockNames.has(name)) fail(`${name}: approved skill has no lock entry in skill-lock.json`);
  }

  // Extra lock entries (lock has an entry for a skill not in the registry)
  for (const name of lockNames) {
    if (!approvedNames.has(name)) fail(`extra lock entry for unknown skill: "${name}"`);
  }

  // Duplicate lock entries: JSON object keys cannot be duplicate by spec, but
  // detect duplicate sha256 hashes (two skills sharing the same hash is a
  // registry quality concern).
  const lockHashes = new Map();
  for (const [name, entry] of Object.entries(lock.skills ?? {})) {
    const h = entry?.sha256;
    if (!h) { fail(`lock entry for "${name}" is missing sha256`); continue; }
    if (lockHashes.has(h)) fail(`duplicate sha256 in lock: "${name}" and "${lockHashes.get(h)}" share the same hash`);
    else lockHashes.set(h, name);
  }

  // --- Unregistered skill detection ----------------------------------------
  // Any directory inside skill-registry/compact/ that is not in the registry
  // is an unregistered skill — a governance gap.
  if (existsSync(COMPACT_DIR)) {
    for (const entry of readdirSync(COMPACT_DIR)) {
      const full = join(COMPACT_DIR, entry);
      if (!statSync(full).isDirectory()) continue;
      if (!registryIds.has(entry)) {
        fail(`unregistered skill directory in compact/: "${entry}" — add it to approved-skills.json or remove it`);
      }
    }
  }
}

if (problems.length) {
  console.error(`skill registry validation failed: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(`skill registry validation OK — ${Object.keys(registry.skills ?? {}).length} approved skills`);
