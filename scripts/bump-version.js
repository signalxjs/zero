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
 * It is two passes (#195): every package is read and its next version
 * planned first, and nothing is written unless the whole plan holds. A
 * relative bump (patch/minor/major) refuses a tree whose publishable
 * packages already disagree — `version:set X.Y.Z` is how one is put back in
 * step — so a failed run never leaves the repo half-bumped.
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

/**
 * Pass 1 — read every publishable package and decide its next version,
 * writing NOTHING. A tree already out of lockstep is refused here (#195):
 * a relative bump computes each package's next version from its own
 * current one, so drifted packages would drift on, and the old
 * write-then-check loop exited 1 with the tree half-bumped. An exact
 * `version:set X.Y.Z` is how a drifted tree is put back in step, so it is
 * the one run that does not require the packages to agree first. Every
 * version line is also edited in memory here, so a malformed version or
 * manifest fails before the first write too.
 */
function planPackages(dir) {
    const plan = [];
    for (const entry of readdirSync(dir).sort()) {
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
        plan.push({ name: pkg.name, fullPath, pkgPath, raw, oldVersion: pkg.version });
    }

    const current = new Set(plan.map((p) => p.oldVersion));
    if (!exactVersion && current.size > 1) {
        throw new Error(
            `Lockstep broken before the bump — publishable packages disagree:\n` +
            plan.map((p) => `  ${p.name}: ${p.oldVersion}`).join('\n') +
            `\nNothing was written. Put them back in step with \`pnpm version:set X.Y.Z\` first.`
        );
    }

    for (const p of plan) {
        p.newVersion = exactVersion || bumpVersion(p.oldVersion, bumpType);
        p.nextRaw = replaceVersionLine(p.raw, p.newVersion);
    }
    const next = new Set(plan.map((p) => p.newVersion));
    if (next.size > 1) throw new Error(`Lockstep broken: packages would end on ${[...next].join(', ')}. Nothing was written.`);
    return plan;
}

/** Pass 2 — write the planned package.json files and cut the CHANGELOGs. */
function applyPlan(plan, today) {
    for (const p of plan) {
        writeFileSync(p.pkgPath, p.nextRaw);
        console.log(`${p.name}: ${p.oldVersion} → ${p.newVersion}`);

        const changelogPath = join(p.fullPath, 'CHANGELOG.md');
        if (cutChangelog && existsSync(changelogPath)) {
            const before = readFileSync(changelogPath, 'utf-8');
            const after = cutChangelogText(before, p.newVersion, today);
            if (after !== before) {
                writeFileSync(changelogPath, after);
                console.log(`  CHANGELOG.md: [Unreleased] → [${p.newVersion}] - ${today}`);
            } else {
                console.log(`  CHANGELOG.md: [Unreleased] is empty — not cut (nothing to release under ${p.newVersion}?)`);
            }
        }
    }
}

// The pure halves live in lib/version.mjs (the test imports them there);
// this file is the CLI. Node hands `argv[1]` over resolved, but a relative
// spelling is normalised anyway.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const today = new Date().toISOString().slice(0, 10);
    console.log(exactVersion
        ? `Setting all packages to version ${exactVersion}...\n`
        : `Bumping ${bumpType} version for packages...\n`);
    let plan;
    try {
        plan = planPackages(packagesDir);
    } catch (err) {
        console.error(`\n${err.message}`);
        process.exit(1);
    }
    if (plan.length === 0) {
        console.error('\nNo publishable packages found — nothing to bump.');
        process.exit(1);
    }
    applyPlan(plan, today);
    const version = plan[0].newVersion;
    console.log(`\nDone — ${version}. Next: open the release PR, merge, then \`git tag v${version} && git push origin v${version}\`.`);
}
