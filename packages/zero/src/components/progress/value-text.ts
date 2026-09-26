/**
 * The value text Progress and RadialProgress announce and show (#274).
 *
 * A progressbar with only `aria-valuenow` makes a screen reader read the raw
 * number — "62" of a 0–1024 upload, where the eye sees "6%". The root renders
 * `aria-valuetext` from the same string the default `ValueText` paints, so
 * what is heard is what is seen. An indeterminate bar has no value, so it has
 * no value text either.
 *
 * The default formats through `Intl.NumberFormat` (`locale`,
 * `formatOptions`, default `{ style: 'percent' }`): a percent style formats
 * the filled fraction (`percent / 100`), any other style formats the value
 * itself (`{ style: 'unit', unit: 'megabyte' }` → "62 MB"). `getValueText`
 * replaces the formatter outright. Server-rendered without a `locale`, the
 * server's default locale formats the markup — pass one when server and
 * client could disagree.
 *
 * Platform-neutral: no DOM.
 */
import type { Define } from 'sigx';

/** What `getValueText` is told besides the (clamped) value. */
export interface ProgressValueTextDetails {
    min: number;
    max: number;
    /** The filled share, 0–100. */
    percent: number;
}

export type ProgressGetValueText = (value: number, details: ProgressValueTextDetails) => string;

/** The value-text props both progress roots take. */
export type WithProgressValueText =
    /** Replaces the default formatter: the string is both announced and shown. */
    & Define.Prop<'getValueText', ProgressGetValueText, false>
    /** BCP 47 locale for the default formatter; the runtime's default when omitted. */
    & Define.Prop<'locale', string, false>
    /** `Intl.NumberFormat` options for the default formatter; `{ style: 'percent' }` when omitted. */
    & Define.Prop<'formatOptions', Intl.NumberFormatOptions, false>;

export interface ProgressValueTextInput {
    getValueText?: ProgressGetValueText;
    locale?: string;
    formatOptions?: Intl.NumberFormatOptions;
}

/**
 * The value text for a determinate value, or `undefined` for an
 * indeterminate one (`value`/`percent` null).
 */
export function progressValueText(
    props: ProgressValueTextInput,
    value: number | null | undefined,
    percent: number | null,
    min: number,
    max: number,
): string | undefined {
    if (value == null || percent == null) return undefined;
    if (props.getValueText) return props.getValueText(value, { min, max, percent });
    const options = props.formatOptions ?? { style: 'percent' };
    const n = options.style === 'percent' ? percent / 100 : value;
    return new Intl.NumberFormat(props.locale, options).format(n);
}
