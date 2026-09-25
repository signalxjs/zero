import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { component, defineApp, signal } from 'sigx';
import { Combobox, Input, Textarea, caretAnchor, comboboxAnatomy, inputAnatomy, textareaAnatomy, zeroPlugin } from '@sigx/zero';
import type { ComboboxInsertDetail, TextAnchor } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface Person { id: string; name: string }
const PEOPLE: Person[] = [
    { id: 'ada', name: 'Ada' },
    { id: 'alan', name: 'Alan' },
    { id: 'grace', name: 'Grace' },
];

/** Type into the control the way a keystroke does: value, caret, input. */
function typeInto(el: HTMLTextAreaElement | HTMLInputElement, text: string, caret = text.length) {
    el.value = text;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

const key = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(e);
    return e;
};

describe('Combobox trigger mode (#58)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function harness(extra: { emptyText?: string; trigger?: string | RegExp; disabled?: boolean; anchor?: TextAnchor } = {}) {
        const state = signal({ draft: '', query: '', open: false, value: '' as unknown });
        const inserts: ComboboxInsertDetail<Person>[] = [];
        const sent: string[] = [];
        const valueChanges: unknown[] = [];
        render(
            <Combobox.Root
                trigger={extra.trigger ?? '@'}
                items={PEOPLE}
                itemKey={(p) => p.id}
                itemLabel={(p) => p.name}
                emptyText={extra.emptyText}
                disabled={extra.disabled}
                anchor={extra.anchor}
                model:inputValue={[state, 'query']}
                model:open={[state, 'open']}
                onValueChange={(v) => valueChanges.push(v)}
                onInsert={(d) => inserts.push(d)}
            >
                <Textarea.Root model={[state, 'draft']} name="message">
                    <Textarea.Label>Message</Textarea.Label>
                    <Textarea.Textarea
                        onKeydown={(e: KeyboardEvent) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sent.push(state.draft); }
                        }}
                    />
                </Textarea.Root>
            </Combobox.Root>,
            container,
        );
        return {
            state,
            inserts,
            sent,
            valueChanges,
            el: container.querySelector<HTMLTextAreaElement>('[data-scope="textarea"][data-part="textarea"]')!,
            popup: container.querySelector<HTMLElement>('[data-scope="combobox"][data-part="popup"]')!,
            items: () => [...container.querySelectorAll<HTMLElement>('[data-scope="combobox"][data-part="item"]')],
        };
    }

    it('the textarea is the control: autocomplete ARIA at rest, a combobox while open', async () => {
        const h = harness();
        expect(h.el.getAttribute('aria-autocomplete')).toBe('list');
        expect(h.el.getAttribute('aria-controls')).toBe(h.popup.id);
        expect(h.el.hasAttribute('role')).toBe(false);
        expect(h.el.hasAttribute('aria-expanded')).toBe(false);
        expect(h.popup.getAttribute('aria-labelledby')).toBe(h.el.id);
        // No input, no trigger button, no hidden select — the textarea posts itself.
        expect(container.querySelector('[data-scope="combobox"][data-part="input"]')).toBeNull();
        expect(container.querySelector('[data-scope="combobox"][data-part="hidden-input"]')).toBeNull();

        typeInto(h.el, 'hi @a');
        await tick();
        expect(h.state.open).toBe(true);
        expect(h.state.query).toBe('a');
        expect(h.el.getAttribute('role')).toBe('combobox');
        expect(h.el.getAttribute('aria-expanded')).toBe('true');
        // Contains-match on the label: Ada, Alan, Grace.
        expect(h.items().map((i) => i.textContent)).toEqual(['Ada', 'Alan', 'Grace']);
        // The first option is highlighted, so Enter commits at once.
        expect(h.el.getAttribute('aria-activedescendant')).toBe(h.items()[0]!.id);
        expectAnatomy(container, comboboxAnatomy);
        expectAnatomy(container, textareaAnatomy);
    });

    it('arrows move, Enter commits: the token becomes the label, the caret follows, the app never sees that Enter', async () => {
        const h = harness();
        typeInto(h.el, 'hi @al there', 6);
        await tick();
        expect(h.items().map((i) => i.textContent)).toEqual(['Alan']);
        typeInto(h.el, 'hi @a', 5);
        await tick();
        key(h.el, 'ArrowDown');
        await tick();
        expect(h.el.getAttribute('aria-activedescendant')).toBe(h.items()[1]!.id);
        const enter = key(h.el, 'Enter');
        await tick();
        expect(enter.defaultPrevented).toBe(true);
        expect(h.sent).toEqual([]);
        expect(h.el.value).toBe('hi @Alan ');
        expect(h.state.draft).toBe('hi @Alan ');
        expect(h.el.selectionStart).toBe(9);
        expect(h.inserts).toEqual([{ value: PEOPLE[1], label: 'Alan', text: '@Alan ' }]);
        expect(h.state.open).toBe(false);
        expect(h.el.hasAttribute('role')).toBe(false);
        // No selection model in trigger mode.
        expect(h.valueChanges).toEqual([]);
        expect(h.items().some((i) => i.hasAttribute('data-selected'))).toBe(false);
        // Closed, Enter is the app's again.
        key(h.el, 'Enter');
        expect(h.sent).toEqual(['hi @Alan ']);
    });

    it('replaces the whole word the caret is in', async () => {
        const h = harness();
        typeInto(h.el, '@grx and', 2);
        await tick();
        key(h.el, 'Tab');
        await tick();
        // The space already there is the one after the label — never two —
        // and the caret steps over it.
        expect(h.el.value).toBe('@Grace and');
        expect(h.el.selectionStart).toBe(7);
        expect(h.inserts.at(-1)?.text).toBe('@Grace');
    });

    it('the textarea unmounting drops the popup\'s label reference', async () => {
        const state = signal({ show: true });
        const App = component(() => () => (
            <Combobox.Root trigger="@" items={PEOPLE} itemLabel={(p) => p.name}>
                {state.show ? <Textarea.Root><Textarea.Textarea /></Textarea.Root> : null}
            </Combobox.Root>
        ));
        render(<App />, container);
        const popup = container.querySelector<HTMLElement>('[data-scope="combobox"][data-part="popup"]')!;
        expect(popup.getAttribute('aria-labelledby')).toBe(container.querySelector('textarea')!.id);
        state.show = false;
        await tick();
        expect(popup.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('Shift+Enter is still a line break', async () => {
        const h = harness();
        typeInto(h.el, '@a');
        await tick();
        const e = key(h.el, 'Enter', { shiftKey: true });
        expect(e.defaultPrevented).toBe(false);
        expect(h.inserts).toEqual([]);
    });

    it('Escape dismisses until the next edit', async () => {
        const h = harness();
        typeInto(h.el, '@a');
        await tick();
        const esc = key(h.el, 'Escape');
        await tick();
        expect(esc.defaultPrevented).toBe(true);
        expect(h.state.open).toBe(false);
        typeInto(h.el, '@ad');
        await tick();
        expect(h.state.open).toBe(true);
    });

    it('never opens inside a word, and closes once a space ends the token', async () => {
        const h = harness();
        typeInto(h.el, 'me@a');
        await tick();
        expect(h.state.open).toBe(false);
        typeInto(h.el, '@a');
        await tick();
        expect(h.state.open).toBe(true);
        typeInto(h.el, '@a ');
        await tick();
        expect(h.state.open).toBe(false);
    });

    it('a caret move re-reads the token', async () => {
        const h = harness();
        typeInto(h.el, '@ad hello');
        await tick();
        expect(h.state.open).toBe(false);
        h.el.setSelectionRange(3, 3);
        h.el.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
        await tick();
        expect(h.state.open).toBe(true);
        expect(h.state.query).toBe('ad');
    });

    it('closes when nothing matches, unless emptyText says so', async () => {
        const h = harness();
        typeInto(h.el, '@zz');
        await tick();
        expect(h.state.open).toBe(false);
        container.innerHTML = '';
        const other = document.body.appendChild(document.createElement('div'));
        container = other;
        const e = harness({ emptyText: 'Nobody' });
        typeInto(e.el, '@zz');
        await tick();
        expect(e.state.open).toBe(true);
        expect(other.querySelector('[data-scope="combobox"][data-part="empty"]')?.textContent).toBe('Nobody');
        // Nothing highlighted, so Enter is the app's.
        key(e.el, 'Enter');
        expect(e.sent).toEqual(['@zz']);
    });

    it('a click on an option commits and keeps focus in the textarea', async () => {
        const h = harness();
        h.el.focus();
        typeInto(h.el, 'cc @gr');
        await tick();
        const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        h.items()[0]!.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);
        h.items()[0]!.click();
        await tick();
        expect(h.el.value).toBe('cc @Grace ');
        expect(document.activeElement).toBe(h.el);
    });

    it('takes a RegExp trigger and keeps what it matched before the query', async () => {
        const h = harness({ trigger: /(?:^|\s)[@#](\w*)/ });
        typeInto(h.el, 'ping #gr');
        await tick();
        key(h.el, 'Enter');
        await tick();
        expect(h.el.value).toBe('ping #Grace ');
    });

    it('stays shut while disabled', async () => {
        const h = harness({ disabled: true });
        typeInto(h.el, '@a');
        await tick();
        expect(h.state.open).toBe(false);
    });

    it('hand-written items in a popup of your own', async () => {
        const state = signal({ draft: '', query: '' });
        const got: string[] = [];
        const List = component(() => () => (
            <>
                {['ada', 'grace'].filter((n) => n.includes(state.query)).map((n) => (
                    <Combobox.Item value={n} key={n}>{n.toUpperCase()}</Combobox.Item>
                ))}
            </>
        ));
        render(
            <Combobox.Root trigger="@" model:inputValue={[state, 'query']} onInsert={(d) => got.push(String(d.value))}>
                <Textarea.Root model={[state, 'draft']}>
                    <Textarea.Textarea />
                </Textarea.Root>
                <Combobox.Popup><List /></Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        const el = container.querySelector<HTMLTextAreaElement>('textarea')!;
        typeInto(el, '@gr');
        await tick();
        key(el, 'Enter');
        await tick();
        expect(el.value).toBe('@GRACE ');
        expect(got).toEqual(['grace']);
    });

    it('only the first textarea claims the control', async () => {
        render(
            <Combobox.Root trigger="@" items={PEOPLE} itemLabel={(p) => p.name}>
                <Textarea.Root><Textarea.Textarea /></Textarea.Root>
                <Textarea.Root><Textarea.Textarea /></Textarea.Root>
            </Combobox.Root>,
            container,
        );
        const [first, second] = [...container.querySelectorAll('textarea')];
        expect(first!.getAttribute('aria-autocomplete')).toBe('list');
        expect(second!.hasAttribute('aria-autocomplete')).toBe(false);
    });

    it('server-renders the autocomplete wiring', async () => {
        const app = defineApp(
            <Combobox.Root trigger="@" items={PEOPLE} itemLabel={(p) => p.name}>
                <Textarea.Root name="message"><Textarea.Textarea /></Textarea.Root>
            </Combobox.Root>,
        );
        app.use(zeroPlugin());
        const html = await renderToString(app);
        expect(html).toMatch(/<textarea[^>]*aria-autocomplete="list"[^>]*aria-controls="[^"]+-popup"/);
        expect(html).not.toMatch(/<textarea[^>]*role=/);
        expect(html).toMatch(/data-scope="combobox"[^>]*data-part="popup"[^>]*data-state="closed"/);
    });

    it('an item keyed "" is fine here — there is no placeholder sentinel to collide with', async () => {
        const got: unknown[] = [];
        render(
            <Combobox.Root trigger="@" items={['', 'Ada']} onInsert={(d) => got.push(d.label)}>
                <Textarea.Root><Textarea.Textarea /></Textarea.Root>
            </Combobox.Root>,
            container,
        );
        const el = container.querySelector('textarea')!;
        typeInto(el, '@ad');
        await tick();
        key(el, 'Enter');
        await tick();
        expect(got).toEqual(['Ada']);
    });

    describe('anchoring (#105)', () => {
        type Box = { left: number; top: number; width: number; height: number };
        const rect = ({ left, top, width, height }: Box): DOMRect =>
            ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;
        /** The textarea at (100, 200), 300×120; the typed `@` at (42, 36) inside it. */
        const stub = () => {
            const marker = { left: 42, top: 36, width: 9, height: 18 };
            vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
                if (this.tagName === 'SPAN') return rect(marker);
                if (this.tagName === 'TEXTAREA') return rect({ left: 100, top: 200, width: 300, height: 120 });
                return rect({ left: 0, top: 0, width: 0, height: 0 });
            });
        };
        afterEach(() => vi.restoreAllMocks());

        it('anchor={caretAnchor} opens the list at the token, not under the textarea', async () => {
            stub();
            const h = harness({ anchor: caretAnchor });
            typeInto(h.el, 'hi @a');
            await tick();
            expect(h.state.open).toBe(true);
            // Below the `@`'s line (236 + 18) by the 4px offset, at its inline start.
            expect(h.popup.style.left).toBe('142px');
            expect(h.popup.style.top).toBe('258px');
            expect(h.popup.getAttribute('data-placement')).toBe('bottom-start');
        });

        it('without an anchor, the list docks to the textarea\'s box', async () => {
            stub();
            const h = harness();
            typeInto(h.el, 'hi @a');
            await tick();
            expect(h.popup.style.left).toBe('100px');
            expect(h.popup.style.top).toBe('324px');
        });

        it('under rtl bottom-start aligns to the token\'s reading start, so the list opens towards the reading direction', async () => {
            stub();
            const h = harness({ anchor: caretAnchor });
            h.el.style.direction = 'rtl';
            typeInto(h.el, 'hi @a');
            await tick();
            expect(h.popup.getAttribute('data-placement')).toBe('bottom-start');
            // The `@`'s right edge (its inline start) — the list's own right edge sits there.
            expect(h.popup.style.left).toBe('151px');
        });

        it('under rtl a placement beside the token keeps its block alignment', async () => {
            stub();
            const state = signal({ draft: '' });
            render(
                <Combobox.Root trigger="@" items={PEOPLE} itemLabel={(p) => p.name} anchor={caretAnchor} placement="right-start">
                    <Textarea.Root model={[state, 'draft']}><Textarea.Textarea /></Textarea.Root>
                </Combobox.Root>,
                container,
            );
            const el = container.querySelector('textarea')!;
            el.style.direction = 'rtl';
            typeInto(el, 'hi @a');
            await tick();
            const popup = container.querySelector<HTMLElement>('[data-scope="combobox"][data-part="popup"]')!;
            expect(popup.getAttribute('data-placement')).toBe('right-start');
            expect(popup.style.top).toBe('236px');
        });

        it('a vertical writing mode falls back to the box', async () => {
            stub();
            const h = harness({ anchor: caretAnchor });
            h.el.style.writingMode = 'vertical-rl';
            typeInto(h.el, 'hi @a');
            await tick();
            expect(h.popup.style.left).toBe('100px');
        });
    });

    describe('itemInsert (#107)', () => {
        function insertHarness(itemInsert: NonNullable<Parameters<typeof Combobox.Root>[0]['itemInsert']>, trigger: string | RegExp = '@', children?: 'hand') {
            const state = signal({ draft: '' });
            const inserts: ComboboxInsertDetail<unknown>[] = [];
            render(
                children === 'hand'
                    ? (
                        <Combobox.Root trigger={trigger} itemInsert={itemInsert} onInsert={(d) => inserts.push(d)}>
                            <Textarea.Root model={[state, 'draft']}><Textarea.Textarea /></Textarea.Root>
                            <Combobox.Popup>
                                <Combobox.Item value="ada">Ada</Combobox.Item>
                            </Combobox.Popup>
                        </Combobox.Root>
                    )
                    : (
                        <Combobox.Root trigger={trigger} items={PEOPLE} itemKey={(p) => p.id} itemLabel={(p) => p.name} itemInsert={itemInsert} onInsert={(d) => inserts.push(d)}>
                            <Textarea.Root model={[state, 'draft']}><Textarea.Textarea /></Textarea.Root>
                        </Combobox.Root>
                    ),
                container,
            );
            return { state, inserts, el: container.querySelector('textarea')! };
        }

        it('replaces the default text: an id-bearing mention, no space added', async () => {
            const seen: unknown[] = [];
            const h = insertHarness((d) => {
                seen.push(d);
                return `${d.prefix}[${d.label}](user:${(d.item as Person).id})`;
            });
            typeInto(h.el, 'hi @al and', 6);
            await tick();
            key(h.el, 'Enter');
            await tick();
            expect(seen).toEqual([{ item: PEOPLE[1], value: PEOPLE[1], key: 'alan', label: 'Alan', prefix: '@', query: 'al' }]);
            // Inserted as returned — the following space is not stepped over.
            expect(h.el.value).toBe('hi @[Alan](user:alan) and');
            expect(h.el.selectionStart).toBe(21);
            expect(h.state.draft).toBe('hi @[Alan](user:alan) and');
            expect(h.inserts.at(-1)).toEqual({ value: PEOPLE[1], label: 'Alan', text: '@[Alan](user:alan)' });
        });

        it('may drop the prefix: an emoji for a `:` trigger', async () => {
            const h = insertHarness(({ label }) => (label === 'Grace' ? '🎉' : label), ':');
            typeInto(h.el, 'yay :gr');
            await tick();
            key(h.el, 'Tab');
            await tick();
            expect(h.el.value).toBe('yay 🎉');
            expect(h.el.selectionStart).toBe(6);
        });

        it('a RegExp trigger hands over what it matched before the query', async () => {
            const seen: string[] = [];
            const h = insertHarness(({ prefix, label }) => { seen.push(prefix); return `${prefix}${label}`; }, /(?:^|\s)#(\w*)/);
            typeInto(h.el, 'ping #gr');
            await tick();
            key(h.el, 'Enter');
            await tick();
            expect(seen).toEqual([' #']);
            expect(h.el.value).toBe('ping #Grace');
        });

        it('a hand-written option has no data item', async () => {
            const seen: unknown[] = [];
            const h = insertHarness((d) => { seen.push(d.item); return `<${d.value as string}>`; }, '@', 'hand');
            typeInto(h.el, '@ad');
            await tick();
            key(h.el, 'Enter');
            await tick();
            expect(seen).toEqual([undefined]);
            expect(h.el.value).toBe('<ada>');
        });
    });

    describe('Input.Input as the control (#106)', () => {
        const COMMANDS = ['deploy', 'describe', 'help'];
        function inputHarness(anchor?: TextAnchor) {
            const state = signal({ line: '', open: false });
            const inserts: ComboboxInsertDetail<string>[] = [];
            const ran: string[] = [];
            render(
                <Combobox.Root trigger="/" items={COMMANDS} anchor={anchor} model:open={[state, 'open']} onInsert={(d) => inserts.push(d)}>
                    <Input.Root model={[state, 'line']} name="command">
                        <Input.Label>Command</Input.Label>
                        <Input.Control>
                            <Input.Input
                                onKeydown={(e: KeyboardEvent) => {
                                    if (e.key === 'Enter') { e.preventDefault(); ran.push(state.line); }
                                }}
                            />
                        </Input.Control>
                    </Input.Root>
                </Combobox.Root>,
                container,
            );
            return {
                state,
                inserts,
                ran,
                el: container.querySelector<HTMLInputElement>('[data-scope="input"][data-part="input"]')!,
                popup: container.querySelector<HTMLElement>('[data-scope="combobox"][data-part="popup"]')!,
                items: () => [...container.querySelectorAll<HTMLElement>('[data-scope="combobox"][data-part="item"]')],
            };
        }

        it('the input is the control: autocomplete ARIA at rest, a combobox while open', async () => {
            const h = inputHarness();
            expect(h.el.getAttribute('aria-autocomplete')).toBe('list');
            expect(h.el.hasAttribute('role')).toBe(false);
            expect(h.popup.getAttribute('aria-labelledby')).toBe(h.el.id);
            typeInto(h.el, '/de');
            await tick();
            expect(h.state.open).toBe(true);
            expect(h.el.getAttribute('role')).toBe('combobox');
            expect(h.el.getAttribute('aria-expanded')).toBe('true');
            expect(h.items().map((i) => i.textContent)).toEqual(['deploy', 'describe']);
            expect(h.el.getAttribute('aria-activedescendant')).toBe(h.items()[0]!.id);
            expectAnatomy(container, comboboxAnatomy);
            expectAnatomy(container, inputAnatomy);
        });

        it('Enter commits into the line; the app sees Enter only while the list is closed', async () => {
            const h = inputHarness();
            typeInto(h.el, 'run /des');
            await tick();
            const enter = key(h.el, 'Enter');
            await tick();
            expect(enter.defaultPrevented).toBe(true);
            expect(h.ran).toEqual([]);
            expect(h.el.value).toBe('run /describe ');
            expect(h.state.line).toBe('run /describe ');
            expect(h.el.selectionStart).toBe(14);
            expect(h.inserts).toEqual([{ value: 'describe', label: 'describe', text: '/describe ' }]);
            expect(h.state.open).toBe(false);
            key(h.el, 'Enter');
            expect(h.ran).toEqual(['run /describe ']);
        });

        it('a caret move re-reads the token; Escape dismisses until the next edit', async () => {
            const h = inputHarness();
            typeInto(h.el, '/he and more', 3);
            await tick();
            expect(h.state.open).toBe(true);
            h.el.setSelectionRange(8, 8);
            h.el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await tick();
            expect(h.state.open).toBe(false);
            typeInto(h.el, '/h');
            await tick();
            key(h.el, 'Escape');
            await tick();
            expect(h.state.open).toBe(false);
            typeInto(h.el, '/he');
            await tick();
            expect(h.state.open).toBe(true);
        });

        it('caretAnchor measures a single line: the list opens under the input, at the token', async () => {
            const box = { left: 100, top: 200, width: 300, height: 40 };
            vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
                const r = this.tagName === 'SPAN' ? { left: 58, top: 11, width: 9, height: 18 }
                    : this.tagName === 'INPUT' ? box : { left: 0, top: 0, width: 0, height: 0 };
                return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => ({}) } as DOMRect;
            });
            try {
                const h = inputHarness(caretAnchor);
                typeInto(h.el, 'go /d');
                await tick();
                expect(h.popup.style.left).toBe('158px');
                // Below the input's box, not the glyph: an input is one line.
                expect(h.popup.style.top).toBe('244px');
            } finally {
                vi.restoreAllMocks();
            }
        });

        it('the first control claims — an input before a textarea keeps it', () => {
            render(
                <Combobox.Root trigger="@" items={PEOPLE} itemLabel={(p) => p.name}>
                    <Input.Root><Input.Input /></Input.Root>
                    <Textarea.Root><Textarea.Textarea /></Textarea.Root>
                </Combobox.Root>,
                container,
            );
            expect(container.querySelector('input')!.getAttribute('aria-autocomplete')).toBe('list');
            expect(container.querySelector('textarea')!.hasAttribute('aria-autocomplete')).toBe(false);
        });

        it('an input that unmounts releases the claim', async () => {
            const state = signal({ show: true });
            const App = component(() => () => (
                <Combobox.Root trigger="@" items={PEOPLE} itemLabel={(p) => p.name}>
                    {state.show ? <Input.Root><Input.Input /></Input.Root> : null}
                </Combobox.Root>
            ));
            render(<App />, container);
            const popup = container.querySelector<HTMLElement>('[data-scope="combobox"][data-part="popup"]')!;
            expect(popup.getAttribute('aria-labelledby')).toBe(container.querySelector('input')!.id);
            state.show = false;
            await tick();
            expect(popup.hasAttribute('aria-labelledby')).toBe(false);
        });

        it('server-renders the autocomplete wiring on the input', async () => {
            const app = defineApp(
                <Combobox.Root trigger="/" items={COMMANDS}>
                    <Input.Root name="command"><Input.Input /></Input.Root>
                </Combobox.Root>,
            );
            app.use(zeroPlugin());
            const html = await renderToString(app);
            expect(html).toMatch(/<input[^>]*aria-autocomplete="list"[^>]*aria-controls="[^"]+-popup"/);
            expect(html).not.toMatch(/<input[^>]*role=/);
        });

        it('an Input outside a trigger-mode Combobox is untouched', () => {
            render(<Input.Root><Input.Input /></Input.Root>, container);
            expect(container.querySelector('input')!.hasAttribute('aria-autocomplete')).toBe(false);
        });
    });

    it('an empty trigger is no trigger: the ordinary composition renders', () => {
        render(
            <Combobox.Root trigger="" items={['Ada']}>
                <Textarea.Root><Textarea.Textarea /></Textarea.Root>
            </Combobox.Root>,
            container,
        );
        expect(container.querySelector('textarea')!.hasAttribute('aria-autocomplete')).toBe(false);
    });

    it('leaves a plain Combobox untouched: no binding without a trigger', () => {
        const spy = vi.fn();
        render(
            <Combobox.Root onInsert={spy}>
                <Textarea.Root><Textarea.Textarea /></Textarea.Root>
            </Combobox.Root>,
            container,
        );
        expect(container.querySelector('textarea')!.hasAttribute('aria-autocomplete')).toBe(false);
    });
});
