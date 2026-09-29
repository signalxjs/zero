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
 * Both directions (#538). Declared → written, above; and written →
 * declared: every custom property a component directory's sources write —
 * an inline style key (`'--table-cell-align': …`) or a
 * `style.setProperty('--x', …)` — must be in the `runtimeProperties` of an
 * anatomy that directory's own `anatomy.ts` exports. An undeclared write is
 * a name a recipe reads on faith: nothing tells a lynx build it is
 * web-only, and nothing in the manifest tells a design system it exists.
 *
 * The shared behaviors stay out of the reverse check. Their writes are not
 * a scope's: `position.ts` publishes the anchored-position properties
 * (`--available-width`, `--arrow-x`, …) on every popup of every scope, and
 * `press.ts` the `--press-*` point on any pressable part — contract-level
 * names the kit carries itself, not per-anatomy declarations.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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

/**
 * A custom property written by a source: a style-object key or a
 * `setProperty` call. A plain `'--x'` literal elsewhere (a doc comment, a
 * lookup) is not a write, so the key form needs the colon.
 */
const WRITE_PATTERNS = [
    /'(--[a-z0-9-]+)'\s*:/g,
    /\.setProperty\(\s*'(--[a-z0-9-]+)'/g,
];

function writesOf(source: string): string[] {
    return [...new Set(WRITE_PATTERNS.flatMap((re) => [...source.matchAll(re)].map((m) => m[1]!)))];
}

/** Every component directory, with the runtime properties its own anatomies declare. */
const directories = await Promise.all(
    readdirSync(componentsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map(async (d) => {
            const anatomyFile = resolve(componentsDir, d.name, 'anatomy.ts');
            const declared = new Set<string>();
            if (existsSync(anatomyFile)) {
                const mod: Record<string, unknown> = await import(pathToFileURL(anatomyFile).href);
                for (const value of Object.values(mod)) {
                    const list = (value as { runtimeProperties?: readonly string[] } | null)?.runtimeProperties;
                    for (const name of list ?? []) declared.add(name);
                }
            }
            return { dir: d.name, declared, writes: writesOf(sourcesOf(d.name)) };
        }),
);

describe('every custom property a component writes is declared by its anatomy (#538)', () => {
    it('the scrape finds the known writers', () => {
        // Guards the patterns themselves: a regex that matched nothing would
        // pass every row below.
        const writers = directories.filter((d) => d.writes.length > 0).map((d) => d.dir).sort();
        expect(writers).toEqual(expect.arrayContaining(['progress', 'slider', 'table', 'tabs', 'textarea', 'toast']));
    });

    it.each(directories.filter((d) => d.writes.length > 0).map((d) => [d.dir, d] as const))('%s: each written name is declared', (dir, d) => {
        for (const name of d.writes) {
            expect(d.declared.has(name), `components/${dir}/ writes "${name}", which no anatomy in components/${dir}/anatomy.ts declares in runtimeProperties`).toBe(true);
        }
    });
});
