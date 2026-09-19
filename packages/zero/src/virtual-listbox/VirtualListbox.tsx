/**
 * The windowing strategy for Select and Combobox (#96, #119) — its own
 * entry, so an app that never windows never ships `createVirtualList`:
 *
 * ```tsx
 * import { virtualListbox } from '@sigx/zero/virtual-listbox';
 *
 * <Select.Root items={timeZones} virtual={virtualListbox} />
 * <Combobox.Root items={timeZones} virtual={virtualListbox} />
 * ```
 *
 * The roots own everything a list needs whether windowed or not (the
 * collection, the listbox, how an option renders, PageUp/PageDown by the
 * window's page size); this renders the window over them — the options near
 * the scroll position, the pinned highlight, and `spacer` parts standing in
 * for the rest.
 */
import { component } from 'sigx';
import type { Define, JSXElement } from 'sigx';
import { createVirtualListbox, type ListboxWindowHost, type ListboxWindowing } from '../behaviors/virtual-listbox.js';

type VirtualListboxItemsProps = Define.Prop<'host', ListboxWindowHost, true>;

/**
 * The data expansion's options under `virtual`: rendered directly in the
 * popup, which is the scroll viewport. The host is built once by the root,
 * so it is read once, at setup.
 */
const VirtualListboxItems = component<VirtualListboxItemsProps>(({ props, onUnmounted }) => {
    const host = props.host;
    const v = createVirtualListbox({
        listbox: host.listbox,
        collection: host.collection,
        open: () => host.open(),
        estimateSize: () => host.estimateSize(),
        resetOn: host.resetOn && (() => host.resetOn!()),
    });
    host.current = v;
    onUnmounted(() => { if (host.current === v) host.current = null; });
    // Spacer keys start with a NUL, so no item key can collide with one.
    const spacer = (key: string, size: number, ref?: (el: HTMLElement | null) => void): JSXElement => (
        <div key={`\0${key}`} data-scope={host.scope} data-part="spacer" aria-hidden="true" style={{ blockSize: `${size}px` }} ref={ref} />
    );
    return () => {
        const size = v.setSize();
        const out: JSXElement[] = [spacer('start', v.before(), v.startRef)];
        for (const row of v.rows()) {
            if (row.skip > 0) out.push(spacer(`before:${row.key}`, row.skip));
            out.push(host.item(row.item, row.index, size));
        }
        out.push(spacer('end', v.after()));
        return <>{out}</>;
    };
}, { name: 'VirtualListbox.Items' });

/** Window a data-mode `Select.Root` / `Combobox.Root`: pass it as `virtual`. */
export const virtualListbox: ListboxWindowing = {
    render: (host) => <VirtualListboxItems host={host} />,
};
