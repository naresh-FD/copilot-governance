import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

// Node runtime server frameworks whose presence in dependencies is reliable
// evidence that this project runs on the Node.js runtime rather than in a
// browser. Presence of package.json alone is NOT evidence — a browser React
// app also has package.json.
const NODE_RUNTIME_DEPS = new Set([
  'express', 'fastify', 'koa', 'hapi', '@hapi/hapi', 'restify',
  'nestjs', '@nestjs/core', '@nestjs/common', 'sails', 'feathers',
  '@feathersjs/feathers', 'polka', 'micro', 'http-server',
]);

// Inspect up to this many workspace members to avoid scanning huge trees.
const WORKSPACE_SCAN_LIMIT = 20;

export function detectRepositoryProfile(cwd = process.cwd()) {
  const packageJson = readJsonIfPresent(join(cwd, 'package.json'));
  const deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  const prodDeps = packageJson?.dependencies ?? {};

  const stacks = [];
  const evidence = {};

  function addStack(name, reason) {
    if (!stacks.includes(name)) stacks.push(name);
    if (!evidence[name]) evidence[name] = [];
    evidence[name].push(reason);
  }

  // Browser/UI frameworks
  if (deps.react || deps['react-dom']) {
    addStack('react', deps.react ? `react ${deps.react} in dependencies` : `react-dom ${deps['react-dom']} in dependencies`);
  }

  // Angular — dependency or workspace config file
  if (deps['@angular/core'] || existsSync(join(cwd, 'angular.json'))) {
    if (deps['@angular/core']) addStack('angular', `@angular/core ${deps['@angular/core']}`);
    if (existsSync(join(cwd, 'angular.json'))) addStack('angular', 'angular.json present');
  }

  // Node runtime — server framework evidence only (not just package.json presence)
  const nodeRuntimeFound = Object.keys(prodDeps).filter(d => NODE_RUNTIME_DEPS.has(d));
  if (nodeRuntimeFound.length > 0) {
    for (const d of nodeRuntimeFound) addStack('node', `${d} ${prodDeps[d]} in dependencies`);
  }
  // Also check devDependencies for common Node-only patterns (e.g. @types/node implies Node target)
  if (!stacks.includes('node') && deps['@types/node'] && !deps.react && !deps['@angular/core']) {
    addStack('node', '@types/node in devDependencies (no browser framework detected)');
  }

  // Build/test tool stacks (useful metadata for routing, not mutually exclusive)
  if (deps.typescript) addStack('typescript', `typescript ${deps.typescript}`);
  if (deps.vite) addStack('vite', `vite ${deps.vite}`);
  if (deps.jest) addStack('jest', `jest ${deps.jest}`);
  if (deps.vitest) addStack('vitest', `vitest ${deps.vitest}`);

  // Java — Maven
  if (existsSync(join(cwd, 'pom.xml'))) {
    addStack('java', 'pom.xml present');
    addStack('maven', 'pom.xml present');
  }

  // Java — Gradle
  if (existsSync(join(cwd, 'build.gradle')) || existsSync(join(cwd, 'build.gradle.kts'))) {
    const gradleFile = existsSync(join(cwd, 'build.gradle')) ? 'build.gradle' : 'build.gradle.kts';
    addStack('java', `${gradleFile} present`);
    addStack('gradle', `${gradleFile} present`);
  }

  // Monorepo workspace member inspection (bounded depth, no full-tree recursion)
  const workspaceMembers = resolveWorkspaceMembers(cwd, packageJson);
  for (const memberDir of workspaceMembers) {
    const memberPkg = readJsonIfPresent(join(memberDir, 'package.json'));
    if (!memberPkg) continue;
    const memberDeps = { ...(memberPkg.dependencies ?? {}), ...(memberPkg.devDependencies ?? {}) };
    const memberProd = memberPkg.dependencies ?? {};

    if (memberDeps.react || memberDeps['react-dom']) addStack('react', `react in workspace member ${memberDir}`);
    if (memberDeps['@angular/core']) addStack('angular', `@angular/core in workspace member ${memberDir}`);
    const memberNode = Object.keys(memberProd).filter(d => NODE_RUNTIME_DEPS.has(d));
    if (memberNode.length > 0) addStack('node', `${memberNode[0]} in workspace member ${memberDir}`);
    if (existsSync(join(memberDir, 'pom.xml'))) { addStack('java', `pom.xml in workspace member ${memberDir}`); addStack('maven', `pom.xml in workspace member ${memberDir}`); }
    if (existsSync(join(memberDir, 'build.gradle')) || existsSync(join(memberDir, 'build.gradle.kts'))) { addStack('java', `build.gradle in workspace member ${memberDir}`); addStack('gradle', `build.gradle in workspace member ${memberDir}`); }
  }

  // Conflict detection: Angular and React in the same project is unusual and
  // warrants uncertainty rather than a confident classification.
  const uncertainty = stacks.includes('react') && stacks.includes('angular');

  return {
    stacks: [...new Set(stacks)],
    evidence,
    uncertainty,
    packageManager: detectPackageManager(cwd),
    commands: detectCommands(packageJson),
  };
}

// Resolves workspace members from package.json workspaces field and
// pnpm-workspace.yaml. Returns absolute paths, bounded to WORKSPACE_SCAN_LIMIT.
function resolveWorkspaceMembers(cwd, packageJson) {
  const members = [];

  // npm/yarn workspaces: array of glob patterns or { packages: [...] }
  const wsField = packageJson?.workspaces;
  const wsPatterns = Array.isArray(wsField) ? wsField : (wsField?.packages ?? []);

  for (const pattern of wsPatterns) {
    if (members.length >= WORKSPACE_SCAN_LIMIT) break;
    // Handle simple `packages/*` or `apps/*` patterns (one glob level only)
    const parts = pattern.split('/');
    if (parts.length === 2 && parts[1] === '*') {
      const dir = join(cwd, parts[0]);
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          if (members.length >= WORKSPACE_SCAN_LIMIT) break;
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) members.push(full);
        }
      } catch { /* ignore unreadable */ }
    } else if (!pattern.includes('*')) {
      // Exact path (no glob)
      const full = join(cwd, pattern);
      if (existsSync(full)) members.push(full);
    }
  }

  // pnpm-workspace.yaml (basic: look for `packages:` section)
  const pnpmYaml = join(cwd, 'pnpm-workspace.yaml');
  if (existsSync(pnpmYaml)) {
    try {
      const lines = readFileSync(pnpmYaml, 'utf8').split('\n');
      let inPackages = false;
      for (const line of lines) {
        if (members.length >= WORKSPACE_SCAN_LIMIT) break;
        if (/^packages:/.test(line)) { inPackages = true; continue; }
        if (inPackages && /^\s+-\s+/.test(line)) {
          const pattern = line.replace(/^\s+-\s+['"]?/, '').replace(/['"]?\s*$/, '');
          if (pattern.endsWith('/*')) {
            const dir = join(cwd, pattern.slice(0, -2));
            if (existsSync(dir)) {
              try {
                const entries = readdirSync(dir);
                for (const entry of entries) {
                  if (members.length >= WORKSPACE_SCAN_LIMIT) break;
                  const full = join(dir, entry);
                  if (statSync(full).isDirectory()) members.push(full);
                }
              } catch { /* ignore */ }
            }
          } else if (!pattern.includes('*')) {
            const full = join(cwd, pattern);
            if (existsSync(full)) members.push(full);
          }
        } else if (inPackages && line.trim() && !/^\s/.test(line)) {
          break; // end of packages section
        }
      }
    } catch { /* ignore unreadable yaml */ }
  }

  return members;
}

function detectPackageManager(cwd) {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(cwd, 'package-lock.json'))) return 'npm';
  if (existsSync(join(cwd, 'pom.xml'))) return 'maven';
  if (existsSync(join(cwd, 'gradlew')) || existsSync(join(cwd, 'gradlew.bat'))) return 'gradle-wrapper';
  return 'unknown';
}

function detectCommands(packageJson) {
  const scripts = packageJson?.scripts ?? {};
  return {
    test: scripts.test ?? null,
    lint: scripts.lint ?? null,
    build: scripts.build ?? null,
    typecheck: scripts.typecheck ?? scripts['type-check'] ?? scripts.typeCheck ?? null,
  };
}
