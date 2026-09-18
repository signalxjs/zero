/**
 * Levenshtein distance, only ever used to suggest a near miss.
 *
 * Shared by the token vocabulary's `nearest()` (did you mean `--color-primry`
 * → `--color-primary`) and the CSS property check in `validate-recipes`
 * (`paddding` → `padding`). The length check is a cheap reject, not an early
 * exit from the matrix — the names are short and the candidate sets are at
 * most a few hundred entries, so the full DP is not worth optimizing.
 */
export function distance(a: string, b: string, limit: number): number {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(
                prev[j]! + 1,
                row[j - 1]! + 1,
                prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        prev = row;
    }
    return prev[b.length]!;
}

/**
 * The closest candidate within `maxDistance` edits (exclusive), or undefined
 * when nothing is close enough to be a typo rather than a different word.
 */
export function nearestOf(name: string, candidates: Iterable<string>, maxDistance: number): string | undefined {
    let best: string | undefined;
    let bestDistance = maxDistance;
    for (const candidate of candidates) {
        const d = distance(name, candidate, bestDistance);
        if (d < bestDistance) {
            bestDistance = d;
            best = candidate;
        }
    }
    return best;
}
