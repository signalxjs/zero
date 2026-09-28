/**
 * The html attributes kit parts pass through — a local stand-in for zero's
 * `WithHtmlAttrs`, which cannot be used here: it references zero's
 * unexported `ReservedByZero`, so any package emitting declarations for a
 * component typed with it fails with TS2883 (signalxjs/zero#440).
 * `htmlAttrs()` still does the runtime filtering.
 */
import type { Define } from 'sigx';

export type KitHtmlAttrs =
    & Define.Prop<'id', string, false>
    & Define.Prop<'title', string, false>
    & Define.Prop<'aria-label', string, false>
    & Define.Prop<'aria-labelledby', string, false>
    & Define.Prop<'aria-describedby', string, false>
    & Define.Prop<'aria-live', 'off' | 'polite' | 'assertive', false>
    & Define.Prop<'aria-hidden', 'true' | 'false', false>;
