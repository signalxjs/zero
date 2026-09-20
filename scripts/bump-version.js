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

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(__dirname, '..', 'packages');

const args = process.argv.slice(2);
const cutChangelog = !args.includes('--no-changelog');
const arg = args.find((a) => !a.startsWith('--')) || 'patch';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const isExactVersion = SEMVER.test(arg);
const bumpType = isExactVersion ? null : arg;
const exactVersion = isExactVersion ? arg : null;
if (!isExactVersion && !['patch', 'minor', 'major'].includes(bumpType)) {
    console.error(`Unknown bump "${arg}" — expected patch | minor | major | X.Y.Z[-pre]`);
    process.exit(1);
}

export function bumpVersion(version, type) {
    const m = SEMVER.exec(version);
    if (!m) throw new Error(`"${version}" is not a semver version`);
    // A prerelease is dropped before the bump: the next release after a
    // beta is the next minor, not the beta's base (see the header).
    const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
    switch (type) {
        case 'major': return `${major + 1}.0.0`;
        case 'minor': return `${major}.${minor + 1}.0`;
        case 'patch': return `${major}.${minor}.${patch + 1}`;
        default: throw new Error(`Unknown bump type "${type}"`);
    }
}

/**
 * Cut a Keep-a-Changelog file: the `[Unreleased]` section becomes the
 * release, under a new empty `[Unreleased]`. Untouched when there is no
 * `[Unreleased]` heading, and — the state right after a release — when the
 * section is EMPTY (nothing but whitespace before the next `## ` heading or
 * the end): a rerun of `pnpm version:*` must not mint an empty release
 * entry and push the real one down.
 */
export function cutChangelogText(text, version, date) {
    const heading = '## [Unreleased]';
    const at = text.indexOf(heading);
    if (at === -1) return text;
    const bodyStart = at + heading.length;
    const nextHeading = text.indexOf('\n## ', bodyStart);
    const body = text.slice(bodyStart, nextHeading === -1 ? undefined : nextHeading);
    if (body.trim() === '') return text;
    return `${text.slice(0, at)}${heading}\n\n## [${version}] - ${date}${text.slice(bodyStart)}`;
}

/**
 * Move the TOP-LEVEL `"version"` line of a package.json, textually, so the
 * rest of the file stays byte-for-byte (a JSON round-trip rewrote unicode
 * escapes, #147). Anchored to a line-leading key, and it must match exactly
 * once — a nested `"version"` (a dependency map, a publishConfig) or an
 * unexpected layout is an error rather than a silent miss.
 */
export function replaceVersionLine(raw, newVersion) {
    const pattern = /^(\s*"version":\s*")([^"]+)(")/gm;
    const matches = [...raw.matchAll(pattern)];
    if (matches.length !== 1) {
        throw new Error(`expected exactly one top-level "version" line, found ${matches.length}`);
    }
    const next = raw.replace(pattern, `$1${newVersion}$3`);
    if (JSON.parse(next).version !== newVersion) throw new Error(`version line replaced, but the manifest reads ${JSON.parse(next).version}`);
    return next;
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

// Only run when invoked directly, so the pure functions above are
// importable by the test. Node hands `argv[1]` over resolved, but a relative
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
