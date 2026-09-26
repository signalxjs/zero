import { component } from 'sigx';
import { Button, Dialog, toast } from '@sigx/zero';
import { pickRole, pickVariant } from '../design-systems';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const ToastDemos = component(() => () => (
    <>
        <p>
            An imperative queue behind a <code>popover="manual"</code> top
            layer. Presence is runtime-managed — the enter/exit transition
            is plain two-state CSS, and the node unmounts once the exit
            finishes. Hover the stack to pause auto-dismiss; it also pauses
            while the tab is hidden or the window unfocused. <code>F8</code>
            moves focus to the first toast, <code>Escape</code> on a toast
            dismisses it, and closing a focused toast hands focus to the
            next one (or back to where it came from).
        </p>
        {/*
          * Picked, not named — including inside the click
          * handlers, which read the vocabulary at fire time. Where
          * a design system declares status roles the four toasts
          * differ; where it declares none they are uniformly
          * neutral, which is the truth about that design system
          * rather than four dead `data-color` attributes. `role`
          * still separates the alert from the status, so the
          * distinction survives colourlessness for AT either way.
          */}
        <DemoRow>
            <Button.Root onClick={() => toast({ title: 'Saved', description: 'Your changes are safe.', color: pickRole('success') })}>
                Success toast
            </Button.Root>
            <Button.Root color={pickRole('error', 'danger')} onClick={() => toast({ title: 'Sync failed', description: 'Retrying in 30s.', color: pickRole('error', 'danger'), role: 'alert' })}>
                Error alert
            </Button.Root>
            <Button.Root variant={pickVariant('outline', 'tertiary', 'secondary')} onClick={() => {
                const started = toast({ title: 'Uploading…', duration: Infinity });
                setTimeout(() => toast({ id: started, title: 'Upload complete', color: pickRole('success'), duration: 4000 }), 1500);
            }}>
                Progress → done
            </Button.Root>
            <Button.Root variant={pickVariant('outline', 'tertiary', 'secondary')} onClick={() => toast({
                title: 'Undoable action',
                action: { label: 'Undo', onClick: () => toast({ title: 'Undone', color: pickRole('info') }) },
                duration: 8000,
            })}>
                With action
            </Button.Root>
        </DemoRow>
        {/*
          * A toast raised while a modal dialog is open re-stacks the
          * viewport above it (hide + show is the only way to the top of
          * the top layer). It is seen, but — by spec — inert until the
          * dialog closes.
          */}
        <DemoRow>
            <Dialog.Root>
                <Dialog.Trigger>Toast over a dialog</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Raise a toast from here</Dialog.Title>
                    <Dialog.Description>
                        The toast shows above this modal; its buttons stay
                        inert until the dialog closes.
                    </Dialog.Description>
                    <Dialog.Footer>
                        <Button.Root onClick={() => toast({ title: 'Raised over the dialog', duration: 10_000 })}>
                            Raise a toast
                        </Button.Root>
                        <Dialog.Close>Close</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>
        </DemoRow>
    </>
), { name: 'ToastDemos' });

export const toastPage: PageEntry = {
    id: 'toast',
    title: 'Toast',
    category: 'Overlays',
    Demos: ToastDemos,
};
