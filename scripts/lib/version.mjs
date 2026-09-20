/**
 * The pure halves of the lockstep bump (scripts/bump-version.js, #148):
 * the semver step and the changelog cut, plus the textual version-line
 * edit. Kept apart from the script so a test can import them — the script
 * carries a shebang, and Vite's CJS-interop rewrite on the Windows runner
 * lands its import hoist BEFORE `#!`, which is a parse error there.
 */
export const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

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
