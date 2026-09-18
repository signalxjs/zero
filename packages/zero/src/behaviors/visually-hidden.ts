/**
 * The visually-hidden style for a native control that must stay interactive
 * and focusable while invisible — the checkbox under a Checkbox, the radio
 * under a RadioGroup.Item, the `<select>` a Select posts through. Functional
 * necessity, not styling (same technique as Zag/Base UI), which is why zero
 * inlines it rather than leaving it to the design system: a skin that forgot
 * would show a raw platform control beside the styled one.
 *
 * One definition. It was copied verbatim into four components before this.
 */
export const VISUALLY_HIDDEN_STYLE = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    border: '0',
    clip: 'rect(0 0 0 0)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
} as const;
