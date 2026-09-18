import { component } from 'sigx';
import { Button, Input, Join } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const JoinDemos = component(() => () => (
    <>
        <p>
            Visual grouping that collapses the radii of adjacent children into
            one segmented shape. Pure CSS composition — zero renders attribute
            carriers, the design system squares the inner corners and folds
            the doubled seam into one border. The corner rules land on the
            item <em>and</em> its direct child, so wrapping a zero Button
            works, and <code>asChild</code> puts the item attributes straight
            on a raw control.
        </p>
        <DemoRow align="center">
            <Join.Root>
                <Join.Item><Button>Years</Button></Join.Item>
                <Join.Item><Button>Months</Button></Join.Item>
                <Join.Item><Button>Days</Button></Join.Item>
            </Join.Root>
        </DemoRow>
        <DemoRow align="center">
            <Join.Root>
                <Join.Item>
                    <Input.Root name="join-search">
                        <Input.Label>Search the docs</Input.Label>
                        <Input.Control>
                            <Input.Input placeholder="Search…" />
                        </Input.Control>
                    </Input.Root>
                </Join.Item>
                <Join.Item><Button color={pickRole('primary')}>Go</Button></Join.Item>
            </Join.Root>
        </DemoRow>
        <p>Vertical, the stacked form:</p>
        <div style="max-width: 16rem; display: grid; justify-items: start">
            <Join.Root orientation="vertical">
                <Join.Item><Button>Duplicate</Button></Join.Item>
                <Join.Item><Button>Rename</Button></Join.Item>
                <Join.Item><Button>Delete</Button></Join.Item>
            </Join.Root>
        </div>
    </>
), { name: 'JoinDemos' });

export const joinPage: PageEntry = {
    id: 'join',
    title: 'Join',
    category: 'Actions',
    Demos: JoinDemos,
};
