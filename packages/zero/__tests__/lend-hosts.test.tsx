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
import { Box, Button, Card, Dialog, HoverCard, Menu, Popover, Tooltip } from '@sigx/zero';
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
    /** Renders the host with `class="own-class"`, so row 13's join is checked. */
    ownClass?: true;
}

/** Module → how to render its host(s) with a lent bag. */
const FIXTURES: Record<string, Fixture[]> = {
    'box/Box.tsx': [{
        scope: 'box',
        part: 'root',
        ownClass: true,
        render: (lend) => <Box lend={lend} class="own-class">Box</Box>,
    }],
    'card/Card.tsx': [{
        scope: 'card',
        part: 'root',
        ownClass: true,
        render: (lend) => <Card.Root lend={lend} class="own-class">Card</Card.Root>,
    }],
    'menu/Menu.tsx': [{
        scope: 'menu',
        part: 'context-trigger',
        ownClass: true,
        render: (lend) => (
            <Menu.Root>
                <Menu.ContextTrigger lend={lend} class="own-class">Surface</Menu.ContextTrigger>
                <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
            </Menu.Root>
        ),
    }, {
        scope: 'menu',
        part: 'trigger',
        ownClass: true,
        render: (lend) => (
            <Menu.Root>
                <Menu.Trigger lend={lend} class="own-class">Actions</Menu.Trigger>
                <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
            </Menu.Root>
        ),
    }],
    'popover/Popover.tsx': [{
        scope: 'popover',
        part: 'trigger',
        ownClass: true,
        render: (lend) => (
            <Popover.Root>
                <Popover.Trigger lend={lend} class="own-class">Details</Popover.Trigger>
                <Popover.Popup>Body</Popover.Popup>
            </Popover.Root>
        ),
    }, {
        scope: 'popover',
        part: 'close',
        ownClass: true,
        render: (lend) => (
            <Popover.Root>
                <Popover.Popup><Popover.Close lend={lend} class="own-class">Close</Popover.Close></Popover.Popup>
            </Popover.Root>
        ),
    }],
    'dialog/Dialog.tsx': [{
        scope: 'dialog',
        part: 'trigger',
        ownClass: true,
        render: (lend) => (
            <Dialog.Root>
                <Dialog.Trigger lend={lend} class="own-class">Open</Dialog.Trigger>
                <Dialog.Popup><Dialog.Title>Title</Dialog.Title></Dialog.Popup>
            </Dialog.Root>
        ),
    }, {
        scope: 'dialog',
        part: 'close',
        ownClass: true,
        render: (lend) => (
            <Dialog.Root>
                <Dialog.Popup><Dialog.Close lend={lend} class="own-class">Close</Dialog.Close></Dialog.Popup>
            </Dialog.Root>
        ),
    }, {
        scope: 'dialog',
        part: 'cancel',
        ownClass: true,
        render: (lend) => (
            <Dialog.Root>
                <Dialog.Popup><Dialog.Cancel lend={lend} class="own-class">Cancel</Dialog.Cancel></Dialog.Popup>
            </Dialog.Root>
        ),
    }],
    'hover-card/HoverCard.tsx': [{
        scope: 'hover-card',
        part: 'trigger',
        ownClass: true,
        render: (lend) => (
            <HoverCard.Root>
                <HoverCard.Trigger lend={lend} href="#profile" class="own-class">Profile</HoverCard.Trigger>
                <HoverCard.Popup>Card</HoverCard.Popup>
            </HoverCard.Root>
        ),
    }],
    'button/Button.tsx': [{
        scope: 'button',
        part: 'root',
        ownClass: true,
        render: (lend) => <Button.Root lend={lend} class="own-class">Archive</Button.Root>,
    }],
    'tooltip/Tooltip.tsx': [{
        scope: 'tooltip',
        part: 'trigger',
        ownClass: true,
        render: (lend) => (
            <Tooltip.Root>
                <Tooltip.Trigger lend={lend} class="own-class">Save</Tooltip.Trigger>
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
                    class: 'lent-class',
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
                // Row 13: class concatenates, neither side lost to prop order.
                expect(el.classList.contains('lent-class')).toBe(true);
                if (fixture.ownClass) expect(el.classList.contains('own-class')).toBe(true);
            });
        }
    }
});
