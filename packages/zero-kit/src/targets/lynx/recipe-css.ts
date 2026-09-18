/**
 * Lynx recipe emitter — compiles a `RecipeInput` against a component's
 * anatomy into class-grammar CSS. Same manifest contract as the web emitter
 * (unknown parts and states are hard errors), different projection:
 *
 * - Every selector is a flat class compound on the styled part itself.
 *   `[data-scope="tabs"][data-part="tab"][data-state="active"]` becomes
 *   `.zx-tabs__tab.zx-s-active`. Machine states and flags resolve through
 *   the manifest's `states`/`flags`; the web's interaction pseudo-classes
 *   resolve through `INTERACTION_STATE_CLASSES` (runtime-stamped flag
 *   classes; `hover` has no pointer and is dropped with a report entry).
 * - Axis rules follow the push-down contract: the runtime stamps
 *   `zx-a-*`/`zx-m-*` classes on every part from carrier context, so a
 *   variant rule is `.zx-btn__root.zx-a-variant-solid { … }` on ANY part —
 *   never a descendant selector, and never the web's `@scope` donut or
 *   `:not()` default twins (the runtime always stamps a concrete value).
 * - Anatomy `pseudo` parts are REAL parts here (a lynx dialog backdrop is a
 *   rendered view), so they style as their own part class — `partProjection`
 *   has no lynx counterpart by design.
 * - Conditions (`at:`) and `selectors:` keys the grammar cannot express are
 *   dropped with report entries; two attribute patterns the contract owns
 *   (`&[data-orientation="…"]`, `&[data-placement="…"]`) translate to their
 *   grammar classes instead.
 * - Declarations are capability-checked one by one: `var(--press-*)` rejects
 *   (web-runtime mechanism), color functions bake to literals, and the
 *   `flex: <n>` shorthand expands to long-form (lynx expands it RN-style,
 *   collapsing layout). `calc()` over `var()` emits verbatim — measured
 *   working on device (signalxjs/lynx#1029, iOS 18.3). `display: inline-flex`
 *   rewrites to `flex` — lynx has no inline formatting context, and an
 *   unsupported display keeps the broken default linear layout (measured,
 *   signalxjs/lynx#1075); `grid`/`inline-grid` remain unsupported AND
 *   unrewritten (no mechanical flex equivalent — daisy's toast still ships
 *   grid properties, recorded in the capability report only).
 * - `var()` chains through a CALC-HOLDING custom property are inlined at
 *   compile time by `inlineCalcChains` (see `calc-chains.ts`), or refused —
 *   lynx drops any declaration consuming `var(--x)` when `--x`'s value holds
 *   `calc()` (measured, signalxjs/lynx#1075). Plain var→var chains and
 *   descendant-from-host selectors are proven working and emit as-is.
 * - A color function over THEME variables cannot bake here, because a recipe
 *   is theme-agnostic. It is not dropped either: every theme block is a full
 *   restatement of literals, so the value is finite per theme, and the
 *   declaration is re-emitted once per theme under that theme's host class.
 *   See `emitChecked`.
 */
import type { ManifestComponent, ManifestPart } from '../../contract.js';
import { carrierPart, parseLayoutAttr } from '../../contract.js';
import type { CssProps, PartStyles, RecipeInput } from '../../recipes.js';
import { assertAxisToken, assertKeyframesName, declBlock, findPart, kebab } from '../shared.js';
import type { ChainVocabulary } from './calc-chains.js';
import { inlineCalcChains } from './calc-chains.js';
import type { LynxCapabilityReport } from './capabilities.js';
import {
    INTERACTION_STATE_CLASSES,
    bakeColorValue,
    hasComparisonFunction,
    hasUnsupportedColorFunction,
    LynxRuntimePropertyError,
    runtimePropertyIn,
} from './capabilities.js';
import { HOST_CLASS, axisClass, flagClass, layoutClass, modClass, orientationClass, partClass, placementClass, stateClass, themeClass } from './class-names.js';

/**
 * One state key resolved to the class that narrows it, `null` for a state
 * that exists on the web and has no lynx projection (`hover`), or an error
 * for a state the contract does not know at all.
 */
function stateClassFor(component: ManifestComponent, part: ManifestPart, state: string): string | null {
    // Anatomy wins over interaction states, exactly like the web emitter: a
    // part with a machine state named `active` styles `.zx-s-active`, not the
    // pressed flag.
    if (part.states?.includes(state)) return `.${stateClass(state)}`;
    if (part.flags?.includes(state)) return `.${flagClass(state)}`;
    if (state in INTERACTION_STATE_CLASSES) {
        const cls = INTERACTION_STATE_CLASSES[state];
        return cls ? `.${cls}` : null;
    }
    const known = [
        ...(part.states ?? []),
        ...(part.flags ?? []),
        ...Object.keys(INTERACTION_STATE_CLASSES),
    ].join(', ');
    throw new Error(
        `[zero-kit] recipe for "${component.scope}"."${part.name}" styles unknown state "${state}" (known: ${known})`,
    );
}

/**
 * The `selectors:` patterns the contract itself owns and the grammar can
 * therefore express: `&[data-orientation="…"]` and `&[data-placement="…"]`.
 * Everything else in the escape hatch is web spelling by definition.
 */
const CONTRACT_ATTR_PATTERN = /^&\[data-(orientation|placement)="([a-z-]+)"\]$/;

/**
 * The layout family's equivalent: `&[data-l-gap="md"]` → `.zx-l-gap-md`.
 *
 * Separate from `CONTRACT_ATTR_PATTERN` because the value alphabet differs —
 * layout values carry digits (`cols="12"`, `grow="0"`, and the `2xs` end of
 * the spacing ramp), which the orientation/placement vocabularies never do.
 * A per-breakpoint spelling has no class form and is dropped with the same
 * message the `at:` blocks get; it only reaches here if a recipe hand-wrote
 * one outside a condition, which would not have matched on the web either.
 *
 * The name may LEAD with a digit, which is why this is `[a-z0-9]` and not
 * `[a-z]`: token keys may start with one (`--text-2xl`), so a design system
 * may legitimately name a breakpoint `2xl` and spell the selector
 * `&[data-l-2xl-gap="lg"]`. Requiring a letter made that fall through to the
 * generic "not expressible" drop instead of the responsive one — the rule
 * was dropped either way, but the report told the author the wrong thing
 * about why.
 */
const LAYOUT_ATTR_SELECTOR = /^&\[(data-l-[a-z0-9][a-z0-9-]*)="([a-z0-9-]+)"\]$/;

/** `flex: <number>` — the shorthand lynx expands RN-style (grow N shrink 1 basis auto). */
const FLEX_NUMBER = /^\s*(\d+(?:\.\d+)?)\s*$/;

/**
 * The one color keyword that is a RUNTIME value, so nothing can bake it — and
 * measured NEVER resolving on device, on either platform (signalxjs/lynx#1079,
 * 0.2.0-beta.4): a declaration valued with it ships and silently paints
 * nothing (the daisy tabs border underline was transparent because of it).
 * Refused with a report entry wherever it appears, not only inside a color
 * function — the recipe's lynx section spends the same ink the element's
 * `color:` rules deliver instead.
 */
const CURRENT_COLOR = /\bcurrentcolor\b/i;

/**
 * Logical inset/margin/padding spellings — measured resolving on iOS but NOT
 * on Android (signalxjs/lynx#1084, four-bar probe against the beta.5
 * artifact; the daisy slider thumb sat off-center on Android because of
 * them). Cross-platform-asymmetric, so the target treats them as
 * unsupported: refused with a report entry wherever they appear. Physical
 * spellings (`top`, `margin-left`, …) are proven on BOTH platforms and are
 * this target's norm — lynx has no RTL flow to make the logical/physical
 * distinction meaningful (see the tabs lynx path from #381).
 */
const LOGICAL_PROPERTY = /^(?:inset|margin|padding)-(?:block|inline)(?:-(?:start|end))?$/;

/**
 * The standalone `translate`/`rotate`/`scale` properties — same #1084
 * verdict: iOS resolves them, Android does not. `transform`'s
 * `translate…()`/`rotate()`/`scale()` functions are proven on both
 * platforms, so the recipe's lynx section spells the same motion there.
 */
const STANDALONE_TRANSFORM = /^(?:translate|rotate|scale)$/;

/**
 * The same refusals for RAW CSS TEXT (keyframes bodies): a property
 * declaration in one of the refused spellings, anchored so a custom
 * property like `--tw-translate:` cannot trip it.
 */
const REFUSED_PROPERTY_IN_TEXT = /(?:^|[{;\s])(?:(?:inset|margin|padding)-(?:block|inline)(?:-(?:start|end))?|translate|rotate|scale)\s*:/i;

/** Every `var(--x)` a value reads. */
const ANY_VAR = /var\(\s*(--[A-Za-z0-9_-]+)/g;

/**
 * The first `var()` in a value that per-theme baking cannot resolve.
 *
 * A theme block defines the `--color-*` vocabulary and nothing else, so those
 * bake. A RECIPE-LOCAL property (`--slider-accent`, set by an axis rule) is
 * not in any theme's map, and its value depends on which compound matched —
 * there is no single literal to bake it to.
 */
function unbakeableVarIn(value: string): string | undefined {
    for (const match of value.matchAll(ANY_VAR)) {
        if (!match[1]!.startsWith('--color-')) return match[1];
    }
    return undefined;
}

/**
 * The result of capability-checking one declaration block: what emits as it
 * stands, and what has to be RESTATED PER THEME because its value reads theme
 * colors through a function nothing theme-agnostic can evaluate.
 */
interface CheckedProps {
    /** Emits once, on the plain selector. */
    props: CssProps;
    /** Emits once per theme, under that theme's class. Values are unbaked. */
    perTheme: CssProps;
}

/**
 * Capability-check one declaration block. Pushes report entries for what it
 * drops, throws for what the target must refuse, and defers what only a theme
 * can resolve.
 */
function checkedProps(
    props: CssProps,
    where: string,
    report: LynxCapabilityReport,
): CheckedProps {
    const out: CssProps = {};
    const perTheme: CssProps = {};
    for (const [prop, raw] of Object.entries(props)) {
        const value = String(raw);
        const runtime = runtimePropertyIn(`${prop} ${value}`);
        if (runtime) {
            throw new LynxRuntimePropertyError(
                `[zero-kit] ${where}: "${prop}" references ${runtime}, a web-runtime-published property with no lynx equivalent — move the declaration into the recipe's web target section`,
                runtime,
            );
        }
        const kebabProp = kebab(prop);
        if (LOGICAL_PROPERTY.test(kebabProp)) {
            // Logical spellings resolve on iOS but NOT on Android (measured,
            // signalxjs/lynx#1084) — the declaration would ship and lay out
            // on one platform only. Dropped; the recipe's lynx target
            // section restates the same geometry with physical spellings,
            // which are this target's norm (no RTL flow on lynx).
            report.dropped.push({
                where,
                what: `${prop}: ${value}`,
                detail: `${kebabProp} resolves on iOS but not on Android (measured, signalxjs/lynx#1084) — cross-platform-asymmetric, treated as unsupported; dropped, restate the geometry with a physical spelling (top/right/bottom/left, margin-*/padding-*) in the recipe's lynx target section`,
            });
            continue;
        }
        if (STANDALONE_TRANSFORM.test(kebabProp)) {
            // Same #1084 verdict as the logical spellings: the standalone
            // transform properties resolve on iOS only. `transform`'s
            // translate…()/rotate()/scale() functions are proven on both
            // platforms.
            report.dropped.push({
                where,
                what: `${prop}: ${value}`,
                detail: `the standalone ${kebabProp} property resolves on iOS but not on Android (measured, signalxjs/lynx#1084) — cross-platform-asymmetric, treated as unsupported; dropped, spell the motion as a transform function (${kebabProp === 'translate' ? 'transform: translateX(...) translateY(...)' : `transform: ${kebabProp}(...)`}) in the recipe's lynx target section`,
            });
            continue;
        }
        if (kebabProp === 'display' && value.trim().toLowerCase() === 'inline-flex') {
            // Lynx has no inline formatting context: `inline-flex` does not
            // resolve, and an unsupported display keeps the broken default
            // linear layout (measured, signalxjs/lynx#1075 — the daisy tabs
            // list stacked vertically). `flex` is the closest layout that
            // exists. `grid`/`inline-grid` are equally unsupported but have
            // no mechanical rewrite — they stay as authored and belong in a
            // lynx recipe target section instead.
            out[prop] = 'flex';
            report.translated.push({
                where,
                what: 'display: inline-flex',
                detail: 'rewritten to display: flex — lynx has no inline formatting context, and an unsupported display value keeps the default linear layout (signalxjs/lynx#1075)',
            });
            continue;
        }
        const flexNumber = kebabProp === 'flex' ? FLEX_NUMBER.exec(value) : null;
        if (flexNumber) {
            // `flex: <n>` means grow n / shrink 1 / basis 0% — lynx expands
            // the shorthand to `1 1 auto` instead, collapsing layouts, so the
            // long form is written for it.
            out['flexGrow'] = flexNumber[1]!;
            out['flexShrink'] = '1';
            out['flexBasis'] = '0%';
            report.translated.push({ where, what: `flex: ${value}`, detail: 'expanded to flex-grow/flex-shrink/flex-basis — lynx mis-expands the shorthand' });
            continue;
        }
        if (hasComparisonFunction(value)) {
            report.dropped.push({
                where,
                what: `${prop}: ${value}`,
                detail: 'min()/max()/clamp() are not implemented by lynx\'s engine — the declaration would be dropped on device and lay out as though never written; dropped here instead, supply a lynx replacement in the recipe target section',
            });
            continue;
        }
        if (CURRENT_COLOR.test(value)) {
            // `currentColor` is the element's own computed `color` — a
            // runtime value no compile-time pass can know, in a theme block
            // or anywhere else — and it never resolves on device: the
            // declaration ships and silently paints nothing on BOTH
            // platforms (measured, signalxjs/lynx#1079 — the daisy tabs
            // underline was transparent because of it). Dropped wherever it
            // appears, not only inside a color function.
            report.dropped.push({
                where,
                what: `${prop}: ${value}`,
                detail: 'currentColor never resolves on lynx (measured on device on both platforms, signalxjs/lynx#1079) — the declaration would ship and silently paint nothing; dropped, spend the ink the element\'s color rules deliver (a plain var() chain or a baked literal) in the recipe\'s lynx target section',
            });
            continue;
        }
        if (hasUnsupportedColorFunction(value)) {
            const unbakeable = unbakeableVarIn(value);
            if (unbakeable) {
                report.dropped.push({
                    where,
                    what: `${prop}: ${value}`,
                    detail: `a color function over ${unbakeable} cannot bake — only the theme's --color-* vocabulary has a literal per theme, and a recipe-local property's value depends on which compound matched; dropped, supply a lynx replacement in the recipe target section`,
                });
                continue;
            }
            if (value.includes('var(')) {
                // Theme-dependent paint. A recipe is theme-agnostic, so
                // nothing here can evaluate it — but every theme block is a
                // full restatement of literals, so the value is finite and
                // computable ONCE PER THEME. Deferred to the caller, which
                // owns the theme list and emits the restatements.
                perTheme[prop] = value;
                continue;
            }
            out[prop] = bakeColorValue(value, {}, 'light', where);
            continue;
        }
        out[prop] = value;
    }
    return { props: out, perTheme };
}

/**
 * One theme, reduced to what baking a recipe declaration against it needs:
 * the literal color map the tokens emitter already produced, and the scheme
 * `light-dark()` picks a side with. `isDefault` marks the theme `.zx-root`
 * carries with no theme class selected.
 */
export interface LynxThemeColors {
    name: string;
    colors: Record<string, string>;
    colorScheme: 'light' | 'dark';
    isDefault: boolean;
}

/**
 * Emit one checked declaration block: the theme-agnostic half on `selector`,
 * then one restatement per theme for whatever only a theme can resolve.
 *
 * The restatement selector is a DESCENDANT of the theme host —
 * `.zx-root.zx-theme-dark .zx-button__root` — because the host is where the
 * theme class lives and the part is somewhere below it. That is three classes
 * against the plain rule's one, so a theme always wins, and the default
 * theme's copy rides `.zx-root` alone (two classes) so an app that never
 * selects a theme still paints. Descendant and compound selectors are both
 * proven on lynx (signalxjs/lynx#1029, iOS 18.3).
 */
function emitChecked(
    selector: string,
    props: CssProps,
    where: string,
    rules: string[],
    report: LynxCapabilityReport,
    themes: readonly LynxThemeColors[],
): void {
    const checked = checkedProps(props, where, report);
    if (Object.keys(checked.props).length > 0) {
        rules.push(`${selector} {\n${declBlock(checked.props, '    ', where)}\n}`);
    }
    if (Object.keys(checked.perTheme).length === 0) return;
    if (themes.length === 0) {
        // No theme list to bake against — the pre-theming caller. Report the
        // loss rather than emit a reference to a value that never lands.
        for (const [prop, value] of Object.entries(checked.perTheme)) {
            report.dropped.push({
                where,
                what: `${prop}: ${String(value)}`,
                detail: 'a color function over theme variables needs the theme list to bake against, and none was supplied — dropped',
            });
        }
        return;
    }
    for (const theme of themes) {
        const scoped: CssProps = {};
        for (const [prop, value] of Object.entries(checked.perTheme)) {
            scoped[prop] = bakeColorValue(
                String(value),
                theme.colors,
                theme.colorScheme,
                `${where} (theme "${theme.name}")`,
            );
        }
        const host = theme.isDefault ? `.${HOST_CLASS}` : `.${HOST_CLASS}.${themeClass(theme.name)}`;
        rules.push(`${host} ${selector} {\n${declBlock(scoped, '    ', where)}\n}`);
    }
}

/**
 * Emit one part's styles as flat class-compound rules. `extraClasses` carries
 * the axis/modifier compound for variant emissions — attached to the part
 * class itself per the push-down contract.
 */
function emitPartStyles(
    component: ManifestComponent,
    partName: string,
    styles: PartStyles,
    extraClasses: string,
    rules: string[],
    report: LynxCapabilityReport,
    themes: readonly LynxThemeColors[],
): void {
    const part = findPart(component, partName);
    const where = `lynx recipe for "${component.scope}"."${partName}"`;
    const base = `.${partClass(component.scope, partName)}${extraClasses}`;
    const rule = (selector: string, props: CssProps) => {
        emitChecked(selector, props, where, rules, report, themes);
    };

    if (styles.base && Object.keys(styles.base).length > 0) {
        rule(base, styles.base);
    }
    for (const [state, props] of Object.entries(styles.states ?? {})) {
        if (Object.keys(props).length === 0) continue;
        const cls = stateClassFor(component, part, state);
        if (cls === null) {
            report.dropped.push({
                where,
                what: `states.${state}`,
                detail: 'no hover on a touch platform — dropped; press styling flows through the pressed flag instead',
            });
            continue;
        }
        rule(`${base}${cls}`, props);
    }
    for (const [nested, props] of Object.entries(styles.selectors ?? {})) {
        if (Object.keys(props).length === 0) continue;
        const contractAttr = CONTRACT_ATTR_PATTERN.exec(nested);
        if (contractAttr) {
            const cls = contractAttr[1] === 'orientation'
                ? orientationClass(contractAttr[2]!)
                : placementClass(contractAttr[2]!);
            rule(`${base}.${cls}`, props);
            continue;
        }
        const layoutAttr = LAYOUT_ATTR_SELECTOR.exec(nested);
        if (layoutAttr) {
            const parsed = parseLayoutAttr(layoutAttr[1]!);
            if (parsed && parsed.breakpoint === undefined) {
                rule(`${base}.${layoutClass(parsed.attr, layoutAttr[2]!)}`, props);
                continue;
            }
            report.dropped.push({
                where,
                what: `selectors["${nested}"]`,
                detail: parsed
                    ? 'a per-breakpoint layout value has no class form — responsive styling is runtime JS on lynx'
                    : 'not a declared layout attribute — dropped',
            });
            continue;
        }
        report.dropped.push({
            where,
            what: `selectors["${nested}"]`,
            detail: 'not expressible in the class grammar — dropped; supply a lynx replacement in the recipe target section',
        });
    }
    for (const [key] of Object.entries(styles.at ?? {})) {
        report.dropped.push({
            where,
            what: `at["${key}"]`,
            detail: 'conditional rules (@media/@supports/breakpoints) are not emitted on this target — responsive styling is runtime JS on lynx',
        });
    }
}

/** Compile one recipe to lynx class-grammar CSS. */
export function compileLynxRecipeCss(
    recipe: RecipeInput,
    component: ManifestComponent,
    report: LynxCapabilityReport,
    themes: readonly LynxThemeColors[] = [],
): string {
    if (recipe.component !== component.scope) {
        throw new Error(
            `[zero-kit] recipe component "${recipe.component}" does not match anatomy scope "${component.scope}"`,
        );
    }
    const rules: string[] = [];
    const scope = component.scope;

    if (recipe.tokens && Object.keys(recipe.tokens).length > 0) {
        const where = `lynx recipe for "${scope}" tokens`;
        emitChecked(
            `.${partClass(scope, carrierPart(component))}`,
            recipe.tokens,
            where,
            rules,
            report,
            themes,
        );
    }

    for (const [partName, styles] of Object.entries(recipe.parts)) {
        emitPartStyles(component, partName, styles, '', rules, report, themes);
    }

    for (const [axis, values] of Object.entries(recipe.variants ?? {})) {
        assertAxisToken('axis', axis, scope);
        for (const [value, parts] of Object.entries(values)) {
            const compound = `.${axisClass(axis, assertAxisToken('value', value, scope))}`;
            for (const [partName, styles] of Object.entries(parts)) {
                // No `:not()` default twin: the runtime always stamps a
                // concrete axis class, explicit or default.
                emitPartStyles(component, partName, styles, compound, rules, report, themes);
            }
        }
    }

    for (const [name, parts] of Object.entries(recipe.modifiers ?? {})) {
        const compound = `.${modClass(assertAxisToken('modifier', name, scope))}`;
        for (const [partName, styles] of Object.entries(parts)) {
            emitPartStyles(component, partName, styles, compound, rules, report, themes);
        }
    }

    for (const compoundVariant of recipe.compoundVariants ?? []) {
        // A conjunction is just a longer compound. The web's defaulted-value
        // alternative (`:not([attr])`) has no counterpart here — the runtime
        // stamps the default's concrete class, so the explicit compound
        // already matches.
        const compound = Object.entries(compoundVariant.match)
            .map(([axis, value]) => value === true
                ? `.${modClass(assertAxisToken('modifier', axis, scope))}`
                : `.${axisClass(axis, assertAxisToken('value', value, scope))}`)
            .join('');
        for (const [partName, styles] of Object.entries(compoundVariant.parts)) {
            emitPartStyles(component, partName, styles, compound, rules, report, themes);
        }
    }

    // Inline (or refuse) every calc-holding custom-property chain before the
    // rules become text — lynx drops any declaration consuming var(--x) when
    // --x's value holds calc() (signalxjs/lynx#1075). Raw lynx css and
    // keyframes bodies are not rewritten, only scanned, so a consumer hiding
    // there refuses instead of dangling.
    const vocabulary: ChainVocabulary = {
        axes: [...new Set([
            ...Object.keys(recipe.variants ?? {}),
            ...(recipe.compoundVariants ?? []).flatMap((cv) => Object.entries(cv.match).filter(([, v]) => v !== true).map(([axis]) => axis)),
        ])],
        modifiers: [...new Set([
            ...Object.keys(recipe.modifiers ?? {}),
            ...(recipe.compoundVariants ?? []).flatMap((cv) => Object.entries(cv.match).filter(([, v]) => v === true).map(([name]) => name)),
        ])],
    };
    const externalCss = [recipe.css ?? '', ...Object.values(recipe.keyframes ?? {})].join('\n');
    const inlined = inlineCalcChains(scope, rules, vocabulary, report, externalCss);

    // By the time this emitter runs, `resolveRecipeForTarget('lynx')` has
    // already withheld any SHARED `css` (web spelling by definition; the
    // compile records the drop) — a `css` here came from `targets.lynx.css`
    // and is lynx-authored by construction, so it appends verbatim, except
    // for the one mechanical fix the declaration path also applies: an
    // `inline-flex` display would keep the broken default linear layout on
    // device (signalxjs/lynx#1075), so it rewrites to `flex` here too.
    let css = inlined.length > 0 ? `${inlined.join('\n\n')}\n` : '';
    if (recipe.css?.trim()) {
        const rewritten = recipe.css.trim().replace(/(\bdisplay\s*:\s*)inline-flex\b/gi, (_whole, head: string) => {
            report.translated.push({
                where: `lynx recipe for "${scope}" css (raw stylesheet escape hatch)`,
                what: 'display: inline-flex',
                detail: 'rewritten to display: flex — lynx has no inline formatting context, and an unsupported display value keeps the default linear layout (signalxjs/lynx#1075)',
            });
            return `${head}flex`;
        });
        css += `${rewritten}\n`;
    }
    for (const [name, body] of Object.entries(recipe.keyframes ?? {})) {
        assertKeyframesName(name, scope);
        // Keyframes bodies are raw strings, so they get the same capability
        // checks the declaration path applies — a runtime-property reference
        // rejects and a var-free color function bakes. The per-theme
        // restatement the declaration path uses has no counterpart here: a
        // keyframes block is not selector-scoped, so theme-dependent paint
        // inside one would need a whole animation per theme AND a per-theme
        // `animation-name`. That stays dropped, and the report says why.
        const where = `lynx recipe for "${scope}" keyframes "${name}"`;
        const runtime = runtimePropertyIn(body);
        if (runtime) {
            throw new LynxRuntimePropertyError(
                `[zero-kit] ${where}: references ${runtime}, a web-runtime-published property with no lynx equivalent — move the keyframes into the recipe's web target section`,
                runtime,
            );
        }
        if (CURRENT_COLOR.test(body)) {
            // Same verdict as the declaration path: currentColor never
            // resolves on device (signalxjs/lynx#1079), so an animation
            // painting with it would silently render nothing.
            report.dropped.push({
                where,
                what: `keyframes ${name}`,
                detail: 'the animation paints with currentColor, which never resolves on lynx (measured, signalxjs/lynx#1079) — dropped; supply a lynx replacement in the recipe target section',
            });
            continue;
        }
        if (REFUSED_PROPERTY_IN_TEXT.test(body)) {
            // Same verdict as the declaration path: logical spellings and the
            // standalone translate/rotate/scale properties resolve on iOS but
            // not on Android (signalxjs/lynx#1084) — an animation moving one
            // of them would play on one platform only.
            report.dropped.push({
                where,
                what: `keyframes ${name}`,
                detail: 'the animation declares a logical inset/margin/padding spelling or a standalone translate/rotate/scale property, which resolve on iOS but not on Android (measured, signalxjs/lynx#1084) — dropped; supply a lynx replacement animating physical spellings or transform functions in the recipe\'s targets.lynx.keyframes',
            });
            continue;
        }
        const baked = hasUnsupportedColorFunction(body) && !body.includes('var(')
            ? bakeColorValue(body, {}, 'light', where)
            : body;
        if (hasUnsupportedColorFunction(baked)) {
            report.dropped.push({
                where,
                what: `keyframes ${name}`,
                detail: 'a keyframes block is not selector-scoped, so a color function over theme variables cannot be restated per theme the way a declaration can — the animation is dropped; supply a lynx replacement in the recipe target section',
            });
            continue;
        }
        css += `@keyframes ${name} {\n    ${baked.trim()}\n}\n`;
    }
    return css;
}
