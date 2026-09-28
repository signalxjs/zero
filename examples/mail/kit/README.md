# @sigx/zero-mail-kit

The components Zero Mail needed and `@sigx/zero` does not ship. Each is built
only from zero's public surface: `defineAnatomy`, the behaviors, and the
contract helpers. Each is an entry in signalxjs/zero#440.

| Component | Stands in for |
|---|---|
| `Text`, `Heading`, `Time` | A typography primitive. They take `tone`, `weight`, `truncate` and `clamp` from the design system's vocabulary. |
| `Icon` | An icon primitive: a small stroke set drawn in `currentColor`. |
| `Toolbar` | `role="toolbar"` with one roving tab stop over arbitrary zero children. |
| `MailList`, `MailRow` | A virtualised list, built on zero's `createVirtualList` (a behavior only), with roving, open/toggle and a cursor. `MailList.Root` is a lend host (#450): `<Menu.ContextTrigger asChild>{(p) => <MailList.Root lend={p} …/>}` makes the list itself the right-click surface, merged through zero's public `mergePartProps`. |
| `Shell`, `Split` | A viewport-height frame, scrolling regions, `<main>`, and a resizable split view. |
| `ActionButton` | A tooltip-labelled icon button that acts on click: a convenience over `<Tooltip.Trigger onClick>` (#486) that bundles the icon, `aria-label`, shortcut hint and tooltip. It no longer stands in for a gap. |
| `Hotkeys` | Document-level single-key shortcuts that respect editable targets and open popups. |

`./fragment` is pure data: the `mail-*` anatomies as a manifest fragment for
the design system's build. It ships no recipe pack. The design system styles
these scopes against its own axes.
