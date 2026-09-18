/**
 * The api declaration's validator (issue #179) — every error family once,
 * plus the grade derivation.
 *
 * The checks guard the seam adapt() trusts: the runtime never re-validates
 * (generated artifacts are downstream of this validator, the same trust model
 * register.js has), so anything this suite lets through is something the
 * generated ./components module would ship.
 */
import { describe, expect, it } from 'vitest';
import type { ApiVocabulary, DesignSystemApi } from '@sigx/zero-kit';
import { apiGrade, defineApi, modifierGrade, validateApi } from '@sigx/zero-kit';

const vocabulary: ApiVocabulary = {
    variants: ['primary', 'ghost', 'danger', 'danger-tertiary'],
    axes: { shape: ['circle', 'round'] },
    modifiers: ['icon-only', 'expressive'],
};

const validate = (api: DesignSystemApi, vocab: ApiVocabulary = vocabulary) => validateApi(api, vocab);
const errors = (api: DesignSystemApi, vocab?: ApiVocabulary) =>
    validate(api, vocab).filter((i) => i.level === 'error');
const warnings = (api: DesignSystemApi, vocab?: ApiVocabulary) =>
    validate(api, vocab).filter((i) => i.level === 'warning');

describe('validateApi — mapped surfaces must be declared', () => {
    it('rejects api.variant when tokens.variants is undeclared', () => {
        const issues = errors({ variant: { as: 'kind' } }, { modifiers: ['icon-only'] });
        expect(issues).toHaveLength(1);
        expect(issues[0]!.where).toBe('api.variant');
        expect(issues[0]!.message).toContain('tokens.variants is undeclared');
    });

    it('rejects a mapping for an undeclared custom axis', () => {
        const issues = errors({ axes: { radius: {} } });
        expect(issues.map((i) => i.message).join()).toContain('"radius" is not declared in tokens.axes');
    });

    it('rejects a mapping for an undeclared modifier', () => {
        const issues = errors({ modifiers: { pending: { as: 'isPending' } } });
        expect(issues.map((i) => i.message).join()).toContain('"pending" is not declared in tokens.modifiers');
    });
});

describe('validateApi — vendor prop names', () => {
    it('rejects an `as` that is not a valid prop name', () => {
        const issues = errors({ variant: { as: 'danger prop' } });
        expect(issues.map((i) => i.message).join()).toContain('not a valid prop name');
    });

    it("rejects an `as` naming zero's own axis props", () => {
        for (const as of ['color', 'size', 'axes', 'mods']) {
            const issues = errors({ variant: { as } });
            expect(issues.map((i) => i.message).join(), as).toContain("zero's own prop");
        }
        // `as: 'variant'` on the variant surface is the identity case, not a
        // collision — the prop routes to itself, so it only warns.
        const identity = warnings({ variant: { as: 'variant' } });
        expect(identity.map((i) => i.message).join()).toContain('omit `as`');
    });

    it('rejects an `as` from the anatomy contract', () => {
        const issues = errors({ variant: { as: 'state' } });
        expect(issues.map((i) => i.message).join()).toContain('part of the anatomy contract');
    });

    it('rejects an `as` shadowing a structural prop', () => {
        const issues = errors({ variant: { as: 'asChild' } });
        expect(issues.map((i) => i.message).join()).toContain('structural prop');
    });

    it('rejects two surfaces exposing the same prop', () => {
        const issues = errors({
            variant: { as: 'kind' },
            modifiers: { 'icon-only': { as: 'kind' } },
        });
        expect(issues.map((i) => i.message).join()).toContain('both expose the prop "kind"');
    });

    it('a modifier without `as` occupies its own name in the duplicate check', () => {
        const issues = errors({
            axes: { shape: { as: 'icon-only' } },
            modifiers: { 'icon-only': {} },
        });
        expect(issues.map((i) => i.message).join()).toContain('both expose the prop "icon-only"');
    });

    it('warns on an identity `as`', () => {
        const issues = warnings({ modifiers: { 'icon-only': { as: 'icon-only' } } });
        expect(issues.map((i) => i.message).join()).toContain("the surface's own name");
    });

    it('rejects a modifier surfacing under a name zero already owns', () => {
        const issues = errors(
            { modifiers: { disabled: {} } },
            { modifiers: ['disabled'] },
        );
        expect(issues.map((i) => i.message).join()).toContain('a prop zero already owns');
    });
});

describe('validateApi — values remaps', () => {
    it('rejects a remap of an undeclared value', () => {
        const issues = errors({ variant: { values: { solid: 'Solid' } } });
        expect(issues.map((i) => i.message).join()).toContain('"solid", which is not in tokens.variants');
    });

    it('rejects a non-injective remap', () => {
        const issues = errors({ variant: { values: { ghost: 'x', danger: 'x' } } });
        expect(issues.map((i) => i.message).join()).toContain('must be injective');
    });

    it('rejects a vendor spelling that is itself a declared value', () => {
        const issues = errors({ variant: { values: { 'danger-tertiary': 'ghost' } } });
        expect(issues.map((i) => i.message).join()).toContain('one name with two meanings');
    });

    it('rejects a vendor spelling with whitespace or quotes', () => {
        for (const vendor of ['danger tertiary', "danger'", 'danger\\t']) {
            const issues = errors({ variant: { values: { 'danger-tertiary': vendor } } });
            expect(issues.map((i) => i.message).join(), vendor).toContain('not a plain printable spelling');
        }
    });

    it('warns on an identity remap', () => {
        const issues = warnings({ variant: { values: { ghost: 'ghost' } } });
        expect(issues.map((i) => i.message).join()).toContain('needs no remap');
    });
});

describe('validateApi — color and size axes (#318)', () => {
    const withColors: ApiVocabulary = { ...vocabulary, roles: { primary: {}, danger: {} }, sizes: ['sm', 'md', 'lg'] };

    it('accepts a color mapping against the declared roles', () => {
        expect(validate({ color: { as: 'tone' } }, withColors)).toEqual([]);
        expect(validate({ color: { values: { danger: 'destructive' } } }, withColors)).toEqual([]);
    });

    it('accepts a size mapping against the declared ramp — carbon can finally respell size', () => {
        expect(validate({ size: { values: { sm: 'small', md: 'medium', lg: 'large' } } }, withColors)).toEqual([]);
    });

    it('rejects a remap of an undeclared role or size', () => {
        expect(errors({ color: { values: { brand: 'Brand' } } }, withColors).map((i) => i.message).join())
            .toContain('"brand", which is not in tokens.roles');
        expect(errors({ size: { values: { xl: 'huge' } } }, withColors).map((i) => i.message).join())
            .toContain('"xl", which is not in tokens.sizes');
    });

    it('rejects a color mapping when the design system declared the axis out of existence', () => {
        const issues = errors({ color: { as: 'tone' } }, { ...vocabulary, roles: {}, sizes: [] });
        expect(issues.map((i) => i.message).join()).toContain('roles: {}');
        const size = errors({ size: { as: 'scale' } }, { ...vocabulary, roles: {}, sizes: [] });
        expect(size.map((i) => i.message).join()).toContain('sizes: []');
    });

    it('an undeclared vocabulary falls back to the recommended defaults', () => {
        // Omitting roles/sizes means the recommended vocabulary, exactly as
        // compilation resolves them — so a mapping may respell those.
        expect(validate({ size: { values: { xs: 'compact' } } }, vocabulary)).toEqual([]);
    });
});

describe('validateApi — per-scope components overrides (#318)', () => {
    const scopes = ['button', 'select'];

    it('accepts an override that replaces a DS-wide entry for one scope', () => {
        expect(validate(
            { variant: { as: 'kind' }, components: { select: { variant: { as: 'look' } } } },
            vocabulary,
        )).toEqual([]);
    });

    it('rejects an override for an unknown scope when the manifest scopes are provided', () => {
        const issues = validateApi(
            { components: { selct: { variant: { as: 'look' } } } },
            vocabulary,
            { scopes },
        ).filter((i) => i.level === 'error');
        expect(issues.map((i) => i.message).join()).toContain('"selct" is not a component scope');
    });

    it('applies the same entry checks inside an override', () => {
        const issues = errors({ components: { select: { variant: { as: 'data prop' } } } });
        expect(issues.map((i) => i.message).join()).toContain('not a valid prop name');
        const values = errors({ components: { select: { variant: { values: { nope: 'x' } } } } });
        expect(values.map((i) => i.message).join()).toContain('"nope", which is not in tokens.variants');
    });

    it('rejects an override whose prop collides with a surviving DS-wide prop', () => {
        const issues = errors({
            variant: { as: 'kind' },
            components: { select: { axes: { shape: { as: 'kind' } } } },
        });
        expect(issues.map((i) => i.message).join()).toContain('both expose the prop "kind"');
    });

    it('does not re-report a DS-wide prop the override replaces', () => {
        // The override REPLACES api.variant for select, so `kind` is free.
        expect(validate({
            variant: { as: 'kind' },
            components: { select: { variant: {}, axes: { shape: { as: 'kind' } } } },
        })).toEqual([]);
    });
});

describe('validateApi — RESERVED_PROPS_BY_SCOPE (#318)', () => {
    it("rejects a DS-wide rename onto a scope's component-specific prop, naming the fix", () => {
        // The G8 incident: `api.variant = { as: 'name' }` silently deleted
        // Select's `name` prop on every wired scope.
        const issues = errors({ variant: { as: 'name' } });
        const text = issues.map((i) => i.message).join();
        expect(text).toContain('"select"');
        expect(text).toContain('api.components');
    });

    it('applies to a modifier surfacing under its own colliding name', () => {
        const issues = errors(
            { modifiers: { placeholder: {} } },
            { modifiers: ['placeholder'] },
        );
        // `placeholder` is contract-reserved already; use a scope-specific one.
        const scoped = errors(
            { modifiers: { name: {} } },
            { modifiers: ['name'] },
        );
        expect([...issues, ...scoped].length).toBeGreaterThan(0);
        expect(scoped.map((i) => i.message).join()).toContain('component-specific prop');
    });

    it('allows the same rename scoped to one component — deliberate vendor shadowing', () => {
        expect(validate({ components: { select: { variant: { as: 'name' } } } })).toEqual([]);
    });

    it('refuses a contract-owned name at BOTH tiers, which is why the table need not carry it (#475)', () => {
        // Recorded because the table's asymmetry invites a wrong conclusion:
        // `divider` lists `orientation` (it declares the prop as a literal,
        // which the parity scraper sees) while the eight scopes that spell it
        // through `WithOrientation` do not. That looks like a hole — a
        // DS-wide rename shadowing `orientation` on eight scopes — and is
        // not one.
        //
        // `checkAs` rejects any `as` in RESERVED_AXES, which contains
        // `orientation` alongside `scope`, `part`, `state` and every flag,
        // and it runs BEFORE the per-scope table check and at both tiers. So
        // the protection never depended on the table, and adding the eight
        // entries would only have duplicated an error that already fires.
        //
        // The same reasoning is why `WithDisabled` is absent from the
        // scraper's FRAGMENTS table.
        for (const api of [
            { variant: { as: 'orientation' } },
            { components: { tabs: { variant: { as: 'orientation' } } } },
        ]) {
            const messages = errors(api as never).map((i) => i.message);
            expect(messages.some((m) => m.includes('part of the anatomy contract')), JSON.stringify(api)).toBe(true);
        }
    });
});

describe('validateApi — declaration shape', () => {
    it('rejects unknown top-level keys', () => {
        const issues = errors({ colour: {} } as DesignSystemApi);
        expect(issues.map((i) => i.message).join()).toContain('unknown key "colour"');
    });

    it('rejects unknown keys inside an entry', () => {
        const issues = errors({ modifiers: { 'icon-only': { values: {} } } } as unknown as DesignSystemApi);
        expect(issues.map((i) => i.message).join()).toContain('unknown key "values"');
    });

    it('accepts a clean declaration with no issues', () => {
        const api = defineApi(
            { variants: vocabulary.variants!, modifiers: vocabulary.modifiers!, axes: vocabulary.axes! },
            {
                variant: { as: 'kind', values: { 'danger-tertiary': 'danger--tertiary' } },
                axes: { shape: {} },
                modifiers: { 'icon-only': { as: 'hasIconOnly' }, expressive: {} },
            },
        );
        expect(validate(api)).toEqual([]);
    });
});

describe('grade derivation', () => {
    it('derives the conformance fidelity grade from the declaration alone', () => {
        expect(apiGrade(undefined)).toBe('unsupported');
        expect(apiGrade({})).toBe('exact');
        expect(apiGrade({ as: 'kind' })).toBe('renamed');
        expect(apiGrade({ as: 'kind', values: { 'danger-tertiary': 'danger--tertiary' } })).toBe('reshaped');
        // A values remap reshapes even without a rename.
        expect(apiGrade({ values: { 'danger-tertiary': 'danger--tertiary' } })).toBe('reshaped');
        // An empty values bag states nothing.
        expect(apiGrade({ as: 'kind', values: {} })).toBe('renamed');
    });

    it('grades every mapped modifier reshaped — the shape changes even when the name does not', () => {
        expect(modifierGrade(undefined)).toBe('unsupported');
        expect(modifierGrade({})).toBe('reshaped');
        expect(modifierGrade({ as: 'isIconOnly' })).toBe('reshaped');
    });
});
