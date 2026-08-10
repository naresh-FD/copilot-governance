import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export function isInside(parent, child) {
  const result = relative(parent, child);
  return result !== '' && !result.startsWith('..') && !result.includes(':');
}

export function selectSkills({ intent, repositoryProfile, registry, governanceRoot }) {
  // Load the lock file. A missing or unreadable lock file means we cannot
  // verify integrity — return all skills as rejected rather than fail open.
  let lock = null;
  let lockError = null;
  try {
    const lockPath = resolve(governanceRoot, 'skill-registry', 'skill-lock.json');
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (err) {
    lockError = err.message;
  }

  if (!lock) {
    // Cannot verify any skill without the lock file — report as integrity error.
    const requestedSkills = intent.skills ?? [];
    return {
      selected: [],
      rejected: requestedSkills.map((s) => ({ skill: s, reason: 'integrity-error', detail: `skill-lock.json unreadable: ${lockError}` })),
      integrityError: true,
    };
  }

  const requestedSkills = intent.skills ?? [];
  const selected = [];
  const rejected = [];
  const max = registry.maxSkillsPerPrompt ?? 2;
  const allowedRoot = resolve(governanceRoot, 'skill-registry');

  // Resolve the real allowed root once (handles symlinks on the root itself).
  let realAllowedRoot;
  try { realAllowedRoot = realpathSync(allowedRoot); } catch { realAllowedRoot = allowedRoot; }

  for (const skillName of requestedSkills) {
    if (selected.length >= max) break;

    const config = registry.skills?.[skillName];
    if (!config) { rejected.push({ skill: skillName, reason: 'not-present-in-registry' }); continue; }
    if (config.status !== 'approved') { rejected.push({ skill: skillName, reason: 'not-approved' }); continue; }
    if (!(config.allowedIntents ?? []).includes(intent.id)) { rejected.push({ skill: skillName, reason: 'intent-not-allowed' }); continue; }

    const stacks = repositoryProfile?.stacks ?? [];
    const stackAllowed = (config.allowedStacks ?? []).length === 0 || stacks.length === 0
      || stacks.some((stack) => (config.allowedStacks ?? []).includes(stack));
    if (!stackAllowed) { rejected.push({ skill: skillName, reason: 'repository-stack-not-allowed' }); continue; }

    const skillPath = resolve(governanceRoot, config.path);

    // Lexical path check first (fast, catches obvious traversal)
    if (!isInside(allowedRoot, skillPath)) { rejected.push({ skill: skillName, reason: 'path-outside-registry' }); continue; }

    if (!existsSync(skillPath)) { rejected.push({ skill: skillName, reason: 'skill-file-missing' }); continue; }

    // Resolve the real path to detect symlink escapes that point outside the
    // allowed root even though the declared path is inside it.
    let realSkillPath;
    try {
      realSkillPath = realpathSync(skillPath);
    } catch {
      rejected.push({ skill: skillName, reason: 'skill-file-missing' }); continue;
    }
    if (!isInside(realAllowedRoot, realSkillPath)) {
      rejected.push({ skill: skillName, reason: 'path-outside-registry' }); continue;
    }

    const content = readFileSync(skillPath, 'utf8');

    if (content.length > (config.maxChars ?? registry.defaultSkillBudgetChars ?? 7000)) {
      rejected.push({ skill: skillName, reason: 'skill-budget-exceeded' }); continue;
    }

    // Runtime integrity check: compute the hash of the content we actually
    // loaded and compare it to the lock entry. This catches both accidental
    // modification and deliberate tampering of deployed skill files.
    const expectedHash = lock.skills?.[skillName]?.sha256;
    if (!expectedHash) {
      rejected.push({ skill: skillName, reason: 'integrity-error', detail: 'no lock entry for this skill' });
      continue;
    }
    const actualHash = createHash('sha256').update(content).digest('hex');
    if (actualHash !== expectedHash) {
      rejected.push({
        skill: skillName,
        reason: 'integrity-error',
        detail: `hash mismatch: expected ${expectedHash.slice(0, 12)}…, got ${actualHash.slice(0, 12)}…`,
      });
      continue;
    }

    selected.push({ name: skillName, content, requiresHumanReview: config.requiresHumanReview === true });
  }

  const hasIntegrityError = rejected.some((r) => r.reason === 'integrity-error');
  return { selected, rejected, integrityError: hasIntegrityError };
}
