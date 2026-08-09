import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function detectRepositoryProfile(cwd = process.cwd()) {
  const packageJson = readJsonIfPresent(join(cwd, 'package.json'));
  const dependencies = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  const stacks = [];
  if (dependencies.react) stacks.push('react');
  if (dependencies['@angular/core']) stacks.push('angular');
  if (dependencies.typescript) stacks.push('typescript');
  if (dependencies.vite) stacks.push('vite');
  if (dependencies.jest) stacks.push('jest');
  if (dependencies.vitest) stacks.push('vitest');
  if (dependencies.express || packageJson) stacks.push('node');
  if (existsSync(join(cwd, 'pom.xml'))) stacks.push('java', 'maven');
  if (existsSync(join(cwd, 'build.gradle')) || existsSync(join(cwd, 'build.gradle.kts'))) stacks.push('java', 'gradle');
  return { stacks: [...new Set(stacks)], packageManager: detectPackageManager(cwd), commands: detectCommands(packageJson) };
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
  return { test: scripts.test ?? null, lint: scripts.lint ?? null, build: scripts.build ?? null, typecheck: scripts.typecheck ?? scripts['type-check'] ?? scripts.typeCheck ?? null };
}
