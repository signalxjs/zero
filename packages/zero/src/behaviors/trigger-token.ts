/**
 * Trigger tokens — the `@mention` half of a trigger-mode Combobox (#58), as
 * pure functions over a string and a caret: where the token under the caret
 * is, what it queries, and what the text becomes once an item replaces it.
 * DOM-free (on `@sigx/zero/behaviors/core`), so the rules are testable
 * without an element and a non-DOM runtime can reuse them.
 */

/** The token the caret is in. */
export interface TriggerToken {
    /** Where the token starts — the trigger, or the regexp match. */
    start: number;
    /** Where it ends (exclusive): the end of the word the caret is in, so a commit replaces the whole of it. */
    end: number;
    /** What a commit keeps in front of the label — the trigger itself for a string trigger. */
    prefix: string;
    /** What the list filters on: the text between the prefix and the caret. */
    query: string;
}

const SPACE = /\s/;

/**
 * The token under `caret` in `text`, or `null`.
 *
 * A string trigger (`'@'`, `'#'`, `'/'`, `':'`, several characters too)
 * starts a token at the beginning of the text or after whitespace, and the
 * token runs over non-whitespace — typing a space ends it, and so an `@`
 * inside `me@example.com` never opens anything.
 *
 * A RegExp is matched against the text BEFORE the caret, anchored there (it
 * need not end in `$`; the `g`/`y` flags are ignored). Its first capture
 * group is the query, and whatever of the match precedes the query is the
 * prefix a commit keeps: with `/(?:^|\s)[@#](\w*)/` the query is the `\w*`
 * and the prefix is `@`, `#`, or either one after the whitespace it matched.
 * A pattern with no first group — or one that did not take part in the
 * match — yields no token; spell an empty query `(\w*)`, not `(\w+)?`.
 */
export function triggerTokenAt(text: string, caret: number, trigger: string | RegExp): TriggerToken | null {
    const upTo = text.slice(0, caret);
    const rest = /^\S*/.exec(text.slice(caret))![0];
    if (typeof trigger === 'string') {
        if (trigger === '') return null;
        const at = upTo.lastIndexOf(trigger);
        if (at === -1) return null;
        if (at > 0 && !SPACE.test(upTo.charAt(at - 1))) return null;
        const query = upTo.slice(at + trigger.length);
        if (SPACE.test(query)) return null;
        return { start: at, end: caret + rest.length, prefix: trigger, query };
    }
    const anchored = new RegExp(`(?:${trigger.source})$`, trigger.flags.replace(/[gy]/g, ''));
    const match = anchored.exec(upTo);
    if (!match) return null;
    // No first group (or one that did not take part) is a mis-specified
    // trigger: fail closed rather than open on every match.
    const query = match[1];
    if (query === undefined) return null;
    const whole = match[0];
    // The query is the tail of the match by construction (the caret ends
    // both); anything else is a pattern this cannot split, so no token.
    if (!whole.endsWith(query)) return null;
    return { start: match.index, end: caret + rest.length, prefix: whole.slice(0, whole.length - query.length), query };
}

/**
 * The text with `token` replaced by `insert`, and the caret just after it.
 */
export function replaceToken(text: string, token: TriggerToken, insert: string): { text: string; caret: number } {
    return {
        text: text.slice(0, token.start) + insert + text.slice(token.end),
        caret: token.start + insert.length,
    };
}
