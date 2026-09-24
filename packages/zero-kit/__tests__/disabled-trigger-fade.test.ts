/**
 * The disabled-overlay-trigger guard (#191).
 *
 * Dialog, popover, tooltip, menu and drawer carry their axes on a TRIGGER
 * that zero renders as a real `<button>` and stamps `data-disabled` (plus the
 * native `disabled`) on when the app disables it. A skin that paints the
 * trigger an accent ink has overridden the UA's GrayText for `:disabled`, so
 * unless its recipe fades the part itself, a disabled trigger renders at full
 * ink with a pointer cursor — only its hover layer (keyed on
 * `:not([data-disabled])`) goes away. material shipped exactly that: every
 * one of its five triggers declared `disabled: {}`.
 *
 * The assertion is on the compiled CSS, not the recipe tree: there must be a
 * rule whose selector keys on `[data-disabled]` (a `:not([data-disabled])`
 * does not count) and which sets `opacity` — the same fade each skin's
 * `button.root` wears. material's dismiss actions (dialog's close and cancel,
 * popover's and drawer's close) had the same empty state and are held to it
 * too.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { CompiledDesignSystem, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';
import { parseRules } from '../src/audit/css-rules.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// One by one — `DesignSystemInput<R>` is invariant in `R` (see css-golden).
const SYSTEMS: ReadonlyArray<readonly [string, CompiledDesignSystem]> = [
    ['basic', compileDesignSystem(basicDS, manifest)],
    ['daisyui', compileDesignSystem(daisyDS, manifest)],
    ['material', compileDesignSystem(materialDS, manifest)],
    ['brutalist', compileDesignSystem(brutalistDS, manifest)],
    ['heroui', compileDesignSystem(herouiDS, manifest)],
    ['carbon', compileDesignSystem(carbonDS, manifest)],
];

const OVERLAY_SCOPES = ['dialog', 'popover', 'tooltip', 'menu', 'drawer'] as const;

/** The declarations of every rule that paints `scope.part` while disabled. */
const disabledDecls = (compiled: CompiledDesignSystem, scope: string, part: string): string[] =>
    parseRules(compiled.componentCss[scope] ?? '')
        .filter((r) => r.selector.includes(`[data-part="${part}"]`))
        .filter((r) => r.selector.replace(/:not\(\[data-disabled\]\)/g, '').includes('[data-disabled]'))
        .flatMap((r) => r.decls);

const fades = (decls: readonly string[]): boolean => decls.some((d) => /^opacity\s*:/.test(d));

describe('disabled overlay triggers fade', () => {
    it('declares a trigger on every overlay scope', () => {
        // Substrate check: a renamed part would make every case below vacuous.
        for (const scope of OVERLAY_SCOPES) {
            const component = manifest.components.find((c) => c.scope === scope);
            expect(component?.parts.map((p) => p.name), scope).toContain('trigger');
        }
    });

    it.each(SYSTEMS.map(([name]) => name))('%s: every overlay trigger fades when disabled', (name) => {
        const compiled = SYSTEMS.find(([n]) => n === name)![1];
        const unfaded = OVERLAY_SCOPES.filter((scope) => !fades(disabledDecls(compiled, scope, 'trigger')));
        expect(unfaded).toEqual([]);
    });

    it('material: the triggers match the button — faded and not-allowed', () => {
        const compiled = SYSTEMS.find(([n]) => n === 'material')![1];
        expect(disabledDecls(compiled, 'button', 'root')).toEqual(
            expect.arrayContaining(['opacity: var(--disabled-opacity)', 'cursor: not-allowed']),
        );
        for (const scope of OVERLAY_SCOPES) {
            expect(disabledDecls(compiled, scope, 'trigger'), scope).toEqual(
                expect.arrayContaining(['opacity: var(--disabled-opacity)', 'cursor: not-allowed']),
            );
        }
    });

    it('material: the dismiss actions fade when disabled', () => {
        const compiled = SYSTEMS.find(([n]) => n === 'material')![1];
        const parts = [['dialog', 'close'], ['dialog', 'cancel'], ['popover', 'close'], ['drawer', 'close']] as const;
        const unfaded = parts
            .filter(([scope, part]) => !fades(disabledDecls(compiled, scope, part)))
            .map(([scope, part]) => `${scope}.${part}`);
        expect(unfaded).toEqual([]);
    });
});
