#!/usr/bin/env node

/**
 * Fails when a release tag disagrees with the versions it would publish
 * (#196). The first step of release.yml's publish job.
 *
 * Usage: node scripts/check-release-tag.mjs <tag>   (e.g. v0.6.0)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublishList, releaseTagProblems } from './lib/release-tag.mjs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2] ?? '';

const packages = readPublishList(readFileSync(join(rootDir, 'scripts/publish.js'), 'utf-8')).map((dir) => {
    const { name, version } = JSON.parse(readFileSync(join(rootDir, dir, 'package.json'), 'utf-8'));
    return { name, version };
});

const problems = releaseTagProblems(tag, packages);
if (problems.length > 0) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
}
console.log(`✓ ${tag} matches all ${packages.length} publishable packages`);
