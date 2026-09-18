import { component } from 'sigx';
import { Breadcrumbs } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const BreadcrumbsDemos = component(() => () => (
    <>
        <p>
            The APG breadcrumb pattern: a <code>&lt;nav&gt;</code> landmark
            named <em>Breadcrumb</em> around an <code>&lt;ol&gt;</code> —
            order is the meaning. The current page's link carries{' '}
            <code>aria-current="page"</code> and the activation state; the
            separator is <code>aria-hidden</code> punctuation with a
            replaceable glyph.
        </p>
        <Breadcrumbs.Root>
            <Breadcrumbs.List>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs">Home</Breadcrumbs.Link>
                    <Breadcrumbs.Separator />
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs">Components</Breadcrumbs.Link>
                    <Breadcrumbs.Separator />
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs" current>Breadcrumbs</Breadcrumbs.Link>
                </Breadcrumbs.Item>
            </Breadcrumbs.List>
        </Breadcrumbs.Root>
        <p>A custom separator glyph, and a coloured current page:</p>
        <Breadcrumbs.Root color={pickRole('primary')}>
            <Breadcrumbs.List>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs">Library</Breadcrumbs.Link>
                    <Breadcrumbs.Separator>›</Breadcrumbs.Separator>
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs">Data</Breadcrumbs.Link>
                    <Breadcrumbs.Separator>›</Breadcrumbs.Separator>
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs" current>Add data source</Breadcrumbs.Link>
                </Breadcrumbs.Item>
            </Breadcrumbs.List>
        </Breadcrumbs.Root>
        <p>Small, for dense chrome:</p>
        <Breadcrumbs.Root size="sm" label="Secondary breadcrumb">
            <Breadcrumbs.List>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs">Settings</Breadcrumbs.Link>
                    <Breadcrumbs.Separator />
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="#/breadcrumbs" current>Billing</Breadcrumbs.Link>
                </Breadcrumbs.Item>
            </Breadcrumbs.List>
        </Breadcrumbs.Root>
    </>
), { name: 'BreadcrumbsDemos' });

export const breadcrumbsPage: PageEntry = {
    id: 'breadcrumbs',
    title: 'Breadcrumbs',
    category: 'Navigation & structure',
    Demos: BreadcrumbsDemos,
};
