import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Dialog, Drawer, Popover } from '@sigx/zero';

/**
 * #102: a `<dialog>` (or popover) whose model is already open at mount. A
 * popup below another element or component mounts before its parent has
 * inserted the subtree, so `showModal()` / `show()` / `showPopover()` would
 * be called on a detached element — which a real engine refuses with
 * `InvalidStateError: The element is not in a Document`. (A root that IS the
 * mount's own child is connected in time, which is why every existing
 * default-open test passed.) happy-dom's implementations are plain
 * `setAttribute('open')` with no such check, so the suite could only ever
 * pass here for the wrong reason; these tests give the stubs the engine's
 * teeth, and nest the popup the way an app does.
 */
const tick = () => new Promise((r) => setTimeout(r, 0));

const notInDocument = () => {
    const e = new Error("Failed to execute 'showModal' on 'HTMLDialogElement': The element is not in a Document.");
    e.name = 'InvalidStateError';
    return e;
};

describe('a popup open at mount (#102)', () => {
    let container: HTMLElement;
    const proto = HTMLDialogElement.prototype;
    const original = { showModal: proto.showModal, show: proto.show };
    const originalShowPopover = (HTMLElement.prototype as { showPopover?: () => void }).showPopover;
    const calls: string[] = [];

    beforeEach(() => {
        calls.length = 0;
        proto.showModal = function (this: HTMLDialogElement) {
            if (!this.isConnected) throw notInDocument();
            calls.push('showModal');
            original.showModal.call(this);
        };
        proto.show = function (this: HTMLDialogElement) {
            if (!this.isConnected) throw notInDocument();
            calls.push('show');
            original.show.call(this);
        };
        (HTMLElement.prototype as { showPopover?: () => void }).showPopover = function (this: HTMLElement) {
            if (!this.isConnected) throw notInDocument();
            calls.push('showPopover');
            this.setAttribute('data-test-popover-open', '');
        };
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        proto.showModal = original.showModal;
        proto.show = original.show;
        (HTMLElement.prototype as { showPopover?: () => void }).showPopover = originalShowPopover;
        container.remove();
    });

    it('a modal Dialog open at mount opens once it is in the document', async () => {
        const state = signal({ open: true });
        render(
            <section>
                <Dialog.Root model={[state, 'open']}>
                    <Dialog.Popup><Dialog.Title>T</Dialog.Title></Dialog.Popup>
                </Dialog.Root>
            </section>,
            container,
        );
        await tick();
        const popup = container.querySelector<HTMLDialogElement>('[data-part="popup"]')!;
        expect(popup.open).toBe(true);
        expect(calls).toEqual(['showModal']);
        expect(popup.getAttribute('data-state')).toBe('open');
    });

    it('a modal Drawer open at mount opens once it is in the document', async () => {
        const state = signal({ open: true });
        render(
            <section>
                <Drawer.Root model={[state, 'open']} label="Menu">
                    <Drawer.Panel>content</Drawer.Panel>
                </Drawer.Root>
            </section>,
            container,
        );
        await tick();
        const panel = container.querySelector<HTMLDialogElement>('[data-part="panel"]')!;
        expect(panel.open).toBe(true);
        expect(calls).toEqual(['showModal']);
    });

    it('a Popover open at mount shows once it is in the document', async () => {
        const state = signal({ open: true });
        render(
            <section>
                <Popover.Root model={[state, 'open']}>
                    <Popover.Trigger>Open</Popover.Trigger>
                    <Popover.Popup>content</Popover.Popup>
                </Popover.Root>
            </section>,
            container,
        );
        await tick();
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(calls).toEqual(['showPopover']);
        expect(popup.hasAttribute('data-test-popover-open')).toBe(true);
    });

    it('a model closed again before the deferred open runs never opens', async () => {
        const state = signal({ open: true });
        render(
            <section>
                <Dialog.Root model={[state, 'open']}>
                    <Dialog.Popup><Dialog.Title>T</Dialog.Title></Dialog.Popup>
                </Dialog.Root>
            </section>,
            container,
        );
        state.open = false;
        await tick();
        const popup = container.querySelector<HTMLDialogElement>('[data-part="popup"]')!;
        expect(popup.open).toBe(false);
        expect(calls).toEqual([]);
    });
});
