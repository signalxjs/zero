/**
 * Every lend host keeps its word (#452, #494).
 *
 * A host is opt-in: a component whose props take `WithLend` and wraps its
 * bag in `mergePartProps(props.lend, …)`. The sweep finds the hosts by
 * reading the component sources — textual on purpose, as in
 * `model-parity.test.ts` — and holds that list to the fixtures below both
 * ways: a new host without a fixture fails, and so does a fixture whose
 * component stopped being one.
 *
 * Each host renders with a probe bag standing in for a lender, and must:
 * keep its own `data-scope`/`data-part`, join the lent `aria-describedby`,
 * fire the lent `onClick`, and hand the lent ref the element.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import type { JSXElement } from 'sigx';
import { Button, Tooltip } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';

const componentsDir = resolve(import.meta.dirname, '../src/components');

/** Every `.tsx` under `src/components`, as a path relative to it. */
function componentSources(dir = componentsDir): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) return componentSources(path);
        return entry.name.endsWith('.tsx') ? [relative(componentsDir, path).split('\\').join('/')] : [];
    });
}

/**
 * The modules whose props include `WithLend` anywhere in a type — an alias
 * body, an intersection or union member, a generic argument, an `extends`
 * clause (the contract's own declaration lives outside `components/`). Import
 * declarations are stripped first, so importing the type is not hosting it.
 */
const IMPORTS = /^import\b[^;]*;/gm;
const USES_WITH_LEND = /(?:^|[=&|,(<]|extends)\s*WithLend\b/m;
const hosts = componentSources()
    .filter((file) => USES_WITH_LEND.test(readFileSync(resolve(componentsDir, file), 'utf8').replace(IMPORTS, '')))
    .sort();

interface Fixture {
    /** The host's own anatomy, which must survive the lent bag. */
    scope: string;
    part: string;
    render(lend: PartProps): JSXElement;
}

/** Module → how to render its host(s) with a lent bag. */
const FIXTURES: Record<string, Fixture[]> = {
    'button/Button.tsx': [{
        scope: 'button',
        part: 'root',
        render: (lend) => <Button.Root lend={lend}>Archive</Button.Root>,
    }],
    'tooltip/Tooltip.tsx': [{
        scope: 'tooltip',
        part: 'trigger',
        render: (lend) => (
            <Tooltip.Root>
                <Tooltip.Trigger lend={lend}>Save</Tooltip.Trigger>
                <Tooltip.Popup>Save the document</Tooltip.Popup>
            </Tooltip.Root>
        ),
    }],
};

describe('lend hosts (#452)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => container.remove());

    it('the sweep and the fixtures name the same modules', () => {
        expect(hosts).toEqual(Object.keys(FIXTURES).sort());
    });

    it('every host wraps its bag in mergePartProps(props.lend, …)', () => {
        for (const file of hosts) {
            const source = readFileSync(resolve(componentsDir, file), 'utf8');
            expect(source, file).toMatch(/mergePartProps\(props\.lend,/);
        }
    });

    for (const [file, fixtures] of Object.entries(FIXTURES)) {
        for (const fixture of fixtures) {
            it(`${file}: ${fixture.scope}.${fixture.part} keeps its anatomy and takes the lent behaviour`, () => {
                const onClick = vi.fn();
                const ref = vi.fn();
                const probe = {
                    'data-scope': 'probe',
                    'data-part': 'trigger',
                    'aria-describedby': 'probe-desc',
                    onClick,
                    ref,
                } as unknown as PartProps;
                render(fixture.render(probe), container);

                expect(container.querySelector('[data-scope="probe"]')).toBeNull();
                const el = container.querySelector<HTMLElement>(
                    `[data-scope="${fixture.scope}"][data-part="${fixture.part}"]`,
                )!;
                expect(el).not.toBeNull();
                expect(el.getAttribute('aria-describedby')?.split(' ')).toContain('probe-desc');
                el.click();
                expect(onClick).toHaveBeenCalledTimes(1);
                expect(ref).toHaveBeenCalledWith(el);
            });
        }
    }
});
