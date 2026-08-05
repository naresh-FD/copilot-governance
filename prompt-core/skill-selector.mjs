import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export function isInside(parent, child) {
  const result = relative(parent, child);
  return result !== '' && !result.startsWith('..') && !result.includes(':');
}

export function selectSkills({ intent, repositoryProfile, registry, governanceRoot }) {
  const requestedSkills = intent.skills ?? [];
  const selected = [];
  const rejected = [];
  const max = registry.maxSkillsPerPrompt ?? 2;
  for (const skillName of requestedSkills) {
    const config = registry.skills?.[skillName];
    if (!config) { rejected.push({ skill: skillName, reason: 'not-present-in-registry' }); continue; }
    if (config.status !== 'approved') { rejected.push({ skill: skillName, reason: 'not-approved' }); continue; }
    if (!(config.allowedIntents ?? []).includes(intent.id)) { rejected.push({ skill: skillName, reason: 'intent-not-allowed' }); continue; }
    const stacks = repositoryProfile?.stacks ?? [];
    const stackAllowed = (config.allowedStacks ?? []).length === 0 || stacks.length === 0 || stacks.some((stack) => config.allowedStacks.includes(stack));
    if (!stackAllowed) { rejected.push({ skill: skillName, reason: 'repository-stack-not-allowed' }); continue; }
    const skillPath = resolve(governanceRoot, config.path);
    const allowedRoot = resolve(governanceRoot, 'skill-registry');
    if (!isInside(allowedRoot, skillPath)) { rejected.push({ skill: skillName, reason: 'path-outside-registry' }); continue; }
    if (!existsSync(skillPath)) { rejected.push({ skill: skillName, reason: 'skill-file-missing' }); continue; }
    const content = readFileSync(skillPath, 'utf8');
    if (content.length > (config.maxChars ?? registry.defaultSkillBudgetChars ?? 7000)) { rejected.push({ skill: skillName, reason: 'skill-budget-exceeded' }); continue; }
    selected.push({ name: skillName, content, requiresHumanReview: config.requiresHumanReview === true });
    if (selected.length >= max) break;
  }
  return { selected, rejected };
}
