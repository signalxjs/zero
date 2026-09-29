import { describe, it, expect } from 'vitest';
import { anatomies, defineAnatomy } from '@sigx/zero/anatomy';
import { FLAG_VOCABULARY, LAYOUT_ATTR_NAMES, PLACEMENT_VOCABULARY, STATE_NAMES, STATE_SYNONYMS } from '@sigx/zero';

describe('defineAnatomy', () => {
    const a = defineAnatomy('demo', {
        root: { element: 'div', states: ['open', 'closed'], flags: ['disabled'] },
        item: { element: 'button' },
    });

    it('builds selectors', () => {
        expect(a.selector('root')).toBe('[data-scope="demo"][data-part="root"]');
        expect(a.selector('root', { state: 'open' })).toBe('[data-scope="demo"][data-part="root"][data-state="open"]');
        expect(a.selector('item', { flags: ['disabled'] })).toBe('[data-scope="demo"][data-part="item"][data-disabled]');
    });

    it('emits JSON with per-state selectors', () => {
        const json = a.toJSON();
        expect(json.scope).toBe('demo');
        const root = json.parts.find((p) => p.name === 'root')!;
        expect(root.selectors.open).toBe('[data-state="open"]');
        expect(root.selectors.disabled).toBe('[data-disabled]');
        // JSON-safe
        expect(() => JSON.stringify(json)).not.toThrow();
    });

    it('emits and builds domain-flag selectors under the x- key (#457)', () => {
        const row = defineAnatomy('acme-row', {
            root: { element: 'div', flags: ['selected'], domainFlags: ['unread', 'has-attachment'] },
        });
        const root = row.toJSON().parts[0]!;
        expect(root.domainFlags).toEqual(['unread', 'has-attachment']);
        expect(root.selectors['x-unread']).toBe('[data-x-unread]');
        expect(root.selectors['x-has-attachment']).toBe('[data-x-has-attachment]');
        // The bare name is not a key: it would collide with states and flags.
        expect(root.selectors.unread).toBeUndefined();
        expect(row.selector('root', { flags: ['selected'], domainFlags: ['unread'] }))
            .toBe('[data-scope="acme-row"][data-part="root"][data-selected][data-x-unread]');
    });

    it('emits runtimeProperties only when there are some, like models (#456)', () => {
        // Absent, never empty: the manifest schema holds the key to
        // `minItems: 1` (validated in zero-kit's schemas suite).
        expect(a.toJSON()).not.toHaveProperty('runtimeProperties');
        expect(defineAnatomy('demo', { root: { element: 'div' } }, { runtimeProperties: [] }).toJSON())
            .not.toHaveProperty('runtimeProperties');
        const declared = ['--demo-count'] as const;
        const withRuntime = defineAnatomy('demo', { root: { element: 'div' } }, { runtimeProperties: declared });
        expect(withRuntime.runtimeProperties).toEqual(['--demo-count']);
        const json = withRuntime.toJSON();
        expect(json.runtimeProperties).toEqual(['--demo-count']);
        // A copy: the JSON is a snapshot, not a view onto the declaration.
        expect(json.runtimeProperties).not.toBe(declared);
    });

    describe('pseudo parts', () => {
        const withPseudo = defineAnatomy('demo', {
            popup: { element: 'dialog', states: ['open', 'closed'] },
            backdrop: {
                element: 'dialog',
                states: ['open', 'closed'],
                pseudo: { of: 'popup', selector: '::backdrop' },
            },
        });

        it('projects onto the host with the pseudo-element last', () => {
            expect(withPseudo.selector('backdrop'))
                .toBe('[data-scope="demo"][data-part="popup"]::backdrop');
            // States narrow the HOST — an attribute can't narrow a
            // pseudo-element, so the suffix always comes after.
            expect(withPseudo.selector('backdrop', { state: 'open' }))
                .toBe('[data-scope="demo"][data-part="popup"][data-state="open"]::backdrop');
        });

        it('flows through toJSON for the recipe compiler', () => {
            const part = withPseudo.toJSON().parts.find((p) => p.name === 'backdrop')!;
            expect(part.pseudo).toEqual({ of: 'popup', selector: '::backdrop' });
        });

    });
});

describe('anatomy registry', () => {
    it('contains every component', () => {
        expect(Object.keys(anatomies).sort()).toEqual([
            'accordion', 'alert', 'avatar', 'avatar-group', 'badge', 'box', 'breadcrumbs', 'button', 'card', 'carousel', 'center', 'chat', 'chat-log', 'checkbox', 'checkbox-group', 'collapsible',
            'combobox', 'container', 'countdown', 'dialog', 'diff', 'divider', 'drawer', 'empty-state', 'field', 'fieldset', 'file-upload', 'grid', 'hover-card', 'indicator', 'input', 'join', 'kbd', 'menu', 'menubar',
            'nav-list', 'navbar', 'number-input', 'pagination', 'popover', 'progress', 'radial-progress', 'radio-group',
            'rating-group', 'select', 'skeleton', 'slider', 'spacer', 'spinner', 'stack', 'stats', 'status', 'steps', 'swap', 'switch', 'table', 'tabs',
            'textarea', 'timeline', 'toast', 'toggle', 'toggle-group', 'tooltip',
            'tree-view',
        ]);
    });

    it('all part names and scopes are kebab-case', () => {
        for (const anatomy of Object.values(anatomies)) {
            expect(anatomy.scope).toMatch(/^[a-z][a-z0-9-]*$/);
            for (const part of anatomy.partNames()) {
                expect(part).toMatch(/^[a-z][a-z0-9-]*$/);
            }
        }
    });

    it('every pseudo part projects onto a real part', () => {
        // defineAnatomy carries no runtime guard for this (it is on every
        // component's size budget), so the registry is checked here instead.
        for (const anatomy of Object.values(anatomies)) {
            // Widened: the registry carries literal part keys per scope now,
            // and `pseudo.of` is a plain string being checked against them.
            const parts: Record<string, { pseudo?: { of: string; selector: string } }> = anatomy.parts;
            for (const [name, part] of Object.entries(parts)) {
                if (part.pseudo) {
                    expect(parts[part.pseudo.of], `${anatomy.scope}.${name} → ${part.pseudo.of}`).toBeDefined();
                    expect(part.pseudo.selector).toMatch(/^::/);
                }
            }
        }
    });

    it('every hiddenIn state is one the part actually declares', () => {
        // `hiddenIn` names a state the runtime hides the part in, so a value
        // outside `states` describes a render that cannot happen — and would
        // silently exempt nothing in the tooling that reads it.
        const declared: string[] = [];
        for (const anatomy of Object.values(anatomies)) {
            for (const [name, part] of Object.entries<{ states?: readonly string[]; hiddenIn?: readonly string[] }>(anatomy.parts)) {
                if (!part.hiddenIn) continue;
                // Absent, never empty: `[]` reaches the manifest as a key that
                // claims nothing, which `manifest.schema.json` rejects
                // (`minItems: 1`) — fail at the anatomy rather than at the
                // published artifact.
                expect(part.hiddenIn.length, `${anatomy.scope}.${name}: empty hiddenIn — omit it`)
                    .toBeGreaterThan(0);
                for (const state of part.hiddenIn) {
                    expect(part.states ?? [], `${anatomy.scope}.${name}: hiddenIn "${state}"`).toContain(state);
                    declared.push(`${anatomy.scope}.${name}`);
                }
            }
        }
        // Every part zero hides with the `hidden` attribute, and no other.
        // Adding one to the runtime without declaring it here is the drift
        // this pins: the DOM half is asserted by `expectAnatomy`.
        expect([...new Set(declared)].sort()).toEqual([
            'alert.root', 'avatar.fallback', 'avatar.image', 'breadcrumbs.ellipsis', 'breadcrumbs.item',
            'chat-log.jump-trigger', 'steps.content', 'tabs.panel', 'tree-view.branch-content',
        ]);
    });

    it('every parent names a declared part, acyclically', () => {
        // The part tree is contract data (the contrast audit derives ancestor
        // chains from it; the recipe compiler bounds axis rules with it), so a
        // dangling or circular `parent` would corrupt every derivation.
        for (const anatomy of Object.values(anatomies)) {
            const parts: Record<string, { parent?: string; pseudo?: unknown }> = anatomy.parts;
            for (const [name, part] of Object.entries(parts)) {
                if (part.parent === undefined) continue;
                expect(parts[part.parent], `${anatomy.scope}.${name} → parent "${part.parent}" is not a declared part`)
                    .toBeDefined();
                expect(part.parent, `${anatomy.scope}.${name} declares itself as its own parent`).not.toBe(name);
                // A pseudo part renders no element, so it can nest nothing and
                // sits nowhere — its host is `pseudo.of`, not a parent.
                expect(part.pseudo, `${anatomy.scope}.${name} is a pseudo part and must not declare a parent`)
                    .toBeUndefined();
                // Walk to a root; a cycle would never terminate, so bound the
                // walk by the part count and fail if it is exhausted.
                let cursor: string | undefined = part.parent;
                let hops = 0;
                const budget = Object.keys(parts).length;
                while (cursor !== undefined) {
                    hops += 1;
                    expect(hops, `${anatomy.scope}.${name}: parent chain does not terminate (cycle)`).toBeLessThanOrEqual(budget);
                    cursor = parts[cursor]?.parent;
                }
            }
        }
    });

    it('all flags come from the shared vocabulary', () => {
        const vocabulary = new Set<string>(FLAG_VOCABULARY);
        for (const anatomy of Object.values(anatomies)) {
            for (const part of Object.values(anatomy.parts)) {
                for (const flag of part.flags ?? []) {
                    expect(vocabulary.has(flag), `${anatomy.scope}: flag "${flag}"`).toBe(true);
                }
            }
        }
    });

    it('no zero anatomy declares a domain flag — the shared vocabularies stay closed (#457)', () => {
        // Domain flags are the ECOSYSTEM's namespace. A fact zero's own
        // components need belongs in FLAG_VOCABULARY, where every skin sees it.
        for (const anatomy of Object.values(anatomies)) {
            for (const [name, part] of Object.entries(anatomy.parts)) {
                expect(part.domainFlags, `${anatomy.scope}.${name}`).toBeUndefined();
            }
        }
    });

    // The one declared runtime property outside its own scope's prefix, and
    // why. A row whose scope stops declaring the name fails as stale.
    const RUNTIME_PREFIX_EXCEPTIONS: Record<string, Record<string, string>> = {
        'radial-progress': {
            '--progress-percent': "shares Progress's percent so one recipe idiom serves both",
        },
    };

    it('every declared runtime property carries its own scope\'s prefix, bar the listed exceptions (#537)', () => {
        const used = new Set<string>();
        for (const anatomy of Object.values(anatomies)) {
            const list = anatomy.runtimeProperties;
            if (list === undefined) continue;
            // Absent, never empty, and no name twice — the manifest schema's
            // shape, failed here at the anatomy rather than downstream.
            expect(list.length, `${anatomy.scope}: empty runtimeProperties — omit it`).toBeGreaterThan(0);
            expect(new Set(list).size, `${anatomy.scope}: a runtime property listed twice`).toBe(list.length);
            for (const name of list) {
                expect(name, `${anatomy.scope}: "${name}"`).toMatch(/^--[a-z0-9]+(?:-[a-z0-9]+)*$/);
                const exception = RUNTIME_PREFIX_EXCEPTIONS[anatomy.scope]?.[name];
                if (exception !== undefined) {
                    used.add(`${anatomy.scope} ${name}`);
                    continue;
                }
                expect(name.startsWith(`--${anatomy.scope}-`), `${anatomy.scope}: "${name}" does not start with "--${anatomy.scope}-"`).toBe(true);
            }
        }
        const rows = Object.entries(RUNTIME_PREFIX_EXCEPTIONS).flatMap(([scope, names]) => Object.keys(names).map((n) => `${scope} ${n}`));
        expect(rows.filter((row) => !used.has(row)), 'stale exception rows').toEqual([]);
    });

    it('each declaring anatomy\'s toJSON carries its runtimeProperties (#537)', () => {
        const declaring = Object.values(anatomies).filter((a) => a.runtimeProperties !== undefined);
        expect(declaring.map((a) => a.scope).sort()).toEqual([
            'accordion', 'collapsible', 'countdown', 'diff', 'input', 'progress', 'radial-progress', 'slider', 'tabs', 'toast',
        ]);
        for (const anatomy of declaring) {
            expect(anatomy.toJSON().runtimeProperties, anatomy.scope).toEqual([...anatomy.runtimeProperties!]);
        }
        for (const anatomy of Object.values(anatomies).filter((a) => a.runtimeProperties === undefined)) {
            expect(anatomy.toJSON(), anatomy.scope).not.toHaveProperty('runtimeProperties');
        }
    });

    it('all states come from the governed vocabulary', () => {
        // Flags have been governed from the start; this is the symmetric half
        // (#317 item 3). A state outside the vocabulary is either a synonym —
        // in which case the failure names the member to use — or a genuinely
        // new value, which is a contract change in STATE_VOCABULARY first.
        for (const anatomy of Object.values(anatomies)) {
            for (const [name, part] of Object.entries<{ states?: readonly string[] }>(anatomy.parts)) {
                for (const state of part.states ?? []) {
                    const hint = STATE_SYNONYMS[state] ? ` — use "${STATE_SYNONYMS[state]}"` : '';
                    expect(STATE_NAMES.has(state), `${anatomy.scope}.${name}: state "${state}"${hint}`).toBe(true);
                }
            }
        }
    });

    it('all placements come from the placement vocabulary, and exactly the stamping parts declare them', () => {
        const vocabulary = new Set<string>(PLACEMENT_VOCABULARY);
        const declared: string[] = [];
        for (const anatomy of Object.values(anatomies)) {
            for (const [name, part] of Object.entries<{ placements?: readonly string[] }>(anatomy.parts)) {
                if (!part.placements) continue;
                // Absent, never empty — same reasoning as hiddenIn.
                expect(part.placements.length, `${anatomy.scope}.${name}: empty placements — omit it`).toBeGreaterThan(0);
                for (const placement of part.placements) {
                    expect(vocabulary.has(placement), `${anatomy.scope}.${name}: placement "${placement}"`).toBe(true);
                }
                declared.push(`${anatomy.scope}.${name}`);
            }
        }
        // Every part the runtime stamps `data-placement` on, and no other:
        // the six anchored-position popups, toast's viewport/root pair, and
        // the content-tier parts that anchor along an axis (#334), and
        // input's adornment and affix, which name the control edge they sit
        // at (#281, #467),
        // and divider's label, the rule edge it is set at (#298).
        // The DOM half is asserted by expectAnatomy in each component's tests.
        expect(declared.sort()).toEqual([
            'chat.root', 'combobox.popup', 'divider.label', 'drawer.panel', 'hover-card.popup', 'indicator.item', 'input.adornment', 'input.affix', 'menu.popup', 'menu.sub-popup',
            'popover.popup', 'select.popup', 'timeline.content', 'toast.root', 'toast.viewport', 'tooltip.popup',
        ]);
    });

    it('all declared layout attributes come from the layout vocabulary', () => {
        // Governed exactly like placements. The registry currently declares
        // none — the layout tier's own scopes land in the follow-ups — and
        // this passing vacuously is the point: the guard is in place before
        // the first part can declare one, so a typo'd attribute name can
        // never reach a manifest.
        for (const anatomy of Object.values(anatomies)) {
            for (const [name, part] of Object.entries<{ layout?: readonly string[] }>(anatomy.parts)) {
                if (!part.layout) continue;
                // Absent, never empty — same reasoning as hiddenIn.
                expect(part.layout.length, `${anatomy.scope}.${name}: empty layout — omit it`).toBeGreaterThan(0);
                for (const attr of part.layout) {
                    expect(LAYOUT_ATTR_NAMES.has(attr), `${anatomy.scope}.${name}: layout "${attr}"`).toBe(true);
                }
            }
        }
    });

    it('a re-carried axis is a named axis, on a rendered part other than the carrier', () => {
        // `carries` (#94) makes a second carrier in one scope. The carrier
        // itself carries every axis already, a pseudo part renders no element
        // to put the attribute on, and a custom axis is design-system
        // vocabulary no anatomy can promise.
        const carrying: string[] = [];
        for (const anatomy of Object.values(anatomies)) {
            const carrier = 'root' in anatomy.parts ? 'root' : anatomy.partNames()[0];
            for (const [name, part] of Object.entries<{ carries?: readonly string[]; pseudo?: unknown }>(anatomy.parts)) {
                if (!part.carries) continue;
                carrying.push(`${anatomy.scope}.${name}`);
                expect(part.carries.length, `${anatomy.scope}.${name}: empty carries — omit it`).toBeGreaterThan(0);
                expect(name, `${anatomy.scope}.${name}: the carrier re-carries nothing`).not.toBe(carrier);
                expect(part.pseudo, `${anatomy.scope}.${name}: a pseudo part cannot carry an attribute`).toBeUndefined();
                for (const axis of part.carries) expect(['color', 'size', 'variant']).toContain(axis);
            }
        }
        expect(carrying).toContain('timeline.marker');
        expect(carrying).toContain('steps.item');
        expect(carrying).toContain('stats.item');
    });

    it('an absorbable part is an asChild part with no element-bound declarations, never a parent', () => {
        // `absorbable` (#452/#493): the part may lend its asChild bag to a
        // host through `lend`, and then renders no element of its own — so
        // it cannot contain another part, and `hiddenIn`, `layout` and
        // `pseudo` would each describe an element that is not there.
        type Part = { absorbable?: unknown; asChild?: unknown; parent?: string; hiddenIn?: unknown; layout?: unknown; pseudo?: unknown };
        const absorbable: string[] = [];
        for (const anatomy of Object.values(anatomies)) {
            const parts: Record<string, Part> = anatomy.parts;
            const parents = new Set(Object.values(parts).map((p) => p.parent).filter((p) => p !== undefined));
            for (const [name, part] of Object.entries(parts)) {
                if (!('absorbable' in part)) continue;
                const at = `${anatomy.scope}.${name}`;
                absorbable.push(at);
                expect(part.absorbable, `${at}: absorbable is presence-only — true or omitted`).toBe(true);
                expect(part.asChild, `${at}: an absorbable part lends its asChild bag, so it must support asChild`).toBe(true);
                expect(parents.has(name), `${at}: an absorbed part renders no element, so no part can sit inside it`).toBe(false);
                expect(part.hiddenIn, `${at}: absorbable with hiddenIn`).toBeUndefined();
                expect(part.layout, `${at}: absorbable with layout`).toBeUndefined();
                expect(part.pseudo, `${at}: absorbable with pseudo`).toBeUndefined();
            }
        }
        expect(absorbable.sort()).toEqual([
            // Non-native mode only (#453): a <summary> cannot be lent.
            'collapsible.trigger',
            'dialog.cancel', 'dialog.close', 'dialog.trigger',
            'hover-card.trigger',
            'menu.context-trigger', 'menu.trigger',
            'popover.close', 'popover.trigger',
            'tooltip.trigger',
        ]);
        // The responsive Drawer's trigger hides itself through its own
        // anatomy when docked (`data-l-dock-above`), so it cannot be lent in
        // v1 (#452 decision F) — nor can its close.
        for (const [name, part] of Object.entries<Part>(anatomies.drawer.parts)) {
            expect(part.absorbable, `drawer.${name} must not be absorbable`).toBeUndefined();
        }
    });

    it('a paint declaration is consistent with its own part', () => {
        // `paint` (#31) is what the contrast audit measures as a mark. `only`
        // names one of the part's own flags; `host` names a rendered part
        // inside the declared parent; `glyph` is a real character; a pseudo
        // part renders nothing to measure.
        type P = { parent?: string; flags?: readonly string[]; pseudo?: unknown; paint?: true | { glyph?: string; only?: string; host?: string } };
        const painting: string[] = [];
        for (const anatomy of Object.values(anatomies)) {
            const parts = anatomy.parts as Record<string, P>;
            for (const [name, part] of Object.entries(parts)) {
                if (part.paint === undefined) continue;
                const at = `${anatomy.scope}.${name}`;
                painting.push(at);
                expect(part.pseudo, `${at}: a pseudo part paints nothing of its own`).toBeUndefined();
                if (part.paint === true) continue;
                expect(Object.keys(part.paint).length, `${at}: an empty paint object — declare paint: true`).toBeGreaterThan(0);
                if (part.paint.glyph !== undefined) expect(part.paint.glyph.length, `${at}: empty glyph`).toBeGreaterThan(0);
                if (part.paint.only !== undefined) expect(part.flags ?? [], `${at}: paint.only`).toContain(part.paint.only);
                if (part.paint.host !== undefined) {
                    const host = parts[part.paint.host];
                    expect(host, `${at}: paint.host "${part.paint.host}" is not a declared part`).toBeDefined();
                    expect(host.pseudo, `${at}: paint.host is a pseudo part`).toBeUndefined();
                    const chain: string[] = [];
                    for (let cursor = host.parent; cursor !== undefined; cursor = parts[cursor]?.parent) chain.push(cursor);
                    expect(part.parent, `${at}: paint.host needs a declared parent to refine`).toBeDefined();
                    expect(chain, `${at}: paint.host must sit inside the declared parent`).toContain(part.parent);
                }
            }
        }
        expect(painting).toContain('rating-group.item');
        expect(painting).toContain('menu.item-indicator');
    });

    it('every part the paint-only naming pattern picks declares paint', () => {
        // The part-name vocabulary reserves `indicator`, `<thing>-indicator`,
        // `thumb` and `range` for marks; one of those with no `text` hint and
        // no `paint` is a mark the contrast audit would silently skip.
        const undeclared: string[] = [];
        for (const anatomy of Object.values(anatomies)) {
            for (const [name, part] of Object.entries<{ tokens?: readonly string[]; paint?: unknown }>(anatomy.parts)) {
                if (/^(?:.*-)?(?:indicator|thumb|range)$/.test(name) && !part.tokens?.includes('text') && part.paint === undefined) {
                    undeclared.push(`${anatomy.scope}.${name}`);
                }
            }
        }
        expect(undeclared).toEqual([]);
    });
});
