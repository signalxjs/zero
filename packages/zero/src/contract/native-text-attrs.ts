/**
 * The native constraint and input-hint attributes the text controls
 * (Input, Textarea) forward to their element — typed, rather than a widened
 * attribute bag, so a misspelt `inputmode` is a compile error and not a
 * keyboard that silently never changes.
 *
 * lib.dom-free: the types name no DOM shape.
 */

/** The virtual keyboard a touch device shows — the native `inputmode`. */
export type InputMode = 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';

/** The label of a virtual keyboard's Enter key — the native `enterkeyhint`. */
export type EnterKeyHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';

/** Automatic capitalization of typed text — the native `autocapitalize`. */
export type Autocapitalize = 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';

/** The Root props both text controls share, as their Root declares them. */
export interface NativeTextProps {
    minlength?: number;
    enterkeyhint?: EnterKeyHint;
    spellcheck?: boolean;
    autocapitalize?: Autocapitalize;
    autofocus?: boolean;
}

/** JSX props for the element — spread, since the element types spell few of them. */
export type NativeTextJsx = Record<string, string | number | boolean | undefined>;

/**
 * The shared native attributes as JSX props, spread onto the element.
 * `spellCheck` and `autoFocus` are camel-spelled on purpose: no element has
 * a property by those names, so sigx writes the ATTRIBUTE (HTML lowercases
 * the name) on the client as the server does. `spellcheck` must render the
 * `"false"` token, which neither a boolean property write nor the server's
 * boolean-attribute rule can spell.
 */
export function nativeTextAttrs(p: NativeTextProps): NativeTextJsx {
    return {
        minLength: p.minlength,
        enterKeyHint: p.enterkeyhint,
        spellCheck: p.spellcheck === undefined ? undefined : String(p.spellcheck),
        autocapitalize: p.autocapitalize,
        autoFocus: p.autofocus || undefined,
    };
}
