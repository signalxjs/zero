/**
 * The pure half of the release-tag guard (#196), kept apart from
 * scripts/check-release-tag.mjs so a test can import it (see version.mjs
 * for why a shebang'd script cannot be imported on the Windows runner).
 *
 * `scripts/publish.js` publishes whatever each package.json says and skips a
 * name@version already on npm, so a tag that disagrees with the packages
 * — v0.6.0 pushed on the 0.5.0 commit — skipped all of them, exited 0, and
 * `release.yml` still cut a GitHub release for it. A prerelease tag on a
 * stable version is the other half: publish.js picks the dist-tag from the
 * package version, so it would have landed on npm `latest` while the GitHub
 * release said prerelease. The tag must equal every publishable version.
 */
import { SEMVER } from './version.mjs';

/**
 * Every reason `tag` must not release `packages` (`{ name, version }[]`);
 * empty when it may.
 */
export function releaseTagProblems(tag, packages) {
    const version = typeof tag === 'string' && tag.startsWith('v') ? tag.slice(1) : null;
    if (version === null || !SEMVER.test(version)) {
        return [`"${tag}" is not a release tag — expected v<semver>, e.g. v0.6.0`];
    }
    if (packages.length === 0) {
        return ['no publishable packages found — nothing to check the tag against'];
    }
    return packages
        .filter((pkg) => pkg.version !== version)
        .map((pkg) => `${pkg.name} is ${pkg.version}, but the tag is ${tag} — tag the commit whose packages carry ${version} (pnpm version:*), or fix the tag`);
}

/**
 * The PACKAGES array from publish.js's source — the list that actually
 * publishes. Read rather than imported: publish.js runs on import. Same
 * tolerant pattern verify-pack.js uses.
 */
export function readPublishList(source) {
    const block = /const\s+PACKAGES\s*=\s*\[([\s\S]*?)\]/.exec(source);
    if (!block) throw new Error('Could not find the PACKAGES array in scripts/publish.js');
    return [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}
