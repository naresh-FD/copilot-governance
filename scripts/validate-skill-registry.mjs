#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, basename, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REGISTRY = join(ROOT, 'skill-registry', 'approved-skills.json');
const LOCK = join(ROOT, 'skill-registry', 'skill-lock.json');
const FORBIDDEN = [/curl\s+/i, /wget\s+/i, /bash\s+-c/i, /rm\s+-rf\s+\//i, /GOV_TELEMETRY_RAW/i];
const problems = [];
const isInside = (parent, child) => { const r = relative(parent, child); return r !== '' && !r.startsWith('..') && !r.includes(':'); };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
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
function walk(dir) { return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); }

let registry, lock;
try { registry = readJson(REGISTRY); } catch (e) { problems.push(`approved-skills.json unreadable: ${e.message}`); }
try { lock = readJson(LOCK); } catch (e) { problems.push(`skill-lock.json unreadable: ${e.message}`); }
if (registry && lock) {
  const root = resolve(ROOT, 'skill-registry');
  for (const [name, cfg] of Object.entries(registry.skills ?? {})) {
    if (cfg.status !== 'approved') continue;
    const p = resolve(ROOT, cfg.path ?? '');
    if (!isInside(root, p)) { problems.push(`${name}: path leaves skill-registry`); continue; }
    if (!existsSync(p)) { problems.push(`${name}: SKILL.md missing`); continue; }
    if (basename(dirname(p)) !== name) problems.push(`${name}: directory name mismatch`);
    const text = readFileSync(p, 'utf8');
    const fm = frontmatter(text);
    if (!fm) problems.push(`${name}: invalid YAML frontmatter`);
    else if (fm.name !== name) problems.push(`${name}: frontmatter name mismatch`);
    if (text.length > (cfg.maxChars ?? registry.defaultSkillBudgetChars ?? 7000)) problems.push(`${name}: exceeds character budget`);
    const expected = lock.skills?.[name]?.sha256;
    const actual = createHash('sha256').update(text).digest('hex');
    if (!expected) problems.push(`${name}: missing lock hash`);
    else if (actual !== expected) problems.push(`${name}: hash mismatch`);
    for (const pattern of FORBIDDEN) if (pattern.test(text)) problems.push(`${name}: forbidden pattern ${pattern}`);
    if (!/source:\s*copilot-governance/i.test(text)) problems.push(`${name}: provenance missing`);
    for (const f of walk(dirname(p))) {
      if (basename(f) !== 'SKILL.md') problems.push(`${name}: unapproved extra file ${relative(ROOT, f)}`);
    }
    for (const ref of text.matchAll(/\]\((?!https?:)([^)]+)\)/g)) {
      const target = resolve(dirname(p), ref[1]);
      if (!isInside(dirname(p), target) && target !== dirname(p)) problems.push(`${name}: reference leaves skill directory: ${ref[1]}`);
    }
  }
}
if (problems.length) { console.error(`skill registry validation failed: ${problems.length} problem(s)`); for (const p of problems) console.error(`- ${p}`); process.exit(1); }
console.log(`skill registry validation OK — ${Object.keys(registry.skills).length} approved skills`);
