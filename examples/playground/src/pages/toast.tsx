import { component } from 'sigx';
import { Button, toast } from '@sigx/zero';
import { pickRole, pickVariant } from '../design-systems';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const ToastDemos = component(() => () => (
    <>
        <p>
            An imperative queue behind a <code>popover="manual"</code> top
            layer. Presence is runtime-managed — the enter/exit transition
            is plain two-state CSS, and the node unmounts once the exit
            finishes. Hover the stack to pause auto-dismiss.
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
    </>
), { name: 'ToastDemos' });

export const toastPage: PageEntry = {
    id: 'toast',
    title: 'Toast',
    category: 'Overlays',
    Demos: ToastDemos,
};
