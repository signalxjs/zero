import { component, signal } from 'sigx';
import { Dialog } from '@sigx/zero';
import type { PageEntry } from './registry';

const DialogDemos = component(() => {
    const state = signal({ dialogOpen: false, findOpen: false });

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
            </p>
            <Dialog.Root role="alertdialog">
                <Dialog.Trigger>Delete file…</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Delete "report.pdf"?</Dialog.Title>
                    <Dialog.Description>
                        This cannot be undone. A backdrop click will not
                        dismiss; Escape and the actions will.
                    </Dialog.Description>
                    <Dialog.Footer>
                        <Dialog.Cancel>Cancel</Dialog.Cancel>
                        <Dialog.Close>Delete</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>
        </>
    );
}, { name: 'DialogDemos' });

export const dialogPage: PageEntry = {
    id: 'dialog',
    title: 'Dialog',
    category: 'Overlays',
    Demos: DialogDemos,
};
