/**
 * `docs/building-your-own-component.md` is the first thing an external
 * component author copies, and its snippets are load-bearing rather than
 * illustrative: §1's `defineAnatomy` call and §4's manifest-fragment literal
 * are what a reader pastes into their own package. So they are executed here
 * rather than eyeballed.
 *
 * The bug this gate was written for: §4's literal omitted `version`, which
 * `mergeManifests` requires — so the canonical snippet hard-errored on the
 * reader's first adopting build, naming a field the guide never mentioned.
 * Prose can drift from the contract silently; a snippet that runs cannot.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { mergeManifests } from '@sigx/zero-kit';
import type { ManifestComponent, ManifestFragment } from '@sigx/zero-kit';
import { anatomies, defineAnatomy } from '@sigx/zero/anatomy';
import type { Anatomy } from '@sigx/zero/anatomy';

const GUIDE = resolve(process.cwd(), 'docs/building-your-own-component.md');
const guide = () => readFileSync(GUIDE, 'utf8');

/**
 * Pull one expression out of the guide by its `export const <name> =` binding,
 * up to the terminating `;` at column 0 of its own line. Deliberately literal:
 * a snippet the extractor cannot find is a failure, not a skip — renaming the
 * binding in the doc must break this test rather than silently disable it.
 */
function snippetExpression(name: string): string {
    const marker = `export const ${name} = `;
    const start = guide().indexOf(marker);
    expect(start, `${GUIDE} declares no \`${marker.trim()}\``).toBeGreaterThan(-1);
    const rest = guide().slice(start + marker.length);

    // Whichever terminator comes first: a call expression closes with `});`,
    // a plain object literal with `};`. Both absent means the snippet was
    // reshaped — say so, rather than slicing to a nonsense offset and letting
    // `new Function` report a syntax error about a fragment nobody wrote.
    const ends = ['\n});', '\n};']
        .map((t) => ({ t, at: rest.indexOf(t) }))
        .filter(({ at }) => at >= 0)
        .sort((a, b) => a.at - b.at);
    expect(ends.length, `\`${marker.trim()}\` in ${GUIDE} has no \`});\` or \`};\` terminator`).toBeGreaterThan(0);

    const { t, at } = ends[0]!;
    return rest.slice(0, at + t.length).replace(/;\s*$/, '');
}

/** Evaluate a snippet expression with the guide's own imports in scope. */
function evaluate<T>(expression: string, scope: Record<string, unknown>): T {
    const names = Object.keys(scope);
    return new Function(...names, `return (${expression});`)(...names.map((n) => scope[n])) as T;
}

describe('docs/building-your-own-component.md', () => {
    it('§1 declares an anatomy the contract accepts', () => {
        const anatomy = evaluate<Anatomy>(snippetExpression('stepperAnatomy'), { defineAnatomy });
        expect(anatomy.scope).toBe('acme-stepper');
        expect(anatomy.partNames().length).toBeGreaterThan(0);
    });

    it('§4 publishes a fragment a design system can actually merge', () => {
        const stepperAnatomy = evaluate<Anatomy>(snippetExpression('stepperAnatomy'), { defineAnatomy });
        const fragment = evaluate<ManifestFragment>(snippetExpression('fragment'), { stepperAnatomy });

        const base = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
        const merged = mergeManifests(base, fragment);

        const stepper = merged.components.find((c) => c.scope === 'acme-stepper');
        expect(stepper, 'the guide’s fragment did not merge').toBeDefined();
        expect(stepper?.package).toBe('@acme/zero-stepper');
    });
});
