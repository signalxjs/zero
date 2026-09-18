/**
 * Presence — enter and exit animation — is declarative here, not a runtime
 * behavior.
 *
 * Zero never unmounts a popup: every popup component keeps its node mounted
 * and toggles `data-state`, and Collapsible/Accordion are native `<details>`.
 * That is exactly what the platform needs, so an exit animation is a recipe
 * concern. Measured in Chrome before any of this was written — a `<dialog>`
 * whose `.close()` is called synchronously still renders and animates for the
 * length of an `overlay`/`display` transition marked `allow-discrete`.
 *
 * These tests hold the shape in place. The half that silently breaks is the
 * exit: an entry animation works with `@starting-style` alone, so a popup can
 * look animated while its close is instant.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem, validateDesignSystem, BUILTIN_CONDITIONS } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basic } from '@sigx/zero-basic';
import { designSystem as daisyui } from '@sigx/zero-daisyui';
import { designSystem as material } from '@sigx/zero-material';
import { designSystem as brutalist } from '@sigx/zero-brutalist';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

/** Every component whose popup lives in the top layer. */
const POPUPS = ['dialog', 'popover', 'menu', 'select', 'tooltip'] as const;
/** Native `<details>`, where the animated element is `::details-content`. */
const DISCLOSURES = ['collapsible', 'accordion'] as const;

const SYSTEMS = [
    ['basic', basic],
    ['daisyui', daisyui],
    ['material', material],
    ['brutalist', brutalist],
] as const;

describe('the starting-style condition', () => {
    it('is a built-in, so it is spellable and discoverable', () => {
        expect(BUILTIN_CONDITIONS['starting-style']).toBe('@starting-style');
    });

    it('emits after the rule it interpolates from', () => {
        // `@starting-style` supplies the before-change style for the open
        // state, so it has to follow the open rule in source order.
        const ds = {
            name: 'probe',
            tokens: basic.tokens,
            recipes: [{
                component: 'popover',
                parts: {
                    popup: {
                        base: { transition: 'opacity 1ms, display 1ms allow-discrete' },
                        states: { open: { opacity: '1' } },
                        at: { 'starting-style': { states: { open: { opacity: '0' } } } },
                    },
                },
            } as RecipeInput],
        } as DesignSystemInput;
        const css = compileDesignSystem(ds, manifest).componentCss.popover!;
        expect(css.indexOf('@starting-style')).toBeGreaterThan(css.indexOf('opacity: 1;'));
    });

    it('puts the raw `@starting-style` spelling in the same place', () => {
        // Both spellings are documented, so they have to behave identically.
        // As a plain raw prelude the entry rule would sort first and could
        // precede the breakpoint rule it needs to interpolate from.
        const popup = (key: string) => ({
            base: { transition: 'opacity 1ms, display 1ms allow-discrete' },
            at: {
                [key]: { states: { open: { opacity: '0' } } },
                sm: { states: { open: { opacity: '1' } } },
            },
        });
        const css = (key: string) => compileDesignSystem({
            name: 'probe',
            tokens: basic.tokens,
            recipes: [{ component: 'popover', parts: { popup: popup(key) } } as RecipeInput],
        } as DesignSystemInput, manifest).componentCss.popover!;
        for (const key of ['starting-style', '@starting-style']) {
            const out = css(key);
            expect(out.indexOf('@starting-style'), key).toBeGreaterThan(out.indexOf('@media (min-width'));
        }
    });
});

describe.each(SYSTEMS)('%s animates presence', (name, ds) => {
    const compiled = compileDesignSystem(ds as DesignSystemInput, manifest);

    it.each(POPUPS)('gives the %s popup both directions', (component) => {
        const css = compiled.componentCss[component]!;
        // The entry half.
        expect(css, 'no @starting-style, so the popup appears at its open value').toContain('@starting-style');
        // The exit half — the one that silently doesn't happen. Without
        // `allow-discrete` the element stops being rendered immediately and
        // the transition never gets a frame.
        expect(css, 'no allow-discrete, so the exit is instant').toMatch(/display [^;]*allow-discrete/);
        expect(css, 'a top-layer popup also needs `overlay`').toMatch(/overlay [^;]*allow-discrete/);
    });

    it.each(POPUPS)('collapses the %s popup under reduced motion', (component) => {
        const css = compiled.componentCss[component]!;
        const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
        expect(reduced).toContain('transition: none');
    });

    it.each(DISCLOSURES)('animates the %s panel through ::details-content', (component) => {
        const css = compiled.componentCss[component]!;
        // `interpolate-size` is what makes `auto` a legal transition endpoint;
        // it is set on the element rather than globally so nothing outside
        // this design system changes behaviour.
        expect(css).toContain('interpolate-size: allow-keywords');
        expect(css).toContain('::details-content');
        expect(css).toMatch(/block-size [^;]*(var\(--duration|\d)/);
    });

    it('drives every duration from a token, so reduced motion reaches it', () => {
        for (const component of [...POPUPS, ...DISCLOSURES]) {
            const transitions = compiled.componentCss[component]!.match(/transition: [^;]+;/g) ?? [];
            for (const value of transitions) {
                if (value.includes('none')) continue;
                expect(value, `${name}/${component}: literal duration`).toContain('var(--duration-');
            }
        }
    });
});

describe('the validator catches a half-animated popup', () => {
    const recipe = (popup: Record<string, unknown>): DesignSystemInput => ({
        name: 'probe',
        tokens: basic.tokens,
        recipes: [{ component: 'popover', parts: { popup } } as RecipeInput],
    } as DesignSystemInput);

    const warnings = (ds: DesignSystemInput): string[] =>
        validateDesignSystem(ds, manifest).warnings.map((w) => w.message);

    it('warns when starting styles have no transition to interpolate', () => {
        const messages = warnings(recipe({
            base: { opacity: '0' },
            states: { open: { opacity: '1' } },
            at: { 'starting-style': { states: { open: { opacity: '0' } } } },
        }));
        expect(messages.some((m) => m.includes('never transitions'))).toBe(true);
    });

    it('warns when the entry animates and the exit cannot', () => {
        const messages = warnings(recipe({
            base: { opacity: '0', transition: 'opacity var(--duration-fast) var(--ease-standard)' },
            states: { open: { opacity: '1' } },
            at: { 'starting-style': { states: { open: { opacity: '0' } } } },
        }));
        expect(messages.some((m) => m.includes('the exit will not'))).toBe(true);
    });

    it('says nothing when both halves are there', () => {
        const messages = warnings(recipe({
            base: {
                opacity: '0',
                transition: 'opacity var(--duration-fast) var(--ease-standard), '
                    + 'display var(--duration-fast) allow-discrete, overlay var(--duration-fast) allow-discrete',
            },
            states: { open: { opacity: '1' } },
            at: { 'starting-style': { states: { open: { opacity: '0' } } } },
        }));
        expect(messages.filter((m) => m.includes('starting-style'))).toEqual([]);
    });

    it('sees starting styles nested under another condition', () => {
        // A responsive entry animation puts them under the breakpoint; it
        // needs the exit half just as much as a flat one does.
        const messages = warnings(recipe({
            base: { opacity: '0' },
            at: {
                sm: {
                    base: { transition: 'opacity var(--duration-fast) var(--ease-standard)' },
                    at: { 'starting-style': { states: { open: { opacity: '0' } } } },
                },
            },
        }));
        expect(messages.some((m) => m.includes('the exit will not'))).toBe(true);
    });

    it('is not satisfied by allow-discrete over continuous properties alone', () => {
        // `transition-behavior` applies to the properties actually listed. If
        // none of them is discrete, nothing keeps the element rendered and the
        // exit is still instant — so the warning must survive this shape.
        const messages = warnings(recipe({
            base: {
                opacity: '0',
                transition: 'opacity var(--duration-fast) var(--ease-standard)',
                transitionBehavior: 'allow-discrete',
            },
            states: { open: { opacity: '1' } },
            at: { 'starting-style': { states: { open: { opacity: '0' } } } },
        }));
        expect(messages.some((m) => m.includes('the exit will not'))).toBe(true);
    });

    it('accepts the two halves written as separate declarations', () => {
        const messages = warnings(recipe({
            base: {
                opacity: '0',
                transition: 'opacity var(--duration-fast) var(--ease-standard), display var(--duration-fast)',
                transitionBehavior: 'allow-discrete',
            },
            states: { open: { opacity: '1' } },
            at: { 'starting-style': { states: { open: { opacity: '0' } } } },
        }));
        expect(messages.filter((m) => m.includes('starting-style'))).toEqual([]);
    });

    it('sees starting styles declared by a variant', () => {
        const messages = validateDesignSystem({
            name: 'probe',
            tokens: basic.tokens,
            recipes: [{
                component: 'popover',
                parts: { popup: { base: { transition: 'opacity var(--duration-fast) var(--ease-standard)' } } },
                variants: {
                    size: {
                        lg: { popup: { at: { 'starting-style': { states: { open: { opacity: '0' } } } } } },
                    },
                },
            } as RecipeInput],
        } as DesignSystemInput, manifest).warnings.map((w) => w.message);
        expect(messages.some((m) => m.includes('the exit will not'))).toBe(true);
    });

    it('says nothing about a part that never asks for an entry animation', () => {
        // The rules key on `starting-style`, so a plain unanimated popup — or
        // any other part — is not nagged into animating.
        const messages = warnings(recipe({ base: { padding: '1rem' } }));
        expect(messages.filter((m) => m.includes('starting-style'))).toEqual([]);
    });
});
