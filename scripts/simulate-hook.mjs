#!/usr/bin/env node
//
// Hook simulator for the prompt interception kernel.
//
// Replays a realistic hook payload against the engine exactly as a hook runtime
// would — spawning it as a child process, writing JSON to stdin, reading stdout,
// stderr and the exit code — so interception can be verified without a live
// VS Code, Copilot CLI or Claude Code session.
//
// This is the difference between testing the engine and testing the hook. The
// unit tests call the engine directly; this reproduces the process boundary the
// engine actually sits behind, which is where the schema mismatches that make a
// hook silently fail open show up.
//
// Usage:
//   node scripts/simulate-hook.mjs --prompt "<text>"                 all surfaces
//   node scripts/simulate-hook.mjs --surface claude --prompt "<text>"
//   node scripts/simulate-hook.mjs --surface copilot-cli --event userPromptTransformed --prompt "..."
//   node scripts/simulate-hook.mjs --prompt "..." --rule-mode bypass-verification=enforce
//   node scripts/simulate-hook.mjs --prompt "..." --raw               print full payload and response
//
// Telemetry is disabled by default so simulation never pollutes real shadow-mode
// evidence. Pass --telemetry to write records (to GOV_TELEMETRY_DIR if set).
//
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENGINE = join(ROOT, 'prompt-core', 'rewrite.mjs');
const SURFACES = JSON.parse(readFileSync(join(ROOT, 'prompt-core', 'surfaces.json'), 'utf8'));

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] ?? null;
};
const has = (name) => argv.includes(name);

const prompt = flag('--prompt');
if (!prompt) {
  process.stderr.write(
    'simulate-hook: --prompt is required.\n' +
      'Example: node scripts/simulate-hook.mjs --prompt "fix the SQL injection in the account lookup"\n'
  );
  process.exit(1);
}

const only = flag('--surface');
const onlyEvent = flag('--event');
const ruleModeSpec = flag('--rule-mode');
const raw = has('--raw');

let ruleMode = null;
if (ruleModeSpec) {
  const separator = ruleModeSpec.indexOf('=');
  const id = separator > 0 ? ruleModeSpec.slice(0, separator) : '';
  const mode = separator > 0 ? ruleModeSpec.slice(separator + 1) : '';
  if (!id || !['off', 'shadow', 'candidate', 'soft-block', 'enforce'].includes(mode)) {
    process.stderr.write(
      'simulate-hook: --rule-mode must be <rule-id>=off|shadow|candidate|soft-block|enforce\n',
    );
    process.exit(1);
  }
  ruleMode = { id, mode };
}

// Builds the payload each runtime actually sends. Field names differ per
// surface — camelCase vs snake_case, prompt vs transformedPrompt — and getting
// them wrong is exactly the failure this tool exists to catch.
function payloadFor(surfaceId, event) {
  const common = { cwd: ROOT, timestamp: new Date().toISOString() };
  if (surfaceId === 'copilot-cli') {
    const p = {
      sessionId: 'simulate-cli',
      hook_event_name: event,
      cwd: ROOT,
      timestamp: Date.now(),
      prompt,
    };
    // userPromptTransformed additionally carries the runtime-transformed text,
    // which is the field the engine governs on this surface.
    if (event === 'userPromptTransformed') p.transformedPrompt = prompt;
    return p;
  }
  return { ...common, hook_event_name: event, session_id: `simulate-${surfaceId}`, prompt };
}

function describe(surfaceId, surface, event, res) {
  const notify = (surface.notifyOnly || []).includes(event);
  let stdout;
  try {
    stdout = res.stdout.trim() ? JSON.parse(res.stdout) : {};
  } catch {
    return `  MALFORMED stdout (not JSON): ${res.stdout.slice(0, 200)}`;
  }

  const lines = [];
  const status = res.status ?? 0;

  if (status === 2) {
    lines.push('  BLOCKED via exit code 2 (the documented block on this surface)');
    lines.push(`  reason: ${res.stderr.trim().slice(0, 160)}`);
    return lines.join('\n');
  }
  if (stdout.decision === 'block') {
    lines.push('  BLOCKED via top-level decision field');
    lines.push(`  reason: ${String(stdout.reason).slice(0, 160)}`);
    return lines.join('\n');
  }
  if (notify) {
    lines.push('  notification-only event — telemetry recorded, nothing modified');
    lines.push(`  response: ${JSON.stringify(stdout)}`);
    return lines.join('\n');
  }

  // Locate the governance block wherever this surface puts it.
  const body =
    stdout.modifiedTransformedPrompt ??
    stdout.hookSpecificOutput?.additionalContext ??
    stdout.hookSpecificOutput?.modifiedPrompt ??
    null;

  if (!body) {
    lines.push('  NOT GOVERNED — no governance block in the response.');
    lines.push(`  response keys: ${JSON.stringify(Object.keys(stdout))}`);
    return lines.join('\n');
  }

  const header = body.match(/mode=(\S+) intent=(\S+) risk=(\S+)/);
  const field = stdout.modifiedTransformedPrompt
    ? 'modifiedTransformedPrompt'
    : stdout.hookSpecificOutput?.additionalContext
      ? 'hookSpecificOutput.additionalContext'
      : 'hookSpecificOutput.modifiedPrompt';

  lines.push(`  strategy: ${header ? header[1] : '?'}   intent: ${header ? header[2] : '?'}   risk: ${header ? header[3] : '?'}`);
  lines.push(`  delivered via: ${field}`);
  lines.push(
    `  replaces the prompt: ${
      !surface.rewriteField
        ? 'no — injected beside the untouched prompt'
        : surface.rewriteVerified
          ? 'yes'
          : 'UNVERIFIED — the field is emitted opportunistically; governance relies on injection'
    }`
  );

  // The guarantee that matters: the developer's words must still be there.
  // Where the block may replace the prompt, they have to be inside it.
  const verbatim = body.includes(prompt);
  if (surface.rewriteVerified) {
    lines.push(`  original text preserved verbatim in the block: ${verbatim ? 'YES' : 'NO — BUG'}`);
  } else {
    lines.push('  original text preserved: yes (prompt is untouched by this surface)');
  }
  if (body.includes('## Refuse this request')) {
    lines.push('  NOTE: an enforcing rule could not be blocked here; degraded to an in-prompt refusal');
  }
  if (stdout.systemMessage) lines.push(`  systemMessage: ${stdout.systemMessage}`);
  lines.push(`  governance block: ${body.length} chars (raw prompt: ${prompt.length})`);
  return lines.join('\n');
}

const env = { ...process.env };
if (!has('--telemetry')) env.GOV_TELEMETRY = '0';
env.GOV_POLICY_CACHE = '0';
env.GOV_ROLLBACK_STATE = '0';
if (ruleMode) {
  env.GOV_ALLOW_TEST_OVERRIDES = '1';
  env.GOV_TEST_RULE_MODES = JSON.stringify({ [ruleMode.id]: ruleMode.mode });
}

const targets = only ? [only] : Object.keys(SURFACES.surfaces);

console.log(`=== simulate-hook ===`);
console.log(`prompt:  ${JSON.stringify(prompt)}`);
console.log(
  `rule mode: ${ruleMode ? `${ruleMode.id}=${ruleMode.mode} (simulation override)` : 'all rules use the checked-in control plane'}`,
);

let failures = 0;

for (const surfaceId of targets) {
  const surface = SURFACES.surfaces[surfaceId];
  if (!surface) {
    console.log(`\n-- ${surfaceId} --\n  unknown surface`);
    failures += 1;
    continue;
  }

  const events = onlyEvent ? [onlyEvent] : surface.events;
  for (const event of events) {
    console.log(`\n-- ${surface.label} (${surfaceId}) / ${event} --`);
    const payload = payloadFor(surfaceId, event);
    const res = spawnSync(
      process.execPath,
      [ENGINE, '--surface', surfaceId, '--event', event],
      { input: JSON.stringify(payload), encoding: 'utf8', env }
    );

    if (raw) {
      console.log('  payload:  ' + JSON.stringify(payload));
      console.log('  stdout:   ' + res.stdout.trim());
      if (res.stderr.trim()) console.log('  stderr:   ' + res.stderr.trim());
      console.log('  exit:     ' + (res.status ?? 0));
    }

    // Exit 2 is legitimate only as a deliberate block. Anything else exiting 2
    // means a fault became a blocked prompt, which the contract forbids.
    const blocked = res.status === 2;
    if (blocked && !['soft-block', 'enforce'].includes(ruleMode?.mode)) {
      console.log('  FAIL: exited 2 with no enforcing rule — a fault must never block');
      failures += 1;
      continue;
    }
    console.log(describe(surfaceId, surface, event, res));
  }
}

console.log('');
if (failures > 0) {
  console.log(`${failures} problem(s) found.`);
  process.exit(1);
}
console.log('Simulation complete. Compare the "delivered via" field against');
console.log('prompt-core/surfaces.json if a surface looks ungoverned.');
