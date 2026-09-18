/**
 * The lynx token emitter (#351): baked literals on class hosts, capability
 * verdicts, and the structural gate that makes "capability-safe" a property
 * of the artifact rather than of reviewer attention — the compile-time
 * analogue of the lynx repo's on-device css-engine probe.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    hasComparisonFunction,
    hasUnsupportedColorFunction,
    bakeColorValue,
    bakeColor,
    bakeSoft,
    compileLynxTokensCss,
    emptyReport,
    runtimePropertyIn,
    STRUCTURAL_FALLBACKS,
} from '../src/targets/lynx/index.js';
import type { TokensInput } from '../src/tokens.js';
import { tokens as basicTokens } from '@sigx/zero-basic';
import { tokens as daisyTokens } from '@sigx/zero-daisyui';

/**
 * What lynx's engine cannot parse and this target must therefore never emit.
 * One list, applied to every compiled artifact below — a new emission path
 * that leaks a web-ism fails here by construction.
 */
const FORBIDDEN = [
    /@layer/, /@property/, /@starting-style/, /@media/, /@supports/,
    /light-dark\(/, /oklch\(/, /oklab\(/, /color-mix\(/, /\bmin\(/, /\bmax\(/, /clamp\(/,
    /:root/, /\[data-/,
    // currentColor never resolves on lynx — measured on device on both
    // platforms (signalxjs/lynx#1079); a token carrying it would make every
    // consumer silently paint nothing.
    /currentcolor/i,
    // Logical inset/margin/padding spellings and the standalone
    // translate/rotate/scale properties resolve on iOS but not on Android
    // (measured, signalxjs/lynx#1084) — refused by the recipe emitter, and
    // no token emission path may leak them either. Anchored so a custom
    // property name (`--tw-translate: …`) cannot trip the gate.
    /(?:^|[\s{;])(?:inset|margin|padding)-(?:block|inline)/im,
    /(?:^|[\s{;])(?:translate|rotate|scale)\s*:/im,
] as const;

function expectLynxSafe(css: string): void {
    for (const pattern of FORBIDDEN) {
        expect(css).not.toMatch(pattern);
    }
    // Every selector is a class chain — nothing else can select on lynx.
    for (const line of css.split('\n')) {
        if (!line.endsWith('{')) continue;
        expect(line.trim()).toMatch(/^\.[A-Za-z0-9_.-]+(\s*\.[A-Za-z0-9_.-]+)*\s*\{$/);
    }
}

describe('capability primitives', () => {
    it('bakes color functions to literals', () => {
        expect(bakeColor('oklch(45% 0.24 277.023)', 'test')).toMatch(/^#[0-9a-f]{6}$/);
        expect(bakeColor('#123456', 'test')).toBe('#123456');
        expect(bakeColor('rgba(0, 0, 0, 0.5)', 'test')).toMatch(/^#[0-9a-f]{8}$/);
    });

    it('rejects a value nothing can bake', () => {
        expect(() => bakeColor('var(--nope)', 'tokens theme "x"')).toThrow(/cannot resolve/);
        expect(() => bakeColor('0 0 8px oklch(45% 0.1 200)', 'tokens')).toThrow(/cannot resolve/);
    });

    it('derives soft tints with the same oklab mix as the web target', () => {
        const soft = bakeSoft('#422ad5', '#ffffff', 0.16, 'test');
        expect(soft).toMatch(/^#[0-9a-f]{6}$/);
        expect(soft).not.toBe('#422ad5');
        expect(soft).not.toBe('#ffffff');
    });

    it('spots runtime-published properties in either spelling', () => {
        expect(runtimePropertyIn('var(--press-x)')).toBe('--press-x');
        expect(runtimePropertyIn('translate(var(--press-x), var(--press-y))')).toBe('--press-x');
        expect(runtimePropertyIn('--progress-percent: 0')).toBe('--progress-percent');
        // A property that merely CONTAINS one as a substring is not a match.
        expect(runtimePropertyIn('var(--press-xylophone)')).toBeUndefined();
        expect(runtimePropertyIn('var(--color-primary)')).toBeUndefined();
    });
});

describe('compileLynxTokensCss', () => {
    it('compiles zero-basic to lynx-safe, literal, class-hosted tokens', () => {
        const report = emptyReport();
        const css = compileLynxTokensCss(basicTokens as TokensInput, report);
        expectLynxSafe(css);
        expect(css).toContain('.zx-root {');
        // Every theme gets a compound block on the host class.
        for (const name of Object.keys((basicTokens as TokensInput).themes)) {
            expect(css).toContain(`.zx-root.zx-theme-${name} {`);
        }
        // Colors are hex literals.
        expect(css).toMatch(/--color-primary: #[0-9a-f]{6}/);
        // Soft tints are baked, not live color-mix.
        expect(css).toMatch(/--color-primary-soft: #[0-9a-f]{6}/);
        // The fixed-text aliases are literals, not var() indirection.
        const fixed = /--text-fixed-sm: ([^;]+);/.exec(css);
        expect(fixed).not.toBeNull();
        expect(fixed![1]).not.toContain('var(');
    });

    it('compiles zero-daisyui (oklch source) to lynx-safe output', () => {
        const report = emptyReport();
        const css = compileLynxTokensCss(daisyTokens as TokensInput, report);
        expectLynxSafe(css);
        expect(css).toContain('.zx-root {');
        expect(css).toMatch(/--color-primary: #[0-9a-f]{6}/);
    });

    it('pins the emitted shape (golden)', () => {
        const css = compileLynxTokensCss(basicTokens as TokensInput, emptyReport());
        expect(css).toMatchSnapshot();
    });

    it('rejects a token that references a runtime-published property', () => {
        const input: TokensInput = {
            defaultLight: 'l',
            themes: {
                l: {
                    colorScheme: 'light',
                    colors: { 'base-100': '#ffffff', 'base-content': '#111111' },
                    extra: { '--glow': 'circle at var(--press-x) var(--press-y)' },
                },
            },
        };
        expect(() => compileLynxTokensCss(input, emptyReport())).toThrow(/--press-x.*web-only/s);
    });

    it('inlines non-color var() chains and keeps color references live', () => {
        const input: TokensInput = {
            defaultLight: 'l',
            themes: {
                l: {
                    colorScheme: 'light',
                    colors: { 'base-100': '#ffffff', 'base-content': '#111111' },
                    extra: {
                        '--ring-width': '2px',
                        '--ring': '0 0 0 var(--ring-width) var(--color-primary)',
                    },
                },
            },
        };
        const css = compileLynxTokensCss(input, emptyReport());
        expect(css).toContain('--ring: 0 0 0 2px var(--color-primary);');
    });

    it('reports an unresolvable non-color var() instead of silently keeping it', () => {
        const report = emptyReport();
        const input: TokensInput = {
            defaultLight: 'l',
            themes: {
                l: {
                    colorScheme: 'light',
                    colors: { 'base-100': '#ffffff', 'base-content': '#111111' },
                    extra: { '--pad': 'var(--app-defined)' },
                },
            },
        };
        compileLynxTokensCss(input, report);
        expect(report.dropped.some((f) => f.what.includes('--pad'))).toBe(true);
    });

    it('drops a token valued with currentColor — it never resolves on device', () => {
        // signalxjs/lynx#1079: currentColor paints nothing on either
        // platform, so a token carrying it would break every consumer.
        const report = emptyReport();
        const input: TokensInput = {
            defaultLight: 'l',
            themes: {
                l: {
                    colorScheme: 'light',
                    colors: { 'base-100': '#ffffff', 'base-content': '#111111' },
                    extra: { '--underline': '0 0 0 2px currentColor' },
                },
            },
        };
        const css = compileLynxTokensCss(input, report);
        expect(css).not.toMatch(/currentcolor/i);
        expect(report.dropped.some((f) => f.what.includes('--underline') && f.detail.includes('currentColor'))).toBe(true);
    });

    it('rejects a theme name that cannot be a class', () => {
        const input: TokensInput = {
            defaultLight: 'ok',
            themes: {
                'ok': { colorScheme: 'light', colors: { 'base-100': '#fff', 'base-content': '#111' } },
                'Bad Name': { colorScheme: 'dark', colors: { 'base-100': '#000', 'base-content': '#eee' } },
            },
        };
        expect(() => compileLynxTokensCss(input, emptyReport())).toThrow(/not a kebab-case identifier/);
    });
});

/**
 * Lynx has no `@layer` and no base stylesheet, so the structural fallbacks
 * `@sigx/zero`'s `css/base.css` provides on the web are emitted into
 * `tokens.css` instead. Two copies of the same numbers is a drift risk, so
 * this reads the real `base.css` and pins them equal.
 */
describe('structural fallbacks', () => {
    // Resolved through the package graph rather than a relative path — the
    // point is to read the base.css that actually ships (`./css` is the
    // subpath `@sigx/zero` exports it under).
    const baseCss = readFileSync(
        createRequire(join(process.cwd(), 'noop.js')).resolve('@sigx/zero/css'),
        'utf8',
    );

    it.each(Object.entries(STRUCTURAL_FALLBACKS))('%s matches base.css', (prop, value) => {
        expect(baseCss).toContain(`${prop}: ${value};`);
    });

    it('emits them ahead of the design system, so a declared token wins', () => {
        const css = compileLynxTokensCss(daisyTokens as TokensInput, emptyReport());
        const root = css.slice(0, css.indexOf('}'));
        // daisyUI declares no text ramp at all — without the fallback every
        // `font-size: var(--text-sm)` in its recipes reads a property nothing
        // defines, and on lynx that declaration simply never applies
        // (signalxjs/lynx#1029).
        expect(root).toContain('--text-sm: 0.875rem;');
        expect(root.indexOf('--text-sm')).toBeLessThan(root.indexOf('--color-primary'));
    });
});

describe('color-function detection stays in lockstep with baking', () => {
    // Copilot caught hwb( bakeable but undetected (#354): a function only one
    // of the two lists knows either leaks unbaked into emitted CSS or bakes
    // without ever being flagged. Pin every name behaviorally.
    const FUNCTIONS: [string, string][] = [
        ['oklch', 'oklch(45% 0.24 277)'],
        ['oklab', 'oklab(0.45 0.1 -0.2)'],
        ['lch', 'lch(45% 30 270)'],
        ['lab', 'lab(45% 20 -30)'],
        ['color-mix', 'color-mix(in oklab, #ff0000 40%, #0000ff)'],
        ['light-dark', 'light-dark(#ffffff, #000000)'],
        ['color', 'color(srgb 0.2 0.4 0.6)'],
        ['hwb', 'hwb(200 10% 20%)'],
    ];
    it.each(FUNCTIONS)('%s is detected and bakes to a literal', (_name, value) => {
        expect(hasUnsupportedColorFunction(`0 0 4px ${value}`)).toBe(true);
        const baked = bakeColorValue(`0 0 4px ${value}`, {}, 'light', 'test');
        expect(baked).toMatch(/^0 0 4px #[0-9a-f]{6,8}$/);
        expect(hasUnsupportedColorFunction(baked)).toBe(false);
    });

    // CSS function names are ASCII case-insensitive, so an author's `OKLCH(…)`
    // or `Min(…)` is the same function a browser sees — and would otherwise
    // walk straight past a case-sensitive gate into the emitted stylesheet.
    it.each(FUNCTIONS)('%s is detected whatever its case', (_name, value) => {
        expect(hasUnsupportedColorFunction(value.toUpperCase())).toBe(true);
        const baked = bakeColorValue(value.toUpperCase(), {}, 'light', 'test');
        expect(baked).toMatch(/^#[0-9a-f]{6,8}$/);
    });

    it.each(['min(1px, 2px)', 'max(1px, 2px)', 'clamp(1px, 2px, 3px)'])(
        '%s is detected whatever its case',
        (value) => {
            expect(hasComparisonFunction(value)).toBe(true);
            expect(hasComparisonFunction(value.toUpperCase())).toBe(true);
        },
    );

    it('does not mistake a longer identifier for a comparison function', () => {
        expect(hasComparisonFunction('width: minmax(1px, 2px)')).toBe(false);
        expect(hasComparisonFunction('--my-max: 4px')).toBe(false);
    });
});
