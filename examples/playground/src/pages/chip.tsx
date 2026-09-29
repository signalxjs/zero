import { component, signal } from 'sigx';
import { Chip, ChipGroup, type PartProps } from '@sigx/zero';
import { pickRole, pickScopeVariant } from '../design-systems';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const PEOPLE = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson', 'Margaret Hamilton'];

const ChipDemos = component(() => {
    const state = signal({
        filters: ['open'] as string[],
        sort: 'newest',
        people: [...PEOPLE],
        shared: 0,
        starred: false,
    });

    return () => {
        const elevated = pickScopeVariant('chip', 'elevated');
        return (
            <>
                <p>
                    A chip is some mix of three behaviours: an action, a selection
                    (<code>selectable</code>, <code>aria-pressed</code>,{' '}
                    <code>on|off</code>) and a removal (<code>removable</code>, a
                    trailing <code>Chip.Remove</code> and Backspace/Delete). A{' '}
                    <code>ChipGroup</code> keeps one tab stop and roves with the
                    arrow keys.
                </p>

                <h3>Action (assist)</h3>
                <DemoRow gap="0.5rem">
                    <ChipGroup.Root label="Actions">
                        <Chip.Root value="share">
                            <Chip.Action onClick={() => { state.shared++; }}>
                                <Chip.Icon>↗</Chip.Icon><Chip.Label>Share</Chip.Label>
                            </Chip.Action>
                        </Chip.Root>
                        <Chip.Root value="calendar">
                            <Chip.Action><Chip.Icon>▦</Chip.Icon><Chip.Label>Add to calendar</Chip.Label></Chip.Action>
                        </Chip.Root>
                        <Chip.Root value="docs">
                            <Chip.Action asChild>{(p: PartProps) => <a href="#/chip" {...p}>Open docs</a>}</Chip.Action>
                        </Chip.Root>
                        <Chip.Root value="offline" disabled>
                            <Chip.Action>Offline</Chip.Action>
                        </Chip.Root>
                    </ChipGroup.Root>
                </DemoRow>
                <p data-testid="chip-shared">Shared {state.shared} times</p>

                <h3>Filter (selectable, multiple)</h3>
                <DemoRow gap="0.5rem">
                    <ChipGroup.Root label="Filters" selectable multiple name="filter" model={() => state.filters}>
                        <Chip.Root value="open"><Chip.Action>Open</Chip.Action></Chip.Root>
                        <Chip.Root value="mine"><Chip.Action><Chip.Icon>★</Chip.Icon><Chip.Label>Assigned to me</Chip.Label></Chip.Action></Chip.Root>
                        <Chip.Root value="old" disabled><Chip.Action>Archived</Chip.Action></Chip.Root>
                        <Chip.Root value="bugs"><Chip.Action>Bugs</Chip.Action></Chip.Root>
                    </ChipGroup.Root>
                </DemoRow>
                <p data-testid="chip-filters">Filters: {state.filters.join(', ') || 'none'}</p>

                <h3>Choice (selectable, single)</h3>
                <DemoRow gap="0.5rem">
                    <ChipGroup.Root label="Sort" selectable deselectable={false} color={pickRole('tertiary')} model={() => state.sort}>
                        <Chip.Root value="newest"><Chip.Action>Newest</Chip.Action></Chip.Root>
                        <Chip.Root value="oldest"><Chip.Action>Oldest</Chip.Action></Chip.Root>
                        <Chip.Root value="popular"><Chip.Action>Most popular</Chip.Action></Chip.Root>
                    </ChipGroup.Root>
                </DemoRow>
                <p data-testid="chip-sort">Sort: {state.sort}</p>

                <h3>Input (removable)</h3>
                <DemoRow gap="0.5rem">
                    <ChipGroup.Root label="Recipients">
                        {state.people.map((name) => (
                            <Chip.Root
                                key={name}
                                value={name}
                                removable
                                onRemove={() => { state.people = state.people.filter((p) => p !== name); }}
                            >
                                <Chip.Action><Chip.Label>{name}</Chip.Label></Chip.Action>
                                <Chip.Remove />
                            </Chip.Root>
                        ))}
                    </ChipGroup.Root>
                </DemoRow>
                <p data-testid="chip-people">Recipients: {state.people.length}</p>
                <button type="button" onClick={() => { state.people = [...PEOPLE]; }}>Reset recipients</button>

                <h3>Standalone</h3>
                <DemoRow gap="0.5rem">
                    <Chip.Root selectable model={() => state.starred}>
                        <Chip.Action><Chip.Icon>☆</Chip.Icon><Chip.Label>Starred</Chip.Label></Chip.Action>
                    </Chip.Root>
                    <Chip.Root color={pickRole('success')} selectable defaultSelected>
                        <Chip.Action>Verified</Chip.Action>
                    </Chip.Root>
                    <Chip.Root selectable removable defaultSelected>
                        <Chip.Action>Selected and removable</Chip.Action>
                        <Chip.Remove />
                    </Chip.Root>
                    {elevated
                        ? (
                            <>
                                <Chip.Root variant={elevated}>
                                    <Chip.Action><Chip.Icon>✦</Chip.Icon><Chip.Label>Elevated</Chip.Label></Chip.Action>
                                </Chip.Root>
                                <Chip.Root variant={elevated} selectable defaultSelected>
                                    <Chip.Action>Elevated, selected</Chip.Action>
                                </Chip.Root>
                            </>
                        )
                        : null}
                </DemoRow>
            </>
        );
    };
}, { name: 'ChipDemos' });

export const chipPage: PageEntry = {
    id: 'chip',
    title: 'Chip',
    category: 'Actions',
    Demos: ChipDemos,
};
