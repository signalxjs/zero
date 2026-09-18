/**
 * `contrast/text`, `contrast/indicator`, `contrast/unmeasured` — the static
 * half of the browser contrast audit, as audit rules.
 *
 * The browser spec (`e2e/contrast-audit.spec.ts`) runs its two matrices over
 * the six in-repo skins on every PR. A design system built outside this
 * repo never runs it, and the skill told its author to read the results of
 * a gate they could not run. These rules compute the same matrices from the
 * compiled CSS (`../contrast/`), so the same cells answer to the same
 * floors wherever the design system is built:
 *
 * - below 3:1 is an error — a state that changes background must bring a
 *   readable colour with it; a mark that is painted has to be visible
 *   against what it is painted on;
 * - 3:1 to 4.5:1 is a warning — a finding, not yet a build break;
 * - a `disabled` cell answers to its own 2:1 floor, measured on the pair
 *   BEFORE the state's uniform fade (#207) — dimming is the state, choosing
 *   ink nobody could have read is not.
 *
 * And the third rule is the honesty clause. A static reader cannot see
 * everything a browser paints — a gradient's extent, a filter, a selector it
 * does not evaluate — so every cell it could not judge is reported, once per
 * (scope, part, reason) with the cell count, as `info`. Never as a pass:
 * `unmeasured` is a list of cells the author must eyeball in the playground,
 * and it must never fail a build, because the reader's limit is not the
 * design system's fault.
 */
import type { AuditContext } from '../context.js';
import type { ContrastCell, ContrastMatrix, ContrastOptions } from '../contrast/matrix.js';
import { AA, DISABLED_FLOOR, FLOOR, buildContrastMatrix } from '../contrast/matrix.js';
import type { AuditFinding, RuleOutput } from '../types.js';

export interface ContrastRuleOutput extends RuleOutput {
    contrast: ContrastMatrix;
}

/** The findings one computed matrix yields. Exported so a caller with a matrix in hand need not recompute it. */
export function contrastFindings(matrix: ContrastMatrix): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const unmeasured = new Map<string, { scope: string; part: string; reason: string; count: number; themes: Set<string> }>();
    const band = new Map<string, { rule: 'contrast/text' | 'contrast/indicator'; scope: string; part: string; theme: string; matrix: 'text' | 'indicator'; count: number; worst: ContrastCell; paint: string }>();
    for (const theme of matrix.themes) {
        for (const cell of theme.cells) {
            const where = `${cell.scope}.${cell.part}`;
            const rule = cell.matrix === 'text' ? 'contrast/text' : 'contrast/indicator';
            const paint = cell.matrix === 'text'
                ? `${cell.ink} on ${cell.bg}`
                : `${cell.carrier} ${cell.ink} on ${cell.bg}`;
            const base = { where, scope: cell.scope, part: cell.part, theme: theme.name, cell: cell.key } as const;
            switch (cell.verdict) {
                case 'fail':
                    findings.push({
                        rule, severity: 'error', ...base,
                        contrast: { ratio: cell.ratio!, inGroup: cell.inGroup!, floor: FLOOR },
                        message: cell.matrix === 'text'
                            ? `${cell.key} → ${cell.ratio}:1 (${paint}) — below ${FLOOR}:1: a state that changes background must bring a readable color with it`
                            : `${cell.key} → ${cell.ratio}:1 (${paint}) — below ${FLOOR}:1: a mark that is painted has to be visible against what it is painted on`,
                    });
                    break;
                case 'warn': {
                    // The band is reported once per (scope, part, theme), naming
                    // the worst cell: a muted label at 4.1:1 is one decision, not
                    // one finding per axis combination it was measured under. The
                    // cell table on `result.contrast` keeps every reading.
                    const id = `${where}@${theme.name}#${cell.matrix}`;
                    const entry = band.get(id) ?? { rule, scope: cell.scope, part: cell.part, theme: theme.name, matrix: cell.matrix, count: 0, worst: cell, paint };
                    entry.count++;
                    if (cell.ratio! < entry.worst.ratio!) { entry.worst = cell; entry.paint = paint; }
                    band.set(id, entry);
                    break;
                }
                case 'disabled-fail':
                    findings.push({
                        rule, severity: 'error', ...base,
                        contrast: { ratio: cell.ratio!, inGroup: cell.inGroup!, floor: DISABLED_FLOOR },
                        message: `${cell.key} → ${cell.inGroup}:1 (${paint}) before the state's fade — a disabled colour pair below `
                            + `${DISABLED_FLOOR}:1: dimming is the state, ${cell.matrix === 'text' ? 'choosing ink nobody could have read' : 'drawing a mark nobody could have found'} is not`,
                    });
                    break;
                case 'unmeasured': {
                    const id = `${where}#${cell.reason}`;
                    const entry = unmeasured.get(id) ?? { scope: cell.scope, part: cell.part, reason: cell.reason!, count: 0, themes: new Set<string>() };
                    entry.count++;
                    entry.themes.add(theme.name);
                    unmeasured.set(id, entry);
                    break;
                }
                default:
                    break;
            }
        }
    }
    for (const entry of band.values()) {
        const cells = entry.count === 1 ? '' : ` (${entry.count} cells, worst shown)`;
        const { worst } = entry;
        findings.push(entry.matrix === 'text'
            ? {
                rule: entry.rule, severity: 'warning', where: `${entry.scope}.${entry.part}`, scope: entry.scope, part: entry.part, theme: entry.theme, cell: worst.key,
                contrast: { ratio: worst.ratio!, inGroup: worst.inGroup!, floor: AA },
                message: `${worst.key} → ${worst.ratio}:1 (${entry.paint})${cells} — clears ${FLOOR}:1 but not the ${AA}:1 AA text target`,
            }
            // A non-text mark meets WCAG 1.4.11 at 3:1; the AA band is a note, not a defect.
            : {
                rule: entry.rule, severity: 'info', where: `${entry.scope}.${entry.part}`, scope: entry.scope, part: entry.part, theme: entry.theme, cell: worst.key,
                contrast: { ratio: worst.ratio!, inGroup: worst.inGroup!, floor: AA },
                message: `${worst.key} → ${worst.ratio}:1 (${entry.paint})${cells} — clears the ${FLOOR}:1 non-text floor; ${AA}:1 is the preferred target, not a requirement`,
            });
    }
    for (const entry of unmeasured.values()) {
        findings.push({
            rule: 'contrast/unmeasured',
            severity: 'info',
            where: `${entry.scope}.${entry.part}`,
            scope: entry.scope,
            part: entry.part,
            reason: entry.reason,
            message: `${entry.scope}.${entry.part}: ${entry.count} cell(s) across ${entry.themes.size} theme(s) could not be measured statically `
                + `(${entry.reason}) — check them in the playground; the browser contrast audit is the ground truth here`,
        });
    }
    return findings;
}

export function run(ctx: AuditContext, options: ContrastOptions = {}): ContrastRuleOutput {
    const contrast = buildContrastMatrix(ctx, options);
    return { findings: contrastFindings(contrast), waived: [], contrast };
}
