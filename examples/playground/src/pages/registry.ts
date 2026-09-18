/**
 * The page registry — the single source the sidebar, the router and the
 * kitchen-sink `#/all` route all derive from. Registry order is sidebar order
 * within a category; `categories` is the display order of the groups.
 *
 * A page's `id` doubles as its route segment and its stable handle in the e2e
 * suite (`page.goto('/#/<id>')` in `e2e/nav.ts`) — renaming one is a spec
 * change and should be treated like renaming a demo label.
 */
import type { AnyComponentFactory } from 'sigx';

import { buttonPage } from './button';
import { togglePage } from './toggle';
import { toggleGroupPage } from './toggle-group';
import { swapPage } from './swap';
import { fieldPage } from './field';
import { formsPage } from './forms';
import { inputPage } from './input';
import { textareaPage } from './textarea';
import { fileUploadPage } from './file-upload';
import { checkboxPage } from './checkbox';
import { switchPage } from './switch';
import { radioGroupPage } from './radio-group';
import { selectPage } from './select';
import { comboboxPage } from './combobox';
import { numberInputPage } from './number-input';
import { sliderPage } from './slider';
import { ratingGroupPage } from './rating-group';
import { dialogPage } from './dialog';
import { drawerPage } from './drawer';
import { popoverPage } from './popover';
import { tooltipPage } from './tooltip';
import { menuPage } from './menu';
import { toastPage } from './toast';
import { tabsPage } from './tabs';
import { accordionPage } from './accordion';
import { collapsiblePage } from './collapsible';
import { treeViewPage } from './tree-view';
import { avatarPage } from './avatar';
import { cardPage, alertPage, badgePage, dividerPage } from './content-tier';
import { skeletonPage, spinnerPage } from './loading';
import { kbdPage } from './kbd';
import { statusPage } from './status';
import { indicatorPage } from './indicator';
import { statsPage } from './stats';
import { tablePage } from './table';
import { carouselPage } from './carousel';
import { countdownPage } from './countdown';
import { diffPage } from './diff';
import { timelinePage } from './timeline';
import { chatPage } from './chat';
import { radialProgressPage } from './radial-progress';
import { joinPage } from './join';
import { navbarPage } from './navbar';
import { breadcrumbsPage } from './breadcrumbs';
import { paginationPage } from './pagination';
import { stepsPage } from './steps';
import { progressPage } from './progress';
import { sizeRampPage } from './size-ramp';
import { extensibleRolesPage } from './extensible-roles';
import { extensibleAxesPage } from './extensible-axes';
import { aboutPage } from './about';
import { layoutPage } from './layout';

export type Category =
    | 'Actions'
    | 'Forms & inputs'
    | 'Overlays'
    | 'Navigation & structure'
    | 'Display & feedback'
    | 'Layout'
    | 'Concepts';

export interface PageEntry {
    /** Route segment (`#/<id>`) AND the e2e suite's stable handle. */
    id: string;
    /** Sidebar text and page heading. */
    title: string;
    category: Category;
    /** The demo content only — page chrome (heading) is the shell's. */
    Demos: AnyComponentFactory;
}

export const categories: Category[] = [
    'Actions',
    'Forms & inputs',
    'Overlays',
    'Navigation & structure',
    'Layout',
    'Display & feedback',
    'Concepts',
];

export const pages: PageEntry[] = [
    layoutPage,
    buttonPage,
    togglePage,
    toggleGroupPage,
    swapPage,
    joinPage,
    fieldPage,
    formsPage,
    inputPage,
    textareaPage,
    fileUploadPage,
    checkboxPage,
    switchPage,
    radioGroupPage,
    selectPage,
    comboboxPage,
    numberInputPage,
    sliderPage,
    ratingGroupPage,
    dialogPage,
    drawerPage,
    popoverPage,
    tooltipPage,
    menuPage,
    toastPage,
    tabsPage,
    accordionPage,
    collapsiblePage,
    treeViewPage,
    navbarPage,
    breadcrumbsPage,
    paginationPage,
    stepsPage,
    avatarPage,
    cardPage,
    alertPage,
    badgePage,
    dividerPage,
    skeletonPage,
    spinnerPage,
    kbdPage,
    statusPage,
    indicatorPage,
    statsPage,
    tablePage,
    carouselPage,
    countdownPage,
    diffPage,
    timelinePage,
    chatPage,
    progressPage,
    radialProgressPage,
    sizeRampPage,
    extensibleRolesPage,
    extensibleAxesPage,
    aboutPage,
];
