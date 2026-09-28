/**
 * Icon — zero has no glyph primitive (#440), so the kit carries a small
 * stroke set (24×24, 2px, round joins) drawn with `currentColor`. Decorative
 * by default (`aria-hidden`); pass `label` when the glyph IS the content.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { htmlAttrs, variantAttrs } from '@sigx/zero';
import type { WithClass, WithHtmlAttrs, WithVariantAxesOpen } from '@sigx/zero';
import { iconAnatomy } from './anatomy.js';
import type { Tone } from './Text.js';

/** Path data per glyph. Several `d` strings draw one glyph. */
export const ICONS = {
    inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
    star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    send: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4 20-7z'],
    file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
    archive: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
    trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    spam: ['M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z', 'M12 8v4', 'M12 16h.01'],
    clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
    tag: ['M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
    search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
    pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
    settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
    sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
    moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    menu: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
    'chevron-left': ['M15 18l-6-6 6-6'],
    'chevron-right': ['M9 18l6-6-6-6'],
    'chevron-down': ['M6 9l6 6 6-6'],
    reply: ['M9 17l-5-5 5-5', 'M20 18v-2a4 4 0 0 0-4-4H4'],
    'reply-all': ['M7 17l-5-5 5-5', 'M12 17l-5-5 5-5', 'M22 18v-2a4 4 0 0 0-4-4H7'],
    forward: ['M15 17l5-5-5-5', 'M4 18v-2a4 4 0 0 1 4-4h12'],
    more: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
    paperclip: ['M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'],
    check: ['M20 6 9 17l-5-5'],
    mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6l-10 7L2 6'],
    'mail-open': ['M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z', 'M22 10l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10'],
    x: ['M18 6 6 18', 'M6 6l12 12'],
    filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
    refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
    keyboard: ['M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z', 'M6 9h.01', 'M10 9h.01', 'M14 9h.01', 'M18 9h.01', 'M6 13h.01', 'M18 13h.01', 'M10 13h4', 'M7 16h10'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    megaphone: ['M3 11l18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
    logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
    bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
    folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
    plus: ['M12 5v14', 'M5 12h14'],
    image: ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
    sparkles: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z', 'M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17z'],
    zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
    help: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;

export type IconRootProps =
    & WithVariantAxesOpen<'mail-icon'>
    & WithClass
    & WithHtmlAttrs
    & Define.Prop<'name', IconName, true>
    /** The ink, as on Text — the design system's `tone` axis. */
    & Define.Prop<'tone', Tone, false>
    /** Accessible name. Absent → decorative (`aria-hidden`). */
    & Define.Prop<'label', string, false>
    /** Paint the glyph's interior with `currentColor` too (a filled star). */
    & Define.Prop<'filled', boolean, false>;

const IconRoot = component<IconRootProps>(({ props }) => () => (
    <svg
        class={props.class}
        {...htmlAttrs(props)}
        data-scope={iconAnatomy.scope}
        data-part="root"
        {...variantAttrs({ ...props, axes: { tone: props.tone, ...props.axes } })}
        viewBox="0 0 24 24"
        fill={props.filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        role={props.label ? 'img' : undefined}
        aria-label={props.label}
        aria-hidden={props.label ? undefined : 'true'}
        focusable="false"
    >
        {ICONS[props.name].map((d, i) => <path key={`${props.name}-${i}`} d={d} />)}
    </svg>
), { name: 'Icon.Root' });

export const Icon = compound(IconRoot, { Root: IconRoot });
