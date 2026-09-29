import { component } from 'sigx';
import { Badge, Button, Col, Combobox, Field, Popover, Row, Select, Switch } from '@sigx/zero';
import { Icon } from '@sigx/zero-mail-kit';
import { ALL_CONTACTS } from '../data/mock';
import { searching, st } from '../store';

const activeFilters = (): number => {
    const f = st.filters;
    return (f.from ? 1 : 0) + (f.attachments ? 1 : 0) + (f.unread ? 1 : 0) + (f.range !== 'any' ? 1 : 0);
};

export const SearchFilters = component(() => {
    const reset = (): void => {
        st.filters = { from: '', attachments: false, unread: false, range: 'any' };
    };
    return () => (
        <Popover.Root placement="bottom-end" model={() => st.filtersOpen}>
            <Popover.Trigger variant={activeFilters() > 0 ? 'soft' : 'ghost'} size="sm" aria-label="Search filters">
                <Icon name="filter" />
                {activeFilters() > 0 ? <Badge size="xs" color="primary">{activeFilters()}</Badge> : null}
            </Popover.Trigger>
            <Popover.Popup>
                <Popover.Title>Filter messages</Popover.Title>
                <Col gap="md">
                    <Field.Root>
                        <Field.Label>From</Field.Label>
                        <Combobox.Root filterItems model={() => st.filters.from} placeholder="Anyone" clearable openOnClick>
                            <Combobox.Control>
                                <Combobox.Input />
                                <Combobox.ClearTrigger label="Clear sender" />
                                <Combobox.Trigger label="Show senders" />
                            </Combobox.Control>
                            <Combobox.Popup>
                                {ALL_CONTACTS.map((c) => (
                                    <Combobox.Item key={c.email} value={c.email} textValue={c.name}>{c.name}</Combobox.Item>
                                ))}
                                <Combobox.Empty>No one by that name</Combobox.Empty>
                            </Combobox.Popup>
                        </Combobox.Root>
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>Date</Field.Label>
                        <Select.Root model={() => st.filters.range}>
                            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                            <Select.Popup>
                                <Select.Item value="any">Any time</Select.Item>
                                <Select.Item value="week">Past week</Select.Item>
                                <Select.Item value="month">Past month</Select.Item>
                                <Select.Item value="year">Past year</Select.Item>
                            </Select.Popup>
                        </Select.Root>
                    </Field.Root>
                    <Switch.Root model={() => st.filters.attachments}>Has attachments</Switch.Root>
                    <Switch.Root model={() => st.filters.unread}>Unread only</Switch.Root>
                    <Row gap="sm" justify="end">
                        <Button.Root variant="ghost" size="sm" disabled={!searching()} onClick={() => { reset(); st.query = ''; }}>
                            Reset
                        </Button.Root>
                        <Button.Root size="sm" onClick={() => { st.filtersOpen = false; }}>Done</Button.Root>
                    </Row>
                </Col>
            </Popover.Popup>
        </Popover.Root>
    );
}, { name: 'SearchFilters' });
