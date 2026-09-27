/**
 * `rem` → `px` on the lynx target (signalxjs/lynx#1183).
 *
 * Lynx resolves `rem` against its 14px default page font size, so every
 * rem-based size a design system authored at the web's 16px drew 12.5% small
 * on device (daisy's md button measured 35pt instead of 40). The lynx
 * emitters rewrite every rem length to px at 16px/rem as their last pass.
 * Each test here fails if that pass is removed; the web output keeps its
 * rems (the web CSS goldens pin it byte for byte).
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import {
    LYNX_REM_PX,
    compileDesignSystemLynx,
    compileLynxRecipeCss,
    compileLynxTokensCss,
    emptyReport,
    remToPx,
} from '../src/targets/lynx/index.js';

const button = anatomies.button.toJSON() as ManifestComponent;
const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

/** Any rem length left in lynx CSS text. */
const REM = /(?<![\w.-])-?(?:\d+(?:\.\d*)?|\.\d+)rem(?![\w-])/i;

describe('remToPx', () => {
    it('rewrites at 16px per rem', () => {
        expect(LYNX_REM_PX).toBe(16);
        expect(remToPx('width: 10rem;').css).toBe('width: 160px;');
    });

    it('handles fractions, leading dots, negatives, zero and upper case', () => {
        const { css, count } = remToPx('a: 0.875rem; b: .5rem; c: -0.25rem; d: 0rem; e: 1.125REM; f: 0.1rem;');
        expect(css).toBe('a: 14px; b: 8px; c: -4px; d: 0px; e: 18px; f: 1.6px;');
        expect(count).toBe(6);
    });

    it('rewrites inside calc() and shorthands', () => {
        expect(remToPx('height: calc(var(--size-field, 0.25rem) * 10);').css)
            .toBe('height: calc(var(--size-field, 4px) * 10);');
        expect(remToPx('padding: 0 1rem 0.5rem calc(100% - 2rem);').css)
            .toBe('padding: 0 16px 8px calc(100% - 32px);');
        expect(remToPx('box-shadow: 0 0.125rem 0.25rem #0003;').css)
            .toBe('box-shadow: 0 2px 4px #0003;');
    });

    it('leaves identifiers, other units, url() and strings alone', () => {
        const untouched = [
            '--gap-2rem: 1px;',
            '.zx-a-size-2rem { width: 1px; }',
            'animation-name: p2rem;',
            'font-size: 1em; width: 2px; letter-spacing: 0.1ex;',
            'background-image: url(icons/1rem.png);',
            'content: "1rem";',
            "content: '0.5rem';",
        ];
        for (const text of untouched) {
            expect(remToPx(text)).toEqual({ css: text, count: 0 });
        }
    });

    it('keeps rewriting after a quoted data URI holding its own url(…)', () => {
        // daisy's --fx-noise: a `)` inside the quoted url must not end the
        // span early and leave a quote open that swallows the next block.
        const noise = `--fx-noise: url("data:image/svg+xml,%3Crect filter='url(%23a)' width='1rem'/%3E");`;
        const { css } = remToPx(`${noise}\n}\n.zx-root.zx-theme-dark {\n    --size-field: 0.25rem;\n}`);
        expect(css).toContain(noise);
        expect(css).toContain('--size-field: 4px;');
    });
});

describe('lynx tokens', () => {
    it('emit px where the source declares rem', () => {
        const report = emptyReport();
        const css = compileLynxTokensCss(daisyDS.tokens as TokensInput, report);
        expect(css).not.toMatch(REM);
        // daisy's field size — the unit its whole size ramp multiplies.
        expect(css).toContain('--size-field: 4px;');
        // The structural text ramp daisy reads its font sizes from.
        expect(css).toContain('--text-md: 16px;');
        expect(report.translated.some((f) => f.where === 'lynx tokens' && f.what.startsWith('rem lengths'))).toBe(true);
    });
});

describe('lynx recipes', () => {
    it('rewrite declarations, calc() operands, raw lynx css and keyframes', () => {
        const report = emptyReport();
        const css = compileLynxRecipeCss({
            component: 'button',
            parts: {
                root: {
                    base: {
                        paddingLeft: '1rem',
                        height: 'calc(var(--size-field, 0.25rem) * 10)',
                    },
                },
            },
            css: '.zx-button__root.zx-m-wide { max-width: 16rem; }',
            keyframes: { grow: 'from { width: 0rem; } to { width: 2.5rem; }' },
        }, button, report);
        expect(css).not.toMatch(REM);
        expect(css).toContain('padding-left: 16px;');
        expect(css).toContain('height: calc(var(--size-field, 4px) * 10);');
        expect(css).toContain('max-width: 256px;');
        expect(css).toContain('to { width: 40px; }');
        const finding = report.translated.find((f) => f.what.startsWith('rem lengths'));
        expect(finding?.where).toBe('lynx recipe for "button"');
        expect(finding?.what).toBe('rem lengths (5)');
    });

    it('record nothing for a recipe without rem', () => {
        const report = emptyReport();
        compileLynxRecipeCss({ component: 'button', parts: { root: { base: { width: '4px' } } } }, button, report);
        expect(report.translated.some((f) => f.what.startsWith('rem lengths'))).toBe(false);
    });
});

describe('whole skin', () => {
    it('zero-daisyui ships no rem on lynx, and keeps its rems on the web', () => {
        const lynx = compileDesignSystemLynx(daisyDS as never, manifest);
        expect(lynx.indexCss).not.toMatch(REM);
        // The md button: daisy's ramp is calc(var(--size-field) * 10), which
        // now resolves against a 4px field — 40px, the web's height.
        expect(lynx.tokensCss).toContain('--size-field: 4px;');

        const web = compileDesignSystem(daisyDS as never, manifest);
        expect(web.indexCss).toMatch(REM);
    });
});
