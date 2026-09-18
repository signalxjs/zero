/**
 * The naming rule for models, held to the component sources (#451).
 *
 * Every zero model has a concept `N` and exactly two companions:
 * `default<N>` seeds it uncontrolled and `<n>Change` reports a write. The
 * anatomy declares the concept (`ModelSpec`); this test scrapes every
 * `export type <Scope><Member>Props` declaration and holds the two to each
 * other, both ways — a model without a spec, a spec without a model, a
 * companion spelled differently, a form control that does not say so.
 *
 * The scrape is textual on purpose (as in the kit's reserved-props gate):
 * the props are spelled as `Define.*` intersections, so reading the
 * declaration is the same fidelity a type-level walk would give.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { ModelSpec } from '@sigx/zero/anatomy';
import { changeEventOf, defaultPropOf } from '@sigx/zero';

const componentsDir = resolve(import.meta.dirname, '../src/components');

const pascal = (kebab: string): string => kebab.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());

interface ScrapedMember {
    member: string;
    /** `undefined` is the unnamed `model`; otherwise the `model:<name>` key. */
    models: Array<string | undefined>;
    defaults: string[];
    changes: string[];
    formControl: boolean;
    multipleProp: boolean;
}

/** Every `<Scope><Member>Props` block of a scope that declares a model. */
function scrape(scope: string): ScrapedMember[] {
    const dir = resolve(componentsDir, scope);
    const source = readdirSync(dir)
        .filter((f) => f.endsWith('.tsx'))
        .sort()
        .map((f) => readFileSync(resolve(dir, f), 'utf8'))
        .join('\n');
    const prefix = pascal(scope);
    const out: ScrapedMember[] = [];
    // A generic root declares type parameters between the name and the `=`.
    const re = new RegExp(`export type ${prefix}(\\w+)Props(?:<[^>]*>)? =([\\s\\S]*?)\\n(?:const|export const|function|type |export type )`, 'g');
    for (const m of source.matchAll(re)) {
        const [, member, block] = m as unknown as [string, string, string];
        const models = [...block.matchAll(/Define\.Model<(?:'([^']+)',)?/g)].map((x) => x[1]);
        if (models.length === 0) continue;
        out.push({
            member,
            models,
            defaults: [...block.matchAll(/Define\.Prop<'(default\w+)'/g)].map((x) => x[1]!),
            changes: [...block.matchAll(/Define\.Event<'(\w+Change)'/g)].map((x) => x[1]!),
            formControl: /\bWith(?:FormControl|Name)\b/.test(block),
            multipleProp: /Define\.Prop<'multiple'/.test(block),
        });
    }
    return out;
}

const specsOf = (scope: string): readonly ModelSpec[] => anatomies[scope as keyof typeof anatomies]!.models ?? [];

describe('every model follows the naming rule, and the anatomy says so', () => {
    it.each(Object.keys(anatomies))('%s: the sources and the anatomy agree on which models exist', (scope) => {
        const scraped = scrape(scope).flatMap((s) => s.models.map((name) => `${s.member}:${name ?? 'model'}`)).sort();
        const declared = specsOf(scope).map((m) => `${m.member ?? 'Root'}:${m.name ?? 'model'}`).sort();
        expect(declared, `${scope}: the anatomy's models must list exactly the Define.Model declarations of its sources`).toEqual(scraped);
    });

    const withModels = Object.keys(anatomies).filter((scope) => specsOf(scope).length > 0);

    it.each(withModels)('%s: each spec names its companions the way the source spells them', (scope) => {
        const members = new Map(scrape(scope).map((s) => [s.member, s]));
        for (const spec of specsOf(scope)) {
            const at = `${scope}.${spec.member ?? 'Root'} model${spec.name ? `:${spec.name}` : ''}`;
            const src = members.get(spec.member ?? 'Root')!;
            expect(spec.concept, `${at}: a concept is camelCase`).toMatch(/^[a-z][A-Za-z0-9]*$/);
            if (spec.name !== undefined) {
                expect(spec.concept, `${at}: a named model's concept IS its name`).toBe(spec.name);
            }
            expect(src.defaults, `${at}: the seed prop is default<Concept>`).toContain(defaultPropOf(spec.concept));
            expect(src.changes, `${at}: the change event is <concept>Change`).toContain(changeEventOf(spec.concept));
            if (spec.multiple) {
                expect(src.multipleProp, `${at}: \`multiple\` on the spec means a \`multiple\` prop on the member`).toBe(true);
            }
            // The form contract is a fact about the member's props (name /
            // form / …); it belongs to the member's unnamed model alone.
            expect(spec.formControl === true, `${at}: formControl mirrors WithFormControl / WithName on the member, on its unnamed model`)
                .toBe(src.formControl && spec.name === undefined);
        }
    });

    it.each(withModels)('%s: the source carries no companion the anatomy does not claim', (scope) => {
        const specs = specsOf(scope);
        for (const src of scrape(scope)) {
            const own = specs.filter((m) => (m.member ?? 'Root') === src.member);
            const expectedDefaults = own.map((m) => defaultPropOf(m.concept)).sort();
            const expectedChanges = own.map((m) => changeEventOf(m.concept)).sort();
            expect([...src.defaults].sort(), `${scope}.${src.member}: every default* prop seeds a declared model`).toEqual(expectedDefaults);
            expect([...src.changes].sort(), `${scope}.${src.member}: every *Change event reports a declared model`).toEqual(expectedChanges);
        }
    });

    it('toJSON derives the companions', () => {
        const select = anatomies.select.toJSON().models!;
        expect(select.map((m) => [m.name ?? 'model', m.default, m.change])).toEqual([
            ['model', 'defaultValue', 'valueChange'],
            ['open', 'defaultOpen', 'openChange'],
        ]);
        expect(select[0]).toMatchObject({ concept: 'value', type: 'T | null', multiple: true, formControl: true });
        expect(anatomies.badge.toJSON()).not.toHaveProperty('models');
    });
});
