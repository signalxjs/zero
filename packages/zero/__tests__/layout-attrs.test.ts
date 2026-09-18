/**
 * The layout pass-through and its parse. Both are cross-package contracts —
 * the kit mirrors them and `contract-parity.test.ts` holds the copies
 * together — so the behavior is pinned here rather than inferred from the
 * components that will use it.
 */
import { describe, expect, it } from 'vitest';
import {
    LAYOUT_ATTR_PREFIX,
    LAYOUT_VOCABULARY,
    SPACE_STEPS,
    layoutAttrs,
    layoutAttrSpec,
    parseLayoutAttr,
} from '../src/contract/index.js';

const ALL = Object.keys(LAYOUT_VOCABULARY);

describe('layoutAttrs', () => {
    it('renders a bare value as one prefixed attribute', () => {
        expect(layoutAttrs({ gap: 'md' }, ['gap'])).toEqual({ 'data-l-gap': 'md' });
    });

    it('stringifies numbers, because `cols={4}` is how this gets written', () => {
        expect(layoutAttrs({ cols: 4 }, ['cols'])).toEqual({ 'data-l-cols': '4' });
    });

    it('expands a responsive record, with `base` unqualified', () => {
        expect(layoutAttrs({ gap: { base: 'sm', md: 'lg' } }, ['gap'])).toEqual({
            'data-l-gap': 'sm',
            'data-l-md-gap': 'lg',
        });
    });

    it('allows a record with no `base` — vary only above a breakpoint', () => {
        expect(layoutAttrs({ cols: { lg: 3 } }, ['cols'])).toEqual({ 'data-l-lg-cols': '3' });
    });

    it('skips undefined before the guards, so an unset optional prop is inert', () => {
        expect(layoutAttrs({ gap: undefined }, [])).toEqual({});
        expect(layoutAttrs({ gap: { base: undefined, md: 'lg' } }, ['gap']))
            .toEqual({ 'data-l-md-gap': 'lg' });
    });

    // Three throwing guards, all for `variantAttrs`' reason: the value comes
    // from application code, and a silently missing attribute is the exact
    // failure this mechanism exists to remove.
    it('names an unknown attribute rather than dereferencing nothing', () => {
        // Reachable through a typo'd anatomy: `defineAnatomy` carries no
        // runtime guard, so `layout: ['gutter']` satisfies the declared check
        // and used to fail with "cannot read properties of undefined".
        expect(() => layoutAttrs({ gutter: 'md' } as never, ['gutter']))
            .toThrow(/"gutter" is not a layout attribute/);
        expect(() => layoutAttrs({ gutter: 'md' } as never, []))
            .toThrow(/"gutter" is not a layout attribute/);
    });

    it('throws on an attribute the part does not declare', () => {
        expect(() => layoutAttrs({ gap: 'md' }, ['pad']))
            .toThrow(/does not declare "gap"/);
    });

    it('throws on a value outside the closed set', () => {
        // `as never` throughout this block: the prop types now make these
        // shapes uncompilable, which is the better half of the contract —
        // but the runtime guard still has to hold for an untyped caller.
        expect(() => layoutAttrs({ gap: 'roomy' } as never, ['gap']))
            .toThrow(/"roomy" is not a value of "gap"/);
    });

    it('throws when a non-responsive attribute is given a record', () => {
        expect(() => layoutAttrs({ wrap: { md: 'wrap' } } as never, ['wrap']))
            .toThrow(/does not vary per breakpoint/);
        // Including a record that names only `base`. It resolves to no
        // breakpoint, so a per-key check let it through — and the message
        // says "pass a single value rather than a record", which has to mean
        // every record or it means nothing.
        expect(() => layoutAttrs({ wrap: { base: 'wrap' } } as never, ['wrap']))
            .toThrow(/does not vary per breakpoint/);
    });

    it('throws on a breakpoint key that is not kebab-case', () => {
        // The key becomes part of an attribute NAME. `data-*` names are
        // case-sensitive and the lynx class grammar carries them unescaped,
        // so `Md` would render an attribute nothing matches — silently,
        // which is the whole failure mode this module removes.
        expect(() => layoutAttrs({ gap: { Md: 'lg' } } as never, ['gap']))
            .toThrow(/not a kebab-case breakpoint name/);
        expect(() => layoutAttrs({ gap: { 'md!': 'lg' } } as never, ['gap']))
            .toThrow(/not a kebab-case breakpoint name/);
    });

    it('rejects an array rather than reading it as a breakpoint record', () => {
        // Two ways this goes wrong, which is why the rejection is explicit
        // rather than a fallthrough. Read as a record, `gap={['md']}` becomes
        // `data-l-0-gap="md"` — an attribute named after an array index.
        // Read as a bare value it is worse: `String(['md'])` is `'md'`, so a
        // ONE-element array quietly emits a valid attribute while a
        // two-element one throws. `Responsive<T>` admits neither, so this
        // guards the untyped caller only.
        expect(() => layoutAttrs({ gap: ['md'] } as never, ['gap']))
            .toThrow(/not an array/);
        expect(() => layoutAttrs({ gap: ['md', 'lg'] } as never, ['gap']))
            .toThrow(/not an array/);
    });
});

describe('parseLayoutAttr', () => {
    it('round-trips every attribute in the vocabulary, bare and per-breakpoint', () => {
        for (const attr of ALL) {
            expect(parseLayoutAttr(`${LAYOUT_ATTR_PREFIX}${attr}`)).toEqual({ attr });
            const responsive = layoutAttrSpec(attr as never).responsive;
            expect(parseLayoutAttr(`${LAYOUT_ATTR_PREFIX}md-${attr}`))
                .toEqual(responsive ? { attr, breakpoint: 'md' } : undefined);
        }
    });

    it('prefers the whole name over a split, which is what keeps `gap-x` unambiguous', () => {
        // The trap this guards: split-first would read `gap-x` as breakpoint
        // `gap` + attribute `x`, and `gap-x` is a real attribute.
        expect(parseLayoutAttr('data-l-gap-x')).toEqual({ attr: 'gap-x' });
    });

    it('parses a breakpoint name containing a hyphen', () => {
        // The kit holds breakpoint names to TOKEN_KEY_PATTERN, the same
        // grammar that allows `gap-x`, so `tablet-lg` is legal. Splitting at
        // the FIRST hyphen read this as breakpoint `tablet` + attribute
        // `lg-gap` and rejected it — while `layoutAttrs` happily emitted it,
        // so emit and parse disagreed about the same name.
        expect(parseLayoutAttr('data-l-tablet-lg-gap')).toEqual({ attr: 'gap', breakpoint: 'tablet-lg' });
        expect(layoutAttrs({ gap: { 'tablet-lg': 'xl' } } as never, ['gap']))
            .toEqual({ 'data-l-tablet-lg-gap': 'xl' });
    });

    it('anchors on the LONGEST attribute suffix', () => {
        // `md-gap-x` must resolve to the attribute `gap-x` and not stop at
        // `gap`, which would leave a breakpoint of `md-gap`. `gap-x` is not
        // responsive, so the honest answer here is "no interpretation".
        expect(parseLayoutAttr('data-l-md-gap-x')).toBeUndefined();
        expect(parseLayoutAttr('data-l-gap-x')).toEqual({ attr: 'gap-x' });
    });

    it('refuses `base` as a breakpoint, since that key means "unqualified"', () => {
        // `{ base: 'md' }` renders `data-l-gap="md"`, so `data-l-base-gap` is
        // a name layoutAttrs can never write. Parsing it would let
        // expectAnatomy pass a render no stylesheet targets.
        expect(parseLayoutAttr('data-l-base-gap')).toBeUndefined();
        expect(layoutAttrs({ gap: { base: 'md' } }, ['gap'])).toEqual({ 'data-l-gap': 'md' });
    });

    it('refuses a breakpoint the emitter would refuse to write', () => {
        // Both halves of the round trip answer to one grammar, or a name
        // exists that renders but cannot be read back.
        expect(parseLayoutAttr('data-l-Md-gap')).toBeUndefined();
    });

    it('accepts a breakpoint name that starts with a digit', () => {
        // Token keys may lead with a digit (`--text-2xl`), so a design system
        // may legitimately name a breakpoint `2xl`.
        expect(parseLayoutAttr('data-l-2xl-gap')).toEqual({ attr: 'gap', breakpoint: '2xl' });
    });

    it('returns undefined for anything that is not ours', () => {
        for (const name of ['data-color', 'data-state', 'data-l-', 'data-l-gutter', 'gap', '']) {
            expect(parseLayoutAttr(name), name).toBeUndefined();
        }
    });
});

describe('the vocabulary itself', () => {
    it('spells the spacing ramp exactly as the token contract recommends', () => {
        // The two must agree or `gap="2xl"` resolves to a `--space-2xl` no
        // design system was ever asked to declare.
        expect([...SPACE_STEPS]).toEqual(['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl']);
        for (const attr of ['gap', 'gap-x', 'gap-y', 'pad', 'pad-x', 'pad-y', 'space']) {
            expect(layoutAttrSpec(attr as never).values, attr).toEqual([...SPACE_STEPS]);
        }
    });

    it('every value is attribute-selector- and class-safe', () => {
        // Values land in a quoted attribute selector on the web and in an
        // unescaped class name on lynx, so the alphabet has to survive both.
        for (const attr of ALL) {
            expect(attr).toMatch(/^[a-z][a-z0-9-]*$/);
            for (const value of layoutAttrSpec(attr as never).values) {
                expect(value, `${attr}=${value}`).toMatch(/^[a-z0-9][a-z0-9-]*$/);
            }
        }
    });

    it('declares no attribute whose name collides with a reserved axis', () => {
        // The prefix is what makes this true, and it is worth asserting: an
        // unprefixed family would have had to seize all of these names.
        const reserved = new Set(['scope', 'part', 'state', 'orientation']);
        for (const attr of ALL) expect(reserved.has(attr), attr).toBe(false);
    });
});
