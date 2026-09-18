/**
 * The parity guard for the deliberately duplicated token contract.
 *
 * `@sigx/zero-kit` keeps its own copy of `@sigx/zero`'s token vocabulary
 * (`packages/zero-kit/src/contract.ts` vs
 * `packages/zero/src/contract/tokens.ts`) so the kit stays a pure Node tool
 * with no runtime dependency on zero. That duplication is only safe if
 * something fails when the copies drift — this file is that something.
 *
 * Three layers, because a hand-written list of things to compare is a list
 * that falls behind:
 *
 * 1. VALUE parity for every constant the two modules share.
 * 2. COMPLETENESS — the *set* of same-named exports shared by both modules
 *    must equal the table below, so adding a shared export without a table
 *    row fails here rather than silently going unguarded.
 * 3. SEMANTIC parity — the claims the constants encode still hold against
 *    zero's actual behavior, not just against a copied literal.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, it, expect } from 'vitest';
import * as zero from '@sigx/zero/contract';
import * as kit from '../src/contract.js';
import * as lynxGrammar from '../src/targets/lynx/class-names.js';
import { anatomies } from '@sigx/zero/anatomy';

/**
 * Constants that exist in both modules under the same name and must agree.
 * Keyed by export name so layer 2 can check this table is exhaustive.
 */
const SHARED: Record<string, [unknown, unknown]> = {
    RECOMMENDED_ROLE_LIST: [zero.RECOMMENDED_ROLE_LIST, kit.RECOMMENDED_ROLE_LIST],
    BASE_SURFACE_TOKEN_LIST: [zero.BASE_SURFACE_TOKEN_LIST, kit.BASE_SURFACE_TOKEN_LIST],
    // Compared as RegExp objects, not `.source` — deep equality covers the
    // flags too, so adding `i` to one copy and not the other still fails.
    ROLE_NAME_PATTERN: [zero.ROLE_NAME_PATTERN, kit.ROLE_NAME_PATTERN],
    TOKEN_KEY_PATTERN: [zero.TOKEN_KEY_PATTERN, kit.TOKEN_KEY_PATTERN],
    AXIS_VALUE_PATTERN: [zero.AXIS_VALUE_PATTERN, kit.AXIS_VALUE_PATTERN],
    TEXT_FIXED_PREFIX: [zero.TEXT_FIXED_PREFIX, kit.TEXT_FIXED_PREFIX],
    // Deep-compared including order: the categories drive emission order, so
    // a reordering in one copy is real drift, not cosmetic.
    TOKEN_CATEGORIES: [zero.TOKEN_CATEGORIES, kit.TOKEN_CATEGORIES],
    SIZE_SCALE_LIST: [zero.SIZE_SCALE_LIST, kit.SIZE_SCALE_LIST],
    // Sorted arrays rather than the Sets themselves — order carries no
    // meaning here, and this is the list the validator must reject by exactly
    // when the runtime refuses to render it.
    RESERVED_AXES: [[...zero.RESERVED_AXES].sort(), [...kit.RESERVED_AXES].sort()],
    // The boolean-flag vocabulary — the runtime renders exactly these, the
    // kit's mergeManifests holds ecosystem fragments to them.
    FLAG_VOCABULARY: [zero.FLAG_VOCABULARY, kit.FLAG_VOCABULARY],
    // The governed data-state vocabulary — families compared including order
    // (they are documentation, and reordering one copy is drift).
    STATE_VOCABULARY: [zero.STATE_VOCABULARY, kit.STATE_VOCABULARY],
    STATE_NAMES: [[...zero.STATE_NAMES].sort(), [...kit.STATE_NAMES].sort()],
    // The synonym table both sides use for the same diagnostic.
    STATE_SYNONYMS: [zero.STATE_SYNONYMS, kit.STATE_SYNONYMS],
    // The closed data-placement vocabulary — zero's position strategy writes
    // these, the kit's mergeManifests holds fragment `placements` to them.
    PLACEMENT_VOCABULARY: [zero.PLACEMENT_VOCABULARY, kit.PLACEMENT_VOCABULARY],
    // The named-prop axes and the attributes they render. Zero's copy guards
    // the runtime `axes` bag; the kit's drives selector emission.
    VARIANT_AXES: [zero.VARIANT_AXES, kit.VARIANT_AXES],
    // The modifier namespace. The compiler emits `[data-mod-<name>]` and the
    // runtime sets exactly those attributes, so a drifting prefix would mean
    // rules that can never match — silently, since a presence-only selector
    // has nothing to compare against.
    MOD_ATTR_PREFIX: [zero.MOD_ATTR_PREFIX, kit.MOD_ATTR_PREFIX],
    // The layout family. The prefix is load-bearing on both sides — it is
    // what keeps fifteen ordinary words out of RESERVED_AXES — and the
    // vocabulary itself must not drift, because a design system's compiled
    // step table and the attributes the runtime renders are two halves of
    // one lookup: a value in one copy and not the other is a rule that can
    // never match, or a prop that paints nothing.
    LAYOUT_ATTR_PREFIX: [zero.LAYOUT_ATTR_PREFIX, kit.LAYOUT_ATTR_PREFIX],
    // The key `Responsive` reserves for the unqualified value. Both copies
    // refuse it as a breakpoint, and the kit's validator refuses to let a
    // design system declare one — three readers, one name.
    BASE_BREAKPOINT_KEY: [zero.BASE_BREAKPOINT_KEY, kit.BASE_BREAKPOINT_KEY],
    LAYOUT_VOCABULARY: [zero.LAYOUT_VOCABULARY, kit.LAYOUT_VOCABULARY],
    LAYOUT_ATTR_NAMES: [[...zero.LAYOUT_ATTR_NAMES].sort(), [...kit.LAYOUT_ATTR_NAMES].sort()],
    SPACE_STEPS: [zero.SPACE_STEPS, kit.SPACE_STEPS],
};

/**
 * Same-named exports that are deliberately NOT value-compared, with the
 * reason. Layer 2 checks this table is exhaustive, so an exemption has to be
 * recorded here rather than by widening the intersection filter.
 */
const KNOWN_UNSHARED: Record<string, string> = {
    // Functions aren't meaningfully value-comparable; parity is asserted
    // behaviorally in the semantic layer below instead.
    tokenProperty: 'function — compared by behavior, not by value',
    defaultSwatch: 'function — compared by behavior, not by value',
    layoutAttrSpec: 'function — compared by behavior, not by value',
    parseLayoutAttr: 'function — compared by behavior, not by value',
};

describe('kit ↔ zero contract parity', () => {
    // ── 1. value parity ──
    it.each(Object.keys(SHARED))('%s is identical in both contract copies', (name) => {
        const [fromZero, fromKit] = SHARED[name]!;
        expect(fromKit).toEqual(fromZero);
    });

    it('the layout attribute parse agrees on every name both copies can render', () => {
        // The two parsers are read by different halves of one loop — zero's
        // `expectAnatomy` validates what the runtime rendered, the kit's lynx
        // emitter turns a selector into a class — so a disagreement means a
        // component and its stylesheet stop describing the same attribute.
        // Swept over the real vocabulary rather than examples, including the
        // per-breakpoint spelling and the shapes that must be REFUSED.
        const names: string[] = [
            'data-l-nope', 'data-color', 'data-l-', 'data-l-md-wrap',
            // Shapes the suffix-matching parse has to agree on: a hyphenated
            // breakpoint, the longest-suffix tie-break, and a name neither
            // copy may accept because the emitter would not write it.
            'data-l-tablet-lg-gap', 'data-l-md-gap-x', 'data-l-Md-gap', 'data-l-gap-gap',
            'data-l-base-gap', 'data-l-base-cols',
        ];
        for (const attr of Object.keys(zero.LAYOUT_VOCABULARY)) {
            names.push(`data-l-${attr}`, `data-l-md-${attr}`, `data-l-2xl-${attr}`, `data-l-tablet-lg-${attr}`);
        }
        for (const name of names) {
            expect(kit.parseLayoutAttr(name), name).toEqual(zero.parseLayoutAttr(name));
        }
        for (const attr of Object.keys(zero.LAYOUT_VOCABULARY) as Array<keyof typeof zero.LAYOUT_VOCABULARY>) {
            expect(kit.layoutAttrSpec(attr), attr).toEqual(zero.layoutAttrSpec(attr));
        }
    });

    it('the reserved-name sets agree (named differently on each side)', () => {
        // zero calls them CSS_COLOR_KEYWORDS (values resolveColorToken must not
        // rewrite); the kit calls them RESERVED_ROLE_NAMES (names a design
        // system must not declare as roles). Same set, two vantage points.
        expect([...kit.RESERVED_ROLE_NAMES].sort()).toEqual([...zero.CSS_COLOR_KEYWORDS].sort());
    });

    // ── 2. completeness ──
    it('every shared export name is covered by the table above', () => {
        const shared = Object.keys(zero)
            .filter((name) => name in kit)
            .sort();
        const accounted = [...Object.keys(SHARED), ...Object.keys(KNOWN_UNSHARED)].sort();
        expect(shared).toEqual(accounted);
    });

    // ── 3. semantic parity ──
    it('every reserved role name really is unresolvable as a token', () => {
        // The kit rejects these as role names on the grounds that
        // resolveColorToken would never turn them into var(--color-<role>).
        // Verify that justification against zero's actual implementation.
        for (const name of kit.RESERVED_ROLE_NAMES) {
            expect(zero.resolveColorToken(name)).toBe(name);
        }
    });

    it('every recommended role and base surface does resolve by convention', () => {
        for (const role of kit.RECOMMENDED_ROLE_LIST) {
            expect(zero.resolveColorToken(role)).toBe(`var(--color-${role})`);
        }
        for (const surface of kit.BASE_SURFACE_TOKEN_LIST) {
            expect(zero.resolveColorToken(surface)).toBe(`var(--color-${surface})`);
        }
    });

    it('the role-name pattern accepts the recommended vocabulary and rejects the reserved one', () => {
        for (const role of kit.RECOMMENDED_ROLE_LIST) {
            expect(kit.ROLE_NAME_PATTERN.test(role)).toBe(true);
        }
        // Reserved names are *shaped* like valid roles — that is exactly why
        // they need a separate deny-list rather than a stricter pattern.
        expect(kit.ROLE_NAME_PATTERN.test('transparent')).toBe(true);
        expect(kit.RESERVED_ROLE_NAMES.has('transparent')).toBe(true);
    });

    it('the synonym table points into the state vocabulary, from outside it', () => {
        // A key that IS a member would reject a legal state; a value that is
        // NOT a member would recommend an illegal one.
        for (const [synonym, member] of Object.entries(kit.STATE_SYNONYMS)) {
            expect(kit.STATE_NAMES.has(synonym), `synonym "${synonym}" is itself a vocabulary member`).toBe(false);
            expect(kit.STATE_NAMES.has(member), `synonym "${synonym}" points at "${member}", which is not a member`).toBe(true);
        }
    });

    it('the reserved axis names really are the anatomy contract', () => {
        // The kit spells the list out; zero derives it from FLAG_VOCABULARY
        // plus the four structural attributes. Verify the derivation rather
        // than just the copied literal, so adding a flag to zero without
        // updating the kit fails here.
        for (const flag of zero.FLAG_VOCABULARY) {
            expect(kit.RESERVED_AXES.has(flag)).toBe(true);
        }
        for (const structural of ['scope', 'part', 'state', 'orientation']) {
            expect(kit.RESERVED_AXES.has(structural)).toBe(true);
        }
        // …and the axes that DO have named props are not reserved — they are
        // set by zero itself, not through `axes`.
        for (const axis of Object.keys(kit.VARIANT_AXES)) {
            expect(kit.RESERVED_AXES.has(axis)).toBe(false);
        }
    });

    it('defaultSwatch picks identical tokens in both copies', () => {
        // The kit applies this at compile time (into manifest.json) and zero's
        // `registerThemes` applies it at runtime (into the theme registry). A
        // drift here means a theme picker that contradicts the design system's
        // own manifest, which is exactly the bug this pair exists to prevent.
        const vocabularies = [
            kit.RECOMMENDED_ROLE_LIST,
            // Fewer than four roles, and more than four — the slice is the
            // only interesting edge in the rule.
            ['brand', 'danger'],
            ['a', 'b', 'c', 'd', 'e', 'f'],
            [],
        ];
        for (const roles of vocabularies) {
            expect(kit.defaultSwatch(roles)).toEqual(zero.defaultSwatch(roles));
        }
    });

    it('the default swatch names only tokens a design system must provide', () => {
        // It samples declared roles plus the base pair; the base pair is
        // required of every design system, so the swatch can never name a
        // token that does not exist.
        const swatch = kit.defaultSwatch(kit.RECOMMENDED_ROLE_LIST);
        for (const token of swatch) {
            expect(
                (kit.RECOMMENDED_ROLE_LIST as readonly string[]).includes(token)
                || (kit.BASE_SURFACE_TOKEN_LIST as readonly string[]).includes(token),
            ).toBe(true);
        }
    });

    it('tokenProperty spells identical names in both copies', () => {
        for (const category of kit.TOKEN_CATEGORIES) {
            const keys = category.recommended.length > 0 ? category.recommended : [undefined];
            for (const key of keys) {
                expect(kit.tokenProperty(category, key)).toBe(zero.tokenProperty(category, key));
            }
        }
    });

    it('category prefixes cannot collide with each other or with colors', () => {
        // A `scale` prefix that prefixes another would make `--x-y-z`
        // ambiguous between categories, and anything under `--color-` would
        // collide with the role grammar.
        const scales = kit.TOKEN_CATEGORIES.filter((c) => c.shape === 'scale');
        for (const a of kit.TOKEN_CATEGORIES) {
            expect(a.prefix.startsWith('--color-')).toBe(false);
            for (const b of scales) {
                if (a === b) continue;
                expect(b.prefix.startsWith(a.prefix)).toBe(false);
            }
        }
    });

    it('category ids are unique and every recommended key is well-formed', () => {
        const ids = kit.TOKEN_CATEGORIES.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const category of kit.TOKEN_CATEGORIES) {
            for (const key of category.recommended) {
                expect(kit.TOKEN_KEY_PATTERN.test(key)).toBe(true);
            }
            // A scalar category holds one value, so recommended keys would
            // have nothing to attach to.
            if (category.shape === 'scalar') expect(category.recommended).toEqual([]);
        }
    });

    it('base.css fallbacks sit in a layer a design system outranks', () => {
        // The fallbacks are on `:root` (0,1,0) while a compiled design system
        // emits `:where(:root)` (0,0,0) — so sharing one layer let the
        // fallback beat the design system's own default until a theme was
        // explicitly selected. A separate, earlier layer makes the ordering
        // independent of both specificity and import order.
        const baseCss = readFileSync(
            resolve(process.cwd(), 'packages/zero/css/base.css'),
            'utf8',
        );
        const order = /@layer\s+([^;]+);/.exec(baseCss);
        expect(order, 'base.css must declare the layer order').not.toBeNull();
        const layers = order![1]!.split(',').map((l) => l.trim());
        expect(layers.indexOf('zero.fallback')).toBeGreaterThan(-1);
        expect(layers.indexOf('zero.fallback')).toBeLessThan(layers.indexOf('zero.tokens'));

        // …and the fallback values must actually live in that layer. Bounded
        // to the block itself: `indexOf('@layer zero.fallback')` would match
        // the order declaration above, and slicing to EOF would pass even if
        // the values had moved into a later layer.
        const blockStart = baseCss.indexOf('@layer zero.fallback {');
        expect(blockStart, 'no @layer zero.fallback block').toBeGreaterThan(-1);
        const next = baseCss.indexOf('@layer', blockStart + 1);
        const fallbackBlock = baseCss.slice(blockStart, next === -1 ? undefined : next);
        expect(fallbackBlock).toContain('--radius-box:');
    });

    it('base.css hides `hidden` parts from a layer no design system outranks', () => {
        // Parts like `tree-view.branch-content` and `tabs.panel` hide with the
        // `hidden` attribute alone, which relies on the UA sheet's
        // `[hidden] { display: none }` — the weakest rule in the document. A
        // recipe's `display: flex` in `@layer zero.recipes` beats it, which is
        // how collapsed tree branches stayed on screen in all six design
        // systems (#209). `zero.structure` must therefore come LAST: every
        // design-system declaration lands in `zero.recipes`, so layer order
        // settles it without any specificity arithmetic.
        //
        // This can only be asserted structurally here — happy-dom resolves no
        // layered cascade, so the behaviour itself is proved in the browser by
        // `examples/playground/e2e/hidden-parts.spec.ts`.
        const baseCss = readFileSync(
            resolve(process.cwd(), 'packages/zero/css/base.css'),
            'utf8',
        );
        const layers = /@layer\s+([^;]+);/.exec(baseCss)![1]!.split(',').map((l) => l.trim());
        expect(layers, 'base.css must declare zero.structure').toContain('zero.structure');
        expect(
            layers.indexOf('zero.structure'),
            'zero.structure must be last — it exists to outrank every design system',
        ).toBe(layers.length - 1);

        // Bounded to the block, for the same reason as the fallback check
        // above: an unbounded search would match the order declaration, and a
        // slice to EOF would pass even if the rule had drifted into a
        // different layer.
        const blockStart = baseCss.indexOf('@layer zero.structure {');
        expect(blockStart, 'no @layer zero.structure block').toBeGreaterThan(-1);
        const next = baseCss.indexOf('@layer', blockStart + 1);
        const structureBlock = baseCss.slice(blockStart, next === -1 ? undefined : next);
        // Scoped to zero's own anatomy — the guard must not claim `[hidden]`
        // across the whole document.
        expect(structureBlock).toContain('[data-scope][data-part][hidden]');
        expect(structureBlock).toMatch(/\[hidden\][^{]*\{[^}]*display:\s*none/);
        // `hidden="until-found"` is the UA's find-in-page affordance
        // (`content-visibility: hidden`, not `display: none`); forcing it to
        // none would make this guard the next thing silently defeating the UA.
        expect(structureBlock).toContain(':not([hidden="until-found" i])');
    });

    it('base.css ships a fallback for every recommended key', () => {
        // A category a design system never mentions must still resolve, which
        // is what makes "absence is never a validation error" safe.
        // Resolved from the vitest root (import.meta.url is a transform URL
        // here, not a file: one).
        const baseCss = readFileSync(
            resolve(process.cwd(), 'packages/zero/css/base.css'),
            'utf8',
        );
        for (const category of kit.TOKEN_CATEGORIES) {
            const keys = category.recommended.length > 0 ? category.recommended : [undefined];
            for (const key of keys) {
                expect(baseCss).toContain(`${kit.tokenProperty(category, key)}:`);
            }
        }
        // The text ramp's fixed aliases are contract too (TEXT_FIXED_PREFIX):
        // a recipe may reference --text-fixed-<key> for any recommended key
        // even under a design system that never declares typography.
        const text = kit.TOKEN_CATEGORIES.find((c) => c.id === 'text')!;
        for (const key of text.recommended) {
            expect(baseCss).toContain(`${kit.TEXT_FIXED_PREFIX}${key}:`);
        }
    });

    it('the base-* namespace is reserved against role declarations', () => {
        // validate.ts rejects roles named base or base-*; that rule only makes
        // sense while the fixed surfaces actually live in that namespace.
        for (const surface of kit.BASE_SURFACE_TOKEN_LIST) {
            expect(surface.startsWith('base-')).toBe(true);
        }
    });
});

/**
 * The class grammar is the newest deliberate duplication: zero's runtime
 * composes class lists with `contract/class-names.ts`, the kit's lynx target
 * emits selectors with `targets/lynx/class-names.ts`. Drift here is CSS that
 * matches nothing — silently, since a class selector has nothing to compare
 * against — so parity is asserted by value for the constants and by behavior
 * over the ENTIRE real vocabulary for the functions.
 */
describe('class-grammar parity (zero contract vs targets/lynx)', () => {
    it('constants agree', () => {
        expect(lynxGrammar.CLASS_GRAMMAR_VERSION).toBe(zero.CLASS_GRAMMAR_VERSION);
        expect(lynxGrammar.HOST_CLASS).toBe(zero.HOST_CLASS);
    });

    it('every part/state/flag/theme class agrees across the real vocabulary', () => {
        for (const anatomy of Object.values(anatomies)) {
            for (const part of Object.keys(anatomy.parts)) {
                expect(lynxGrammar.partClass(anatomy.scope, part)).toBe(zero.partClass(anatomy.scope, part));
            }
        }
        for (const state of zero.STATE_NAMES) {
            expect(lynxGrammar.stateClass(state)).toBe(zero.stateClass(state));
        }
        for (const flag of zero.FLAG_VOCABULARY) {
            expect(lynxGrammar.flagClass(flag)).toBe(zero.flagClass(flag));
        }
        for (const placement of zero.PLACEMENT_VOCABULARY) {
            expect(lynxGrammar.placementClass(placement)).toBe(zero.placementClass(placement));
        }
        for (const [axis, value] of [['size', 'xs'], ['color', 'primary'], ['density', 'compact']] as const) {
            expect(lynxGrammar.axisClass(axis, value)).toBe(zero.axisClass(axis, value));
        }
        for (const name of ['block', 'icon-only']) {
            expect(lynxGrammar.modClass(name)).toBe(zero.modClass(name));
        }
        for (const orientation of ['horizontal', 'vertical']) {
            expect(lynxGrammar.orientationClass(orientation)).toBe(zero.orientationClass(orientation));
        }
        for (const theme of ['light', 'daisy-dark']) {
            expect(lynxGrammar.themeClass(theme)).toBe(zero.themeClass(theme));
        }
    });
});
