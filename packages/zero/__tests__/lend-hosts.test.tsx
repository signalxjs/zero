/**
 * The lend-host sweep (#452). A host opts into `lend` by adding `WithLend` to
 * its props type and wrapping its bag in `mergePartProps` — one line per
 * host, and 63 files build their bags inline, so nothing but this sweep
 * keeps the second half honest. It reads the component sources for every
 * props type that includes `WithLend`, and requires a row below for each:
 * a new host that no row renders fails here, and so does a row whose host
 * no longer takes `lend`.
 *
 * Each row renders the host with a probe bag and asserts that the host
 * keeps its own scope and part, joins `aria-describedby` (lender first),
 * fires the lent handler, and hands the lent ref its element.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from '@sigx/runtime-dom';
import type { JSXElement } from 'sigx';
import { Box, Card, Menu } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';

const COMPONENTS = resolve(import.meta.dirname, '../src/components');

/** Every `export type <Name> =` whose intersection includes `& WithLend`. */
function lendHosts(): string[] {
    const found: string[] = [];
    const files = readdirSync(COMPONENTS, { recursive: true, encoding: 'utf8' })
        .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
    for (const file of files) {
        const lines = readFileSync(join(COMPONENTS, file), 'utf8').split('\n');
        lines.forEach((line, i) => {
            if (!/^\s*&\s*WithLend\b/.test(line)) return;
            for (let j = i; j >= 0; j--) {
                const m = /^export type (\w+)\s*=/.exec(lines[j]!);
                if (m) { found.push(m[1]!); return; }
            }
            throw new Error(`${file}:${i + 1}: WithLend outside an exported props type`);
        });
    }
    return found.sort();
}

type Row = {
    /** The host's own part, as the rendered element carries it. */
    selector: string;
    render: (lend: PartProps) => JSXElement;
};

/** One row per lend host, keyed by its props type. */
const HOSTS: Record<string, Row> = {
    BoxRootProps: {
        selector: '[data-scope="box"][data-part="root"]',
        render: (lend) => <Box lend={lend} aria-describedby="own-desc">Box</Box>,
    },
    CardRootProps: {
        selector: '[data-scope="card"][data-part="root"]',
        render: (lend) => <Card.Root lend={lend} aria-describedby="own-desc">Card</Card.Root>,
    },
    MenuContextTriggerProps: {
        selector: '[data-scope="menu"][data-part="context-trigger"]',
        render: (lend) => (
            <Menu.Root>
                <Menu.ContextTrigger lend={lend} aria-describedby="own-desc">Surface</Menu.ContextTrigger>
                <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
            </Menu.Root>
        ),
    },
};

describe('lend hosts (#452)', () => {
    it('every props type that takes WithLend has a row, and every row is a host', () => {
        expect(lendHosts()).toEqual(Object.keys(HOSTS).sort());
    });

    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => { container.remove(); });

    for (const [name, row] of Object.entries(HOSTS)) {
        it(`${name}: keeps its anatomy, joins IDREFs, chains the lent handler and ref`, () => {
            const onClick = vi.fn();
            const ref = vi.fn();
            const probe = {
                'data-scope': 'probe',
                'data-part': 'lender',
                'aria-describedby': 'probe-desc',
                onClick,
                ref,
            } as unknown as PartProps;
            render(row.render(probe), container);

            const el = container.querySelector<HTMLElement>(row.selector);
            expect(el, `${name} renders ${row.selector}`).not.toBeNull();
            expect(container.querySelector('[data-scope="probe"]')).toBeNull();
            expect(el!.getAttribute('aria-describedby')).toBe('probe-desc own-desc');
            el!.click();
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(ref).toHaveBeenCalledWith(el);
        });
    }
});
