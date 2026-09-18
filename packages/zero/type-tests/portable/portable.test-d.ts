/**
 * The portable-surface gate: this project compiles with `lib: ["ES2022"]` —
 * no DOM types exist here. Every import below is a module the Lynx runtime
 * (or any non-DOM platform) consumes, so a DOM global or DOM type leaking
 * into one of their graphs fails this compile, not a downstream consumer.
 *
 * Every import goes through a REAL export subpath (via the paths map that
 * mirrors them), so the gate covers the entrypoints a consumer actually
 * resolves — `@sigx/zero/contract/core` is the DOM-free contract surface,
 * beside `behaviors/core`, `theme/registry` and `anatomy`. The one exception
 * is `testing/expect-anatomy-core.js`: its public barrel (`./testing`) also
 * exports the DOM wrapper, so the rules module is imported directly.
 */
import {
    createControllableState,
    segmentBy,
    createId,
    createListController,
    moveHighlight,
    sortByDomOrder,
    type ItemElement,
    type ListController,
    type ListItem,
} from '@sigx/zero/behaviors/core';
import { listThemes, pickThemeFor, registerThemes } from '@sigx/zero/theme/registry';
import { anatomies, type ZeroScope } from '@sigx/zero/anatomy';
import {
    CLASS_GRAMMAR_VERSION,
    HOST_CLASS,
    axisClass,
    flagClass,
    modClass,
    orientationClass,
    partClass,
    placementClass,
    stateClass,
    themeClass,
    variantAttrs,
    MOD_ATTR_PREFIX,
    RESERVED_AXES,
    VARIANT_AXES,
    FLAG_VOCABULARY,
    PLACEMENT_VOCABULARY,
    STATE_NAMES,
    dataAttr,
    stateAttr,
    TOKEN_CATEGORIES,
    resolveColorToken,
    tokenProperty,
} from '@sigx/zero/contract/core';
import { expectAnatomyElements, type ElementLike } from '../../src/testing/expect-anatomy-core.js';

// ---- class grammar ---------------------------------------------------------

const version: number = CLASS_GRAMMAR_VERSION;
const classes: string[] = [
    HOST_CLASS,
    partClass('tabs', 'tab'),
    stateClass('active'),
    flagClass('disabled'),
    axisClass('size', 'xs'),
    modClass('block'),
    orientationClass('vertical'),
    placementClass('top-start'),
    themeClass('dark'),
];

// ---- variant pass-through --------------------------------------------------

const attrs: Record<string, string | undefined> = variantAttrs({
    color: 'primary',
    size: 'md',
    axes: { density: 'compact' },
    mods: { block: true },
});
const reserved: boolean = RESERVED_AXES.has('state');
const prefix: string = MOD_ATTR_PREFIX;
const named: Record<string, string> = VARIANT_AXES;

// ---- vocabularies ----------------------------------------------------------

const flags: readonly string[] = FLAG_VOCABULARY;
const placements: readonly string[] = PLACEMENT_VOCABULARY;
const isState: boolean = STATE_NAMES.has('open');
const disabledAttr: '' | undefined = dataAttr(true);
const state: 'open' | 'closed' = stateAttr(true, 'open', 'closed');
const categories: number = TOKEN_CATEGORIES.length;
const colorVar: string = resolveColorToken('primary');
const radius = TOKEN_CATEGORIES.find((c) => c.id === 'radius')!;
const prop: string = tokenProperty(radius, 'field');

// ---- anatomies -------------------------------------------------------------

const scopes: ZeroScope[] = Object.keys(anatomies) as ZeroScope[];
const switchParts: string[] = Object.keys(anatomies.switch.parts);

// ---- behaviors/core --------------------------------------------------------

const controllable = createControllableState<boolean>(() => undefined, false, () => {});
const flip: boolean = !controllable.value;

const list: ListController = createListController();
const item: ListItem = {
    id: createId('zx-probe'),
    value: 'a',
    disabled: () => false,
    // The non-DOM mode: never hand the controller an element, take the
    // registration-order fallback.
    el: () => null,
    textValue: () => 'A',
};
const unregister: () => void = list.register(item);
unregister();
moveHighlight(list, { value: null }, 'first');
const ordered: ListItem[] = sortByDomOrder(list.items());

// A structural element satisfies ItemElement without lib.dom.
const fakeEl: ItemElement = { isConnected: true, compareDocumentPosition: () => 4 };

const segments = segmentBy([{ value: 'a' }, { value: 'b', label: 'B' }], () => undefined);

// ---- theme registry --------------------------------------------------------

registerThemes({
    themes: { probe: { colorScheme: 'light', colors: { primary: '#123456' } } },
    defaultLight: 'probe',
});
const picked: string | undefined = pickThemeFor('light');
const count: number = listThemes().length;

// ---- anatomy oracle (rules only) -------------------------------------------

const el: ElementLike = {
    getAttribute: (name) => (name === 'data-part' ? 'root' : name === 'data-scope' ? 'switch' : null),
    getAttributeNames: () => ['data-scope', 'data-part'],
    parent: () => null,
};
expectAnatomyElements([el], anatomies.switch);

// Keep every probe value alive so noUnusedLocals never prunes the evidence.
export const probe = {
    version, classes, attrs, reserved, prefix, named, flags, placements, isState,
    disabledAttr, state, categories, colorVar, prop, scopes, switchParts, flip,
    ordered, fakeEl, segments, picked, count,
};
