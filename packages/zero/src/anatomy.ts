/**
 * The anatomy registry — every component's machine-readable anatomy,
 * importable WITHOUT pulling any component code. This is what build
 * tooling, the recipe compiler and AI design-system generators consume;
 * `manifest.json` is generated from it.
 */
export { defineAnatomy } from './contract/anatomy.js';
export type { Anatomy, AnatomyJSON, PartSpec, PartJSON, TokenHint, ModelSpec, ModelJSON } from './contract/anatomy.js';

import type { Anatomy } from './contract/anatomy.js';
import { tabsAnatomy } from './components/tabs/anatomy.js';
import { collapsibleAnatomy } from './components/collapsible/anatomy.js';
import { switchAnatomy } from './components/switch/anatomy.js';
import { dialogAnatomy } from './components/dialog/anatomy.js';
import { popoverAnatomy } from './components/popover/anatomy.js';
import { tooltipAnatomy } from './components/tooltip/anatomy.js';
import { menuAnatomy } from './components/menu/anatomy.js';
import { fieldAnatomy } from './components/field/anatomy.js';
import { checkboxAnatomy } from './components/checkbox/anatomy.js';
import { radioGroupAnatomy } from './components/radio-group/anatomy.js';
import { progressAnatomy } from './components/progress/anatomy.js';
import { sliderAnatomy } from './components/slider/anatomy.js';
import { accordionAnatomy } from './components/accordion/anatomy.js';
import { buttonAnatomy } from './components/button/anatomy.js';
import { selectAnatomy } from './components/select/anatomy.js';
import { avatarAnatomy } from './components/avatar/anatomy.js';
import { toastAnatomy } from './components/toast/anatomy.js';
import { comboboxAnatomy } from './components/combobox/anatomy.js';
import { toggleAnatomy } from './components/toggle/anatomy.js';
import { toggleGroupAnatomy } from './components/toggle-group/anatomy.js';
import { numberInputAnatomy } from './components/number-input/anatomy.js';
import { ratingGroupAnatomy } from './components/rating-group/anatomy.js';
import { treeViewAnatomy } from './components/tree-view/anatomy.js';
import { inputAnatomy } from './components/input/anatomy.js';
import { textareaAnatomy } from './components/textarea/anatomy.js';
import { cardAnatomy } from './components/card/anatomy.js';
import { alertAnatomy } from './components/alert/anatomy.js';
import { badgeAnatomy } from './components/badge/anatomy.js';
import { dividerAnatomy } from './components/divider/anatomy.js';
import { skeletonAnatomy } from './components/skeleton/anatomy.js';
import { stackAnatomy } from './components/stack/anatomy.js';
import { spacerAnatomy } from './components/spacer/anatomy.js';
import { gridAnatomy } from './components/grid/anatomy.js';
import { centerAnatomy } from './components/center/anatomy.js';
import { boxAnatomy } from './components/box/anatomy.js';
import { containerAnatomy } from './components/container/anatomy.js';
import { spinnerAnatomy } from './components/spinner/anatomy.js';
import { kbdAnatomy } from './components/kbd/anatomy.js';
import { statusAnatomy } from './components/status/anatomy.js';
import { indicatorAnatomy } from './components/indicator/anatomy.js';
import { statsAnatomy } from './components/stats/anatomy.js';
import { timelineAnatomy } from './components/timeline/anatomy.js';
import { chatAnatomy } from './components/chat/anatomy.js';
import { radialProgressAnatomy } from './components/radial-progress/anatomy.js';
import { joinAnatomy } from './components/join/anatomy.js';
import { navbarAnatomy } from './components/navbar/anatomy.js';
import { breadcrumbsAnatomy } from './components/breadcrumbs/anatomy.js';
import { paginationAnatomy } from './components/pagination/anatomy.js';
import { stepsAnatomy } from './components/steps/anatomy.js';
import { drawerAnatomy } from './components/drawer/anatomy.js';
import { tableAnatomy } from './components/table/anatomy.js';
import { fileUploadAnatomy } from './components/file-upload/anatomy.js';
import { carouselAnatomy } from './components/carousel/anatomy.js';
import { swapAnatomy } from './components/swap/anatomy.js';
import { countdownAnatomy } from './components/countdown/anatomy.js';
import { diffAnatomy } from './components/diff/anatomy.js';

export {
    buttonAnatomy,
    tabsAnatomy, collapsibleAnatomy, switchAnatomy, dialogAnatomy, popoverAnatomy, tooltipAnatomy, menuAnatomy,
    fieldAnatomy, checkboxAnatomy, radioGroupAnatomy, progressAnatomy, sliderAnatomy, accordionAnatomy, selectAnatomy,
    avatarAnatomy, toastAnatomy, comboboxAnatomy, toggleAnatomy, toggleGroupAnatomy, numberInputAnatomy,
    ratingGroupAnatomy, treeViewAnatomy, inputAnatomy, textareaAnatomy,
    cardAnatomy, alertAnatomy, badgeAnatomy, dividerAnatomy, skeletonAnatomy, spinnerAnatomy,
    stackAnatomy, spacerAnatomy, gridAnatomy, centerAnatomy, boxAnatomy, containerAnatomy,
    kbdAnatomy, statusAnatomy, indicatorAnatomy, statsAnatomy, timelineAnatomy, chatAnatomy,
    radialProgressAnatomy, joinAnatomy,
    navbarAnatomy, breadcrumbsAnatomy, paginationAnatomy, stepsAnatomy, drawerAnatomy,
    tableAnatomy, fileUploadAnatomy, carouselAnatomy, swapAnatomy, countdownAnatomy, diffAnatomy,
};

export const anatomies = {
    button: buttonAnatomy,
    tabs: tabsAnatomy,
    collapsible: collapsibleAnatomy,
    switch: switchAnatomy,
    dialog: dialogAnatomy,
    popover: popoverAnatomy,
    tooltip: tooltipAnatomy,
    menu: menuAnatomy,
    field: fieldAnatomy,
    checkbox: checkboxAnatomy,
    'radio-group': radioGroupAnatomy,
    progress: progressAnatomy,
    slider: sliderAnatomy,
    accordion: accordionAnatomy,
    select: selectAnatomy,
    avatar: avatarAnatomy,
    toast: toastAnatomy,
    combobox: comboboxAnatomy,
    toggle: toggleAnatomy,
    'toggle-group': toggleGroupAnatomy,
    'number-input': numberInputAnatomy,
    'rating-group': ratingGroupAnatomy,
    'tree-view': treeViewAnatomy,
    input: inputAnatomy,
    textarea: textareaAnatomy,
    card: cardAnatomy,
    alert: alertAnatomy,
    badge: badgeAnatomy,
    divider: dividerAnatomy,
    skeleton: skeletonAnatomy,
    stack: stackAnatomy,
    spacer: spacerAnatomy,
    grid: gridAnatomy,
    center: centerAnatomy,
    box: boxAnatomy,
    container: containerAnatomy,
    spinner: spinnerAnatomy,
    kbd: kbdAnatomy,
    status: statusAnatomy,
    indicator: indicatorAnatomy,
    stats: statsAnatomy,
    timeline: timelineAnatomy,
    chat: chatAnatomy,
    'radial-progress': radialProgressAnatomy,
    join: joinAnatomy,
    navbar: navbarAnatomy,
    breadcrumbs: breadcrumbsAnatomy,
    pagination: paginationAnatomy,
    steps: stepsAnatomy,
    drawer: drawerAnatomy,
    table: tableAnatomy,
    'file-upload': fileUploadAnatomy,
    carousel: carouselAnatomy,
    swap: swapAnatomy,
    countdown: countdownAnatomy,
    diff: diffAnatomy,
} as const satisfies Record<string, Anatomy>;

/**
 * The registry with its literal keys — `as const satisfies` rather than a
 * `Record` annotation, which would erase the key set this type exists to
 * carry.
 */
export type ZeroAnatomies = typeof anatomies;

/**
 * Every component scope, as a closed literal union. A generated
 * `register.d.ts` asserts its `components` keys against this, so a typo'd or
 * version-skewed scope fails to compile instead of silently taking the open
 * fallback (see docs/architecture.md, "The register artifact").
 */
export type ZeroScope = keyof ZeroAnatomies & string;
