// Tests for scripts/install-claude-hook.mjs
//
// All fixtures are in temp directories. No real user home directory or
// external service is touched.
//
// Run: node --test tests/claude-hook.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INSTALLER = join(ROOT, 'scripts', 'install-claude-hook.mjs');
const FRAGMENT = join(ROOT, 'hooks', 'claude-code-settings.fragment.json');

function run(fragment, dest) {
  const res = spawnSync(process.execPath, [INSTALLER, '--fragment', fragment, '--dest', dest], { encoding: 'utf8' });
  return { ok: res.status === 0, stdout: res.stdout, stderr: res.stderr };
}

function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

test('installs hook into a new (non-existent) settings.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const dest = join(dir, '.claude', 'settings.json');
    const r = run(FRAGMENT, dest);
    assert.ok(r.ok, `installer failed:\n${r.stderr}`);
    const settings = readJson(dest);
    assert.ok(Array.isArray(settings.hooks?.UserPromptSubmit), 'UserPromptSubmit must be an array');
    assert.equal(settings.hooks.UserPromptSubmit.length, 1);
    assert.match(settings.hooks.UserPromptSubmit[0].command, /rewrite\.mjs.*--surface claude/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('installs hook into an existing settings.json, preserving other keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const clauDir = join(dir, '.claude');
    mkdirSync(clauDir);
    const dest = join(clauDir, 'settings.json');
    const existing = { model: 'claude-opus-5', permissions: { allow: ['Bash'] }, env: { FOO: 'bar' } };
    writeFileSync(dest, JSON.stringify(existing));
    const r = run(FRAGMENT, dest);
    assert.ok(r.ok, `installer failed:\n${r.stderr}`);
    const settings = readJson(dest);
    assert.equal(settings.model, 'claude-opus-5', 'existing model must be preserved');
    assert.deepEqual(settings.permissions, { allow: ['Bash'] }, 'existing permissions must be preserved');
    assert.deepEqual(settings.env, { FOO: 'bar' }, 'existing env must be preserved');
    assert.ok(Array.isArray(settings.hooks?.UserPromptSubmit));
    assert.equal(settings.hooks.UserPromptSubmit.length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('is idempotent — running twice does not duplicate the hook', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const dest = join(dir, 'settings.json');
    run(FRAGMENT, dest);
    const r2 = run(FRAGMENT, dest);
    assert.ok(r2.ok, `second run failed:\n${r2.stderr}`);
    assert.match(r2.stdout, /already present|no change/i, 'second run should report no change');
    const settings = readJson(dest);
    assert.equal(settings.hooks.UserPromptSubmit.length, 1, 'hook must not be duplicated');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('merges with existing UserPromptSubmit entries from other tools', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const dest = join(dir, 'settings.json');
    const existing = {
      hooks: {
        UserPromptSubmit: [{ type: 'command', command: 'node other-hook.mjs', timeout: 5 }],
      },
    };
    writeFileSync(dest, JSON.stringify(existing));
    const r = run(FRAGMENT, dest);
    assert.ok(r.ok, `installer failed:\n${r.stderr}`);
    const settings = readJson(dest);
    assert.equal(settings.hooks.UserPromptSubmit.length, 2, 'both hooks must be present');
    const commands = settings.hooks.UserPromptSubmit.map((e) => e.command);
    assert.ok(commands.includes('node other-hook.mjs'), 'original hook must be kept');
    assert.ok(commands.some((c) => /rewrite\.mjs/.test(c)), 'governance hook must be added');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('write is atomic — no temp file remains after a successful install', async () => {
  // We verify the temp-file-then-rename pattern is used correctly by confirming
  // that no .gov-tmp-* file is left behind after a successful run, and that the
  // destination is readable valid JSON.
  const { readdirSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const dest = join(dir, 'settings.json');
    const r = run(FRAGMENT, dest);
    assert.ok(r.ok, `installer failed:\n${r.stderr}`);
    // No temp file should remain after a successful write.
    const files = readdirSync(dir).filter((n) => n.includes('gov-tmp'));
    assert.equal(files.length, 0, 'no temp file should remain after successful write');
    // The dest must parse as valid JSON.
    const settings = readJson(dest);
    assert.ok(settings.hooks?.UserPromptSubmit);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('exits non-zero with missing --fragment arg', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const dest = join(dir, 'settings.json');
    const res = spawnSync(process.execPath, [INSTALLER, '--dest', dest], { encoding: 'utf8' });
    assert.notEqual(res.status, 0, 'must exit non-zero when --fragment is missing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('exits non-zero with missing --dest arg', () => {
  const res = spawnSync(process.execPath, [INSTALLER, '--fragment', FRAGMENT], { encoding: 'utf8' });
  assert.notEqual(res.status, 0, 'must exit non-zero when --dest is missing');
});

test('exits non-zero when fragment file does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const dest = join(dir, 'settings.json');
    const res = spawnSync(process.execPath, [INSTALLER, '--fragment', join(dir, 'nonexistent.json'), '--dest', dest], { encoding: 'utf8' });
    assert.notEqual(res.status, 0, 'must exit non-zero when fragment is missing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('exits non-zero when existing settings.json is invalid JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-hook-'));
  try {
    const clauDir = join(dir, '.claude');
    mkdirSync(clauDir);
    const dest = join(clauDir, 'settings.json');
    writeFileSync(dest, '{ bad json');
    const r = run(FRAGMENT, dest);
    assert.ok(!r.ok, 'must exit non-zero when existing settings.json is malformed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
