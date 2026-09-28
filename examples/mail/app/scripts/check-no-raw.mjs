// Zero Mail's one rule, enforced: the app renders zero components (and the
// mail kit's, which are built on zero) and nothing else. No intrinsic JSX
// element, no class, no inline style anywhere under src/ — the look is the
// design system's, and a gap in zero is fixed in the kit, never papered over
// here. Runs before the typecheck.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src', import.meta.url));
const files = [];
(function walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name)) files.push(path);
    }
})(root);

const RULES = [
    // `<div`, `<span …`, `</p>` — a lowercase tag is an intrinsic element.
    { re: /<\/?[a-z][a-z0-9]*(?=[\s>/])/g, why: 'intrinsic JSX element' },
    { re: /\bclass(Name)?=/g, why: 'class attribute' },
    { re: /\bstyle=/g, why: 'inline style' },
];

const problems = [];
for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (/^\s*\*/.test(code)) return; // doc comment
        for (const { re, why } of RULES) {
            for (const m of code.matchAll(re)) {
                // `a < b` comparisons and generics are not tags: require a
                // JSX-looking position (start of expression, after `(`, `>`, `{`, `?`, `:` or `&&`).
                if (why === 'intrinsic JSX element') {
                    const before = code.slice(0, m.index).trimEnd();
                    if (before && !/[(>{?:,]$|&&$|\|\|$|return$|=>$/.test(before)) continue;
                }
                problems.push(`${relative(process.cwd(), file)}:${i + 1}: ${why}: ${m[0]}`);
            }
        }
    });
}

if (problems.length) {
    console.error(`zero-mail: ${problems.length} raw-markup violation(s) — use a zero (or mail kit) component:\n${problems.join('\n')}`);
    process.exit(1);
}
console.log(`zero-mail: ${files.length} files, zero components only ✓`);
