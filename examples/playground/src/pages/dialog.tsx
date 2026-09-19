import { component, signal } from 'sigx';
import { Button, Dialog } from '@sigx/zero';
import type { DialogCloseDetail } from '@sigx/zero';
import type { PageEntry } from './registry';

const DialogDemos = component(() => {
    const state = signal({
        dialogOpen: false, findOpen: false, lastClose: 'none yet', lastConfirm: 'none yet',
        restored: false, restoredOpen: false,
    });
    const onAlertClose = (d: DialogCloseDetail): void => {
        state.lastClose = d.value === undefined ? d.reason : `${d.reason} · ${d.value}`;
    };
    const onConfirmClose = (d: DialogCloseDetail): void => {
        state.lastConfirm = d.value === undefined ? d.reason : `${d.reason} · ${d.value}`;
    };

    return () => (
        <>
            <Dialog.Root model={() => state.dialogOpen}>
                <Dialog.Trigger>Open dialog</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Native top layer</Dialog.Title>
                    <Dialog.Description>
                        This is a real &lt;dialog&gt; — focus trap, Escape and
                        backdrop come from the platform, not from JavaScript.
                    </Dialog.Description>
                    <Dialog.Footer>
                        <Dialog.Close>Cancel</Dialog.Close>
                        <Dialog.Close>Got it</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>
            {/*
              * The non-modal projection — a find bar: `show()` rather than
              * `showModal()`, so the page stays interactive, there is no
              * backdrop, and Escape dismissal is zero's own fallback (a
              * non-modal <dialog> fires no cancel event). Deliberately no
              * Title: a find bar has none, and the e2e suite asserts the
              * popup's `aria-labelledby` is absent rather than dangling.
              */}
            <Dialog.Root model={() => state.findOpen} modal={false}>
                <Dialog.Trigger>Open find bar</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Description>
                        Non-modal: the page behind stays live, Escape still closes.
                    </Dialog.Description>
                    <Dialog.Footer>
                        <Dialog.Close>Close find bar</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>

            <h2>Alert dialog</h2>
            <p>
                <code>role="alertdialog"</code> tightens the pattern: the
                backdrop no longer dismisses, and initial focus lands on{' '}
                <code>Dialog.Cancel</code> — the least-destructive action.
                The <code>close</code> event says why it closed, and carries
                the closing <code>Dialog.Close</code>'s <code>value</code>.
            </p>
            <Dialog.Root role="alertdialog" onClose={onAlertClose}>
                <Dialog.Trigger>Delete file…</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Delete "report.pdf"?</Dialog.Title>
                    <Dialog.Description>
                        This cannot be undone. A backdrop click will not
                        dismiss; Escape and the actions will.
                    </Dialog.Description>
                    <Dialog.Footer>
                        <Dialog.Cancel>Cancel</Dialog.Cancel>
                        <Dialog.Close value="delete">Delete</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>
            <p data-demo="close-reason">Last close: {state.lastClose}</p>

            <h2>Confirm with dependents</h2>
            <p>
                The destructive confirm as a composition (#128): the
                dependents are the description's own list, the least
                destructive action is <code>Dialog.Cancel</code>, and the
                destructive one is the app's own <code>Button</code> in its
                danger colour — a <code>type="submit"</code> inside a{' '}
                <code>&lt;form method="dialog"&gt;</code>, so the platform
                closes the dialog and its <code>value</code> comes back as
                the close's <code>value</code> (reason <code>programmatic</code>).
            </p>
            <Dialog.Root role="alertdialog" onClose={onConfirmClose}>
                <Dialog.Trigger>Delete workspace…</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Delete "acme"?</Dialog.Title>
                    <Dialog.Description>
                        This cannot be undone. It also removes:
                        <ul>
                            <li>3 members' access</li>
                            <li>2 shared folders</li>
                            <li>1 pending invitation</li>
                        </ul>
                    </Dialog.Description>
                    <form method="dialog">
                        <Dialog.Footer>
                            <Dialog.Cancel>Keep workspace</Dialog.Cancel>
                            <Button.Root type="submit" value="delete" color="error">Delete workspace</Button.Root>
                        </Dialog.Footer>
                    </form>
                </Dialog.Popup>
            </Dialog.Root>
            <p data-demo="confirm-reason">Last confirm: {state.lastConfirm}</p>

            <h2>Open at mount</h2>
            <p>
                A dialog whose model is already <code>true</code> when it
                mounts — a page restoring <code>?pick=1</code>, a hydrated
                SSR page. The popup mounts before its parent has inserted it,
                and <code>showModal()</code> on a detached element throws, so
                zero defers the call a microtask (#102). Mounted on demand
                here rather than at page boot, so the rest of the page stays
                reachable.
            </p>
            <button type="button" data-demo="mount-open" onClick={() => { state.restoredOpen = true; state.restored = true; }}>
                Mount an open dialog
            </button>
            {state.restored ? (
                <div data-demo="restored">
                    <Dialog.Root model={() => state.restoredOpen} onOpenChange={(open: boolean) => { if (!open) state.restored = false; }}>
                        <Dialog.Popup>
                            <Dialog.Title>Restored open</Dialog.Title>
                            <Dialog.Description>
                                This dialog was open when it mounted.
                            </Dialog.Description>
                            <Dialog.Footer>
                                <Dialog.Close>Close</Dialog.Close>
                            </Dialog.Footer>
                        </Dialog.Popup>
                    </Dialog.Root>
                </div>
            ) : null}
        </>
    );
}, { name: 'DialogDemos' });

export const dialogPage: PageEntry = {
    id: 'dialog',
    title: 'Dialog',
    category: 'Overlays',
    Demos: DialogDemos,
};
