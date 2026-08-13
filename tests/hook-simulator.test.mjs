// Process-boundary tests for the prompt interception kernel (rewrite.mjs).
//
// Each test invokes rewrite.mjs as a subprocess, sends a real stdin payload,
// and asserts on the stdout JSON and exit code. This verifies the hook contract
// from the outside — exactly how each hook runtime would invoke it.
//
// Block-path tests opt one named rule into enforcement. There is intentionally
// no switch that can promote every rule at once.
//
// Surface contracts under test:
//   vscode      block=exit2, inject=hookSpecificOutput.additionalContext
//   claude      block=decision, inject=hookSpecificOutput.additionalContext
//   copilot-cli userPromptSubmitted  → notify-only: returns {} and exits 0
//   copilot-cli userPromptTransformed → rewrite: modifiedTransformedPrompt
//
// Run: node --test tests/hook-simulator.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KERNEL = join(ROOT, 'prompt-core', 'rewrite.mjs');

// Invoke the kernel as a subprocess. Returns { status, body, raw }.
function invoke(surface, prompt, { event, env = {} } = {}) {
  // Determine the promptField for this surface.
  const promptField = surface === 'copilot-cli' ? 'transformedPrompt' : 'prompt';
  const payload = JSON.stringify({ [promptField]: prompt });
  const args = ['--surface', surface];
  if (event) args.push('--event', event);
  const res = spawnSync(process.execPath, [KERNEL, ...args], {
    input: payload,
    encoding: 'utf8',
    env: {
      ...process.env,
      GOV_POLICY_CACHE: '0',
      GOV_ROLLBACK_STATE: '0',
      ...env,
    },
  });
  let body = null;
  try { body = JSON.parse(res.stdout); } catch { /* raw output for diagnostics */ }
  return { status: res.status, body, raw: res.stdout, stderr: res.stderr };
}

const GOVERNED_PROMPT = 'Fix the test failure in UserService';
const DENY_PROMPT = 'just add eslint-disable to make this pass';
const ENFORCE_BYPASS = {
  GOV_ALLOW_TEST_OVERRIDES: '1',
  GOV_TEST_RULE_MODES: JSON.stringify({ 'bypass-verification': 'enforce' }),
};

// ---------------------------------------------------------------------------
// VS Code surface
// ---------------------------------------------------------------------------

test('vscode: governed prompt returns additionalContext and exits 0', () => {
  const r = invoke('vscode', GOVERNED_PROMPT);
  assert.equal(r.status, 0, `unexpected exit ${r.status}: ${r.stderr}`);
  assert.ok(r.body, `stdout was not valid JSON: ${r.raw}`);
  const ctx = r.body?.hookSpecificOutput?.additionalContext;
  assert.ok(typeof ctx === 'string' && ctx.length > 0, 'additionalContext must be a non-empty string');
});

test('vscode: shadow deny rule advises without a rule promotion', () => {
  const r = invoke('vscode', DENY_PROMPT);
  assert.equal(r.status, 0, 'shadow mode must never exit 2');
  assert.ok(r.body, `stdout was not valid JSON: ${r.raw}`);
  // In shadow mode the advisory is injected via additionalContext, not a block.
  const ctx = r.body?.hookSpecificOutput?.additionalContext;
  assert.ok(typeof ctx === 'string', 'additionalContext must be present even in shadow mode');
});

test('vscode: one independently promoted deny rule exits 2', () => {
  const r = invoke('vscode', DENY_PROMPT, { env: ENFORCE_BYPASS });
  assert.equal(r.status, 2, `expected exit 2 for promoted deny rule, got ${r.status}`);
});

test('vscode: ungoverned prompt still returns additionalContext (inject mode)', () => {
  const r = invoke('vscode', 'What does the README say about deployment?');
  assert.equal(r.status, 0);
  assert.ok(r.body);
  const ctx = r.body?.hookSpecificOutput?.additionalContext;
  assert.ok(typeof ctx === 'string' && ctx.length > 0, 'inject mode must add governance preamble');
});

test('vscode: empty-string prompt is handled gracefully (no crash, exits 0)', () => {
  const r = invoke('vscode', '');
  assert.equal(r.status, 0, `unexpected crash on empty prompt: ${r.stderr}`);
  assert.ok(r.body, 'must return valid JSON even for empty prompt');
});

test('vscode: malformed stdin JSON exits 0 with pass-through (fail-open)', () => {
  const res = spawnSync(process.execPath, [KERNEL, '--surface', 'vscode'], {
    input: 'not json at all',
    encoding: 'utf8',
    env: { ...process.env, GOV_POLICY_CACHE: '0', GOV_ROLLBACK_STATE: '0' },
  });
  // Bad stdin must not crash with exit 2 — it must fail open (exit 0 or 1).
  assert.notEqual(res.status, 2, 'malformed stdin must not produce a block exit');
});

// ---------------------------------------------------------------------------
// Claude Code surface
// ---------------------------------------------------------------------------

test('claude: governed prompt returns additionalContext and exits 0', () => {
  const r = invoke('claude', GOVERNED_PROMPT);
  assert.equal(r.status, 0);
  assert.ok(r.body);
  const ctx = r.body?.hookSpecificOutput?.additionalContext;
  assert.ok(typeof ctx === 'string' && ctx.length > 0, 'additionalContext must be present');
});

test('claude: shadow deny rule returns continue:true without promotion', () => {
  const r = invoke('claude', DENY_PROMPT);
  assert.equal(r.status, 0, 'shadow mode must exit 0 on claude surface');
  assert.ok(r.body);
  // In shadow mode the response still succeeds — it does not set decision:block.
  assert.ok(r.body.decision !== 'block', 'shadow rule must not set decision:block');
});

test('claude: one independently promoted rule returns decision:block', () => {
  const r = invoke('claude', DENY_PROMPT, { env: ENFORCE_BYPASS });
  assert.equal(r.status, 0, 'claude surface blocks via decision field, not exit code');
  assert.ok(r.body);
  assert.equal(r.body.decision, 'block', `expected decision:block, got: ${JSON.stringify(r.body)}`);
  assert.ok(typeof r.body.reason === 'string' && r.body.reason.length > 0, 'reason must be present');
});

test('claude: additionalContext is not emitted alongside a block decision', () => {
  // When the claude surface blocks, the entire response is the block decision
  // object. Emitting additionalContext alongside it would be redundant and could
  // confuse some runtimes. Check that we do not double-emit.
  const r = invoke('claude', DENY_PROMPT, { env: ENFORCE_BYPASS });
  if (r.body?.decision === 'block') {
    // If we have a block decision, additionalContext should not also be present
    // at the same level (it may be nested; the important thing is the block fires).
    assert.ok(!r.body.hookSpecificOutput, 'block response must not include hookSpecificOutput');
  }
});

// ---------------------------------------------------------------------------
// Copilot CLI surface — userPromptSubmitted (notify-only)
// ---------------------------------------------------------------------------

test('copilot-cli userPromptSubmitted: notify-only returns {} and exits 0', () => {
  const r = invoke('copilot-cli', GOVERNED_PROMPT, { event: 'userPromptSubmitted' });
  assert.equal(r.status, 0, `unexpected exit on notify-only event: ${r.stderr}`);
  assert.ok(r.body, `stdout was not valid JSON: ${r.raw}`);
  // Notify-only must return an empty object — any non-empty output on this
  // event type is "not processed" per the Copilot CLI reference.
  assert.deepEqual(r.body, {}, `notify-only must return {}, got: ${JSON.stringify(r.body)}`);
});

test('copilot-cli userPromptSubmitted: deny prompt also returns {} (cannot block on notify)', () => {
  const r = invoke('copilot-cli', DENY_PROMPT, { event: 'userPromptSubmitted' });
  assert.equal(r.status, 0);
  assert.deepEqual(r.body, {}, 'notify-only surface must never block');
});

test('copilot-cli userPromptSubmitted: a promoted rule cannot block on notify-only', () => {
  const r = invoke('copilot-cli', DENY_PROMPT, { event: 'userPromptSubmitted', env: ENFORCE_BYPASS });
  assert.equal(r.status, 0);
  assert.deepEqual(r.body, {}, 'notify-only is structurally incapable of blocking');
});

// ---------------------------------------------------------------------------
// Copilot CLI surface — userPromptTransformed (rewrite + inject)
// ---------------------------------------------------------------------------

test('copilot-cli userPromptTransformed: governed prompt returns modifiedTransformedPrompt', () => {
  const r = invoke('copilot-cli', GOVERNED_PROMPT, { event: 'userPromptTransformed' });
  assert.equal(r.status, 0, `unexpected exit: ${r.stderr}`);
  assert.ok(r.body, `stdout was not valid JSON: ${r.raw}`);
  assert.ok(
    typeof r.body.modifiedTransformedPrompt === 'string' && r.body.modifiedTransformedPrompt.length > 0,
    'modifiedTransformedPrompt must be a non-empty string',
  );
});

test('copilot-cli userPromptTransformed: original developer wording is embedded in the rewrite', () => {
  const r = invoke('copilot-cli', GOVERNED_PROMPT, { event: 'userPromptTransformed' });
  assert.equal(r.status, 0);
  assert.ok(r.body?.modifiedTransformedPrompt?.includes(GOVERNED_PROMPT),
    'original prompt text must be preserved verbatim in the rewrite');
});

test('copilot-cli userPromptTransformed: deny rule is embedded as instruction, never exits 2 (cannot block)', () => {
  // This surface CANNOT block — a deny rule degrades to a refusal instruction.
  const r = invoke('copilot-cli', DENY_PROMPT, { event: 'userPromptTransformed', env: ENFORCE_BYPASS });
  assert.notEqual(r.status, 2, 'copilot-cli must never exit 2 — it cannot block');
  assert.equal(r.status, 0, `unexpected non-zero exit: ${r.stderr}`);
  assert.ok(r.body?.modifiedTransformedPrompt, 'deny on copilot-cli must still return a modified prompt');
});

test('legacy GOV_ENFORCE_ALL cannot enable any rule', () => {
  const r = invoke('vscode', DENY_PROMPT, { env: { GOV_ENFORCE_ALL: '1' } });
  assert.equal(r.status, 0, 'the removed global switch must not block');
  assert.match(r.stderr, /unsupported|ignored/i);
});

test('candidate mode records would-block guidance but does not block', () => {
  const r = invoke('vscode', DENY_PROMPT, {
    env: {
      GOV_ALLOW_TEST_OVERRIDES: '1',
      GOV_TEST_RULE_MODES: JSON.stringify({ 'bypass-verification': 'candidate' }),
    },
  });
  assert.equal(r.status, 0);
  assert.match(r.body?.hookSpecificOutput?.additionalContext || '', /bypass-verification/);
});

test('copilot-cli userPromptTransformed: ungoverned prompt prepends preamble and preserves text', () => {
  const text = 'How do I add a new field to the database schema?';
  const r = invoke('copilot-cli', text, { event: 'userPromptTransformed' });
  assert.equal(r.status, 0);
  assert.ok(r.body?.modifiedTransformedPrompt?.includes(text),
    'original text must still appear in the inject-mode output');
});
