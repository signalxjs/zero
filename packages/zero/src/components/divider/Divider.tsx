/**
 * Divider — a separator with the role the platform already has for one.
 *
 * ```tsx
 * <Divider />
 * <Divider orientation="vertical" />
 * <Divider.Root>
 *     <Divider.Label>or</Divider.Label>
 * </Divider.Root>
 * <Divider.Root>
 *     <Divider.Label placement="start">Billing</Divider.Label>
 * </Divider.Root>
 * <Divider decorative />
 * ```
 *
 * `role="separator"` without a `tabindex` is the NON-focusable flavour, which
 * is the right one here: the focusable variant exists for split-pane handles
 * that can be moved, and this one cannot. `aria-orientation` is emitted only
 * for `vertical` — horizontal is the role's own default, and restating a
 * default is how two sources of truth start.
 *
 * A separator's children are presentational, so words put inside one are
 * never read (#298). `Divider.Label` is therefore the root's NAME: while it
 * is rendered the root carries `aria-labelledby` pointing at it. `decorative`
 * is the purely visual rule — `role="none"`, no orientation and no name.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import { createId } from '../../behaviors/create-id.js';
import type { Orientation } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { dividerAnatomy } from './anatomy.js';

const SCOPE = dividerAnatomy.scope;

/** Where a Label sits on the rule; absent, it is centred. Logical, so RTL mirrors. */
export type DividerLabelPlacement = 'start' | 'end';

interface DividerContext {
    ids: { label: string };
    /** Label reports its presence so the root's reference never dangles (#169). */
    setLabelPresent(present: boolean): void;
}

export const useDividerContext = defineInjectable<DividerContext>(() => ({
    ids: { label: 'zx-divider-inert' },
    setLabelPresent: () => {},
}));

export type DividerRootProps =
    & Define.Prop<'orientation', Orientation, false>
    /**
     * A purely visual rule: `role="none"`, no `aria-orientation`, and no
     * name — neither `aria-labelledby` nor an app's `aria-label` is rendered
     * (a Label inside it is ordinary text).
     */
    & Define.Prop<'decorative', boolean, false>
    & WithVariantAxes<'divider'>
    & WithClass
    /**
     * Not `role`: a divider IS a separator (or, decorative, nothing). An app
     * `aria-labelledby` joins the Label's rather than replacing it.
     */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const DividerRoot = component<DividerRootProps>(({ props, slots, signal, onMounted }) => {
    const orientation = (): Orientation => props.orientation ?? 'horizontal';
    const baseId = createId('zx-divider');
    // Optimistic until settled after mount, like Progress: server markup
    // keeps the reference a labelled divider needs, and the client's real
    // count takes over a microtask after mount.
    const present = signal({ label: 0, settled: false });
    settleAfterMount(onMounted, () => { present.settled = true; });
    const ctx: DividerContext = {
        ids: { label: `${baseId}-label` },
        setLabelPresent: (p) => { present.label = countPresence(present.label, p); },
    };
    defineProvide(useDividerContext, () => ctx);
    return () => {
        const attrs = htmlAttrs(props);
        const decorative = !!props.decorative;
        // Only a rendered Label names the root. Before settling there is no
        // way to know, but nothing to reference either without children —
        // so a bare divider never points at an id that cannot exist.
        const labelled = !decorative && (present.label > 0 || (!present.settled && slots.default != null));
        return (
            <div
                {...attrs}
                role={decorative ? 'none' : 'separator'}
                aria-orientation={!decorative && orientation() === 'vertical' ? 'vertical' : undefined}
                // Naming is prohibited on role=none, so an app's label goes too.
                aria-label={decorative ? undefined : attrs['aria-label']}
                aria-labelledby={decorative ? undefined : [
                    labelled ? ctx.ids.label : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                data-scope={SCOPE}
                data-part="root"
                data-orientation={orientation()}
                {...variantAttrs(props)}
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Divider.Root' });

export type DividerLabelProps =
    /** The logical edge the Label sits at; centred when absent. */
    & Define.Prop<'placement', DividerLabelPlacement, false>
    & WithClass
    /** Not `id`: the root is labelled by the Label's own. */
    & Omit<WithHtmlAttrs, 'id'>
    & Define.Slot<'default'>;

const DividerLabel = component<DividerLabelProps>(({ props, slots, onUnmounted }) => {
    const divider = useDividerContext();
    reportPresence(divider.setLabelPresent, onUnmounted);
    return () => (
        <span
            {...htmlAttrs(props)}
            id={divider.ids.label}
            data-scope={SCOPE}
            data-part="label"
            data-placement={props.placement}
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Divider.Label' });

// See Badge: single-part scopes still carry `.Root`.
export const Divider = compound(DividerRoot, { Root: DividerRoot, Label: DividerLabel });
