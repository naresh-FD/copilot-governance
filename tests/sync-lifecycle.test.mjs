// Sync lifecycle tests: manifest planning, prune logic, and the full
// first-run → update → remove-skill cycle.
//
// All fixtures live in temp directories. No GitHub API calls are made.
//
// Run: node --test tests/sync-lifecycle.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  computeManifest,
  computePrune,
  parseManifest,
  serialiseManifest,
} from '../scripts/sync-manifest.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Create a temp directory tree for testing.
function fixture(spec) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-lifecycle-'));
  for (const [path, content] of Object.entries(spec)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content ?? '');
  }
  return dir;
}

// ---- computeManifest -------------------------------------------------------

test('manifest includes mainFile', () => {
  const dir = fixture({});
  try {
    const result = computeManifest({ mainFile: '.github/copilot-instructions.md', trees: [] });
    assert.ok(result.includes('.github/copilot-instructions.md'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('manifest includes all files from a source tree', () => {
  const dir = fixture({
    'src/a.txt': 'A',
    'src/sub/b.txt': 'B',
  });
  try {
    const result = computeManifest({
      mainFile: null,
      trees: [{ sourceDir: join(dir, 'src'), targetPrefix: '.github/src' }],
    });
    assert.ok(result.includes('.github/src/a.txt'));
    assert.ok(result.includes('.github/src/sub/b.txt'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('manifest includes extra files', () => {
  const dir = fixture({});
  try {
    const result = computeManifest({
      mainFile: null,
      trees: [],
      extraFiles: ['.github/skill-registry/approved-skills.json', '.github/skill-registry/skill-lock.json'],
    });
    assert.ok(result.includes('.github/skill-registry/approved-skills.json'));
    assert.ok(result.includes('.github/skill-registry/skill-lock.json'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('manifest is sorted', () => {
  const dir = fixture({ 'z.txt': '', 'a.txt': '', 'b.txt': '' });
  try {
    const result = computeManifest({
      mainFile: null,
      trees: [{ sourceDir: dir, targetPrefix: '.github/x' }],
    });
    const sorted = [...result].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    assert.deepEqual(result, sorted, 'manifest must be lexicographically sorted');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('manifest deduplicates entries', () => {
  const dir = fixture({});
  try {
    const result = computeManifest({
      mainFile: '.github/copilot-instructions.md',
      trees: [],
      extraFiles: ['.github/copilot-instructions.md', '.github/copilot-instructions.md'],
    });
    const count = result.filter((p) => p === '.github/copilot-instructions.md').length;
    assert.equal(count, 1, 'duplicate paths must be deduplicated');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('manifest is empty when no sources exist', () => {
  const result = computeManifest({ mainFile: null, trees: [], extraFiles: [] });
  assert.deepEqual(result, []);
});

test('manifest handles missing source directory gracefully', () => {
  const result = computeManifest({
    mainFile: null,
    trees: [{ sourceDir: '/nonexistent/path', targetPrefix: '.github/x' }],
  });
  assert.deepEqual(result, [], 'non-existent source dir must produce empty result, not throw');
});

// ---- computePrune ----------------------------------------------------------

test('prune identifies paths no longer governed', () => {
  const old = ['.github/copilot-instructions.md', '.github/skills/old-skill/SKILL.md'];
  const next = ['.github/copilot-instructions.md'];
  const toRemove = computePrune(next, old);
  assert.deepEqual(toRemove, ['.github/skills/old-skill/SKILL.md']);
});

test('prune returns empty when nothing was removed', () => {
  const paths = ['.github/copilot-instructions.md', '.github/prompt-core/rewrite.mjs'];
  assert.deepEqual(computePrune(paths, paths), []);
});

test('prune returns empty when old manifest is empty', () => {
  const next = ['.github/copilot-instructions.md'];
  assert.deepEqual(computePrune(next, []), []);
});

test('prune handles the case where all old paths are removed', () => {
  const old = ['.github/skills/a/SKILL.md', '.github/skills/b/SKILL.md'];
  const next = ['.github/copilot-instructions.md'];
  const toRemove = computePrune(next, old);
  assert.deepEqual(toRemove, old);
});

test('prune filters out blank lines from old manifest', () => {
  const old = ['.github/a.txt', '', '  ', '.github/b.txt'];
  const next = ['.github/a.txt'];
  const toRemove = computePrune(next, old);
  // The empty strings must not appear in the result.
  assert.ok(!toRemove.includes(''), 'blank lines must not be in prune output');
  assert.deepEqual(toRemove, ['.github/b.txt']);
});

// ---- parseManifest / serialiseManifest ------------------------------------

test('parseManifest round-trips with serialiseManifest', () => {
  const paths = ['.github/copilot-instructions.md', '.github/prompt-core/rewrite.mjs'];
  const serialised = serialiseManifest(paths);
  const parsed = parseManifest(serialised);
  assert.deepEqual(parsed, paths);
});

test('parseManifest strips blank lines', () => {
  const content = '.github/a.txt\n\n.github/b.txt\n';
  assert.deepEqual(parseManifest(content), ['.github/a.txt', '.github/b.txt']);
});

test('serialiseManifest ends with a newline', () => {
  const s = serialiseManifest(['.github/a.txt']);
  assert.ok(s.endsWith('\n'), 'serialised manifest must end with a trailing newline');
});

test('serialiseManifest on empty list produces empty string', () => {
  assert.equal(serialiseManifest([]), '');
});

// ---- Full sync lifecycle scenario ------------------------------------------

test('lifecycle: first-run then skill-removed produces correct prune set', () => {
  // First run: governance owns instructions + 2 skills.
  const skillDir = mkdtempSync(join(tmpdir(), 'sync-skills-'));
  try {
    mkdirSync(join(skillDir, 'skill-a'), { recursive: true });
    mkdirSync(join(skillDir, 'skill-b'), { recursive: true });
    writeFileSync(join(skillDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');
    writeFileSync(join(skillDir, 'skill-b', 'SKILL.md'), '---\nname: skill-b\n---\n');

    const run1 = computeManifest({
      mainFile: '.github/copilot-instructions.md',
      trees: [{ sourceDir: skillDir, targetPrefix: '.github/skill-registry/compact' }],
      extraFiles: ['.github/skill-registry/approved-skills.json', '.github/skill-registry/skill-lock.json'],
    });

    // Verify first-run manifest contains both skills.
    assert.ok(run1.includes('.github/skill-registry/compact/skill-a/SKILL.md'));
    assert.ok(run1.includes('.github/skill-registry/compact/skill-b/SKILL.md'));

    // Second run: skill-b is removed from the source.
    rmSync(join(skillDir, 'skill-b'), { recursive: true, force: true });

    const run2 = computeManifest({
      mainFile: '.github/copilot-instructions.md',
      trees: [{ sourceDir: skillDir, targetPrefix: '.github/skill-registry/compact' }],
      extraFiles: ['.github/skill-registry/approved-skills.json', '.github/skill-registry/skill-lock.json'],
    });

    // skill-b must not appear in run2.
    assert.ok(!run2.includes('.github/skill-registry/compact/skill-b/SKILL.md'));

    // prune must identify skill-b for removal.
    const toRemove = computePrune(run2, run1);
    assert.ok(toRemove.includes('.github/skill-registry/compact/skill-b/SKILL.md'),
      'removed skill must appear in prune set');
    // skill-a must NOT be in prune set.
    assert.ok(!toRemove.includes('.github/skill-registry/compact/skill-a/SKILL.md'),
      'active skill must not be pruned');
  } finally { rmSync(skillDir, { recursive: true, force: true }); }
});

test('lifecycle: .github/skills/ paths from legacy manifest are pruned in next run', () => {
  // Simulates upgrading a downstream repo that previously had .github/skills/
  // to the new .github/skill-registry/ layout.
  const legacyManifest = [
    '.github/copilot-instructions.md',
    '.github/skills/debugging-and-error-recovery/SKILL.md',
  ];
  const newManifest = [
    '.github/copilot-instructions.md',
    '.github/skill-registry/compact/debugging-and-error-recovery/SKILL.md',
    '.github/skill-registry/approved-skills.json',
    '.github/skill-registry/skill-lock.json',
  ];
  const toRemove = computePrune(newManifest, legacyManifest);
  assert.ok(toRemove.includes('.github/skills/debugging-and-error-recovery/SKILL.md'),
    'legacy .github/skills/ path must be pruned');
  assert.equal(toRemove.length, 1, 'only the legacy path should be pruned');
});
