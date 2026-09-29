/**
 * Declared runtime properties, held to the component sources (#537).
 *
 * An anatomy's `runtimeProperties` tells every design system "a recipe may
 * read this bare — the runtime writes it". A name declared but never written
 * is a promise nothing keeps: the recipe resolves to its fallback and paints
 * nothing. This test scrapes each declaring scope's own sources for the name
 * as a string literal (`'--progress-percent'`), the way model-parity.test.ts
 * reads the props declarations — textual on purpose, since the writes are
 * inline `style` objects and a DOM walk would need every state rendered.
 *
 * A scope may also write through a shared behavior that composes the names
 * from a prefix (`createDisclosurePresence({ prefix: '--accordion-panel' })`
 * writes `<prefix>-height` and `<prefix>-width`). Those writers are listed
 * below, and each row is itself held to the behavior's source, so a renamed
 * suffix fails here rather than passing on a stale table.
 *
 * One direction only: declared → written. The reverse (every inline custom
 * property a scope writes is declared) is not checked yet, because Table's
 * and Textarea's inline writes stay undeclared by decision B(a) on #456 —
 * declaring them makes them web-only, and the skins' lynx builds would
 * refuse the table recipe until its reads move into `targets.web`. #538
 * declares them and adds the reverse check.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';

const srcDir = resolve(import.meta.dirname, '../src');
const componentsDir = resolve(srcDir, 'components');

/** Every `.ts`/`.tsx` source under a scope's own directory, concatenated. */
function sourcesOf(scope: string): string {
    const dir = resolve(componentsDir, scope);
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((f) => /\.tsx?$/.test(f) && f !== 'anatomy.ts')
        .sort()
        .map((f) => readFileSync(resolve(dir, f), 'utf8'))
        .join('\n');
}

/**
 * Behaviors that write names composed from a caller's prefix: the call that
 * passes the prefix, and the suffixes the behavior appends. `writes` is the
 * behavior's own template, checked against its source.
 */
const PREFIX_WRITERS = [
    {
        file: 'behaviors/disclosure-presence.ts',
        call: 'createDisclosurePresence',
        suffixes: ['-height', '-width'],
        writes: (suffix: string) => `\`\${opts.prefix}${suffix}\``,
    },
] as const;

/** The names a scope's sources write through a prefix writer. */
function prefixedWrites(source: string): string[] {
    const out: string[] = [];
    for (const writer of PREFIX_WRITERS) {
        const re = new RegExp(`${writer.call}\\(\\{[^}]*?\\bprefix:\\s*'(--[a-z0-9-]+)'`, 'g');
        for (const [, prefix] of source.matchAll(re)) {
            for (const suffix of writer.suffixes) out.push(`${prefix}${suffix}`);
        }
    }
    return out;
}

const declaring = Object.values(anatomies)
    .filter((a) => (a.runtimeProperties?.length ?? 0) > 0)
    .map((a) => a.scope);

describe('every declared runtime property is written by its scope\'s sources', () => {
    it('the prefix writers really append the suffixes listed', () => {
        for (const writer of PREFIX_WRITERS) {
            const source = readFileSync(resolve(srcDir, writer.file), 'utf8');
            for (const suffix of writer.suffixes) {
                expect(source, `${writer.file} writes ${suffix}`).toContain(writer.writes(suffix));
            }
        }
    });

    it('some scopes declare runtime properties', () => {
        expect(declaring.length).toBeGreaterThan(0);
    });

    it.each(declaring)('%s: each declared name is written', (scope) => {
        const source = sourcesOf(scope);
        const written = new Set([
            ...[...source.matchAll(/'(--[a-z0-9-]+)'/g)].map((m) => m[1]!),
            ...prefixedWrites(source),
        ]);
        for (const name of anatomies[scope as keyof typeof anatomies].runtimeProperties!) {
            expect(written.has(name), `${scope}: "${name}" is declared but no source under components/${scope}/ writes it`).toBe(true);
        }
    });
});
