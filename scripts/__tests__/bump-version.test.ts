/**
 * The lockstep bump's two pure halves (#148). The script itself is exercised
 * by every release; this pins the two rules a release now relies on and
 * nobody wants to discover at tag time:
 *
 * - a bump FROM a prerelease drops it and bumps (0.3.0-beta.1 → minor →
 *   0.4.0) — the betas ended, and the next release is the next minor;
 * - the changelog cut turns `[Unreleased]` into the release under a fresh,
 *   empty `[Unreleased]`, and leaves a file with no such heading alone.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — a plain ESM script, no declarations by design.
import { bumpVersion, cutChangelogText, replaceVersionLine } from '../bump-version.js';

describe('bumpVersion', () => {
    it('bumps a stable version by part', () => {
        expect(bumpVersion('0.4.0', 'patch')).toBe('0.4.1');
        expect(bumpVersion('0.4.0', 'minor')).toBe('0.5.0');
        expect(bumpVersion('0.4.7', 'minor')).toBe('0.5.0');
        expect(bumpVersion('0.9.3', 'major')).toBe('1.0.0');
    });

    it('drops a prerelease before bumping — the next release after a beta is the next minor', () => {
        expect(bumpVersion('0.3.0-beta.1', 'minor')).toBe('0.4.0');
        expect(bumpVersion('0.3.0-beta.1', 'patch')).toBe('0.3.1');
        expect(bumpVersion('0.3.0-beta.1', 'major')).toBe('1.0.0');
        expect(bumpVersion('1.2.3-rc.2', 'minor')).toBe('1.3.0');
    });

    it('refuses what is not a version', () => {
        expect(() => bumpVersion('0.3', 'minor')).toThrow(/not a semver version/);
        expect(() => bumpVersion('0.4.0', 'nope')).toThrow(/Unknown bump type/);
    });
});

describe('cutChangelogText', () => {
    const before = [
        '# Changelog', '', '## [Unreleased]', '', '### Added — a thing', '', '- it.', '',
        '## [0.3.0-beta.1] - 2026-09-19', '', 'old', '',
    ].join('\n');

    it('turns [Unreleased] into the release under a fresh, empty [Unreleased]', () => {
        const after = cutChangelogText(before, '0.4.0', '2026-09-20');
        expect(after.startsWith('# Changelog\n\n## [Unreleased]\n\n## [0.4.0] - 2026-09-20\n\n### Added — a thing')).toBe(true);
        expect(after).toContain('## [0.3.0-beta.1] - 2026-09-19');
        // Exactly one fresh heading, and everything that was unreleased is now under the release.
        expect(after.split('## [Unreleased]').length - 1).toBe(1);
        expect(after.indexOf('## [Unreleased]')).toBeLessThan(after.indexOf('## [0.4.0]'));
    });

    it('leaves a file with no [Unreleased] section alone', () => {
        expect(cutChangelogText('# Changelog\n\n## [0.4.0] - 2026-09-20\n', '0.5.0', '2026-10-01')).toBe('# Changelog\n\n## [0.4.0] - 2026-09-20\n');
    });

    it('does not cut an EMPTY [Unreleased] — the state right after a release, so a rerun mints no empty entry', () => {
        const cut = cutChangelogText(before, '0.4.0', '2026-09-20');
        // Immediately after a cut the fresh section is empty: cutting again is a no-op.
        expect(cutChangelogText(cut, '0.5.0', '2026-10-01')).toBe(cut);
        // Whitespace-only counts as empty, with or without a following release.
        expect(cutChangelogText('# Changelog\n\n## [Unreleased]\n\n\n## [0.4.0] - x\n', '0.5.0', 'd')).toBe('# Changelog\n\n## [Unreleased]\n\n\n## [0.4.0] - x\n');
        expect(cutChangelogText('# Changelog\n\n## [Unreleased]\n', '0.5.0', 'd')).toBe('# Changelog\n\n## [Unreleased]\n');
    });
});

describe('replaceVersionLine', () => {
    it('moves the top-level version line and nothing else', () => {
        const raw = '{\n    "name": "@sigx/x",\n    "version": "0.3.0-beta.1",\n    "description": "a \\u2014 b",\n    "peerDependencies": { "sigx": "catalog:" }\n}\n';
        const next = replaceVersionLine(raw, '0.4.0');
        expect(next).toBe(raw.replace('"0.3.0-beta.1"', '"0.4.0"'));
        expect(next).toContain('\\u2014');
        expect(JSON.parse(next).version).toBe('0.4.0');
    });

    it('refuses a manifest whose version line is missing or ambiguous', () => {
        expect(() => replaceVersionLine('{ "name": "x" }', '0.4.0')).toThrow(/exactly one top-level "version" line, found 0/);
        expect(() => replaceVersionLine('{\n  "version": "1.0.0",\n  "nested": {\n  "version": "9.9.9"\n  }\n}', '0.4.0')).toThrow(/found 2/);
    });
});
