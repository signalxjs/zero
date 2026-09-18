/**
 * A small reader for the CSS the kit emits.
 *
 * Tests that assert on emitted CSS have so far done it with `toContain`, which
 * cannot see which rule a declaration landed in, or `toMatchFileSnapshot`,
 * which sees everything and understands none of it. A guard that asks "do these
 * two states render differently?" needs the middle ground: the rules, keyed by
 * where they apply.
 *
 * Deliberately not a general-purpose CSS parser. It reads what
 * `compileRecipeCss` emits — balanced braces, no comments in the output, at-rule
 * nesting but no selector nesting — and it is only ever pointed at that output.
 * Quoted strings are stepped over verbatim so a `content: "\2714"` or a data-URI
 * value cannot be mistaken for structure.
 *
 * It began as a test helper (`__tests__/helpers/css-rules.ts`) and moved into
 * the kit when the guards that read it did (#403): every audit rule that judges
 * the artifact rather than the recipe tree stands on this one reader.
 */

export interface CssRule {
    /** The at-rule preludes enclosing this rule, outermost first. */
    at: readonly string[];
    /** The rule's own selector. Nested selector preludes join with a space. */
    selector: string;
    /** `prop: value` declarations, in source order. */
    decls: readonly string[];
}

const isAt = (prelude: string): boolean => prelude.startsWith('@');

/**
 * Every rule in `css` that carries at least one declaration.
 *
 * A block with only nested blocks emits nothing of its own — `@layer` and
 * `@media` wrappers are structure, not rules — so they appear in `at` instead.
 */
export function parseRules(css: string): CssRule[] {
    const rules: CssRule[] = [];
    const preludes: string[] = [];
    const decls: string[][] = [];
    let buf = '';

    const emit = (): void => {
        const own = decls[decls.length - 1];
        if (!own?.length) return;
        rules.push({
            at: preludes.filter(isAt),
            selector: preludes.filter((p) => !isAt(p)).join(' '),
            decls: own,
        });
    };

    for (let i = 0; i < css.length; i++) {
        const ch = css[i]!;

        // Step over a quoted string whole: its contents are a value, not syntax.
        if (ch === '"' || ch === "'") {
            const end = ((): number => {
                for (let j = i + 1; j < css.length; j++) {
                    if (css[j] === '\\') { j++; continue; }
                    if (css[j] === ch) return j;
                }
                return css.length - 1;
            })();
            buf += css.slice(i, end + 1);
            i = end;
            continue;
        }
        if (ch === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end === -1 ? css.length : end + 1;
            continue;
        }

        if (ch === '{') {
            preludes.push(buf.trim());
            decls.push([]);
            buf = '';
            continue;
        }
        if (ch === '}') {
            // A last declaration may have no trailing semicolon.
            if (buf.trim()) decls[decls.length - 1]?.push(buf.trim());
            emit();
            preludes.pop();
            decls.pop();
            buf = '';
            continue;
        }
        if (ch === ';') {
            // Inside a block this is a declaration; at top level it is a
            // statement at-rule (`@import …;`) and belongs to nobody.
            if (buf.trim()) decls[decls.length - 1]?.push(buf.trim());
            buf = '';
            continue;
        }
        buf += ch;
    }
    return rules;
}
