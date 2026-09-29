import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import type { JSXElement } from 'sigx';
import {
    Dialog, Drawer, HoverCard, Menu, Popover, Tooltip,
    dialogAnatomy, drawerAnatomy, hoverCardAnatomy, menuAnatomy, popoverAnatomy, tooltipAnatomy,
} from '@sigx/zero';
import type { Anatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/**
 * #514: the fragment-rooted scopes carry their axis props on the trigger,
 * and the popup — a top-layer sibling no selector rooted on the trigger can
 * reach — mirrors every axis attribute the trigger renders (`mirrorsAxes`
 * in the anatomy). One prop surface, two elements, kept in step.
 */

type Axes = {
    color?: string;
    size?: string;
    variant?: string;
    axes?: Record<string, string>;
    mods?: Record<string, boolean>;
};

interface Case {
    scope: string;
    anatomy: Anatomy;
    /** The popup part — `panel` on the drawer. */
    popup: string;
    view(axes: Axes, showTrigger: boolean): JSXElement;
}

const cases: Case[] = [
    {
        scope: 'dialog',
        anatomy: dialogAnatomy,
        popup: 'popup',
        view: (a, t) => (
            <Dialog.Root>
                {t ? <Dialog.Trigger {...a}>Open</Dialog.Trigger> : null}
                <Dialog.Popup><Dialog.Title>Title</Dialog.Title></Dialog.Popup>
            </Dialog.Root>
        ),
    },
    {
        scope: 'drawer',
        anatomy: drawerAnatomy,
        popup: 'panel',
        view: (a, t) => (
            <Drawer.Root label="Nav">
                {t ? <Drawer.Trigger {...a}>Open</Drawer.Trigger> : null}
                <Drawer.Panel>Links</Drawer.Panel>
            </Drawer.Root>
        ),
    },
    {
        scope: 'popover',
        anatomy: popoverAnatomy,
        popup: 'popup',
        view: (a, t) => (
            <Popover.Root>
                {t ? <Popover.Trigger {...a}>Open</Popover.Trigger> : null}
                <Popover.Popup>Body</Popover.Popup>
            </Popover.Root>
        ),
    },
    {
        scope: 'tooltip',
        anatomy: tooltipAnatomy,
        popup: 'popup',
        view: (a, t) => (
            <Tooltip.Root>
                {t ? <Tooltip.Trigger {...a}>Save</Tooltip.Trigger> : null}
                <Tooltip.Popup>Save the document</Tooltip.Popup>
            </Tooltip.Root>
        ),
    },
    {
        scope: 'hover-card',
        anatomy: hoverCardAnatomy,
        popup: 'popup',
        view: (a, t) => (
            <HoverCard.Root>
                {t ? <HoverCard.Trigger href="/ada" {...a}>@ada</HoverCard.Trigger> : null}
                <HoverCard.Popup>Ada</HoverCard.Popup>
            </HoverCard.Root>
        ),
    },
    {
        scope: 'menu',
        anatomy: menuAnatomy,
        popup: 'popup',
        view: (a, t) => (
            <Menu.Root>
                {t ? <Menu.Trigger {...a}>Actions</Menu.Trigger> : null}
                <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
            </Menu.Root>
        ),
    },
];

const tick = () => new Promise((r) => setTimeout(r, 0));

const AXIS_ATTRS = ['data-color', 'data-size', 'data-variant', 'data-tone', 'data-mod-dense'];

function axisBag(el: HTMLElement): Record<string, string | null> {
    return Object.fromEntries(AXIS_ATTRS.map((a) => [a, el.getAttribute(a)]));
}

describe('overlay popups mirror their trigger\'s axes (#514)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    for (const c of cases) {
        const part = (name: string) =>
            container.querySelector<HTMLElement>(`[data-scope="${c.scope}"][data-part="${name}"]`)!;

        it(`${c.scope}: the ${c.popup} renders every axis attribute its trigger does`, () => {
            render(c.view({ color: 'primary', size: 'lg', variant: 'rich', axes: { tone: 'warm' }, mods: { dense: true } }, true), container);
            const trigger = part('trigger');
            const popup = part(c.popup);
            expect(axisBag(trigger)).toEqual({
                'data-color': 'primary', 'data-size': 'lg', 'data-variant': 'rich', 'data-tone': 'warm', 'data-mod-dense': '',
            });
            expect(axisBag(popup)).toEqual(axisBag(trigger));
            // The anatomy declares the mirror, so the contract accepts it.
            expectAnatomy(container, c.anatomy, { axes: ['tone'] });
        });

        it(`${c.scope}: the mirror follows the trigger's props`, async () => {
            const s = signal({ variant: 'plain' as string | undefined, dense: false });
            const App = component(() => () => c.view({ variant: s.variant, mods: { dense: s.dense } }, true));
            render(<App />, container);
            expect(part(c.popup).getAttribute('data-variant')).toBe('plain');
            s.variant = 'rich';
            s.dense = true;
            await tick();
            expect(part(c.popup).getAttribute('data-variant')).toBe('rich');
            expect(part(c.popup).getAttribute('data-mod-dense')).toBe('');
            s.variant = undefined;
            s.dense = false;
            await tick();
            expect(part(c.popup).hasAttribute('data-variant')).toBe(false);
            expect(part(c.popup).hasAttribute('data-mod-dense')).toBe(false);
        });

        it(`${c.scope}: with no trigger the ${c.popup} mirrors nothing, and a trigger that leaves takes its axes along`, async () => {
            const s = signal({ trigger: true });
            const App = component(() => () => c.view({ color: 'primary', variant: 'rich' }, s.trigger));
            render(<App />, container);
            expect(part(c.popup).getAttribute('data-variant')).toBe('rich');
            s.trigger = false;
            await tick();
            expect(axisBag(part(c.popup))).toEqual(Object.fromEntries(AXIS_ATTRS.map((a) => [a, null])));
        });
    }
});
