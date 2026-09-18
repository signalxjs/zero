/**
 * Splitting a brief into the two modules the scaffold writes.
 *
 * A brief file in the pack is one `TokensInput` followed by one worked Button
 * `RecipeInput`, and every brief keeps the same top-level order:
 *
 *     import → brief → roles / custom / system / systemDark / … → tokens → [ROLES / helpers] → button
 *
 * The scaffold cuts at the end of the `tokens` block: the head becomes
 * `src/tokens.ts`, the tail becomes `src/button.ts`. That convention is
 * pinned by `__tests__/brief-split.test.ts` against every brief in the pack,
 * so a brief that reorders its exports is a failing test rather than a
 * scaffold that writes a module which does not compile.
 *
 * The `basic` brief has no tail — it is zero-basic's `tokens.ts`, and its
 * Button is the baseline's.
 */

export interface SplitBrief {
    /** The `TokensInput` half — everything through the `tokens` export. */
    tokens: string;
    /** The Button half, or undefined when the brief carries no recipe. */
    button: string | undefined;
}

const TOKENS_EXPORT = /^export const tokens\b/m;

/**
 * Cut a brief at the end of its `tokens` block. The block ends at the first
 * line that is exactly `};` after the export starts — every brief's `tokens`
 * is one object literal at column zero, closed on its own line.
 */
export function splitBrief(source: string): SplitBrief {
    const start = TOKENS_EXPORT.exec(source);
    if (!start) throw new Error('brief has no `export const tokens` — not a brief in the pack\'s shape');
    const closer = /^};$/m;
    closer.lastIndex = 0;
    const rest = source.slice(start.index);
    const end = closer.exec(rest);
    if (!end) throw new Error('brief\'s `tokens` block never closes with a `};` line');
    const cut = start.index + end.index + end[0].length;
    const tokens = source.slice(0, cut).trimEnd() + '\n';
    const tail = source.slice(cut).trim();
    return { tokens, button: tail.length > 0 ? tail + '\n' : undefined };
}

/** Exported binding names in a module's head (`export const X`). */
export function exportedNames(source: string): string[] {
    return [...source.matchAll(/^export const ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]!);
}

/**
 * Which of `names` the tail uses as an identifier — a bare reference, not a
 * property key (`variants: {`) and not a member access (`x.roles`).
 */
export function referencedNames(tail: string, names: readonly string[]): string[] {
    return names.filter((name) => new RegExp(`(?<![.\\w$])${name}(?![\\w$]|\\s*:)`).test(tail));
}

/** Drop one name from a brief's `import type { … } from '@sigx/zero-kit'` line. */
export function withoutTypeImport(source: string, name: string): string {
    return source.replace(
        /^import type \{([^}]*)\} from '@sigx\/zero-kit';$/m,
        (_whole, list: string) => {
            const names = list.split(',').map((s) => s.trim()).filter((s) => s.length > 0 && s !== name);
            return `import type { ${names.join(', ')} } from '@sigx/zero-kit';`;
        },
    );
}
