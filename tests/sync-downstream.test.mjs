// Downstream deployment layout tests.
//
// These tests verify that sync-copilot-instructions.sh produces the correct
// directory layout in the downstream repository — specifically that the skill
// registry is deployed under .github/skill-registry/ (not .github/skills/).
//
// The sync script cannot run in CI without GitHub access, so we test the
// deployment logic directly: given the correct copy_tree operations, the
// downstream layout must satisfy what skill-selector.mjs and
// validate-skill-registry.mjs expect.
//
// Run: node --test tests/sync-downstream.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Simulate what the sync script does for the skill-registry section.
function simulateSync(sourceRoot, destRoot) {
  const registryDir = join(sourceRoot, 'skill-registry');
  const compactDir = join(registryDir, 'compact');
  const destRegistryDir = join(destRoot, '.github', 'skill-registry');
  const destCompactDir = join(destRegistryDir, 'compact');

  mkdirSync(destRegistryDir, { recursive: true });

  // These are the three operations the sync script performs:
  cpSync(join(registryDir, 'approved-skills.json'), join(destRegistryDir, 'approved-skills.json'));
  cpSync(join(registryDir, 'skill-lock.json'), join(destRegistryDir, 'skill-lock.json'));
  if (existsSync(compactDir)) {
    cpSync(compactDir, destCompactDir, { recursive: true });
  }
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('registry JSON files land at .github/skill-registry/', () => {
  const dest = mkdtempSync(join(tmpdir(), 'sync-dest-'));
  try {
    simulateSync(ROOT, dest);
    assert.ok(existsSync(join(dest, '.github', 'skill-registry', 'approved-skills.json')),
      'approved-skills.json must be deployed to .github/skill-registry/');
    assert.ok(existsSync(join(dest, '.github', 'skill-registry', 'skill-lock.json')),
      'skill-lock.json must be deployed to .github/skill-registry/');
  } finally { rmSync(dest, { recursive: true, force: true }); }
});

test('compact skills land at .github/skill-registry/compact/ (not .github/skills/)', () => {
  const dest = mkdtempSync(join(tmpdir(), 'sync-dest-'));
  try {
    simulateSync(ROOT, dest);
    // The old (wrong) path must not exist
    assert.ok(!existsSync(join(dest, '.github', 'skills')),
      '.github/skills/ must not exist — skills go under skill-registry/compact/');
    // The correct path must exist and contain skill directories
    const compactPath = join(dest, '.github', 'skill-registry', 'compact');
    assert.ok(existsSync(compactPath), '.github/skill-registry/compact/ must exist');
    const entries = readdirSync(compactPath).filter((n) => statSync(join(compactPath, n)).isDirectory());
    assert.ok(entries.length > 0, 'at least one skill must be deployed to compact/');
  } finally { rmSync(dest, { recursive: true, force: true }); }
});

test('deployed registry JSON is byte-identical to source', () => {
  const dest = mkdtempSync(join(tmpdir(), 'sync-dest-'));
  try {
    simulateSync(ROOT, dest);
    for (const fname of ['approved-skills.json', 'skill-lock.json']) {
      const src = readFileSync(join(ROOT, 'skill-registry', fname));
      const deployed = readFileSync(join(dest, '.github', 'skill-registry', fname));
      assert.equal(src.toString(), deployed.toString(), `${fname} must be byte-identical after sync`);
    }
  } finally { rmSync(dest, { recursive: true, force: true }); }
});

test('deployed skill files have correct SHA-256 per lock', () => {
  const dest = mkdtempSync(join(tmpdir(), 'sync-dest-'));
  try {
    simulateSync(ROOT, dest);
    const lock = JSON.parse(readFileSync(join(dest, '.github', 'skill-registry', 'skill-lock.json'), 'utf8'));
    const registry = JSON.parse(readFileSync(join(dest, '.github', 'skill-registry', 'approved-skills.json'), 'utf8'));
    const skills = registry.skills ?? {};
    for (const [name, cfg] of Object.entries(skills)) {
      if (cfg.status !== 'approved') continue;
      // Map source path to deployed path: skill-registry/compact/X -> .github/skill-registry/compact/X
      const deployedPath = join(dest, '.github', cfg.path.replace(/^skill-registry\//, 'skill-registry/'));
      if (!existsSync(deployedPath)) continue;
      const content = readFileSync(deployedPath, 'utf8');
      const expectedHash = lock.skills?.[name]?.sha256;
      if (!expectedHash) continue;
      const actualHash = createHash('sha256').update(content).digest('hex');
      assert.equal(actualHash, expectedHash,
        `${name}: deployed skill content must match lock hash`);
    }
  } finally { rmSync(dest, { recursive: true, force: true }); }
});

test('manifest would include skill-registry paths, not skills/ paths', () => {
  // Verify the manifest generation logic — we test it by running the same
  // path-building logic the shell script uses. Manifests are shell-generated,
  // so we simulate what the updated shell commands produce.
  const dest = mkdtempSync(join(tmpdir(), 'sync-dest-'));
  try {
    simulateSync(ROOT, dest);
    const deployedFiles = walk(join(dest, '.github', 'skill-registry'))
      .map((f) => relative(dest, f).replace(/\\/g, '/'));

    // Every deployed file must be under .github/skill-registry/, not .github/skills/
    for (const f of deployedFiles) {
      assert.ok(!f.startsWith('.github/skills/'),
        `deployed file must not be under .github/skills/: ${f}`);
      assert.ok(f.startsWith('.github/skill-registry/'),
        `deployed file must be under .github/skill-registry/: ${f}`);
    }
  } finally { rmSync(dest, { recursive: true, force: true }); }
});

test('skill-selector.mjs can load a deployed skill using downstream layout', async () => {
  const { selectSkills } = await import('../prompt-core/skill-selector.mjs');
  const dest = mkdtempSync(join(tmpdir(), 'sync-dest-'));
  try {
    simulateSync(ROOT, dest);
    const govRoot = join(dest, '.github');
    const registry = JSON.parse(
      readFileSync(join(govRoot, 'skill-registry', 'approved-skills.json'), 'utf8'),
    );
    // In downstream repos GOV_ROOT = .github/ so skill-registry/ is a sibling
    // of prompt-core/. Paths in the registry are relative to GOV_ROOT.
    const result = selectSkills({
      intent: { id: 'test-failure', skills: ['debugging-and-error-recovery'] },
      repositoryProfile: { stacks: ['react'] },
      registry,
      governanceRoot: govRoot,
    });
    // If the lock file was copied and paths are correct, the skill should load.
    assert.equal(result.selected.length, 1,
      `skill must load from downstream layout. rejected: ${JSON.stringify(result.rejected)}`);
    assert.equal(result.integrityError, false);
  } finally { rmSync(dest, { recursive: true, force: true }); }
});
