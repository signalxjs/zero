/**
 * `sigx zero:extend` — adopting packs against an already-published design
 * system.
 *
 * `runExtend` itself is not reachable here (it dynamic-imports the installed
 * design system's built entry, which vite's module runner cannot load), so
 * this covers the two pieces that decide whether its output is correct: which
 * scopes reach the stylesheet, and how the design system's entry is found at
 * all.
 *
 * The register module is written as a `.js`/`.d.ts` PAIR, the same shape a
 * design system's own `/register` ships — the declaration does the work and
 * the runtime file exists so the specifier resolves. Emitting the
 * declaration alone made the command's own advice ("import this instead")
 * impossible to follow.
 *
 * The third piece needs no test of its own. The register module it writes is
 * `compileRegisterDts` over the same composition zero-basic's own build
 * produces, and the emitted file is byte-identical to
 * `packages/zero/type-tests/ecosystem/basic-ext.register.d.ts` — which
 * `pnpm test:types` already compiles in an isolated project. That identity is
 * the reason a replacement register works at all, and it is checked where it
 * was already being checked.
 */
import { describe, expect, it } from 'vitest';
import { exportedSubpath } from '@sigx/zero-kit';
import { extendedCss } from '../src/commands/extend.js';

describe('extendedCss', () => {
    const compiled = {
        componentCss: {
            'button': '@layer zero.recipes {\n[data-scope="button"] { color: red; }\n}',
            'acme-stepper': '@layer zero.recipes {\n[data-scope="acme-stepper"] { display: flex; }\n}',
        },
    };

    it('carries the added scopes and nothing the design system already ships', () => {
        const css = extendedCss(compiled, ['acme-stepper'], 'daisyui');
        expect(css).toContain('acme-stepper');
        expect(css).not.toContain('data-scope="button"');
        // No tokens.css: re-emitting it would duplicate the design system's
        // own `@property` registrations.
        expect(css).not.toContain('@property');
        expect(css).toMatch(/^\/\* daisyui \+ 1 ecosystem scope\(s\)/);
    });

    it('writes an honest empty stylesheet when nothing was added', () => {
        // The command does NOT bail out on an empty set: overwriting is how a
        // pack removed since the last run stops being declared. The file has
        // to be valid and carry no scopes.
        const css = extendedCss(compiled, [], 'daisyui');
        expect(css).not.toContain('data-scope');
        expect(css).toMatch(/^\/\* daisyui \+ 0 ecosystem scope\(s\)/);
    });

    it('keeps each scope self-layered, so import order does not matter', () => {
        expect(extendedCss(compiled, ['acme-stepper'], 'x')).toContain('@layer zero.recipes {');
    });
});

describe('exportedSubpath', () => {
    it('resolves a subpath an ESM package declares with types and import only', () => {
        // The whole reason this exists: `createRequire().resolve()` asks for
        // the `require` condition, which such a package never declares — the
        // same dead end that makes `"sigx-zero".fragment` carry a path.
        const pkg = {
            exports: {
                '.': { types: './dist/index.d.ts', import: './dist/index.js' },
                './design-system': { types: './dist/design-system.d.ts', import: './dist/design-system.js' },
            },
        };
        expect(exportedSubpath(pkg, './design-system')).toBe('./dist/design-system.js');
        expect(exportedSubpath(pkg, '.')).toBe('./dist/index.js');
    });

    it('reports an undeclared subpath as unreachable rather than guessing', () => {
        const pkg = { exports: { '.': './dist/index.js' }, main: './dist/index.js' };
        expect(exportedSubpath(pkg, './design-system')).toBeUndefined();
    });

    it('reads the shorthand forms', () => {
        expect(exportedSubpath({ exports: './only.js' }, '.')).toBe('./only.js');
        expect(exportedSubpath({ exports: './only.js' }, './design-system')).toBeUndefined();
        // A bare conditions object is the root, and declares no subpaths.
        expect(exportedSubpath({ exports: { import: './root.js' } }, '.')).toBe('./root.js');
        expect(exportedSubpath({ exports: { import: './root.js' } }, './design-system')).toBeUndefined();
    });

    it('says nothing when there is no exports map at all', () => {
        expect(exportedSubpath({ main: './dist/index.js' }, '.')).toBeUndefined();
    });
});
