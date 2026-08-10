// Pure manifest-planning logic for the copilot-governance sync.
//
// This module computes the set of file paths that governance owns in a
// downstream repository, given the source trees that the sync script copies.
// It has no filesystem side effects — callers read and write; this module
// only reasons about paths.
//
// Exposed for testing and for the sync script itself so the "what is governed"
// logic is defined in exactly one place.

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// Walk a directory tree, returning every file path relative to sourceDir.
function walk(sourceDir) {
  if (!existsSync(sourceDir)) return [];
  const results = [];
  const recurse = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) recurse(full);
      else results.push(relative(sourceDir, full).replace(/\\/g, '/'));
    }
  };
  recurse(sourceDir);
  return results;
}

/**
 * Compute the sorted list of downstream paths that governance owns for one
 * sync run.
 *
 * @param {object} options
 * @param {string}   options.mainFile     - Repo-relative path of the main file
 *                                         (e.g. ".github/copilot-instructions.md")
 * @param {{sourceDir: string, targetPrefix: string}[]} options.trees
 *                                       - Source directories to mirror and their
 *                                         target prefixes in the downstream repo.
 * @param {string[]} [options.extraFiles] - Additional literal paths to include
 *                                         (e.g. lock files copied individually).
 * @returns {string[]} Sorted, deduplicated list of governed paths.
 */
export function computeManifest({ mainFile, trees = [], extraFiles = [] }) {
  const paths = new Set();

  if (mainFile) paths.add(mainFile);
  for (const f of extraFiles) if (f) paths.add(f);

  for (const { sourceDir, targetPrefix } of trees) {
    for (const rel of walk(sourceDir)) {
      paths.add(`${targetPrefix}/${rel}`);
    }
  }

  return [...paths].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/**
 * Compute the set of paths that were governed in a previous run but are no
 * longer governed in the new run — these are candidates for removal.
 *
 * @param {string[]} newPaths  - Paths the new run governs.
 * @param {string[]} oldPaths  - Paths the previous run governed (from the manifest file).
 * @returns {string[]} Paths to remove (old governed, not in new).
 */
export function computePrune(newPaths, oldPaths) {
  const newSet = new Set(newPaths);
  return oldPaths.map((p) => p.trim()).filter((p) => p && !newSet.has(p));
}

/**
 * Parse a manifest file (one path per non-empty line) into an array of paths.
 *
 * @param {string} content - Raw manifest file content.
 * @returns {string[]}
 */
export function parseManifest(content) {
  return content.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Serialise a path list to manifest file format (one path per line, trailing newline).
 *
 * @param {string[]} paths
 * @returns {string}
 */
export function serialiseManifest(paths) {
  return paths.join('\n') + (paths.length > 0 ? '\n' : '');
}
