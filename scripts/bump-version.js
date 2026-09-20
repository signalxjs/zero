#!/usr/bin/env node
/**
 * bump-version.js — the lockstep version bump (`pnpm version:patch|minor|major`
 * or `pnpm version:set X.Y.Z`).
 *
 * Every publishable package under packages/ moves to the same version, and
 * both CHANGELOGs that exist (zero, zero-kit) are cut: `## [Unreleased]`
 * becomes `## [X.Y.Z] - <today>` under a fresh, empty `## [Unreleased]`.
 * Private packages are skipped — they never publish and never ship a
 * changelog.
 *
 * Releases are plain semver from 0.4.0 on (#148); the betas ended at
 * 0.3.0-beta.1. So a bump FROM a prerelease drops the prerelease first and
 * then bumps: 0.3.0-beta.1 → `minor` → 0.4.0 — the release the beta was
 * leading to is not what comes next, the next minor is. A prerelease is
 * still expressible through `version:set 0.4.0-rc.1`; it is just no longer
 * the path (`publish.js` puts a prerelease on its own dist-tag, never
 * `latest`, and `release.yml` marks its tag a GitHub prerelease).
 *
 * Usage:
 *   node scripts/bump-version.js patch|minor|major
 *   node scripts/bump-version.js 0.4.0            # exact
 *   … --no-changelog                               # skip the changelog cut
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { SEMVER, bumpVersion, cutChangelogText, replaceVersionLine } from './lib/version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(__dirname, '..', 'packages');

const args = process.argv.slice(2);
const cutChangelog = !args.includes('--no-changelog');
const arg = args.find((a) => !a.startsWith('--')) || 'patch';
const isExactVersion = SEMVER.test(arg);
const bumpType = isExactVersion ? null : arg;
const exactVersion = isExactVersion ? arg : null;
if (!isExactVersion && !['patch', 'minor', 'major'].includes(bumpType)) {
    console.error(`Unknown bump "${arg}" — expected patch | minor | major | X.Y.Z[-pre]`);
    process.exit(1);
}

function processPackages(dir, today) {
    const results = [];
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        if (!statSync(fullPath).isDirectory()) continue;
        const pkgPath = join(fullPath, 'package.json');
        if (!existsSync(pkgPath)) continue;
        const raw = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(raw);
        if (pkg.private) {
            console.log(`Skipping private package: ${pkg.name}`);
            continue;
        }
        const oldVersion = pkg.version;
        const newVersion = exactVersion || bumpVersion(oldVersion, bumpType);
        writeFileSync(pkgPath, replaceVersionLine(raw, newVersion));
        console.log(`${pkg.name}: ${oldVersion} → ${newVersion}`);
        results.push(newVersion);

        const changelogPath = join(fullPath, 'CHANGELOG.md');
        if (cutChangelog && existsSync(changelogPath)) {
            const before = readFileSync(changelogPath, 'utf-8');
            const after = cutChangelogText(before, newVersion, today);
            if (after !== before) {
                writeFileSync(changelogPath, after);
                console.log(`  CHANGELOG.md: [Unreleased] → [${newVersion}] - ${today}`);
            } else {
                console.log(`  CHANGELOG.md: [Unreleased] is empty — not cut (nothing to release under ${newVersion}?)`);
            }
        }
    }
    return results;
}

// The pure halves live in lib/version.mjs (the test imports them there);
// this file is the CLI. Node hands `argv[1]` over resolved, but a relative
// spelling is normalised anyway.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const today = new Date().toISOString().slice(0, 10);
    console.log(exactVersion
        ? `Setting all packages to version ${exactVersion}...\n`
        : `Bumping ${bumpType} version for packages...\n`);
    const versions = new Set(processPackages(packagesDir, today));
    if (versions.size > 1) {
        console.error(`\nLockstep broken: packages ended on ${[...versions].join(', ')}`);
        process.exit(1);
    }
    console.log(`\nDone — ${[...versions][0]}. Next: open the release PR, merge, then \`git tag v${[...versions][0]} && git push origin v${[...versions][0]}\`.`);
}
