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
            'accordion', 'alert', 'avatar', 'badge', 'box', 'breadcrumbs', 'button', 'card', 'carousel', 'center', 'chat', 'checkbox', 'collapsible',
            'combobox', 'container', 'countdown', 'dialog', 'diff', 'divider', 'drawer', 'field', 'file-upload', 'grid', 'indicator', 'input', 'join', 'kbd', 'menu',
            'navbar', 'number-input', 'pagination', 'popover', 'progress', 'radial-progress', 'radio-group',
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
            'alert.root', 'avatar.fallback', 'avatar.image', 'tabs.panel', 'tree-view.branch-content',
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
        // the content-tier parts that anchor along an axis (#334).
        // The DOM half is asserted by expectAnatomy in each component's tests.
        expect(declared.sort()).toEqual([
            'chat.root', 'combobox.popup', 'drawer.panel', 'indicator.item', 'menu.popup', 'menu.sub-popup',
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
});
