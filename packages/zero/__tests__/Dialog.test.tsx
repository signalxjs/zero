import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Dialog, dialogAnatomy } from '@sigx/zero';
import type { DialogCloseDetail } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** Presence flags land one microtask after the render pass; settle them. */
const tick = () => new Promise((r) => setTimeout(r, 0));

function mount(container: HTMLElement, state: { open: boolean }) {
    render(
        <Dialog.Root model={[state, 'open']}>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Popup>
                <Dialog.Title>Title</Dialog.Title>
                <Dialog.Description>Description</Dialog.Description>
                <Dialog.Footer>
                    <Dialog.Close>Close</Dialog.Close>
                </Dialog.Footer>
            </Dialog.Popup>
        </Dialog.Root>,
        container,
    );
}

describe('Dialog', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy on a native dialog element', () => {
        mount(container, signal({ open: false }));
        expectAnatomy(container, dialogAnatomy);
        expect(container.querySelector('dialog[data-part="popup"]')).not.toBeNull();
        expect(container.querySelector('footer[data-part="footer"]')).not.toBeNull();
        // The backdrop part renders no element — it projects onto the native
        // ::backdrop; only recipes ever address it.
        expect(container.querySelector('[data-part="backdrop"]')).toBeNull();
    });

    it('passes the variant axes through on the trigger (the carrier part)', () => {
        render(
            <Dialog.Root>
                <Dialog.Trigger color="primary" size="sm">Open</Dialog.Trigger>
            </Dialog.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="dialog"][data-part="trigger"]')!;
        expect(trigger.getAttribute('data-color')).toBe('primary');
        expect(trigger.getAttribute('data-size')).toBe('sm');
    });

    it('labels the popup from rendered title and description', async () => {
        mount(container, signal({ open: false }));
        await tick();
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        const title = container.querySelector<HTMLElement>('[data-part="title"]')!;
        const description = container.querySelector<HTMLElement>('[data-part="description"]')!;
        expect(popup.getAttribute('aria-labelledby')).toBe(title.id);
        expect(popup.getAttribute('aria-describedby')).toBe(description.id);
    });

    it('omits the label refs when Title and Description are not rendered', async () => {
        render(
            <Dialog.Root>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        await tick();
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        // An aria-labelledby pointing at a never-rendered id names NOTHING —
        // worse than no reference, it hides the popup's own content from the
        // accessible-name computation.
        expect(popup.hasAttribute('aria-labelledby')).toBe(false);
        expect(popup.hasAttribute('aria-describedby')).toBe(false);
    });

    it('trigger opens, close closes, state stays in the model', () => {
        const state = signal({ open: false });
        mount(container, state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        trigger.click();
        expect(state.open).toBe(true);
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('open');

        container.querySelector<HTMLElement>('[data-part="close"]')!.click();
        expect(state.open).toBe(false);
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('publishes press feedback on the trigger and the close button', () => {
        mount(container, signal({ open: true }));
        for (const part of ['trigger', 'close'] as const) {
            const el = container.querySelector<HTMLElement>(`[data-part="${part}"]`)!;
            el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
            expect(el.hasAttribute('data-pressed')).toBe(true);
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            expect(el.hasAttribute('data-pressed')).toBe(false);
        }
    });

    it('publishes no press feedback on a disabled trigger', () => {
        render(
            <Dialog.Root model={[signal({ open: false }), 'open']}>
                <Dialog.Trigger disabled>Open</Dialog.Trigger>
            </Dialog.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('modal={false}: Escape dismisses through the fallback layer (no native cancel)', async () => {
        const state = signal({ open: true });
        render(
            <Dialog.Root model={[state, 'open']} modal={false}>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Title</Dialog.Title>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        await tick();
        // A non-modal <dialog> fires no cancel event, so without the
        // fallback Escape is a silent no-op.
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(state.open).toBe(false);
    });

    it('modal={false} + dismissible={false}: Escape leaves it open', async () => {
        const state = signal({ open: true });
        render(
            <Dialog.Root model={[state, 'open']} modal={false} dismissible={false}>
                <Dialog.Popup>
                    <Dialog.Title>Title</Dialog.Title>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        await tick();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(state.open).toBe(true);
    });

    it('modal={false}: restores focus to the previously focused element on close', async () => {
        const state = signal({ open: false });
        mountNonModal(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        expect(state.open).toBe(true);
        await tick();
        // Focus wandered into the dialog while it was open…
        container.querySelector<HTMLElement>('[data-part="close"]')!.focus();
        state.open = false;
        await tick();
        // …showModal() would restore natively; show() does not — the
        // component must.
        expect(document.activeElement).toBe(trigger);
    });

    function mountNonModal(state: { open: boolean }) {
        render(
            <Dialog.Root model={[state, 'open']} modal={false}>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Title</Dialog.Title>
                    <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
    }

    it('a click on the dialog surface itself (padding) does not close; the backdrop does', () => {
        const state = signal({ open: true });
        mount(container, state);
        const popup = container.querySelector<HTMLDialogElement>('dialog')!;
        popup.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        // Inside the dialog's own box: its padding, not the backdrop.
        popup.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 50, detail: 1, bubbles: true }));
        expect(state.open).toBe(true);
        // Outside the box: only the ::backdrop can be there.
        popup.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 50, detail: 1, bubbles: true }));
        expect(state.open).toBe(false);
    });

    it('modal={false}: a click targeting the dialog never closes (there is no backdrop)', () => {
        const state = signal({ open: true });
        mountNonModal(state);
        const popup = container.querySelector<HTMLDialogElement>('dialog')!;
        popup.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        popup.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 50, detail: 1, bubbles: true }));
        expect(state.open).toBe(true);
    });

    it('native close events sync back into the model', () => {
        const state = signal({ open: true });
        mount(container, state);
        const popup = container.querySelector<HTMLDialogElement>('dialog')!;
        popup.dispatchEvent(new Event('close'));
        expect(state.open).toBe(false);
    });
});

describe('Dialog as alertdialog', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mountAlert(state: { open: boolean }, opts: { role?: 'dialog' | 'alertdialog' } = {}) {
        render(
            <Dialog.Root model={[state, 'open']} role={opts.role ?? 'alertdialog'}>
                <Dialog.Trigger>Delete…</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Delete file?</Dialog.Title>
                    <Dialog.Description>This cannot be undone.</Dialog.Description>
                    <Dialog.Footer>
                        <Dialog.Cancel>Cancel</Dialog.Cancel>
                        <Dialog.Close>Delete</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
    }

    it('renders role="alertdialog" on the popup, and a valid anatomy with the cancel part', () => {
        mountAlert(signal({ open: true }));
        expectAnatomy(container, dialogAnatomy);
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(popup.getAttribute('role')).toBe('alertdialog');
        expect(container.querySelector('button[data-part="cancel"]')).not.toBeNull();
    });

    it('the default role stays the native dialog (no role attribute)', () => {
        const state = signal({ open: true });
        mount(container, state);
        expect(container.querySelector<HTMLElement>('[data-part="popup"]')!.hasAttribute('role')).toBe(false);
    });

    it('a backdrop click does NOT dismiss an alertdialog', () => {
        const state = signal({ open: true });
        mountAlert(state);
        const popup = container.querySelector<HTMLDialogElement>('dialog')!;
        popup.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        popup.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 50, detail: 1, bubbles: true }));
        expect(state.open).toBe(true);
    });

    it('Escape (native cancel) still closes an alertdialog unless dismissible={false}', () => {
        const state = signal({ open: true });
        mountAlert(state);
        const popup = container.querySelector<HTMLDialogElement>('dialog')!;
        popup.dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(state.open).toBe(false);
    });

    it('Cancel is the least-destructive action: it closes, and carries autofocus in alertdialog mode', () => {
        const state = signal({ open: true });
        mountAlert(state);
        const cancel = container.querySelector<HTMLButtonElement>('[data-part="cancel"]')!;
        // `showModal()`'s focusing steps land on the first autofocus element —
        // the platform seam APG's "focus the least destructive action" rides.
        expect(cancel.hasAttribute('autofocus')).toBe(true);
        cancel.click();
        expect(state.open).toBe(false);
    });

    it('Cancel in a plain dialog closes but claims no autofocus', () => {
        const state = signal({ open: true });
        mountAlert(state, { role: 'dialog' });
        const cancel = container.querySelector<HTMLButtonElement>('[data-part="cancel"]')!;
        expect(cancel.hasAttribute('autofocus')).toBe(false);
        cancel.click();
        expect(state.open).toBe(false);
    });
});

describe('Dialog close reason (#52)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    /** Mounts an open dialog and records every event, in order. */
    function mountRecorded(state: { open: boolean }, opts: { modal?: boolean } = {}) {
        const log: Array<[string, unknown]> = [];
        render(
            <Dialog.Root
                model={[state, 'open']}
                modal={opts.modal}
                onOpenChange={(open: boolean) => log.push(['openChange', open])}
                onClose={(detail: DialogCloseDetail) => log.push(['close', detail])}
            >
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Delete file?</Dialog.Title>
                    <Dialog.Footer>
                        <Dialog.Cancel>Cancel</Dialog.Cancel>
                        <Dialog.Close value="confirm">Delete</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        return log;
    }

    const popupOf = () => {
        const popup = container.querySelector<HTMLDialogElement>('dialog')!;
        popup.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        return popup;
    };

    it('Dialog.Close reports `close` with its value, after openChange(false)', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        container.querySelector<HTMLElement>('[data-part="close"]')!.click();
        expect(state.open).toBe(false);
        expect(log).toEqual([['openChange', false], ['close', { reason: 'close', value: 'confirm' }]]);
    });

    it('Dialog.Cancel reports `cancel`, with no value', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        container.querySelector<HTMLElement>('[data-part="cancel"]')!.click();
        expect(log).toEqual([['openChange', false], ['close', { reason: 'cancel' }]]);
    });

    it('Escape reports `escape` — the native cancel, and the non-modal dismiss layer', async () => {
        const modal = signal({ open: true });
        const log = mountRecorded(modal);
        popupOf().dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(log).toEqual([['openChange', false], ['close', { reason: 'escape' }]]);

        const other = document.createElement('div');
        document.body.appendChild(other);
        container = other;
        const inline = signal({ open: true });
        const inlineLog = mountRecorded(inline, { modal: false });
        await tick();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(inline.open).toBe(false);
        expect(inlineLog).toEqual([['openChange', false], ['close', { reason: 'escape' }]]);
    });

    it('a backdrop click reports `backdrop`', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        popupOf().dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 50, detail: 1, bubbles: true }));
        expect(log).toEqual([['openChange', false], ['close', { reason: 'backdrop' }]]);
    });

    it('the parent writing the model reports `programmatic` — and no openChange, which only reports zero\'s writes', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        state.open = false;
        expect(log).toEqual([['close', { reason: 'programmatic' }]]);
        // Reopening and closing through a part reports that part, not a
        // leftover from the last close.
        state.open = true;
        container.querySelector<HTMLElement>('[data-part="cancel"]')!.click();
        expect(log.at(-1)).toEqual(['close', { reason: 'cancel' }]);
    });

    it('a native close zero did not start reports `programmatic` with the returnValue', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        const popup = popupOf();
        // What a <form method="dialog"> submitter leaves behind.
        popup.returnValue = 'save';
        popup.dispatchEvent(new Event('close'));
        expect(state.open).toBe(false);
        expect(log).toEqual([['openChange', false], ['close', { reason: 'programmatic', value: 'save' }]]);
    });

    it('reports each close exactly once — the native close event that follows a requested close is not a second one', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        container.querySelector<HTMLElement>('[data-part="close"]')!.click();
        popupOf().dispatchEvent(new Event('close'));
        expect(log.filter(([name]) => name === 'close')).toHaveLength(1);
    });

    it('a controlled parent that refuses the close gets no close event', () => {
        const log: unknown[] = [];
        render(
            <Dialog.Root
                model={[{ get open() { return true; }, set open(_v: boolean) {} }, 'open']}
                onClose={(detail: DialogCloseDetail) => log.push(detail)}
            >
                <Dialog.Popup>
                    <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        container.querySelector<HTMLElement>('[data-part="close"]')!.click();
        expect(log).toEqual([]);
    });

    it('forwards `value` to the rendered button, as <form method="dialog"> would read it', () => {
        mountRecorded(signal({ open: true }));
        expect(container.querySelector<HTMLElement>('[data-part="close"]')!.getAttribute('value')).toBe('confirm');
        expect(container.querySelector<HTMLElement>('[data-part="cancel"]')!.hasAttribute('value')).toBe(false);
    });
});
