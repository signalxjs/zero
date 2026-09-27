/**
 * Locale-aware display and parsing for NumberInput — `Intl.NumberFormat`
 * only, no bundled parser. DOM-free and unit-testable.
 *
 * The parse side reads the locale's own symbols from `formatToParts` once
 * (group, decimal, minus, and the currency / percent / unit literals), then
 * strips grouping, maps the decimal to `.`, tolerates the literals and
 * rejects everything else. Digits must be ASCII: a locale whose default
 * numbering system is not Latin (`ar-EG`) formats fine but does not parse
 * back — numbering-system parsing is out of scope.
 */

export interface LocaleNumberFormat {
    format(value: number): string;
    /** The typed text as a number, or null when it is not one. */
    parse(text: string): number | null;
    /** `resolvedOptions().maximumFractionDigits` — 0 means whole numbers only. */
    maximumFractionDigits: number;
}

const DIGITS_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const WS_RE = /\s/;
// Every Unicode minus spelling a keyboard or a formatter produces.
const MINUS_RE = /[−‒–—﹣－]/g;

/**
 * Options the symbol probe keeps: the ones that decide which literals
 * appear (style, currency, unit) and which digits/symbols are used. The
 * rest (digit counts, rounding, sign display, notation) would only hide
 * a symbol from the probe.
 */
// `currencySign: 'accounting'` is left out on purpose: its parentheses mean
// "negative", and tolerating them as literals would parse `($5.00)` as +5.
const PROBE_KEYS = ['style', 'currency', 'currencyDisplay', 'unit', 'unitDisplay', 'numberingSystem'] as const;

export function createLocaleNumberFormat(locale: string | undefined, options: Intl.NumberFormatOptions | undefined): LocaleNumberFormat {
    const nf = new Intl.NumberFormat(locale, options);
    const probeOptions: Intl.NumberFormatOptions = { useGrouping: true, minimumFractionDigits: 1, maximumFractionDigits: 1 };
    for (const k of PROBE_KEYS) {
        if (options?.[k] !== undefined) (probeOptions as Record<string, unknown>)[k] = options[k];
    }
    const probe = new Intl.NumberFormat(locale, probeOptions);

    let group = ',';
    let decimal = '.';
    let minus = '-';
    const literals = new Set<string>();
    for (const value of [-12345.6, 12345.6]) {
        for (const part of probe.formatToParts(value)) {
            switch (part.type) {
                case 'group': group = part.value; break;
                case 'decimal': decimal = part.value; break;
                case 'minusSign': minus = part.value; break;
                case 'currency':
                case 'percentSign':
                case 'unit':
                case 'literal': {
                    const t = part.value.trim();
                    if (t) literals.add(t);
                    break;
                }
            }
        }
    }
    // Longest first, so `US$` is stripped before a lone `$` could split it.
    const literalList = [...literals].sort((a, b) => b.length - a.length);
    const groupIsSpace = WS_RE.test(group) || group.trim() === '';
    const isPercent = options?.style === 'percent';
    const maximumFractionDigits = nf.resolvedOptions().maximumFractionDigits ?? 3;

    const parse = (text: string): number | null => {
        let t = text;
        for (const lit of literalList) t = t.split(lit).join('');
        t = t.trim();
        if (t === '') return null;
        t = t.split(minus).join('-').replace(MINUS_RE, '-');
        if (groupIsSpace) t = t.replace(/\s/g, '');
        else t = t.split(group).join('');
        // What is left must be bare ASCII: no inner whitespace, no letters.
        if (decimal !== '.') {
            // A `.` in a comma-decimal locale is not ours to guess at.
            if (t.includes('.')) return null;
            t = t.split(decimal).join('.');
        }
        if (!DIGITS_RE.test(t)) return null;
        const n = Number(t);
        if (!Number.isFinite(n)) return null;
        if (!isPercent) return n;
        // 14.1 / 100 is 0.14100000000000001 — round back to the digits typed.
        const dot = t.indexOf('.');
        const places = dot === -1 ? 0 : t.length - dot - 1;
        return Number((n / 100).toFixed(places + 2));
    };

    return { format: (v) => nf.format(v), parse, maximumFractionDigits };
}
